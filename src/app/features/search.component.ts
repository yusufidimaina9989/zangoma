import { Component, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { SupabaseService } from '../core/supabase.service';
import { SelectComponent, SelectOption } from '../shared/select.component';
import { ToastService } from '../shared/toast.service';
import { jsPDF } from 'jspdf';

@Component({ standalone:true, imports:[ReactiveFormsModule, RouterLink, SelectComponent], template:`
<div class="page-header">
  <div><p class="eyebrow">Dispute resolution</p><h1>Search Records</h1></div>
  <div class="tool-row">
    <span class="muted">{{ count() }} result(s)</span>
    <button class="btn-secondary" [disabled]="exporting()" (click)="exportCsv()">@if (exporting()) { <span class="spinner spinner-dark"></span> }Export Excel</button>
    <button class="btn-secondary" [disabled]="exporting()" (click)="exportPdf()">Export PDF</button>
  </div>
</div>
<section class="card">
  <form [formGroup]="form" (ngSubmit)="apply()" class="search-grid">
    <label class="field">Receipt, name or phone<input formControlName="q" placeholder="DK-0001 or Abubakar"></label>
    <div class="field"><span>Animal</span><app-select formControlName="animal" [options]="animalOptions" placeholder="All animals"></app-select></div>
    <div class="field"><span>Status</span><app-select formControlName="status" [options]="statusOptions" placeholder="All statuses"></app-select></div>
    <label class="field">From date<input type="date" formControlName="from"></label>
    <label class="field">To date<input type="date" formControlName="to"></label>
    <div class="field"><span>&nbsp;</span><button class="btn-primary" [disabled]="busy()">@if (busy()) { <span class="spinner"></span> }Search</button></div>
  </form>
  @if (error()) { <div class="alert-error mt-4">{{ error() }}</div> }
</section>
<section class="card mt-5">
  @if (pendingDelete(); as target) {
    <div class="danger-panel" style="margin-bottom:16px">
      <strong>Delete {{ target.receipt_number }}?</strong>
      <p>This permanently removes the transaction, its photographs and animal markings. A copy is kept in the audit log.</p>
      <div class="tool-row">
        <button class="btn-danger" [disabled]="deleting()" (click)="confirmDelete()">
          @if (deleting()) { <span class="spinner"></span> }Delete permanently
        </button>
        <button class="btn-secondary" (click)="pendingDelete.set(null)">Cancel</button>
      </div>
    </div>
  }
  <div class="table-wrap card-table"><table>
    <thead><tr><th>Receipt</th><th>Animal</th><th>Seller</th><th>Buyer</th><th>Middleman</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>
      @if (busy()) {
        @for (i of [1,2,3,4,5]; track i) { <tr><td colspan="8"><div class="skeleton sk-row"></div></td></tr> }
      } @else {
        @for (r of rows(); track r.id) {
          <tr>
            <td data-label="Receipt"><a class="link font-mono font-bold" [routerLink]="['/transactions', r.receipt_number]">{{ r.receipt_number }}</a></td>
            <td data-label="Animal" class="capitalize">{{ r.animal_type }}</td>
            <td data-label="Seller">{{ r.seller_name }}</td>
            <td data-label="Buyer">{{ r.buyer_name }}</td>
            <td data-label="Middleman">{{ r.middlemen?.full_name || '—' }}</td>
            <td data-label="Date">{{ r.transaction_date }}</td>
            <td data-label="Status"><span class="badge" [class.badge-void]="r.status === 'voided'">{{ r.status }}</span></td>
            <td data-label="Actions">
              <div class="row-actions">
                <a class="link" [routerLink]="['/transactions', r.receipt_number]">Open</a>
                <button type="button" class="link-btn" (click)="downloadRow(r)">PDF</button>
                @if (admin()) {
                  <button type="button" class="link-btn danger" (click)="askDelete(r)">Delete</button>
                }
              </div>
            </td>
          </tr>
        } @empty { <tr><td colspan="8" class="empty">No matching transactions</td></tr> }
      }
    </tbody>
  </table></div>
  <div class="pager">
    <button class="btn-secondary" [disabled]="page() <= 1 || busy()" (click)="go(-1)">Previous</button>
    <span>Page {{ page() }} of {{ pages() }}</span>
    <button class="btn-secondary" [disabled]="page() >= pages() || busy()" (click)="go(1)">Next</button>
  </div>
</section>`})
export class SearchComponent {
  form: ReturnType<FormBuilder['group']>;
  rows = signal<any[]>([]); count = signal(0); page = signal(1); pages = signal(1); error = signal(''); busy = signal(false); exporting = signal(false);
  pendingDelete = signal<any>(null); deleting = signal(false); settings = signal<any>(null);
  readonly animalOptions: SelectOption[] = [
    { value: '', label: 'All animals' },
    { value: 'camel', label: 'Camel', hint: 'C-####' },
    { value: 'donkey', label: 'Donkey', hint: 'DK-####' },
    { value: 'horse', label: 'Horse', hint: 'H-####' },
  ];
  readonly statusOptions: SelectOption[] = [
    { value: '', label: 'All statuses' },
    { value: 'active', label: 'Active' },
    { value: 'voided', label: 'Voided' },
  ];
  constructor(fb: FormBuilder, private api: ApiService, private toast: ToastService, private auth: AuthService, private db: SupabaseService) {
    this.form = fb.group({ q: [''], animal: [''], status: [''], from: [''], to: [''] });
    void this.search(1);
  }

  admin() { return this.auth.profile()?.role === 'admin'; }

  askDelete(row: any) { this.pendingDelete.set(row); }

  async confirmDelete() {
    const target = this.pendingDelete();
    if (!target || this.deleting()) return;
    this.deleting.set(true);
    try {
      await this.api.deleteTransaction(target.id);
      this.toast.warning(`${target.receipt_number} deleted. A copy remains in the audit log.`, 'Transaction deleted');
      this.pendingDelete.set(null);
      await this.search(this.page());
    } catch (e: any) {
      this.toast.error(e.message || 'Could not delete the transaction', 'Delete failed');
    } finally {
      this.deleting.set(false);
    }
  }

  async downloadRow(row: any) {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      const settings = await this.loadSettings();
      const ident = row.animal_identifications;
      const paths = [row.seller_photo_path, row.buyer_photo_path, ident?.left_side_image_path, ident?.right_side_image_path].filter(Boolean) as string[];
      let images: Record<string, string> = {};
      if (paths.length) {
        try { images = (await this.api.signedImages(paths)).signed || {}; } catch { /* PDF still works without photos */ }
      }
      await this.renderRecordPdf(row, settings, images);
      this.toast.success(`Receipt ${row.receipt_number} downloaded`);
    } catch (e: any) {
      this.toast.error(e.message || 'Could not create the PDF', 'Download failed');
    } finally {
      this.exporting.set(false);
    }
  }

  private async loadSettings() {
    if (this.settings()) return this.settings();
    const { data } = await this.db.client.from('market_settings').select('*').eq('id', 1).maybeSingle();
    this.settings.set(data || {});
    return this.settings();
  }

  private async toDataUrl(url?: string): Promise<string | null> {
    if (!url) return null;
    try {
      const blob = await (await fetch(url)).blob();
      return await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      });
    } catch { return null; }
  }

  private async renderRecordPdf(tx: any, settings: any, images: Record<string, string>) {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 45;
    let y = 55;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(settings?.market_name || 'Livestock Market', margin, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text([settings?.market_location, settings?.district, settings?.local_government, settings?.state].filter(Boolean).join(', '), margin, y);
    y += 24;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('LIVESTOCK TRANSACTION RECEIPT', margin, y);
    y += 18;
    doc.setFontSize(12);
    doc.text(tx.receipt_number, margin, y);
    y += 22;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const lines = [
      `Date / time: ${tx.transaction_date} ${tx.transaction_time}`,
      `Animal: ${tx.animal_type} | Sex: ${tx.animal_sex} | Colour: ${tx.animal_colour || '-'}`,
      `Description: ${tx.animal_description || '-'}`,
      `Seller: ${tx.seller_name} | ${tx.seller_phone || '-'} | ${tx.seller_address || '-'}`,
      `Buyer: ${tx.buyer_name} | ${tx.buyer_phone || '-'} | ${tx.buyer_address || '-'}`,
      `Middleman: ${tx.middlemen?.full_name || '-'}`,
      `Collector: ${tx.collector?.full_name || '-'}`,
      `Status: ${tx.status}`,
    ];
    for (const line of lines) {
      doc.text(doc.splitTextToSize(line, 500), margin, y);
      y += 15;
    }

    const addImage = async (path: string | undefined, x: number, top: number, width: number, height: number, label: string) => {
      const data = path ? await this.toDataUrl(images[path]) : null;
      if (!data) return false;
      doc.addImage(data, 'JPEG', x, top, width, height);
      doc.setFontSize(8);
      doc.text(label, x, top + height + 10);
      doc.setFontSize(9.5);
      return true;
    };

    y += 6;
    const seller = await addImage(tx.seller_photo_path, margin, y, 100, 85, 'Seller');
    const buyer = await addImage(tx.buyer_photo_path, margin + 120, y, 100, 85, 'Buyer');
    if (seller || buyer) y += 105;

    const left = await addImage(tx.animal_identifications?.left_side_image_path, margin, y, 230, 115, 'Left side marks');
    const right = await addImage(tx.animal_identifications?.right_side_image_path, margin + 250, y, 230, 115, 'Right side marks');
    if (left || right) y += 140;

    doc.setFontSize(8);
    doc.text('This receipt is the permanent reference for this transaction.', margin, Math.min(y + 10, 800));
    doc.save(`${tx.receipt_number}.pdf`);
  }
  apply() { void this.search(1); }
  go(delta: number) { void this.search(this.page() + delta); }

  private buildParams(page: number, limit: number) {
    const v = this.form.value;
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (v.q) params.set('q', v.q);
    if (v.animal) params.set('animal_type', v.animal);
    if (v.status) params.set('status', v.status);
    if (v.from) params.set('from', v.from);
    if (v.to) params.set('to', v.to);
    return params;
  }

  private stamp() { return new Date().toISOString().slice(0, 10); }

  private download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async exportCsv() {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      const result = await this.api.search(this.buildParams(1, 5000));
      const rows: any[] = result.data || [];
      if (!rows.length) { this.toast.warning('Nothing to export for these filters.'); return; }

      const header = ['Receipt', 'Animal', 'Sex', 'Colour', 'Seller', 'Seller phone', 'Buyer', 'Buyer phone', 'Middleman', 'Collector', 'Date', 'Time', 'Status', 'Registered'];
      const body = rows.map(row => [
        row.receipt_number, row.animal_type, row.animal_sex, row.animal_colour ?? '',
        row.seller_name, row.seller_phone ?? '', row.buyer_name, row.buyer_phone ?? '',
        row.middlemen?.full_name ?? '', row.collector?.full_name ?? '',
        row.transaction_date, row.transaction_time, row.status, row.created_at,
      ]);
      const csv = '\uFEFF' + [header, ...body]
        .map(line => line.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\r\n');

      this.download(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `transactions-${this.stamp()}.csv`);
      this.toast.success(`${rows.length} transaction(s) exported to Excel`, 'Export ready');
    } catch (e: any) {
      this.toast.error(e.message || 'Export failed', 'Export failed');
    } finally {
      this.exporting.set(false);
    }
  }

  async exportPdf() {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      const result = await this.api.search(this.buildParams(1, 5000));
      const rows: any[] = result.data || [];
      if (!rows.length) { this.toast.warning('Nothing to export for these filters.'); return; }

      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const margin = 30;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const columns = [
        { label: 'Receipt', width: 78 },
        { label: 'Animal', width: 55 },
        { label: 'Date', width: 62 },
        { label: 'Seller', width: 130 },
        { label: 'Buyer', width: 130 },
        { label: 'Middleman', width: 105 },
        { label: 'Collector', width: 105 },
        { label: 'Status', width: 52 },
      ];
      let y = margin;

      const drawHeader = (subtitle: string) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Livestock Market — Transaction Register', margin, y);
        y += 16;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(subtitle, margin, y);
        y += 18;
        doc.setFillColor(23, 75, 56);
        doc.rect(margin, y, pageWidth - margin * 2, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        let x = margin + 5;
        for (const column of columns) {
          doc.text(column.label, x, y + 13);
          x += column.width;
        }
        doc.setTextColor(32, 38, 34);
        y += 20;
      };

      drawHeader(`Generated ${new Date().toLocaleString()} · ${rows.length} record(s)`);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);

      for (const row of rows) {
        if (y > pageHeight - margin - 22) {
          doc.addPage();
          y = margin;
          drawHeader('continued');
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
        }
        const cells = [
          row.receipt_number, row.animal_type, row.transaction_date, row.seller_name,
          row.buyer_name, row.middlemen?.full_name ?? '—', row.collector?.full_name ?? '—', row.status,
        ];
        let x = margin + 5;
        cells.forEach((cell, index) => {
          const text = doc.splitTextToSize(String(cell ?? ''), columns[index].width - 8)[0] ?? '';
          doc.text(text, x, y + 11);
          x += columns[index].width;
        });
        doc.setDrawColor(230, 235, 231);
        doc.line(margin, y + 16, pageWidth - margin, y + 16);
        y += 18;
      }

      doc.save(`transactions-${this.stamp()}.pdf`);
      this.toast.success(`${rows.length} transaction(s) exported to PDF`, 'Export ready');
    } catch (e: any) {
      this.toast.error(e.message || 'Export failed', 'Export failed');
    } finally {
      this.exporting.set(false);
    }
  }
  async search(page: number) {
    this.busy.set(true); this.error.set('');
    try {
      const params = this.buildParams(page, 20);
      const result = await this.api.search(params);
      this.rows.set(result.data || []);
      this.count.set(result.count || 0);
      this.page.set(result.page || page);
      this.pages.set(result.pages || 1);
    } catch (e: any) {
      this.error.set(e.message);
      this.toast.error(e.message, 'Search failed');
    } finally { this.busy.set(false); }
  }
}