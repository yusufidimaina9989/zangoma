import type { Handler } from '@netlify/functions';
import { json, requireUser } from './_lib/shared';

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { supabase, profile } = await requireUser(event, ['admin']);
    const body = JSON.parse(event.body || '{}');
    if (!body.transaction_id || !body.reason?.trim()) return json(400, { error: 'Transaction ID and void reason are required' });
    const { data: oldRow, error: readError } = await supabase.from('transactions').select('*').eq('id', body.transaction_id).single();
    if (readError) return json(404, { error: 'Transaction not found' });
    const { error } = await supabase.from('transactions').update({ status: 'voided', voided_at: new Date().toISOString(), void_reason: body.reason.trim(), updated_at: new Date().toISOString() }).eq('id', body.transaction_id);
    if (error) return json(400, { error: error.message });
    await supabase.from('audit_logs').insert({ actor_id: profile.id, action: 'TRANSACTION_VOIDED', entity_type: 'transaction', entity_id: body.transaction_id, old_values: oldRow, new_values: { status: 'voided', void_reason: body.reason.trim() } });
    return json(200, { success: true });
  } catch (error: any) { return json(error.statusCode || 500, { error: error.message || 'Server error' }); }
};
