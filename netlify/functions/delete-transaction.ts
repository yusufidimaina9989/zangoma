import type { Handler } from '@netlify/functions';
import { json, requireUser } from './_lib/shared';

/**
 * Admin-only permanent deletion.
 * - the full row is copied into audit_logs before removal
 * - animal_identifications rows cascade with the transaction
 * - private storage objects are removed on a best-effort basis
 */
export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { supabase, profile } = await requireUser(event, ['admin']);
    const body = JSON.parse(event.body || '{}');
    const transactionId = body.transaction_id;
    if (!transactionId) return json(400, { error: 'transaction_id is required' });

    const { data: row, error: readError } = await supabase
      .from('transactions')
      .select('*, animal_identifications(*)')
      .eq('id', transactionId)
      .maybeSingle();

    if (readError) return json(400, { error: readError.message });
    if (!row) return json(404, { error: 'Transaction not found' });

    const { error: deleteError } = await supabase.from('transactions').delete().eq('id', transactionId);
    if (deleteError) return json(400, { error: deleteError.message });

    // Audit after a successful delete so a failure cannot leave a false record.
    const { error: auditError } = await supabase.from('audit_logs').insert({
      actor_id: profile.id,
      action: 'TRANSACTION_DELETED',
      entity_type: 'transaction',
      entity_id: row.id,
      old_values: row,
      new_values: null,
    });

    const paths = [
      row.seller_photo_path,
      row.buyer_photo_path,
      row.animal_identifications?.left_side_image_path,
      row.animal_identifications?.right_side_image_path,
    ].filter((path): path is string => Boolean(path));

    if (paths.length) {
      await supabase.storage.from('livestock-private').remove(paths).catch(() => null);
    }

    return json(200, {
      success: true,
      deleted: row.receipt_number,
      warning: auditError ? `Deleted, but the audit entry could not be written: ${auditError.message}` : undefined,
    });
  } catch (error: any) {
    return json(error.statusCode || 500, { error: error.message || 'Server error' });
  }
};
