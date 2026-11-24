import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login.component').then(m => m.LoginComponent) },
  {
    path: '', canMatch: [authGuard], loadComponent: () => import('./features/shell.component').then(m => m.ShellComponent), children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'transactions/register', loadComponent: () => import('./features/transaction-register.component').then(m => m.TransactionRegisterComponent) },
      { path: 'transactions/search', loadComponent: () => import('./features/search.component').then(m => m.SearchComponent) },
      { path: 'transactions/:receipt', loadComponent: () => import('./features/transaction-detail.component').then(m => m.TransactionDetailComponent) },
      { path: 'admin/middlemen', canMatch: [adminGuard], loadComponent: () => import('./features/middlemen.component').then(m => m.MiddlemenComponent) },
      { path: 'admin/collectors', canMatch: [adminGuard], loadComponent: () => import('./features/collectors.component').then(m => m.CollectorsComponent) },
      { path: 'admin/audit', canMatch: [adminGuard], loadComponent: () => import('./features/audit.component').then(m => m.AuditComponent) },
      { path: 'settings', loadComponent: () => import('./features/settings.component').then(m => m.SettingsComponent) },
      { path: 'admin/settings', redirectTo: 'settings' }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
