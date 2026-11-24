import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly profile = signal<any>(null);
  readonly loading = signal(true);

  constructor(private supabase: SupabaseService, private router: Router) {
    this.restore();
    this.supabase.client.auth.onAuthStateChange(() => this.restore());
  }

  async restore() {
    this.loading.set(true);
    if (!this.supabase.configured) { this.profile.set(null); this.loading.set(false); return; }
    try {
      const session = await this.supabase.session();
      if (!session) { this.profile.set(null); this.loading.set(false); return; }
      const { data } = await this.supabase.client.from('profiles').select('*').eq('auth_user_id', session.user.id).maybeSingle();
      this.profile.set(data?.is_active ? data : null);
    } catch {
      this.profile.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  async signIn(email: string, password: string) {
    if (!this.supabase.configured) throw new Error(this.supabase.configError);
    let result: Awaited<ReturnType<typeof this.supabase.client.auth.signInWithPassword>>;
    try {
      result = await this.supabase.client.auth.signInWithPassword({ email, password });
    } catch {
      throw new Error('Could not reach Supabase. Check your connection and the SUPABASE_URL in public/env.js.');
    }
    if (result.error) {
      throw new Error(
        /fetch|network/i.test(result.error.message)
          ? 'Could not reach Supabase. Verify SUPABASE_URL and SUPABASE_ANON_KEY in public/env.js.'
          : result.error.message,
      );
    }
    await this.restore();
    if (!this.profile()) throw new Error('This account is inactive or has no application profile.');
  }

  async signOut() {
    await this.supabase.client.auth.signOut();
    this.profile.set(null);
    await this.router.navigate(['/login']);
  }
}
