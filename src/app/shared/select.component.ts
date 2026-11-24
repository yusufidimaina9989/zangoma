import {
  Component,
  ElementRef,
  HostListener,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

@Component({
  selector: 'app-select',
  standalone: true,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectComponent), multi: true },
  ],
  template: `
  <div class="sel" [class.sel-open]="open()" [class.sel-disabled]="disabled">
    <button
      type="button"
      class="sel-trigger"
      [attr.aria-expanded]="open()"
      aria-haspopup="listbox"
      [disabled]="disabled"
      (click)="toggle($event)"
      (keydown)="onKey($event)">
      <span class="sel-value" [class.sel-placeholder]="!selectedLabel()">
        {{ selectedLabel() || placeholder() }}
      </span>
      <svg class="sel-caret" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    @if (open()) {
      <div class="sel-panel" role="listbox">
        @if (searchable()) {
          <input
            class="sel-search"
            type="text"
            placeholder="Search…"
            [value]="query()"
            (input)="onQuery($event)"
            (click)="$event.stopPropagation()" />
        }
        <ul class="sel-list">
          @for (option of filtered(); track option.value; let i = $index) {
            <li
              role="option"
              [attr.aria-selected]="option.value === value()"
              class="sel-option"
              [class.sel-active]="i === activeIndex()"
              [class.sel-selected]="option.value === value()"
              (mouseenter)="activeIndex.set(i)"
              (mousedown)="$event.preventDefault()"
              (click)="choose(option)">
              <div>
                <span>{{ option.label }}</span>
                @if (option.hint) { <small>{{ option.hint }}</small> }
              </div>
              @if (option.value === value()) { <span class="sel-check" aria-hidden="true">✓</span> }
            </li>
          } @empty {
            <li class="sel-empty">No matches</li>
          }
        </ul>
      </div>
    }
  </div>`,
})
export class SelectComponent implements ControlValueAccessor {
  private host = inject(ElementRef<HTMLElement>);

  options = input<SelectOption[]>([]);
  placeholder = input('Select…');
  searchable = input(false);

  readonly value = signal('');
  readonly open = signal(false);
  readonly query = signal('');
  readonly activeIndex = signal(0);
  disabled = false;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  readonly selectedLabel = computed(
    () => this.options().find(option => option.value === this.value())?.label ?? '',
  );

  readonly filtered = computed(() => {
    const term = this.query().trim().toLowerCase();
    if (!term) return this.options();
    return this.options().filter(
      option =>
        option.label.toLowerCase().includes(term) ||
        (option.hint ?? '').toLowerCase().includes(term),
    );
  });

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  toggle(event: Event) {
    event.stopPropagation();
    if (this.disabled) return;
    this.open.update(open => !open);
    if (this.open()) {
      const index = this.filtered().findIndex(option => option.value === this.value());
      this.activeIndex.set(index < 0 ? 0 : index);
      this.query.set('');
    } else {
      this.onTouched();
    }
  }

  onQuery(event: Event) {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
  }

  choose(option: SelectOption) {
    this.value.set(option.value);
    this.onChange(option.value);
    this.onTouched();
    this.open.set(false);
  }

  onKey(event: KeyboardEvent) {
    const list = this.filtered();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) { this.open.set(true); return; }
        this.activeIndex.update(i => Math.min(i + 1, Math.max(list.length - 1, 0)));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
      case ' ':
        if (this.open() && list[this.activeIndex()]) {
          event.preventDefault();
          this.choose(list[this.activeIndex()]);
        }
        break;
      case 'Escape':
        this.open.set(false);
        this.onTouched();
        break;
      case 'Tab':
        this.open.set(false);
        this.onTouched();
        break;
    }
  }

  @HostListener('document:click', ['$event'])
  closeFromOutside(event: Event) {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
      this.onTouched();
    }
  }
}
