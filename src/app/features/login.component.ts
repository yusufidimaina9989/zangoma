import { Component, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { SupabaseService } from '../core/supabase.service';
import { ToastService } from '../shared/toast.service';

@Component({ standalone: true, imports: [ReactiveFormsModule], template: `
<div class="login-shell">
  <section class="login-hero">
    <div style="display:flex;align-items:center;gap:14px">
      <span class="brand-mark">LVM</span>
      <div>
        <div style="font-weight:800;letter-spacing:.16em;font-size:11px;color:#bcd8c9">YOBE STATE</div>
        <div style="font-size:13px;color:#d9ebe2">Livestock Market Registry</div>
      </div>
    </div>
    <div>
      <h2>Digital receipts.<br>Real accountability.</h2>
      <p>Register livestock sales, capture buyer and seller photographs, mark identifying features and resolve disputes from your phone.</p>
    </div>
    <div class="animal-hero" aria-hidden="true">
      <span class="animal-float">🐪</span>
      <span class="animal-float">🫏</span>
      <span class="animal-float">🐴</span>
    </div>
  </section>

  <main class="login-main">
    <form [formGroup]="form" (ngSubmit)="submit()" class="card w-full max-w-md">
      <h1 class="text-2xl font-bold text-charcoal">Welcome back</h1>
      <p class="muted mt-1">Sign in to your account</p>

      @if (configWarning) { <div class="alert-warn mt-5">{{ configWarning }}</div> }
      @if (error()) { <div class="alert-error mt-5">{{ error() }}</div> }

      <label class="field mt-6">Email
        <input type="email" formControlName="email" autocomplete="email" placeholder="you@market.local" />
      </label>

      <label class="field mt-4">Password
        <span class="input-wrap">
          <input
            [type]="showPassword() ? 'text' : 'password'"
            formControlName="password"
            autocomplete="current-password"
            placeholder="Enter your password" />
          <button
            type="button"
            class="toggle-password"
            (click)="showPassword.set(!showPassword())"
            [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
            @if (showPassword()) {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 3l18 18" />
                <path d="M10.6 6.2A10.8 10.8 0 0 1 12 6c7 0 11 6 11 6a19.6 19.6 0 0 1-3.3 4.1" />
                <path d="M6.6 6.7C3.6 8.6 1 12 1 12a19.7 19.7 0 0 0 5.3 5.4" />
                <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
              </svg>
            } @else {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            }
          </button>
        </span>
      </label>

      <button class="btn-primary w-full mt-6" [disabled]="busy() || form.invalid">
        @if (busy()) { <span class="spinner"></span> }
        {{ busy() ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
  </main>
</div>` })
export class LoginComponent {
  form: ReturnType<FormBuilder['group']>;
  busy = signal(false);
  error = signal('');
  showPassword = signal(false);
  readonly configWarning: string;

  constructor(
    fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private toast: ToastService,
    supabase: SupabaseService,
  ) {
    this.configWarning = supabase.configured ? '' : supabase.configError;
    this.form = fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  async submit() {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.signIn(this.form.value.email!, this.form.value.password!);
      this.toast.success('Signed in successfully');
      await this.router.navigate(['/dashboard']);
    } catch (e: any) {
      const message = e?.message || 'Sign in failed';
      this.error.set(message);
      this.toast.error(message, 'Sign in failed');
    } finally {
      this.busy.set(false);
    }
  }
}

