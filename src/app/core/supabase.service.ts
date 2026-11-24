import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient;
  readonly configured: boolean;
  readonly configError: string;

  constructor() {
    const env = (globalThis as any).__env ?? {};
    const url = String(env.SUPABASE_URL ?? '').trim();
    const key = String(env.SUPABASE_ANON_KEY ?? '').trim();
    const placeholder = !url || !key || /your-project|replace-with|placeholder/i.test(url + ' ' + key);
    this.configured = !placeholder;
    this.configError = placeholder
      ? 'Supabase is not configured. Open public/env.js and replace SUPABASE_URL and SUPABASE_ANON_KEY with your project values, then restart the app.'
      : '';
    this.client = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder-key');
  }

  async session() { return (await this.client.auth.getSession()).data.session; }

  async bearerHeaders(): Promise<Record<string, string>> {
    const session = await this.session();
    return session ? { Authorization: `Bearer ${session.access_token}` } : {};
  }
}
