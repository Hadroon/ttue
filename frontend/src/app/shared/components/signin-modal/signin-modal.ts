import { Component, Inject, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { GoogleSigninButtonComponent } from '../google-signin-button/google-signin-button';
import { AuthService } from '../../services/auth.service';
import { ApiService, User } from '../../services/api.service';
import { environment } from '../../environments/environment';

export interface SignInModalData {
  title?: string;
  message?: string;
}

export type SignInMode = 'signin' | 'register' | 'forgot';

@Component({
  selector: 'app-signin-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, GoogleSigninButtonComponent],
  templateUrl: './signin-modal.html',
  styleUrl: './signin-modal.css'
})
export class SigninModalComponent implements OnInit {
  readonly devLoginEnabled = signal(false);
  readonly devLoginBusy = signal(false);
  readonly devLoginError = signal<string | null>(null);
  devUsername = '';

  readonly mode = signal<SignInMode>('signin');
  readonly registrationEnabled = signal(true);
  readonly passwordResetEnabled = signal(true);
  readonly busy = signal(false);
  readonly formError = signal<string | null>(null);
  readonly forgotSent = signal(false);
  readonly registerSent = signal(false);
  readonly title = computed(() => {
    switch (this.mode()) {
      case 'register': return 'Create account';
      case 'forgot': return 'Reset password';
      default: return this.data?.title || 'Sign In';
    }
  });

  identifier = '';
  password = '';
  email = '';

  constructor(
    public dialogRef: MatDialogRef<SigninModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SignInModalData | null,
    private authService: AuthService,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.apiService.getAuthConfig().subscribe({
      next: ({ registration, passwordReset }) => {
        this.registrationEnabled.set(registration);
        this.passwordResetEnabled.set(passwordReset);
      }
    });

    // Only local builds ask (main.ts forces prod mode, so isDevMode() can't be used); the backend additionally requires DEV_LOGIN=true and NODE_ENV=development
    if (!environment.production) {
      this.apiService.getDevLoginConfig().subscribe({
        next: ({ enabled }) => this.devLoginEnabled.set(enabled),
        error: () => this.devLoginEnabled.set(false)
      });
    }
  }

  setMode(mode: SignInMode) {
    // Carry a typed email over between forms
    if (mode !== 'signin' && !this.email && this.identifier.includes('@')) {
      this.email = this.identifier;
    }
    this.mode.set(mode);
    this.formError.set(null);
    this.forgotSent.set(false);
    this.registerSent.set(false);
    this.password = '';
  }

  onSignIn() {
    if (this.busy()) return;
    this.busy.set(true);
    this.formError.set(null);
    this.apiService.login(this.identifier.trim(), this.password).subscribe({
      next: ({ user, token }) => {
        this.busy.set(false);
        this.signedIn(user, token);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.formError.set(err.error?.error || 'Sign in failed');
      }
    });
  }

  onRegister() {
    this.sendEmailLink(this.apiService.startRegistration(this.email.trim()), this.registerSent, 'Could not send the confirmation email');
  }

  onForgotPassword() {
    this.sendEmailLink(this.apiService.forgotPassword(this.email.trim()), this.forgotSent, 'Could not send the reset email');
  }

  private sendEmailLink(request: ReturnType<ApiService['forgotPassword']>, sent: typeof this.forgotSent, fallbackError: string) {
    if (this.busy()) return;
    this.busy.set(true);
    this.formError.set(null);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        sent.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.formError.set(err.error?.error || fallbackError);
      }
    });
  }

  private signedIn(user: User, token: string) {
    this.authService.setLoggedInUser(user, token);
    this.dialogRef.close({ success: true, user });
  }

  onDevLogin() {
    this.devLoginBusy.set(true);
    this.devLoginError.set(null);
    this.apiService.devLogin(this.devUsername.trim() || undefined).subscribe({
      next: ({ user, token }) => {
        this.devLoginBusy.set(false);
        this.signedIn(user, token);
      },
      error: () => {
        this.devLoginBusy.set(false);
        this.devLoginError.set('Dev login failed');
      }
    });
  }

  onGoogleLoginSuccess(event: { user: any; token: string; isNewUser: boolean }) {
    this.signedIn(event.user, event.token);
  }

  onGoogleLoginError(error: string) {
    this.authService.setError(error);
  }

  onCancel() {
    this.dialogRef.close({ success: false });
  }
}
