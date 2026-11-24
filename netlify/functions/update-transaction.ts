import type { Handler } from '@netlify/functions';
import { json, requireUser } from './_lib/shared';

export const handler: Handler = async event => {
  if (event.httpMethod !== 'PUT' && event.httpMethod !== 'PATCH') return json(405, { error: 'Method not allowed' });
  try {
    const { supabase, profile } = await requireUser(event, ['admin']);
    const body = JSON.parse(event.body || '{}');
    if (!body.transaction_id) return json(400, { error: 'Transaction ID is required' });
    const { data: oldRow } = await supabase.from('transactions').select('*').eq('id', body.transaction_id).single();
    if (!oldRow) return json(404, { error: 'Transaction not found' });
    delete body.transaction_id;
    delete body.receipt_number;
    delete body.sequence_number;
    delete body.collector_id;
    const { error } = await supabase.from('transactions').update({ ...body, updated_at: new Date().toISOString() }).eq('id', oldRow.id);
    if (error) return json(400, { error: error.message });
    await supabase.from('audit_logs').insert({ actor_id: profile.id, action: 'TRANSACTION_UPDATED', entity_type: 'transaction', entity_id: oldRow.id, old_values: oldRow, new_values: body });
    return json(200, { success: true });
  } catch (error: any) { return json(error.statusCode || 500, { error: error.message || 'Server error' }); }
};
