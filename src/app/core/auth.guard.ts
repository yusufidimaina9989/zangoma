import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanMatchFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.loading()) return false;
  return auth.profile() ? true : router.createUrlTree(['/login']);
};

export const adminGuard: CanMatchFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.profile()) return router.createUrlTree(['/login']);
  return auth.profile()?.role === 'admin' ? true : router.createUrlTree(['/dashboard']);
};
