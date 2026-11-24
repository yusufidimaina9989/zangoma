/**
 * Creates (or repairs) the initial administrator account.
 *
 * Requires server-only credentials in the environment (never commit them):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npm run admin:create -- --email admin@market.local --password "StrongPass123" --name "Market Administrator"
 *
 * You can also set ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME in .env instead of passing arguments.
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';

/**
 * Minimal .env loader so `tsx scripts/create-admin.ts` behaves like Netlify.
 * Tolerates quoted values and accidental trailing commas/semicolons.
 */
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
      let value = line.slice(separator + 1).trim();
      value = value.replace(/[,;]+$/, '').trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && !(key in process.env)) process.env[key] = value;
    }
  }
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  loadDotEnv();

  const url = (process.env.SUPABASE_URL ?? '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  const email = (arg('email') ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = arg('password') ?? process.env.ADMIN_PASSWORD ?? '';
  const fullName = arg('name') ?? process.env.ADMIN_NAME ?? 'Market Administrator';

  if (!url || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env (or your shell environment).');
    process.exit(1);
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    console.error(`SUPABASE_URL looks invalid: "${url}". Expected https://<project-ref>.supabase.co`);
    process.exit(1);
  }
  if (!/^sb_(secret|service_role)_/i.test(serviceKey) && !serviceKey.startsWith('eyJ')) {
    console.error('SUPABASE_SERVICE_ROLE_KEY does not look like a service-role/secret key.');
    process.exit(1);
  }
  if (!email || !password) {
    console.error('Provide --email and --password (or ADMIN_EMAIL / ADMIN_PASSWORD).');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let userId: string | undefined;
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (created?.user) {
    userId = created.user.id;
    console.log(`Auth user created: ${email}`);
  } else {
    const message = createError?.message ?? 'Unknown auth error';
    if (!/already|registered|exists/i.test(message)) {
      console.error(`Could not create auth user: ${message}`);
      process.exit(1);
    }

    const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
      console.error(`Could not look up existing user: ${listError.message}`);
      process.exit(1);
    }
    const existing = listed.users.find(user => user.email?.toLowerCase() === email);
    if (!existing) {
      console.error('User reported as existing but was not found in the user list.');
      process.exit(1);
    }
    userId = existing.id;

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true });
    if (updateError) {
      console.error(`Could not reset the existing password: ${updateError.message}`);
      process.exit(1);
    }
    console.log(`Existing auth user reused and password reset: ${email}`);
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      { auth_user_id: userId, full_name: fullName, role: 'admin', is_active: true },
      { onConflict: 'auth_user_id' },
    );

  if (profileError) {
    console.error(`Auth user exists but the profile could not be saved: ${profileError.message}`);
    process.exit(1);
  }

  console.log('');
  console.log('Administrator ready.');
  console.log(`  Email:    ${email}`);
  console.log('  Password: (the value you supplied)');
  console.log('  Role:     admin');
  console.log('Log in with these credentials after starting the app.');
}

main().catch(error => {
  console.error(error?.message ?? error);
  process.exit(1);
});
