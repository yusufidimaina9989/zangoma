import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({ standalone: true, imports: [RouterOutlet, RouterLink, RouterLinkActive], template: `
<div class="app-shell">
  <aside class="sidebar">
    <div class="px-5 py-5 border-b border-green-700"><div class="text-xl font-bold">Livestock Market</div><p class="text-xs text-green-100">Transaction Registry</p></div>
    <nav class="p-3 space-y-1">
      <a routerLink="/dashboard" routerLinkActive="active" class="nav-link">Dashboard</a>
      <a routerLink="/transactions/register" class="nav-link">Register Transaction</a>
      <a routerLink="/transactions/search" class="nav-link">{{ auth.profile()?.role === 'admin' ? 'Search Records' : 'My Transactions' }}</a>
      @if (auth.profile()?.role === 'admin') { <a routerLink="/admin/middlemen" class="nav-link">Middlemen</a><a routerLink="/admin/collectors" class="nav-link">Data Collectors</a><a routerLink="/admin/audit" class="nav-link">Audit Logs</a> }
      <a routerLink="/settings" class="nav-link">Settings</a>
      <button (click)="auth.signOut()" class="nav-link w-full text-left mt-6 text-red-100">Logout</button>
    </nav>
  </aside>

  <header class="mobile-topbar">
    <div class="mobile-brand">
      <span class="mobile-logo">LVM</span>
      <div>
        <strong>Livestock Registry</strong>
        <small>{{ auth.profile()?.full_name }}</small>
      </div>
    </div>
    <button type="button" class="icon-button" (click)="auth.signOut()" aria-label="Sign out">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/>
        <path d="M10 17l-5-5 5-5"/>
        <path d="M5 12h11"/>
      </svg>
    </button>
  </header>

  <main class="content"><router-outlet /></main>

  <nav class="tabbar" aria-label="Primary">
    <a routerLink="/dashboard" routerLinkActive="tab-active" class="tab">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
        <rect x="3" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8"/>
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8"/>
      </svg>
      <span>Home</span>
    </a>
    <a routerLink="/transactions/register" routerLinkActive="tab-active" class="tab">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
        <circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>
      </svg>
      <span>Register</span>
    </a>
    <a routerLink="/transactions/search" routerLinkActive="tab-active" class="tab">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
        <path d="M8 6h12M8 12h12M8 18h12"/>
        <circle cx="4" cy="6" r="1.3" fill="currentColor" stroke="none"/>
        <circle cx="4" cy="12" r="1.3" fill="currentColor" stroke="none"/>
        <circle cx="4" cy="18" r="1.3" fill="currentColor" stroke="none"/>
      </svg>
      <span>Records</span>
    </a>
    @if (auth.profile()?.role === 'admin') {
      <button type="button" class="tab" [class.tab-active]="moreOpen()" (click)="moreOpen.set(!moreOpen())">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>
        </svg>
        <span>More</span>
      </button>
    }
    <a routerLink="/settings" routerLinkActive="tab-active" class="tab">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
        <path d="M4 7h9M17 7h3M4 17h4M12 17h8"/>
        <circle cx="15" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/>
      </svg>
      <span>Settings</span>
    </a>
  </nav>

  @if (moreOpen()) {
    <div class="sheet-backdrop" (click)="moreOpen.set(false)"></div>
    <div class="sheet" role="menu">
      <div class="sheet-handle"></div>
      <a routerLink="/admin/middlemen" (click)="moreOpen.set(false)" role="menuitem">Middlemen</a>
      <a routerLink="/admin/collectors" (click)="moreOpen.set(false)" role="menuitem">Data Collectors</a>
      <a routerLink="/admin/audit" (click)="moreOpen.set(false)" role="menuitem">Audit Logs</a>
      <a routerLink="/settings" (click)="moreOpen.set(false)" role="menuitem">Market settings</a>
      <button type="button" (click)="moreOpen.set(false); auth.signOut()" role="menuitem" class="sheet-danger">Sign out</button>
    </div>
  }
</div>` })
export class ShellComponent {
  moreOpen = signal(false);
  constructor(public auth: AuthService) {}
}

