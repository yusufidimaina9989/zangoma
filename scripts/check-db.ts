/**
 * Database readiness check.
 *
 *   npm run db:check            # read-only checks
 *   npm run db:check -- --smoke # also create + delete a test transaction to
 *                               # verify the C-/DK-/H- receipt series
 *
 * Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env (never printed).
 */
import { existsSync, readFileSync } from 'node:fs';

function loadDotEnv() {
  for (const file of ['.env', '.env.local']) {
    if (!existsSync(file)) continue;
    const content = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const separator = line.indexOf('=');
      if (separator < 0) continue;
      const key = line.slice(0, separator).replace(/^export\s+/, '').trim();
      let value = line.slice(separator + 1).trim().replace(/[,;]+$/, '').trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && !(key in process.env)) process.env[key] = value;
    }
  }
}

let failures = 0;
function ok(passed: boolean, label: string, detail = '') {
  if (!passed) failures++;
  const icon = passed ? 'PASS' : 'FAIL';
  console.log(`[${icon}] ${label}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  loadDotEnv();
  const url = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const call = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${url}${path}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    return { status: response.status, body };
  };

  console.log('\nDatabase check\n--------------');

  const profiles = await call('/rest/v1/profiles?select=id,role,is_active&limit=5');
  ok(profiles.status === 200, 'profiles table reachable with service role', `HTTP ${profiles.status}`);
  const rows: any[] = Array.isArray(profiles.body) ? profiles.body : [];
  ok(rows.length > 0, 'at least one profile exists', `${rows.length} row(s)`);
  ok(rows.some(row => row.role === 'admin'), 'an admin profile exists');
  ok(rows.some(row => row.role === 'collector'), 'a collector profile exists');

  const transactions = await call('/rest/v1/transactions?select=receipt_number&order=created_at.desc&limit=3');
  ok(transactions.status === 200, 'transactions table reachable', `HTTP ${transactions.status}`);
  const recent: any[] = Array.isArray(transactions.body) ? transactions.body : [];
  ok(
    recent.every(row => /^[A-Z]{1,2}-\d{4,}$/.test(String(row.receipt_number))),
    'receipt numbers use the per-animal series',
    recent.length ? recent.map(row => row.receipt_number).join(', ') : 'no transactions yet',
  );

  const collector = rows.find(row => row.role === 'collector') ?? rows[0];
  if (collector) {
    const probe = await call('/rest/v1/rpc/create_livestock_transaction', {
      method: 'POST',
      body: JSON.stringify({ p_payload: { collector_id: collector.id, animal_type: 'invalid_probe' } }),
    });
    const message = String(probe.body?.message ?? '');
    const stale = /unauthorized collector/i.test(message);
    ok(
      !stale,
      'RPC accepts the server-supplied collector id',
      stale
        ? 'STALE FUNCTION — run supabase/migrations/202611240007_receipt_codes.sql in the Supabase SQL editor'
        : 'ok (probe rejected the invalid animal type, as expected)',
    );
  }

  if (process.argv.includes('--smoke') && collector) {
    const suffix = Date.now();
    const created = await call('/rest/v1/rpc/create_livestock_transaction', {
      method: 'POST',
      body: JSON.stringify({
        p_payload: {
          collector_id: collector.id,
          transaction_date: new Date().toISOString().slice(0, 10),
          transaction_time: '09:00',
          animal_type: 'donkey',
          animal_sex: 'unknown',
          seller_name: `Smoke Test Seller ${suffix}`,
          buyer_name: `Smoke Test Buyer ${suffix}`,
        },
      }),
    });
    const receipt = created.body?.receipt_number;
    ok(created.status === 200 && !!receipt, 'smoke transaction created', String(receipt ?? created.body?.message ?? ''));
    if (receipt) ok(/^DK-\d{4,}$/.test(receipt), 'donkey receipt uses the DK series', receipt);
    if (created.body?.id) {
      await call(`/rest/v1/transactions?id=eq.${created.body.id}`, { method: 'DELETE' });
      console.log('       (smoke transaction removed)');
    }
  }

  console.log(
    failures === 0
      ? '\nAll checks passed.\n'
      : `\n${failures} check(s) failed. Fix the FAIL lines above.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(error => {
  console.error(error?.message ?? error);
  process.exit(1);
});
