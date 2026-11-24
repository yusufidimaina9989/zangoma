import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  template: `
  <div class="toast-stack" aria-live="polite" aria-atomic="false">
    @for (toast of toasts.toasts(); track toast.id) {
      <div class="toast" [class]="'toast toast-' + toast.kind" role="status">
        <span class="toast-icon" aria-hidden="true">
          @switch (toast.kind) {
            @case ('success') { ✓ }
            @case ('error') { ! }
            @case ('warning') { ! }
            @default { i }
          }
        </span>
        <div class="toast-body">
          @if (toast.title) { <strong>{{ toast.title }}</strong> }
          <p>{{ toast.message }}</p>
        </div>
        <button type="button" class="toast-close" (click)="toasts.dismiss(toast.id)" aria-label="Dismiss notification">×</button>
      </div>
    }
  </div>`,
})
export class ToastContainerComponent {
  toasts = inject(ToastService);
}
