import type { Handler } from '@netlify/functions';
import { json, requireUser } from './_lib/shared';

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { supabase, profile } = await requireUser(event, ['admin','collector']);
    const payload = JSON.parse(event.body || '{}');
    const required = ['transaction_date','transaction_time','animal_type','seller_name','buyer_name'];
    for (const field of required) if (!payload[field]) return json(400, { error: `Missing required field: ${field}` });
    if (!['camel','donkey','horse'].includes(payload.animal_type)) return json(400, { error: 'Invalid animal type' });
    // The RPC runs with the service-role key, which has no end-user JWT, so
    // auth.uid() is NULL inside it. Derive the collector server-side instead of
    // trusting anything the browser sent.
    payload.collector_id = profile.id;
    const { data, error } = await supabase.rpc('create_livestock_transaction', { p_payload: payload });
    if (error) {
      const message = /unauthorized collector/i.test(error.message)
        ? 'Your database is running an outdated transaction function. Run supabase/migrations/202611240007_receipt_codes.sql in the Supabase SQL editor, then retry.'
        : error.message;
      return json(400, { error: message });
    }
    return json(201, data);
  } catch (error: any) { return json(error.statusCode || 500, { error: error.message || 'Server error' }); }
};
