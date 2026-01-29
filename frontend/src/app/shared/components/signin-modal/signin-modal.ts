import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { GoogleSigninButtonComponent } from '../google-signin-button/google-signin-button';
import { AuthService } from '../../services/auth.service';

export interface SignInModalData {
  title?: string;
  message?: string;
}

@Component({
  selector: 'app-signin-modal',
  standalone: true,
  imports: [CommonModule, MatDialogModule, GoogleSigninButtonComponent],
  templateUrl: './signin-modal.html',
  styleUrl: './signin-modal.css'
})
export class SigninModalComponent {
  constructor(
    public dialogRef: MatDialogRef<SigninModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SignInModalData | null,
    private authService: AuthService
  ) {}

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
