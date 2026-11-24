import { Component, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { SupabaseService } from '../core/supabase.service';
import { AuthService } from '../core/auth.service';
import { ToastService } from '../shared/toast.service';

@Component({standalone:true,imports:[ReactiveFormsModule],template:`
<div class="page-header">
  <div><p class="eyebrow">Administration</p><h1>Middlemen</h1></div>
  <span class="muted">{{ rows().length }} registered</span>
</div>
<div class="grid-admin">
  <section class="card">
    <h2>Add middleman</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <label class="field">Full name<input formControlName="full_name" placeholder="e.g. Musa Bulama"></label>
      <label class="field mt-3">Phone<input formControlName="phone" placeholder="080..."></label>
      <label class="field mt-3">Address / village<input formControlName="village" placeholder="Damaturu market"></label>
      <button class="btn-primary w-full mt-4" [disabled]="form.invalid || busy()">
        @if (busy()) { <span class="spinner"></span> }Add Middleman
      </button>
    </form>
  </section>

  <section class="card">
    <h2>Registered middlemen</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Phone</th><th>Status</th><th></th></tr></thead>
      <tbody>
        @if (loading()) {
          @for (i of [1,2,3]; track i) { <tr><td colspan="4"><div class="skeleton sk-row"></div></td></tr> }
        } @else {
          @for (m of rows(); track m.id) {
            <tr>
              <td>{{ m.full_name }}</td>
              <td>{{ m.phone || '—' }}</td>
              <td><span class="badge" [class.badge-void]="!m.is_active">{{ m.is_active ? 'Active' : 'Inactive' }}</span></td>
              <td><button class="btn-secondary" [disabled]="activeBusy() === m.id" (click)="toggle(m)">
                @if (activeBusy() === m.id) { <span class="spinner spinner-dark"></span> }{{ m.is_active ? 'Deactivate' : 'Activate' }}
              </button></td>
            </tr>
          } @empty { <tr><td colspan="4" class="empty">No middlemen yet</td></tr> }
        }
      </tbody>
    </table></div>
  </section>
</div>`})
export class MiddlemenComponent implements OnInit {
  form: ReturnType<FormBuilder['group']>;
  rows = signal<any[]>([]);
  loading = signal(true);
  busy = signal(false);
  activeBusy = signal<string | null>(null);

  constructor(
    fb: FormBuilder,
    private db: SupabaseService,
    private auth: AuthService,
    private toast: ToastService,
  ) {
    this.form = fb.group({ full_name: ['', Validators.required], phone: [''], village: [''] });
  }

  async ngOnInit() { await this.load(); }

  async load() {
    const { data } = await this.db.client.from('middlemen').select('*').order('full_name');
    this.rows.set(data || []);
    this.loading.set(false);
  }

  async save() {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const { data, error } = await this.db.client.from('middlemen').insert(this.form.value).select().single();
      if (error) throw error;
      if (data) await this.audit('MIDDLEMAN_CREATED', data.id, null, data);
      this.toast.success(`${this.form.value.full_name} added`, 'Middleman created');
      this.form.reset();
      await this.load();
    } catch (e: any) {
      this.toast.error(e.message || 'Could not add middleman', 'Save failed');
    } finally {
      this.busy.set(false);
    }
  }

  async toggle(m: any) {
    if (this.activeBusy()) return;
    this.activeBusy.set(m.id);
    try {
      const { error } = await this.db.client
        .from('middlemen')
        .update({ is_active: !m.is_active, updated_at: new Date().toISOString() })
        .eq('id', m.id);
      if (error) throw error;
      await this.audit(m.is_active ? 'MIDDLEMAN_DEACTIVATED' : 'MIDDLEMAN_ACTIVATED', m.id, { is_active: m.is_active }, { is_active: !m.is_active });
      this.toast.success(`${m.full_name} is now ${m.is_active ? 'inactive' : 'active'}`);
      await this.load();
    } catch (e: any) {
      this.toast.error(e.message || 'Could not update middleman', 'Update failed');
    } finally {
      this.activeBusy.set(null);
    }
  }

  private async audit(action: string, entityId: string, oldValues: any, newValues: any) {
    const actor = this.auth.profile()?.id;
    if (!actor) return;
    await this.db.client.from('audit_logs').insert({
      actor_id: actor,
      action,
      entity_type: 'middleman',
      entity_id: entityId,
      old_values: oldValues,
      new_values: newValues,
    });
  }
}