import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';
import { AuthService } from '../core/auth.service';

@Component({ standalone: true, imports: [RouterLink], template: `
<div class="page-header"><div><p class="eyebrow">Overview</p><h1>Dashboard</h1></div><span class="muted">Welcome, {{ auth.profile()?.full_name }}</span></div>
<div class="grid-cards">
  @if (loading()) {
    @for (i of [1,2,3,4,5,6,7,8]; track i) {
      <div class="stat-card"><div class="skeleton sk-line" style="width:55%"></div><div class="skeleton sk-line-lg" style="margin-top:14px"></div></div>
    }
  } @else {
    @for (card of cards(); track card.label) { <div class="stat-card"><p>{{ card.label }}</p><strong>{{ card.value }}</strong></div> }
  }
</div>

<div class="grid-admin mt-6">
  <section class="card"><h2>Transactions by animal type</h2>
    <div class="chart">
      @for (bar of byAnimal(); track bar.label) { <div class="chart-row"><span class="capitalize">{{ bar.label }}</span><div class="bar"><i [style.width.%]="percent(bar.value, max(byAnimal()))"></i></div><b>{{ bar.value }}</b></div> }
      @empty { <p class="muted">No data yet</p> }
    </div>
  </section>
  <section class="card"><h2>Monthly activity</h2>
    <div class="chart">
      @for (bar of byMonth(); track bar.label) { <div class="chart-row"><span>{{ bar.label }}</span><div class="bar"><i [style.width.%]="percent(bar.value, max(byMonth()))"></i></div><b>{{ bar.value }}</b></div> }
      @empty { <p class="muted">No data yet</p> }
    </div>
  </section>
</div>

@if (auth.profile()?.role === 'admin') {
  <section class="card mt-5"><h2>Transactions by data collector</h2>
    <div class="chart">
      @for (bar of byCollector(); track bar.label) { <div class="chart-row"><span>{{ bar.label }}</span><div class="bar"><i [style.width.%]="percent(bar.value, max(byCollector()))"></i></div><b>{{ bar.value }}</b></div> }
      @empty { <p class="muted">No data yet</p> }
    </div>
  </section>
}

<section class="card mt-5"><div class="card-head"><h2>Recent transactions</h2><a class="link" routerLink="/transactions/search">View all</a></div>
  <div class="table-wrap card-table"><table><thead><tr><th>Receipt</th><th>Animal</th><th>Seller</th><th>Buyer</th><th>Date</th></tr></thead>
  <tbody>
    @if (loading()) {
      @for (i of [1,2,3,4]; track i) { <tr><td colspan="5"><div class="skeleton sk-row"></div></td></tr> }
    } @else {
      @for (row of recent(); track row.id) { <tr class="clickable"><td data-label="Receipt"><a class="link font-mono font-bold" [routerLink]="['/transactions', row.receipt_number]">{{ row.receipt_number }}</a></td><td data-label="Animal" class="capitalize">{{ row.animal_type }}</td><td data-label="Seller">{{ row.seller_name }}</td><td data-label="Buyer">{{ row.buyer_name }}</td><td data-label="Date">{{ row.transaction_date }}</td></tr> } @empty { <tr><td colspan="5" class="empty">No transactions yet</td></tr> }
    }
  </tbody></table></div>
</section>` })
export class DashboardComponent implements OnInit {
  cards = signal<{ label: string; value: number }[]>([]);
  recent = signal<any[]>([]);
  loading = signal(true);
  byAnimal = signal<{ label: string; value: number }[]>([]);
  byMonth = signal<{ label: string; value: number }[]>([]);
  byCollector = signal<{ label: string; value: number }[]>([]);

  constructor(private db: SupabaseService, public auth: AuthService) {}

  private head() {
    const profile = this.auth.profile();
    let q: any = this.db.client.from('transactions').select('*', { count: 'exact', head: true });
    if (profile?.role !== 'admin') q = q.eq('collector_id', profile?.id);
    return q;
  }

  async ngOnInit() {
    const profile = this.auth.profile();
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayISO = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const monthStart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;

    const [total, camel, donkey, horse, todayCount, monthCount, collectors, middlemen, recentRows] = await Promise.all([
      this.head(),
      this.head().eq('animal_type', 'camel'),
      this.head().eq('animal_type', 'donkey'),
      this.head().eq('animal_type', 'horse'),
      this.head().eq('transaction_date', todayISO),
      this.head().gte('transaction_date', monthStart),
      this.db.client.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'collector').eq('is_active', true),
      this.db.client.from('middlemen').select('*', { count: 'exact', head: true }).eq('is_active', true),
      this.db.client.from('transactions')
        .select('id,receipt_number,animal_type,seller_name,buyer_name,transaction_date,created_at,collector_id,collector:profiles(full_name)')
        .order('created_at', { ascending: false }).limit(500),
    ]);

    const stats = [
      { label: 'Total Transactions', value: total.count || 0 },
      { label: 'Camels', value: camel.count || 0 },
      { label: 'Donkeys', value: donkey.count || 0 },
      { label: 'Horses', value: horse.count || 0 },
      { label: 'Today', value: todayCount.count || 0 },
      { label: 'This Month', value: monthCount.count || 0 },
    ];
    if (profile?.role === 'admin') {
      stats.push({ label: 'Active Collectors', value: collectors.count || 0 }, { label: 'Middlemen', value: middlemen.count || 0 });
    }
    this.cards.set(stats);

    const rows = recentRows.data || [];
    this.recent.set(rows.slice(0, 8));
    this.byAnimal.set(['camel', 'donkey', 'horse'].map(label => ({ label, value: rows.filter((r: any) => r.animal_type === label).length })));

    const months: { label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      months.push({
        label: d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        value: rows.filter((r: any) => String(r.transaction_date).startsWith(key)).length,
      });
    }
    this.byMonth.set(months);

    const collectorCounts = new Map<string, number>();
    for (const row of rows as any[]) {
      const name = row.collector?.full_name || 'Unassigned';
      collectorCounts.set(name, (collectorCounts.get(name) || 0) + 1);
    }
    this.byCollector.set([...collectorCounts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6));
    this.loading.set(false);
  }

  max(list: { value: number }[]) { return Math.max(1, ...list.map(item => item.value)); }
  percent(value: number, max: number) { return Math.round((value / max) * 100); }
}
