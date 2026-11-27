import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Header, Footer } from '../shared/components';
import { ApiService } from '../shared/services/api.service';
import { AuthService } from '../shared/services/auth.service';

@Component({
  selector: 'app-reset-password',
  imports: [FormsModule, RouterLink, Header, Footer],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css'
})
export class ResetPassword implements OnInit {
  readonly token = signal<string | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);
  password = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.token.set(this.route.snapshot.queryParamMap.get('token'));
  }

  onSubmit() {
    const token = this.token();
    if (!token || this.busy()) return;

    this.busy.set(true);
    this.error.set(null);
    this.apiService.resetPassword(token, this.password).subscribe({
      next: ({ user, token: authToken }) => {
        this.authService.setLoggedInUser(user, authToken);
        // Drop the spent token from the URL and history
        this.router.navigate(['/'], { replaceUrl: true });
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(err.error?.error || 'Could not reset your password');
      }
    });
  }
}
