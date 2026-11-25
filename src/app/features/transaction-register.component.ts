import { Component, ElementRef, OnInit, QueryList, ViewChildren, computed, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { SupabaseService } from '../core/supabase.service';
import { ApiService } from '../core/api.service';
import { SelectComponent, SelectOption } from '../shared/select.component';
import { ToastService } from '../shared/toast.service';
import { compressImage } from '../shared/image.util';

@Component({ standalone: true, imports: [ReactiveFormsModule, SelectComponent], template: `
<div class="page-header"><div><p class="eyebrow">Field registration</p><h1>Register Livestock Transaction</h1></div></div>
@if (saved()) { <div class="success-box"><strong>Transaction registered</strong><div class="receipt-big">{{ saved() }}</div><button class="btn-primary mt-3" (click)="router.navigate(['/transactions', saved()])">View receipt</button><button class="btn-secondary mt-3" (click)="router.navigate(['/transactions/search'])">All records</button></div>
} @else {
<form [formGroup]="form" (ngSubmit)="submit()" class="space-y-5 register-form">
  @if (error()) { <div class="alert-error">{{ error() }}</div> }
  <section class="card"><h2>Transaction information</h2><div class="form-grid">
    <label class="field">Date<input type="date" formControlName="transaction_date"></label>
    <label class="field">Time<input type="time" formControlName="transaction_time"></label>
    <div class="field"><span>Animal category</span><app-select formControlName="animal_type" [options]="animalOptions"></app-select></div>
    <div class="field"><span>Middleman</span><app-select formControlName="middleman_id" [options]="middlemanOptions()" [searchable]="true" placeholder="Select middleman"></app-select></div>
  </div>
  </section>
  <section class="card"><h2>Seller</h2><div class="form-grid">
    <label class="field">Full name<input formControlName="seller_name"></label><label class="field">Phone<input formControlName="seller_phone"></label>
    <label class="field">Address<input formControlName="seller_address"></label><label class="field">Village/town<input formControlName="seller_village"></label>
  </div><label class="photo-field">Seller photograph<input type="file" accept="image/*" capture="environment" (change)="photo($event,'seller')"><span>{{ sellerName() || 'Open camera or choose gallery' }}</span></label>@if(sellerPreview()){<img class="preview" [src]="sellerPreview()" alt="Seller preview">}</section>
  <section class="card"><h2>Buyer</h2><div class="form-grid">
    <label class="field">Full name<input formControlName="buyer_name"></label><label class="field">Phone<input formControlName="buyer_phone"></label>
    <label class="field">Address<input formControlName="buyer_address"></label><label class="field">Village/town<input formControlName="buyer_village"></label>
  </div><label class="photo-field">Buyer photograph<input type="file" accept="image/*" capture="environment" (change)="photo($event,'buyer')"><span>{{ buyerName() || 'Open camera or choose gallery' }}</span></label>@if(buyerPreview()){<img class="preview" [src]="buyerPreview()" alt="Buyer preview">}</section>
  <section class="card"><h2>Animal identification</h2><div class="form-grid">
    <div class="field"><span>Sex</span><app-select formControlName="animal_sex" [options]="sexOptions"></app-select></div>
    <label class="field">Colour<input formControlName="animal_colour"></label><label class="field">Age (optional)<input formControlName="animal_age"></label>
  </div><label class="field mt-4">Distinctive description<textarea formControlName="animal_description" rows="3"></textarea></label>
  <div class="drawing-grid"><div><h3>Left side</h3><canvas #drawCanvas width="600" height="360" (pointerdown)="start($event,'left')" (pointermove)="move($event,'left')" (pointerup)="stop()"></canvas><div class="tool-row"><button type="button" class="btn-secondary" (click)="clear('left')">Clear</button></div></div><div><h3>Right side</h3><canvas #drawCanvas width="600" height="360" (pointerdown)="start($event,'right')" (pointermove)="move($event,'right')" (pointerup)="stop()"></canvas><div class="tool-row"><button type="button" class="btn-secondary" (click)="clear('right')">Clear</button></div></div></div></section>
  <div class="mobile-cta">
    <button class="btn-primary w-full" [disabled]="busy() || form.invalid">@if (busy()) { <span class="spinner"></span> }{{ busy() ? 'Saving transaction…' : 'REGISTER TRANSACTION' }}</button>
  </div>
</form>}` })
export class TransactionRegisterComponent implements OnInit {
  @ViewChildren('drawCanvas') canvases!: QueryList<ElementRef<HTMLCanvasElement>>;
  form: ReturnType<FormBuilder['group']>; middlemen=signal<any[]>([]); busy=signal(false); error=signal(''); saved=signal('');
  readonly animalOptions: SelectOption[] = [
    { value: 'camel', label: 'Camel', hint: 'Receipt series C-0001' },
    { value: 'donkey', label: 'Donkey', hint: 'Receipt series DK-0001' },
    { value: 'horse', label: 'Horse', hint: 'Receipt series H-0001' },
  ];
  readonly sexOptions: SelectOption[] = [
    { value: 'unknown', label: 'Unknown' },
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
  ];
  readonly middlemanOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'No middleman', hint: 'Optional' },
    ...this.middlemen().map(person => ({ value: person.id, label: person.full_name })),
  ]);
  sellerPreview=signal(''); buyerPreview=signal(''); sellerName=signal(''); buyerName=signal('');
  private sellerFile?: File; private buyerFile?: File; private drawing=false; private side='left';
  constructor(fb: FormBuilder, private db: SupabaseService, private auth: AuthService, private api: ApiService, public router: Router, private toast: ToastService) {
    const now=new Date(); const pad=(n:number)=>String(n).padStart(2,'0');
    this.form=fb.group({transaction_date:[`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`,Validators.required],transaction_time:[`${pad(now.getHours())}:${pad(now.getMinutes())}`,Validators.required],animal_type:['camel',Validators.required],middleman_id:[''],seller_name:['',Validators.required],seller_phone:[''],seller_address:[''],seller_village:[''],buyer_name:['',Validators.required],buyer_phone:[''],buyer_address:[''],buyer_village:[''],animal_sex:['unknown'],animal_colour:[''],animal_age:[''],animal_description:['']});
  }
  async ngOnInit(){
    const draft=localStorage.getItem('livestock-draft');
    if(draft){try{this.form.patchValue(JSON.parse(draft));}catch{localStorage.removeItem('livestock-draft');}}
    this.form.valueChanges.subscribe(value=>localStorage.setItem('livestock-draft',JSON.stringify(value)));
    const {data}=await this.db.client.from('middlemen').select('id,full_name').eq('is_active',true).order('full_name'); this.middlemen.set(data||[]); setTimeout(()=>this.resetCanvas(),100);
  }
  async photo(event:Event,side:'seller'|'buyer'){
    const file=(event.target as HTMLInputElement).files?.[0];
    if(!file)return;
    if(file.size>20*1024*1024){this.error.set('Photograph must be smaller than 20 MB');return;}
    try{
      const compressed=await compressImage(file,720,60*1024);
      const sizeLabel=`${Math.max(1,Math.round(compressed.bytes/1024))} KB`;
      if(side==='seller'){this.sellerFile=compressed.file;this.sellerPreview.set(compressed.dataUrl);this.sellerName.set(sizeLabel)}
      else{this.buyerFile=compressed.file;this.buyerPreview.set(compressed.dataUrl);this.buyerName.set(sizeLabel)}
    }catch(e:any){this.error.set(e.message||'Could not process that photograph');}
  }
  private resetCanvas(){this.canvases?.forEach(ref=>{const c=ref.nativeElement;const ctx=c.getContext('2d')!;ctx.fillStyle='#fffaf0';ctx.fillRect(0,0,c.width,c.height);})}
  start(e:PointerEvent,side:string){this.drawing=true;this.side=side;this.point(e,true)}
  move(e:PointerEvent,side:string){if(this.drawing&&this.side===side)this.point(e,false)}
  stop(){this.drawing=false}
  private point(e:PointerEvent,begin:boolean){const ref=this.canvases.toArray().find((_,i)=>i===({left:0,right:1}[this.side as 'left'|'right']));if(!ref)return;const c=ref.nativeElement,r=c.getBoundingClientRect();const ctx=c.getContext('2d')!;ctx.lineWidth=5;ctx.lineCap='round';ctx.strokeStyle='#d97706';const x=(e.clientX-r.left)*c.width/r.width,y=(e.clientY-r.top)*c.height/r.height;if(begin){ctx.beginPath();ctx.moveTo(x,y)}else{ctx.lineTo(x,y);ctx.stroke()}}
  clear(side:string){const i=side==='left'?0:1;const c=this.canvases.toArray()[i]?.nativeElement;if(c){const ctx=c.getContext('2d')!;ctx.clearRect(0,0,c.width,c.height);this.resetCanvas()}}
  private async upload(file:File,prefix:string){const id=crypto.randomUUID();const path=`transactions/${id}/${prefix}.jpg`;const {error}=await this.db.client.storage.from('livestock-private').upload(path,file,{contentType:'image/jpeg',upsert:false});if(error)throw error;return path}
  async submit(){if(this.busy())return;this.busy.set(true);this.error.set('');try{let sellerPath:any,buyerPath:any; if(this.sellerFile)sellerPath=await this.upload(this.sellerFile,'seller');if(this.buyerFile)buyerPath=await this.upload(this.buyerFile,'buyer');const canvases=this.canvases.toArray();const left=await this.canvasBlob(canvases[0].nativeElement);const right=await this.canvasBlob(canvases[1].nativeElement);const leftPath=await this.upload(new File([left],'left.jpg',{type:'image/jpeg'}),'left');const rightPath=await this.upload(new File([right],'right.jpg',{type:'image/jpeg'}),'right');const payload={...this.form.value,seller_photo_path:sellerPath,buyer_photo_path:buyerPath,left_side_image_path:leftPath,right_side_image_path:rightPath};const result=await this.api.createTransaction(payload);this.saved.set(result.receipt_number);this.toast.success(`Transaction ${result.receipt_number} registered`,'Transaction saved');localStorage.removeItem('livestock-draft')}catch(e:any){this.error.set(e.message||'Transaction could not be saved');this.toast.error(e.message||'Transaction could not be saved','Could not register transaction');}finally{this.busy.set(false)}}
  private canvasBlob(c:HTMLCanvasElement){return new Promise<Blob>(r=>c.toBlob(x=>r(x!),'image/jpeg',.7))}
}
