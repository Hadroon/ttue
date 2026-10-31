import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Header, RichTextEditor } from '../shared/components';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { SigninModalComponent } from '../shared/components/signin-modal/signin-modal';
import { AuthService } from '../shared/services/auth.service';
import { ApiService, ChallengeType } from '../shared/services/api.service';
import { AuthGuardService } from '../shared/services/auth-guard.service';
import { CivicDomain } from '../shared/models/civic-profile';

@Component({
  selector: 'app-add-challenge',
  imports: [
    CommonModule,
    FormsModule,
    Header,
    RichTextEditor,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
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
  authGuard = inject(AuthGuardService);
  router = inject(Router);

  readonly isAuthenticated = signal(false);
  isLoading = false;

  // Category, domain, urgency and reward pool are hidden in the form for now,
  // but the backend still requires them, so sensible defaults are submitted.
  challenge = {
    type: 'challenge' as ChallengeType,
    category: 'Other',
    domainSlug: 'general-civic',
    title: '',
    description: '',
    urgency: 'Medium',
    rewardPool: '',
    deadline: null as Date | null,
    tags: [] as string[]
  };

  readonly typeOptions: { value: ChallengeType; label: string; icon: string; description: string }[] = [
    { value: 'challenge', label: 'Challenge', icon: '🎯', description: 'Describe a problem for the community to solve.' },
    { value: 'proposal', label: 'Proposal', icon: '💡', description: 'Put forward a concrete change or solution.' }
  ];

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
  readonly domains = signal<CivicDomain[]>([]);
  readonly domainsLoading = signal(true);

  readonly minDeadline = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  })();

  tagInput = '';
  isSubmitting = false;
  errorMessage = '';

  ngOnInit() {
    this.checkAuthentication();
  }

  private loadDomains() {
    this.apiService.getDomains().subscribe({
      next: ({ domains }) => {
        this.domains.set(domains);
        this.domainsLoading.set(false);
      },
      error: () => {
        this.domains.set([{ id: 0, slug: 'general-civic', name: 'General Civic', description: null }]);
        this.challenge.domainSlug = 'general-civic';
        this.domainsLoading.set(false);
      }
    });
  }

  checkAuthentication() {
    const user = this.authService.currentUser();
    
    if (!user) {
      this.openSignInModal();
    } else {
      this.isAuthenticated.set(true);
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
        this.isAuthenticated.set(true);
      } else {
        this.router.navigate(['/challenges']);
      }
    });
  }

  addTag() {
    const tag = this.tagInput.trim();
    if (tag && !this.challenge.tags.includes(tag)) {
      if (this.challenge.tags.length >= 10) {
        this.errorMessage = 'You can add at most 10 tags';
        return;
      }
      this.challenge.tags.push(tag);
      this.tagInput = '';
    }
  }

  removeTag(tag: string) {
    this.challenge.tags = this.challenge.tags.filter(t => t !== tag);
  }

  onSubmit() {
    if (!this.authGuard.requireAuth('submit a challenge')) {
      return;
    }
    if (!this.challenge.title || !this.challenge.description) {
      this.errorMessage = 'Please fill in all required fields';
      return;
    }
    if (this.challenge.deadline && this.challenge.deadline < this.minDeadline) {
      this.errorMessage = 'Deadline cannot be in the past';
      return;
    }
    // The description is stored as HTML, so the limit includes formatting markup.
    if (this.challenge.description.length > 5000) {
      this.errorMessage = 'Description is too long (max 5000 characters including formatting)';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const challengeData = {
      type: this.challenge.type,
      category: this.challenge.category,
      domainSlug: this.challenge.domainSlug,
      title: this.challenge.title,
      description: this.challenge.description,
      urgency: this.challenge.urgency,
      rewardPool: this.challenge.rewardPool || undefined,
      deadline: this.challenge.deadline?.toISOString(),
      tags: this.challenge.tags
    };

    this.apiService.createChallenge(challengeData).subscribe({
      next: (response) => {
        console.log('Challenge created:', response);
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
