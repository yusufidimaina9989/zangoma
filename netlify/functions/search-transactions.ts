import type { Handler } from '@netlify/functions';
import { json, requireUser } from './_lib/shared';

const clean = (value: string) => value.replace(/[,()%]/g, ' ').trim();

export const handler: Handler = async event => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  try {
    const { supabase, profile } = await requireUser(event, ['admin', 'collector']);
    const params = event.queryStringParameters || {};
    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.min(5000, Math.max(1, Number(params.limit || 20)));

    let query = supabase
      .from('transactions')
      .select(
        '*, middlemen(full_name), collector:profiles(full_name), animal_identifications(left_side_image_path,right_side_image_path,left_side_description,right_side_description)',
        { count: 'exact' },
      );

    if (profile.role !== 'admin') query = query.eq('collector_id', profile.id);

    const q = clean(params.q || '');
    if (q) {
      const [middlemen, collectors] = await Promise.all([
        supabase.from('middlemen').select('id').ilike('full_name', `%${q}%`).limit(50),
        supabase.from('profiles').select('id').ilike('full_name', `%${q}%`).limit(50),
      ]);
      const ors = [
        `receipt_number.ilike.%${q}%`,
        `seller_name.ilike.%${q}%`,
        `buyer_name.ilike.%${q}%`,
        `seller_phone.ilike.%${q}%`,
        `buyer_phone.ilike.%${q}%`,
      ];
      const middlemanIds = (middlemen.data || []).map((row: any) => row.id);
      const collectorIds = (collectors.data || []).map((row: any) => row.id);
      if (middlemanIds.length) ors.push(`middleman_id.in.(${middlemanIds.join(',')})`);
      if (collectorIds.length) ors.push(`collector_id.in.(${collectorIds.join(',')})`);
      query = query.or(ors.join(','));
    }

    if (params.receipt) query = query.ilike('receipt_number', `%${clean(params.receipt)}%`);
    if (params.seller) query = query.ilike('seller_name', `%${clean(params.seller)}%`);
    if (params.buyer) query = query.ilike('buyer_name', `%${clean(params.buyer)}%`);
    if (params.middleman_id) query = query.eq('middleman_id', params.middleman_id);
    if (params.collector_id) query = query.eq('collector_id', params.collector_id);
    if (params.animal_type) query = query.eq('animal_type', params.animal_type);
    if (params.status) query = query.eq('status', params.status);
    if (params.from) query = query.gte('transaction_date', params.from);
    if (params.to) query = query.lte('transaction_date', params.to);

    const sort = ['created_at', 'transaction_date', 'receipt_number'].includes(params.sort || '') ? params.sort! : 'created_at';
    const ascending = params.order === 'asc';
    const { data, count, error } = await query.order(sort, { ascending }).range((page - 1) * limit, page * limit - 1);
    if (error) return json(400, { error: error.message });
    return json(200, { data: data || [], count: count || 0, page, limit, pages: Math.max(1, Math.ceil((count || 0) / limit)) });
  } catch (error: any) {
    return json(error.statusCode || 500, { error: error.message || 'Server error' });
  }
};
