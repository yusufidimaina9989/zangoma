import type { Handler } from '@netlify/functions';
import { json, requireUser, adminClient } from './_lib/shared';

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { supabase, profile } = await requireUser(event, ['admin']);
    const body = JSON.parse(event.body || '{}');
    if (!body.email || !body.full_name || !body.password) return json(400, { error: 'Email, full name and password are required' });
    const admin = adminClient();

    let photoPath: string | null = null;
    const photo = typeof body.photo_data_url === 'string' ? body.photo_data_url : '';
    if (photo) {
      const match = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i.exec(photo);
      if (!match) return json(400, { error: 'Unsupported photo format' });
      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.length > 400 * 1024) return json(400, { error: 'Collector photo must be under 400 KB after compression' });
      const path = `collectors/${crypto.randomUUID()}/photo.jpg`;
      const upload = await admin.storage
        .from('livestock-private')
        .upload(path, buffer, { contentType: 'image/jpeg', upsert: false });
      if (upload.error) return json(400, { error: upload.error.message });
      photoPath = path;
    }

    const created = await admin.auth.admin.createUser({ email: body.email.trim(), password: body.password, email_confirm: true, user_metadata: { full_name: body.full_name } });
    if (created.error) return json(400, { error: created.error.message });
    const { data: appProfile, error } = await supabase.from('profiles').insert({ auth_user_id: created.data.user.id, full_name: body.full_name.trim(), phone: body.phone || null, address: body.address || null, photo_path: photoPath, role: 'collector', is_active: true }).select().single();
    if (error) { await admin.auth.admin.deleteUser(created.data.user.id); return json(400, { error: error.message }); }
    await supabase.from('audit_logs').insert({ actor_id: profile.id, action: 'COLLECTOR_CREATED', entity_type: 'profile', entity_id: appProfile.id, new_values: { full_name: appProfile.full_name, phone: appProfile.phone } });
    return json(201, appProfile);
  } catch (error: any) { return json(error.statusCode || 500, { error: error.message || 'Server error' }); }
};
