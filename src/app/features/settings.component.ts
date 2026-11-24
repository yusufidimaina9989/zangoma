import { Component, OnInit, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { SupabaseService } from '../core/supabase.service';
import { AuthService } from '../core/auth.service';
import { ToastService } from '../shared/toast.service';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const next = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return !next || !confirm || next === confirm ? null : { mismatch: true };
}

@Component({ standalone: true, imports: [ReactiveFormsModule], template: `
<div class="page-header">
  <div><p class="eyebrow">Account</p><h1>Settings</h1></div>
</div>

<div class="grid-admin">
  <section class="card">
    <h2>Change password</h2>
    <p class="muted" style="margin-top:-8px">Signed in as <strong>{{ email() || '…' }}</strong></p>

    <form [formGroup]="passwordForm" (ngSubmit)="changePassword()">
      <label class="field">Current password
        <span class="input-wrap">
          <input [type]="showCurrent() ? 'text' : 'password'" formControlName="currentPassword" autocomplete="current-password" />
          <button type="button" class="toggle-password" (click)="showCurrent.set(!showCurrent())"
                  [attr.aria-label]="showCurrent() ? 'Hide password' : 'Show password'">
            @if (showCurrent()) {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 3l18 18"/><path d="M10.6 6.2A10.8 10.8 0 0 1 12 6c7 0 11 6 11 6a19.6 19.6 0 0 1-3.3 4.1"/>
                <path d="M6.6 6.7C3.6 8.6 1 12 1 12a19.7 19.7 0 0 0 5.3 5.4"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>
              </svg>
            } @else {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            }
          </button>
        </span>
      </label>

      <label class="field mt-3">New password
        <span class="input-wrap">
          <input [type]="showNew() ? 'text' : 'password'" formControlName="newPassword" autocomplete="new-password" placeholder="At least 8 characters" />
          <button type="button" class="toggle-password" (click)="showNew.set(!showNew())"
                  [attr.aria-label]="showNew() ? 'Hide password' : 'Show password'">
            @if (showNew()) {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 3l18 18"/><path d="M10.6 6.2A10.8 10.8 0 0 1 12 6c7 0 11 6 11 6a19.6 19.6 0 0 1-3.3 4.1"/>
                <path d="M6.6 6.7C3.6 8.6 1 12 1 12a19.7 19.7 0 0 0 5.3 5.4"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>
              </svg>
            } @else {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            }
          </button>
        </span>
      </label>

      <label class="field mt-3">Confirm new password
        <span class="input-wrap">
          <input [type]="showConfirm() ? 'text' : 'password'" formControlName="confirmPassword" autocomplete="new-password" />
          <button type="button" class="toggle-password" (click)="showConfirm.set(!showConfirm())"
                  [attr.aria-label]="showConfirm() ? 'Hide password' : 'Show password'">
            @if (showConfirm()) {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 3l18 18"/><path d="M10.6 6.2A10.8 10.8 0 0 1 12 6c7 0 11 6 11 6a19.6 19.6 0 0 1-3.3 4.1"/>
                <path d="M6.6 6.7C3.6 8.6 1 12 1 12a19.7 19.7 0 0 0 5.3 5.4"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>
              </svg>
            } @else {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            }
          </button>
        </span>
      </label>

      @if (passwordForm.errors?.['mismatch'] && passwordForm.get('confirmPassword')?.touched) {
        <p class="field-error">The new passwords do not match.</p>
      }

      <button class="btn-primary mt-4" [disabled]="passwordForm.invalid || busyPassword()">
        @if (busyPassword()) { <span class="spinner"></span> }Update password
      </button>
    </form>
  </section>

  @if (isAdmin()) {
    <section class="card">
      <h2>Market &amp; receipt branding</h2>
      <p class="muted" style="margin-top:-8px">Shown at the top of every printed receipt and QR verification page.</p>
      <form [formGroup]="brandingForm" (ngSubmit)="saveBranding()">
        <div class="form-grid">
          <label class="field">Market name<input formControlName="market_name" placeholder="Damaturu Livestock Market"></label>
          <label class="field">Location<input formControlName="market_location" placeholder="Along Potiskum Road"></label>
          <label class="field">District<input formControlName="district"></label>
          <label class="field">Local government<input formControlName="local_government"></label>
          <label class="field">State<input formControlName="state"></label>
          <label class="field">Contact information<input formControlName="contact_information" placeholder="Phone or email"></label>
        </div>
        <div class="mt-4" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <button class="btn-primary" [disabled]="busyBranding()">@if (busyBranding()) { <span class="spinner"></span> }Save branding</button>
          <span class="animal-tag">Receipt series are fixed per animal: C · DK · H</span>
        </div>
      </form>
    </section>
  } @else {
    <section class="card">
      <h2>Your account</h2>
      <div class="detail-grid">
        <div><span class="label">Name</span><strong>{{ profile()?.full_name }}</strong></div>
        <div><span class="label">Role</span><strong class="capitalize">{{ profile()?.role }}</strong></div>
        <div><span class="label">Phone</span><strong>{{ profile()?.phone || '—' }}</strong></div>
      </div>
      <p class="muted mt-4">Need your login changed? Ask the market administrator to update your details.</p>
    </section>
  }
</div>` })
export class SettingsComponent implements OnInit {
  brandingForm: ReturnType<FormBuilder['group']>;
  passwordForm: ReturnType<FormBuilder['group']>;

  busyBranding = signal(false);
  busyPassword = signal(false);
  showCurrent = signal(false);
  showNew = signal(false);
  showConfirm = signal(false);
  email = signal('');

  constructor(
    fb: FormBuilder,
    private db: SupabaseService,
    private auth: AuthService,
    private toast: ToastService,
  ) {
    this.brandingForm = fb.group({
      market_name: [''],
      market_location: [''],
      district: [''],
      local_government: [''],
      state: ['Yobe State'],
      contact_information: [''],
    });

    this.passwordForm = fb.group(
      {
        currentPassword: ['', Validators.required],
        newPassword: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required],
      },
      { validators: passwordsMatch },
    );
  }

  isAdmin() {
    return this.auth.profile()?.role === 'admin';
  }

  profile() {
    return this.auth.profile();
  }

  async ngOnInit() {
    const { data } = await this.db.client.auth.getUser();
    this.email.set(data.user?.email ?? '');

    if (!this.isAdmin()) return;
    const { data: settings } = await this.db.client.from('market_settings').select('*').eq('id', 1).maybeSingle();
    if (settings) this.brandingForm.patchValue(settings);
  }

  async changePassword() {
    if (this.passwordForm.invalid || this.busyPassword()) {
      this.passwordForm.markAllAsTouched();
      if (this.passwordForm.errors?.['mismatch']) this.toast.error('The new passwords do not match.', 'Check your input');
      return;
    }

    const { currentPassword, newPassword } = this.passwordForm.value;
    if (currentPassword === newPassword) {
      this.toast.warning('Choose a password different from the current one.');
      return;
    }

    this.busyPassword.set(true);
    try {
      const email = this.email();
      if (!email) throw new Error('Could not determine your login email. Sign out and sign in again.');

      // Re-authenticate first so a borrowed session cannot silently change the password.
      const verify = await this.db.client.auth.signInWithPassword({ email, password: currentPassword });
      if (verify.error) throw new Error('Current password is incorrect.');

      const update = await this.db.client.auth.updateUser({ password: newPassword });
      if (update.error) throw new Error(update.error.message);

      this.passwordForm.reset();
      this.toast.success('Your password has been updated. Use it the next time you sign in.', 'Password changed');
    } catch (e: any) {
      this.toast.error(e.message || 'Could not change password', 'Password update failed');
    } finally {
      this.busyPassword.set(false);
    }
  }

  async saveBranding() {
    if (this.busyBranding()) return;
    this.busyBranding.set(true);
    try {
      const { error } = await this.db.client
        .from('market_settings')
        .update({ ...this.brandingForm.value, updated_at: new Date().toISOString() })
        .eq('id', 1);
      if (error) throw error;
      this.toast.success('Receipt branding updated', 'Settings saved');
    } catch (e: any) {
      this.toast.error(e.message || 'Could not save settings', 'Save failed');
    } finally {
      this.busyBranding.set(false);
    }
  }
}