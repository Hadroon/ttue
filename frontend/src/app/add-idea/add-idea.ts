import { Component, inject, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Header } from '../shared/components';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { SigninModalComponent } from '../shared/components/signin-modal/signin-modal';
import { AuthService } from '../shared/services/auth.service';
import { ApiService } from '../shared/services/api.service';

@Component({
  selector: 'app-add-idea',
  imports: [
    CommonModule,
    FormsModule,
    Header,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  templateUrl: './add-idea.html',
  styleUrl: './add-idea.css'
})
export class AddIdea implements OnInit {
  dialog = inject(MatDialog);
  authService = inject(AuthService);
  apiService = inject(ApiService);
  router = inject(Router);
  route = inject(ActivatedRoute);

  isAuthenticated = false;
  isSubmitting = false;
  errorMessage = '';
  challengeId: number | null = null;

  idea = {
    title: '',
    content: ''
  };

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const id = params['challengeId'];
      if (id) {
        this.challengeId = Number(id);
      }
    });
    this.checkAuthentication();
  }

  checkAuthentication() {
    const user = this.authService.currentUser();
    if (!user) {
      this.openSignInModal();
    } else {
      this.isAuthenticated = true;
    }
  }

  openSignInModal() {
    const dialogRef = this.dialog.open(SigninModalComponent, {
      width: '400px',
      maxWidth: '90vw',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        this.isAuthenticated = true;
      } else {
        this.navigateBack();
      }
    });
  }

  onSubmit() {
    if (!this.idea.title.trim() || !this.idea.content.trim()) {
      this.errorMessage = 'Please fill in all required fields';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const ideaData = {
      title: this.idea.title.trim(),
      content: this.idea.content.trim(),
      ...(this.challengeId != null ? { challengeId: this.challengeId } : {})
    };

    this.apiService.createIdea(ideaData).subscribe({
      next: () => {
        this.navigateBack();
      },
      error: (error: any) => {
        this.isSubmitting = false;
        this.errorMessage = error.error?.error || 'Failed to submit idea';
      }
    });
  }

  onCancel() {
    this.navigateBack();
  }

  private navigateBack() {
    if (this.challengeId != null) {
      this.router.navigate(['/article-workbench'], { queryParams: { challengeId: this.challengeId } });
    } else {
      this.router.navigate(['/challenges']);
    }
  }
}
