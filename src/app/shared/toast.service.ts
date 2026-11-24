import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  kind: ToastKind;
  title?: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  show(message: string, kind: ToastKind = 'info', title?: string, duration = 4200) {
    const id = this.nextId++;
    this.toasts.update(list => [...list, { id, kind, title, message }]);
    if (duration > 0) setTimeout(() => this.dismiss(id), duration);
    return id;
  }

  success(message: string, title = 'Done') { return this.show(message, 'success', title); }
  error(message: string, title = 'Something went wrong') { return this.show(message, 'error', title, 6000); }
  info(message: string, title?: string) { return this.show(message, 'info', title); }
  warning(message: string, title = 'Heads up') { return this.show(message, 'warning', title, 5200); }

  dismiss(id: number) {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }
}
