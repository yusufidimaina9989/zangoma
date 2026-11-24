import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private supabase: SupabaseService) {}

  private async request(path: string, init: RequestInit = {}) {
    const headers = await this.supabase.bearerHeaders();
    const combined = new Headers(init.headers as HeadersInit);
    combined.set('Content-Type', 'application/json');
    if (headers['Authorization']) combined.set('Authorization', headers['Authorization']);
    const response = await fetch(`/.netlify/functions/${path}`, { ...init, headers: combined }).catch(() => null);
    if (!response) {
      throw new Error('Cannot reach the backend. Start the full stack with "npm run dev:netlify" and open http://localhost:8888 (running "npm start" alone does not provide the API).');
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Request failed');
    return body;
  }

  createCollector(payload: unknown) { return this.request('create-collector', { method: 'POST', body: JSON.stringify(payload) }); }
  createTransaction(payload: unknown) { return this.request('create-transaction', { method: 'POST', body: JSON.stringify(payload) }); }
  search(params: URLSearchParams) { return this.request(`search-transactions?${params}`, { method: 'GET' }); }
  signedImages(paths: string[]): Promise<{ signed: Record<string, string> }> { return this.request('signed-images', { method: 'POST', body: JSON.stringify({ paths }) }); }
  voidTransaction(transaction_id: string, reason: string) { return this.request('void-transaction', { method: 'POST', body: JSON.stringify({ transaction_id, reason }) }); }
  updateTransaction(payload: Record<string, unknown>) { return this.request('update-transaction', { method: 'PATCH', body: JSON.stringify(payload) }); }
  deleteTransaction(transaction_id: string) { return this.request('delete-transaction', { method: 'POST', body: JSON.stringify({ transaction_id }) }); }
}
