import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = localStorage.getItem('auth_token');
  const request = token
    ? req.clone({ headers: req.headers.set('Authorization', `Bearer ${token}`) })
    : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      // Stale/invalid token: drop the session so the UI prompts for sign-in again
      if (token && error instanceof HttpErrorResponse && error.status === 401) {
        authService.logout();
      }
      return throwError(() => error);
    })
  );
};
