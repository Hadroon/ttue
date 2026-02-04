import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Header } from '../shared/components';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { SigninModalComponent } from '../shared/components/signin-modal/signin-modal';
import { AuthService } from '../shared/services/auth.service';
import { ApiService } from '../shared/services/api.service';

@Component({
  selector: 'app-add-challenge',
  imports: [
    CommonModule,
    FormsModule,
    Header,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatChipsModule
  ],
  templateUrl: './add-challenge.html',
  styleUrl: './add-challenge.css'
})
export class AddChallenge implements OnInit {
  dialog = inject(MatDialog);
  authService = inject(AuthService);
  apiService = inject(ApiService);
  router = inject(Router);

  isAuthenticated = false;
  isLoading = false;

  challenge = {
    category: '',
    title: '',
    description: '',
    urgency: 'Medium',
    rewardPool: '',
    deadline: null as Date | null,
    tags: [] as string[]
  };

  categories = [
    'Environment',
    'Health',
    'Education',
    'Economy',
    'Technology',
    'Social',
    'Infrastructure',
    'Other'
  ];

  urgencyLevels = ['Low', 'Medium', 'High', 'Critical'];

  tagInput = '';
  isSubmitting = false;
  errorMessage = '';

  ngOnInit() {
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
        this.router.navigate(['/challenges']);
      }
    });
  }

  addTag() {
    const tag = this.tagInput.trim();
    if (tag && !this.challenge.tags.includes(tag)) {
      this.challenge.tags.push(tag);
      this.tagInput = '';
    }
  }

  removeTag(tag: string) {
    this.challenge.tags = this.challenge.tags.filter(t => t !== tag);
  }

  onSubmit() {
    if (!this.challenge.title || !this.challenge.category || !this.challenge.description) {
      this.errorMessage = 'Please fill in all required fields';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const challengeData = {
      category: this.challenge.category,
      title: this.challenge.title,
      description: this.challenge.description,
      urgency: this.challenge.urgency,
      rewardPool: this.challenge.rewardPool || undefined,
      deadline: this.challenge.deadline?.toISOString(),
      tags: this.challenge.tags
    };

    this.apiService.createChallenge(challengeData).subscribe({
      next: (response) => {
        console.log('Challenge created:', response.data);
        this.router.navigate(['/challenges']);
      },
      error: (error) => {
        this.isSubmitting = false;
        this.errorMessage = error.error?.message || 'Failed to create challenge';
      }
    });
  }

  onCancel() {
    this.router.navigate(['/challenges']);
  }
}
