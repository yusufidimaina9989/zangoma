import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client. Never import this file from Angular code.
 * Kept in a subfolder so Netlify does not expose it as an HTTP endpoint.
 */
export function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server environment variables are not configured');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function requireUser(event: any, allowedRoles: string[] = []) {
  const token =
    event.headers.authorization?.replace(/^Bearer\s+/i, '') ||
    event.headers.Authorization?.replace(/^Bearer\s+/i, '');
  if (!token) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });

  const supabase = adminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('id,role,is_active')
    .eq('auth_user_id', data.user.id)
    .maybeSingle();

  if (!profile?.is_active) throw Object.assign(new Error('Inactive account'), { statusCode: 403 });
  if (allowedRoles.length && !allowedRoles.includes(profile.role)) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  }
  return { supabase, user: data.user, profile };
}

export function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}
