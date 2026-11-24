import type { Handler } from '@netlify/functions';
import { json, requireUser } from './_lib/shared';

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { supabase } = await requireUser(event, ['admin','collector']);
    const body = JSON.parse(event.body || '{}');
    if (!Array.isArray(body.paths) || body.paths.length > 10) return json(400, { error: 'Provide up to 10 image paths' });
    const expiresIn = 300;
    const signed: Record<string,string> = {};
    for (const path of body.paths) {
      if (typeof path !== 'string') continue;
      const { data, error } = await supabase.storage.from('livestock-private').createSignedUrl(path, expiresIn);
      if (!error && data?.signedUrl) signed[path] = data.signedUrl;
    }
    return json(200, { signed, expiresIn });
  } catch (error: any) { return json(error.statusCode || 500, { error: error.message || 'Server error' }); }
};
