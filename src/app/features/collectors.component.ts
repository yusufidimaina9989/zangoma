import { Component, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { SupabaseService } from '../core/supabase.service';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ToastService } from '../shared/toast.service';
import { compressImage } from '../shared/image.util';

@Component({ standalone:true, imports:[ReactiveFormsModule], template:`
<div class="page-header">
  <div><p class="eyebrow">Administration</p><h1>Data Collectors</h1></div>
  <span class="muted">{{ rows().length }} account(s)</span>
</div>
<div class="grid-admin">
  <section class="card">
    <h2>Create collector account</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <label class="field">Full name<input formControlName="full_name" placeholder="e.g. Bukar Modu"></label>
      <label class="field mt-3">Login email<input type="email" formControlName="email" placeholder="collector@market.local"></label>
      <label class="field mt-3">Phone<input formControlName="phone" placeholder="080..."></label>
      <label class="field mt-3">Temporary password
        <span class="input-wrap">
          <input [type]="showPassword() ? 'text' : 'password'" formControlName="password" placeholder="At least 8 characters" />
          <button type="button" class="toggle-password" (click)="showPassword.set(!showPassword())"
                  [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
            @if (showPassword()) {
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
      <div class="field mt-3">
        <span>Collector photo (optional)</span>
        <label class="photo-field">
          <input type="file" accept="image/*" capture="environment" (change)="onPhoto($event)">
          <span>{{ photoLabel() }}</span>
        </label>
        @if (photoPreview()) {
          <img class="preview" [src]="photoPreview()" alt="Collector photo preview">
        }
      </div>

      <button class="btn-primary w-full mt-4" [disabled]="form.invalid || busy()">
        @if (busy()) { <span class="spinner"></span> }Create Collector
      </button>
    </form>
  </section>

  <section class="card">
    <h2>Collector accounts</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Phone</th><th>Status</th><th></th></tr></thead>
      <tbody>
        @if (loading()) {
          @for (i of [1,2,3]; track i) { <tr><td colspan="4"><div class="skeleton sk-row"></div></td></tr> }
        } @else {
          @for (c of rows(); track c.id) {
            <tr>
              <td><span class="avatar">@if (photo(c.photo_path)) { <img [src]="photo(c.photo_path)" alt=""> } @else { {{ initials(c.full_name) }} }</span>{{ c.full_name }}</td>
              <td>{{ c.phone || '—' }}</td>
              <td><span class="badge" [class.badge-void]="!c.is_active">{{ c.is_active ? 'Active' : 'Inactive' }}</span></td>
              <td><button class="btn-secondary" [disabled]="activeBusy() === c.id" (click)="toggle(c)">
                @if (activeBusy() === c.id) { <span class="spinner spinner-dark"></span> }{{ c.is_active ? 'Deactivate' : 'Activate' }}
              </button></td>
            </tr>
          } @empty { <tr><td colspan="4" class="empty">No collectors yet</td></tr> }
        }
      </tbody>
    </table></div>
  </section>
</div>`})
export class CollectorsComponent implements OnInit {
  form: ReturnType<FormBuilder['group']>;
  rows = signal<any[]>([]);
  loading = signal(true);
  busy = signal(false);
  showPassword = signal(false);
  activeBusy = signal<string | null>(null);
  photoPreview = signal('');
  photoDataUrl = signal('');
  photoLabel = signal('Open camera or choose from gallery');
  photoMap = signal<Record<string, string>>({});

  constructor(
    fb: FormBuilder,
    private db: SupabaseService,
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
  ) {
    this.form = fb.group({
      full_name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      password: ['', [Validators.required, Validators.minLength(8)]],
      address: [''],
    });
  }

  async ngOnInit() { await this.load(); }

  async load() {
    const { data } = await this.db.client.from('profiles').select('*').eq('role', 'collector').order('created_at', { ascending: false });
    this.rows.set(data || []);
    this.loading.set(false);

    const paths = (data || []).map(row => row.photo_path).filter(Boolean) as string[];
    if (paths.length) {
      try {
        const signed = await this.api.signedImages(paths);
        this.photoMap.set(signed.signed || {});
      } catch { /* avatars fall back to initials */ }
    }
  }

  initials(name: string) {
    return (name || '?')
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
  }

  photo(path?: string | null) {
    return path ? this.photoMap()[path] ?? '' : '';
  }

  async onPhoto(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      this.toast.error('Photo must be smaller than 20 MB');
      return;
    }
    try {
      const compressed = await compressImage(file, 480, 40 * 1024);
      this.photoDataUrl.set(compressed.dataUrl);
      this.photoPreview.set(compressed.dataUrl);
      this.photoLabel.set(`${Math.max(1, Math.round(compressed.bytes / 1024))} KB — ready`);
    } catch (e: any) {
      this.toast.error(e.message || 'Could not process that photo');
    }
  }

  async save() {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const created = await this.api.createCollector({ ...this.form.value, photo_data_url: this.photoDataUrl() });
      this.toast.success(`${created.full_name || 'Collector'} can now sign in`, 'Collector created');
      this.form.reset();
      this.photoPreview.set('');
      this.photoDataUrl.set('');
      this.photoLabel.set('Open camera or choose from gallery');
      await this.load();
    } catch (e: any) {
      this.toast.error(e.message || 'Could not create collector', 'Creation failed');
    } finally {
      this.busy.set(false);
    }
  }

  async toggle(c: any) {
    if (this.activeBusy()) return;
    this.activeBusy.set(c.id);
    try {
      const { error } = await this.db.client
        .from('profiles')
        .update({ is_active: !c.is_active, updated_at: new Date().toISOString() })
        .eq('id', c.id);
      if (error) throw error;

      const actor = this.auth.profile()?.id;
      if (actor) {
        await this.db.client.from('audit_logs').insert({
          actor_id: actor,
          action: c.is_active ? 'COLLECTOR_DEACTIVATED' : 'COLLECTOR_ACTIVATED',
          entity_type: 'profile',
          entity_id: c.id,
          old_values: { is_active: c.is_active },
          new_values: { is_active: !c.is_active },
        });
      }
      this.toast.success(`${c.full_name} is now ${c.is_active ? 'inactive' : 'active'}`);
      await this.load();
    } catch (e: any) {
      this.toast.error(e.message || 'Could not update the account', 'Update failed');
    } finally {
      this.activeBusy.set(null);
    }
  }
}