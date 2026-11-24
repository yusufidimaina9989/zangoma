import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { SupabaseService } from '../core/supabase.service';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ToastService } from '../shared/toast.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
  <div class="page-header no-print">
    <div><p class="eyebrow">Transaction record</p><h1>{{ tx()?.receipt_number || 'Loading…' }}</h1></div>
    <div class="tool-row">
      <button class="btn-secondary" (click)="copy()">{{ copied() ? 'Copied' : 'Copy number' }}</button>
      <button class="btn-secondary" (click)="print()">Print</button>
      <button class="btn-secondary" (click)="downloadPdf()">Download PDF</button>
      <button class="btn-secondary" (click)="whatsapp()">WhatsApp</button>
    </div>
  </div>

  @if (error()) { <div class="alert-error no-print">{{ error() }}</div> }
  @if (tx(); as t) {
    <section class="card no-print">
      <div class="detail-grid">
        <div><span class="label">Status</span><strong class="capitalize">{{ t.status }}</strong></div>
        <div><span class="label">Date / time</span><strong>{{ t.transaction_date }} {{ t.transaction_time }}</strong></div>
        <div><span class="label">Animal</span><strong class="capitalize">{{ t.animal_type }} · {{ t.animal_sex }}</strong></div>
        <div><span class="label">Collector</span><strong>{{ t.collector?.full_name || '—' }}</strong></div>
        <div><span class="label">Registered</span><strong>{{ t.created_at | date:'medium' }}</strong></div>
        <div><span class="label">Last updated</span><strong>{{ t.updated_at | date:'medium' }}</strong></div>
      </div>
      @if (t.status === 'voided') { <div class="alert-warn mt-4"><strong>Voided:</strong> {{ t.void_reason }}</div> }
      @if (admin()) {
        <div class="admin-actions mt-4">
          <button class="btn-secondary" (click)="toggleEdit()">{{ editing() ? 'Cancel edit' : 'Edit transaction' }}</button>
          @if (!deleteConfirmOpen()) {
            <button class="btn-danger" (click)="deleteConfirmOpen.set(true)">Delete transaction</button>
          }
        </div>

        @if (deleteConfirmOpen()) {
          <div class="danger-panel mt-4">
            <strong>Permanently delete {{ t.receipt_number }}?</strong>
            <p>The transaction, its photographs and animal markings will be removed. This cannot be undone.
               A copy of the record is kept in the audit log.</p>
            <label class="field">Type the receipt number to confirm
              <input [value]="deleteInput()" (input)="deleteInput.set($any($event.target).value)" [placeholder]="t.receipt_number">
            </label>
            <div class="tool-row mt-3">
              <button class="btn-danger"
                      [disabled]="deleteInput().trim().toUpperCase() !== t.receipt_number.toUpperCase() || deleting()"
                      (click)="deleteTransaction()">
                @if (deleting()) { <span class="spinner"></span> }Delete permanently
              </button>
              <button class="btn-secondary" (click)="cancelDelete()">Cancel</button>
            </div>
          </div>
        }
        @if (editing()) {
          <form [formGroup]="editForm" (ngSubmit)="saveEdit()" class="form-grid mt-4">
            <label class="field">Seller name<input formControlName="seller_name"></label>
            <label class="field">Seller phone<input formControlName="seller_phone"></label>
            <label class="field">Seller address<input formControlName="seller_address"></label>
            <label class="field">Buyer name<input formControlName="buyer_name"></label>
            <label class="field">Buyer phone<input formControlName="buyer_phone"></label>
            <label class="field">Buyer address<input formControlName="buyer_address"></label>
            <label class="field">Animal colour<input formControlName="animal_colour"></label>
            <label class="field">Middleman<select formControlName="middleman_id"><option value="">None</option>@for (m of middlemen(); track m.id) {<option [value]="m.id">{{ m.full_name }}</option>}</select></label>
            <label class="field col-span-2">Description<textarea rows="2" formControlName="animal_description"></textarea></label>
            <div class="col-span-2"><button class="btn-primary" [disabled]="busy()">@if (busy()) { <span class="spinner"></span> }{{ busy() ? 'Saving…' : 'Save changes' }}</button></div>
          </form>
        }
        @if (t.status === 'active') {
          <div class="void-box mt-4">
            <label class="field">Void reason (required)<input [value]="voidReason()" (input)="voidReason.set($any($event.target).value)"></label>
            <button class="btn-danger mt-3" [disabled]="busy()" (click)="voidTransaction()">@if (busy()) { <span class="spinner"></span> }Void transaction</button>
          </div>
        }
      }
    </section>

    <section class="receipt-page" id="receipt">
      <header class="receipt-head">
        <div>
          <h2>{{ settings()?.market_name || 'Livestock Market' }}</h2>
          <p>{{ settings()?.market_location }}</p>
          <p>{{ settings()?.district }} {{ settings()?.local_government }}</p>
          <p>{{ settings()?.state }}</p>
        </div>
        <div class="receipt-qr">
          @if (qr()) { <img [src]="qr()" alt="Transaction verification QR code"> }
          <p>Scan to verify</p>
        </div>
      </header>
      <div class="receipt-title">
        <span>LIVESTOCK TRANSACTION RECEIPT</span>
        <strong>{{ t.receipt_number }}</strong>
      </div>
      <div class="receipt-meta">
        <div><span>Date</span><b>{{ t.transaction_date }}</b></div>
        <div><span>Time</span><b>{{ t.transaction_time }}</b></div>
        <div><span>Animal</span><b class="capitalize">{{ t.animal_type }}</b></div>
        <div><span>Collector</span><b>{{ t.collector?.full_name || '—' }}</b></div>
      </div>

      <div class="receipt-columns">
        <div class="receipt-box">
          <h3>Seller</h3>
          @if (image(t.seller_photo_path)) { <img class="receipt-photo" [src]="image(t.seller_photo_path)" alt="Seller photograph"> }
          <p><span>Name</span><b>{{ t.seller_name }}</b></p>
          <p><span>Phone</span><b>{{ t.seller_phone || '—' }}</b></p>
          <p><span>Address</span><b>{{ t.seller_address || '—' }}</b></p>
          <p><span>Village</span><b>{{ t.seller_village || '—' }}</b></p>
        </div>
        <div class="receipt-box">
          <h3>Buyer</h3>
          @if (image(t.buyer_photo_path)) { <img class="receipt-photo" [src]="image(t.buyer_photo_path)" alt="Buyer photograph"> }
          <p><span>Name</span><b>{{ t.buyer_name }}</b></p>
          <p><span>Phone</span><b>{{ t.buyer_phone || '—' }}</b></p>
          <p><span>Address</span><b>{{ t.buyer_address || '—' }}</b></p>
          <p><span>Village</span><b>{{ t.buyer_village || '—' }}</b></p>
        </div>
      </div>

      <div class="receipt-box">
        <h3>Animal identification</h3>
        <p><span>Middleman</span><b>{{ t.middlemen?.full_name || '—' }}</b></p>
        <p><span>Sex / colour</span><b class="capitalize">{{ t.animal_sex }} / {{ t.animal_colour || '—' }}</b></p>
        <p><span>Age</span><b>{{ t.animal_age || '—' }}</b></p>
        <p><span>Description</span><b>{{ t.animal_description || '—' }}</b></p>
        <div class="marking-grid">
          <figure>
            <figcaption>Left side marks</figcaption>
            @if (image(t.animal_identifications?.left_side_image_path)) { <img [src]="image(t.animal_identifications.left_side_image_path)" alt="Left side markings"> }
            <p>{{ t.animal_identifications?.left_side_description || '' }}</p>
          </figure>
          <figure>
            <figcaption>Right side marks</figcaption>
            @if (image(t.animal_identifications?.right_side_image_path)) { <img [src]="image(t.animal_identifications.right_side_image_path)" alt="Right side markings"> }
            <p>{{ t.animal_identifications?.right_side_description || '' }}</p>
          </figure>
        </div>
      </div>

      <footer class="receipt-foot">
        <div><span>Collector signature</span></div>
        <div><span>Market verification</span></div>
      </footer>
      <p class="receipt-note">This receipt is the permanent reference for this transaction. Keep it safe for dispute resolution.</p>
    </section>
  } @else if (!error()) {
    <p class="muted">Loading transaction…</p>
  }`,
})
export class TransactionDetailComponent implements OnInit {
  tx = signal<any>(null);
  settings = signal<any>(null);
  images = signal<Record<string, string>>({});
  middlemen = signal<any[]>([]);
  qr = signal('');
  error = signal('');
  busy = signal(false);
  editing = signal(false);
  copied = signal(false);
  voidReason = signal('');
  deleteConfirmOpen = signal(false);
  deleteInput = signal('');
  deleting = signal(false);
  admin = () => this.auth.profile()?.role === 'admin';
  editForm: ReturnType<FormBuilder['group']>;

  constructor(
    private route: ActivatedRoute,
    private db: SupabaseService,
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    private router: Router,
    fb: FormBuilder,
  ) {
    this.editForm = fb.group({
      seller_name: [''], seller_phone: [''], seller_address: [''],
      buyer_name: [''], buyer_phone: [''], buyer_address: [''],
      animal_colour: [''], animal_description: [''], middleman_id: [''],
    });
  }

  async ngOnInit() {
    const receipt = this.route.snapshot.paramMap.get('receipt');
    if (receipt) await this.load(receipt);
  }

  image(path?: string | null) { return path ? this.images()[path] || '' : ''; }

  private async load(receipt: string) {
    this.error.set('');
    const { data, error } = await this.db.client
      .from('transactions')
      .select('*, middlemen(full_name,phone,village), collector:profiles(full_name), animal_identifications(*)')
      .eq('receipt_number', receipt)
      .maybeSingle();
    if (error || !data) {
      this.error.set(error?.message || 'Transaction not found or you are not authorized to view it.');
      return;
    }
    this.tx.set(data);
    this.editForm.patchValue({
      seller_name: data.seller_name, seller_phone: data.seller_phone || '', seller_address: data.seller_address || '',
      buyer_name: data.buyer_name, buyer_phone: data.buyer_phone || '', buyer_address: data.buyer_address || '',
      animal_colour: data.animal_colour || '', animal_description: data.animal_description || '',
      middleman_id: data.middleman_id || '',
    });

    const ident = data.animal_identifications;
    const paths = [data.seller_photo_path, data.buyer_photo_path, ident?.left_side_image_path, ident?.right_side_image_path].filter(Boolean) as string[];
    if (paths.length) {
      try {
        const signed = await this.api.signedImages(paths);
        this.images.set(signed.signed || {});
      } catch (e: any) {
        this.error.set(`Images could not be loaded: ${e.message}`);
      }
    }

    const { data: market } = await this.db.client.from('market_settings').select('*').eq('id', 1).maybeSingle();
    this.settings.set(market);

    if (this.admin()) {
      const { data: mm } = await this.db.client.from('middlemen').select('id,full_name').order('full_name');
      this.middlemen.set(mm || []);
    }

    try {
      this.qr.set(await QRCode.toDataURL(`${location.origin}/transactions/${data.receipt_number}`, { margin: 1, width: 220 }));
    } catch { /* QR is optional */ }
  }

  private get receiptUrl() { return `${location.origin}/transactions/${this.tx()?.receipt_number}`; }

  async copy() {
    await navigator.clipboard.writeText(this.tx()?.receipt_number || '');
    this.copied.set(true);
    this.toast.success(`${this.tx()?.receipt_number} copied to clipboard`);
    setTimeout(() => this.copied.set(false), 2000);
  }

  print() { window.print(); }

  whatsapp() {
    const t = this.tx();
    if (!t) return;
    const text = `Livestock transaction ${t.receipt_number} — ${t.animal_type}, seller ${t.seller_name}, buyer ${t.buyer_name}. Verify: ${this.receiptUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  toggleEdit() { this.editing.set(!this.editing()); }

  cancelDelete() { this.deleteConfirmOpen.set(false); this.deleteInput.set(''); }

  async deleteTransaction() {
    const t = this.tx();
    if (!t || this.deleting()) return;
    if (this.deleteInput().trim().toUpperCase() !== t.receipt_number.toUpperCase()) return;

    this.deleting.set(true);
    try {
      await this.api.deleteTransaction(t.id);
      this.toast.warning(`${t.receipt_number} was deleted. A copy is kept in the audit log.`, 'Transaction deleted');
      await this.router.navigate(['/transactions/search']);
    } catch (e: any) {
      this.toast.error(e.message || 'Could not delete the transaction', 'Delete failed');
    } finally {
      this.deleting.set(false);
    }
  }

  async saveEdit() {
    if (!this.tx()) return;
    this.busy.set(true); this.error.set('');
    try {
      await this.api.updateTransaction({ transaction_id: this.tx().id, ...this.editForm.value, middleman_id: this.editForm.value.middleman_id || null });
      this.editing.set(false);
      this.toast.success('Transaction corrected and logged in the audit trail', 'Saved');
      await this.load(this.tx().receipt_number);
    } catch (e: any) { this.error.set(e.message); this.toast.error(e.message, 'Update failed'); } finally { this.busy.set(false); }
  }

  async voidTransaction() {
    if (!this.voidReason().trim()) { this.error.set('A void reason is required.'); return; }
    this.busy.set(true); this.error.set('');
    try {
      await this.api.voidTransaction(this.tx().id, this.voidReason().trim());
      this.toast.warning('Transaction voided. The receipt number is preserved.', 'Voided');
      this.voidReason.set('');
      await this.load(this.tx().receipt_number);
    } catch (e: any) { this.error.set(e.message); this.toast.error(e.message, 'Void failed'); } finally { this.busy.set(false); }
  }

  private async toDataUrl(url: string): Promise<string | null> {
    try {
      const blob = await (await fetch(url)).blob();
      return await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      });
    } catch { return null; }
  }

  async downloadPdf() {
    const t = this.tx();
    if (!t) return;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const M = 45;
    let y = 55;
    const market = this.settings() || {};
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text(market.market_name || 'Livestock Market', M, y); y += 17;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text([market.market_location, market.district, market.local_government, market.state].filter(Boolean).join(', '), M, y); y += 22;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('LIVESTOCK TRANSACTION RECEIPT', M, y); y += 18;
    doc.setFontSize(12); doc.text(t.receipt_number, M, y); y += 20;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    const lines = [
      `Date / time: ${t.transaction_date} ${t.transaction_time}`,
      `Animal: ${t.animal_type} | Sex: ${t.animal_sex} | Colour: ${t.animal_colour || '-'}`,
      `Animal description: ${t.animal_description || '-'}`,
      `Seller: ${t.seller_name} | ${t.seller_phone || '-'} | ${t.seller_address || '-'}`,
      `Buyer: ${t.buyer_name} | ${t.buyer_phone || '-'} | ${t.buyer_address || '-'}`,
      `Middleman: ${t.middlemen?.full_name || '-'}`,
      `Collector: ${t.collector?.full_name || '-'}`,
      `Status: ${t.status}`,
    ];
    for (const line of lines) { doc.text(doc.splitTextToSize(line, 500), M, y); y += 15; }

    const seller = t.seller_photo_path ? await this.toDataUrl(this.image(t.seller_photo_path)) : null;
    const buyer = t.buyer_photo_path ? await this.toDataUrl(this.image(t.buyer_photo_path)) : null;
    y += 8;
    if (seller) { doc.addImage(seller, 'JPEG', M, y, 105, 90); doc.text('Seller', M, y + 102); }
    if (buyer) { doc.addImage(buyer, 'JPEG', M + 125, y, 105, 90); doc.text('Buyer', M + 125, y + 102); }
    if (seller || buyer) y += 122;

    const left = t.animal_identifications?.left_side_image_path ? await this.toDataUrl(this.image(t.animal_identifications.left_side_image_path)) : null;
    const right = t.animal_identifications?.right_side_image_path ? await this.toDataUrl(this.image(t.animal_identifications.right_side_image_path)) : null;
    if (left) { doc.addImage(left, 'JPEG', M, y, 240, 120); doc.text('Left side marks', M, y + 132); }
    if (right) { doc.addImage(right, 'JPEG', M + 260, y, 240, 120); doc.text('Right side marks', M + 260, y + 132); }

    doc.save(`${t.receipt_number}.pdf`);
  }
}
