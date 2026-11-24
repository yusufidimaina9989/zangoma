import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../core/supabase.service';
@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-header">
      <div>
        <p class="eyebrow">Accountability</p>
        <h1>Audit Logs</h1>
      </div>
    </div>
    <section class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Entity</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            @for(r of rows();track r.id){
            <tr>
              <td>{{r.action}}</td>
              <td>{{r.entity_type}}</td>
              <td>{{r.created_at|date:'medium'}}</td>
            </tr>
            }@empty{
            <tr>
              <td colspan="3" class="empty">No audit entries</td>
            </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `
})
export class AuditComponent implements OnInit {
  rows = signal<any[]>([]);

  constructor(private db: SupabaseService) {}

  async ngOnInit() {
    const { data } = await this.db.client
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    this.rows.set(data || []);
  }
}