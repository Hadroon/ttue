import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { GoogleSigninButtonComponent } from '../google-signin-button/google-signin-button';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { environment } from '../../environments/environment';

export interface SignInModalData {
  title?: string;
  message?: string;
}

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

  constructor(
    public dialogRef: MatDialogRef<SigninModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SignInModalData | null,
    private authService: AuthService,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    // Only local builds ask (main.ts forces prod mode, so isDevMode() can't be used); the backend additionally requires DEV_LOGIN=true and NODE_ENV=development
    if (!environment.production) {
      this.apiService.getDevLoginConfig().subscribe({
        next: ({ enabled }) => this.devLoginEnabled.set(enabled),
        error: () => this.devLoginEnabled.set(false)
      });
    }
  }

  onDevLogin() {
    this.devLoginBusy.set(true);
    this.devLoginError.set(null);
    this.apiService.devLogin(this.devUsername.trim() || undefined).subscribe({
      next: ({ user, token }) => {
        this.devLoginBusy.set(false);
        this.authService.setLoggedInUser(user, token);
        this.dialogRef.close({ success: true, user });
      },
      error: () => {
        this.devLoginBusy.set(false);
        this.devLoginError.set('Dev login failed');
      }
    });
  }

  onGoogleLoginSuccess(event: { user: any; token: string; isNewUser: boolean }) {
    this.authService.setLoggedInUser(event.user, event.token);
    console.log('User logged in:', event.user);
    console.log('ref:', this.dialogRef);
    this.dialogRef.close({ success: true, user: event.user });
  }

  onGoogleLoginError(error: string) {
    this.authService.setError(error);
  }

  onCancel() {
    this.dialogRef.close({ success: false });
  }
}
