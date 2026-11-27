import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Header, Footer } from '../shared/components';
import { SigninModalComponent } from '../shared/components/signin-modal/signin-modal';
import { ApiService } from '../shared/services/api.service';
import { AuthService } from '../shared/services/auth.service';

@Component({
  selector: 'app-complete-registration',
  imports: [FormsModule, Header, Footer],
  templateUrl: './complete-registration.html',
  styleUrl: './complete-registration.css'
})
export class CompleteRegistration implements OnInit {
  readonly state = signal<'checking' | 'ready' | 'invalid'>('checking');
  readonly email = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly usernameError = signal<string | null>(null);
  readonly usernameOk = signal(false);
  readonly passwordError = signal<string | null>(null);
  readonly showPassword = signal(false);
  username = '';
  password = '';
  private token = '';
  private lastCheckedUsername = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private apiService: ApiService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.state.set('invalid');
      return;
    }
    this.apiService.verifyRegistration(this.token).subscribe({
      next: ({ email }) => {
        this.email.set(email);
        this.state.set('ready');
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.error || null);
        this.state.set('invalid');
      }
    });
  }

  onUsernameInput() {
    this.usernameOk.set(false);
    this.usernameError.set(null);
  }

  checkUsername() {
    const username = this.username.trim();
    if (!username || username === this.lastCheckedUsername) return;
    this.lastCheckedUsername = username;
    this.apiService.checkUsername(username).subscribe({
      next: ({ available, error }) => {
        if (username !== this.username.trim()) return;
        this.usernameOk.set(available);
        this.usernameError.set(available ? null : error || 'Username not available');
      },
      error: () => this.lastCheckedUsername = ''
    });
  }

  onSubmit() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.passwordError.set(null);
    this.apiService.completeRegistration(this.token, this.username.trim(), this.password).subscribe({
      next: ({ user, token }) => {
        this.authService.setLoggedInUser(user, token);
        // Drop the spent token from the URL and history
        this.router.navigate(['/'], { replaceUrl: true });
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        const message = err.error?.error || 'Could not create your account';
        if (err.error?.field === 'username') {
          this.usernameOk.set(false);
          this.usernameError.set(message);
        } else if (err.error?.field === 'password') {
          this.passwordError.set(message);
        } else {
          this.error.set(message);
        }
      }
    });
  }

  openSignIn() {
    this.dialog.open(SigninModalComponent, {
      width: '400px',
      panelClass: 'signin-modal',
      data: { title: 'Sign In' }
    });
  }
}
