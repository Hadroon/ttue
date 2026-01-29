import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-add-challenge-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatChipsModule
  ],
  templateUrl: './add-challenge-modal.html',
  styleUrl: './add-challenge-modal.css'
})
export class AddChallengeModalComponent {
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

  constructor(
    public dialogRef: MatDialogRef<AddChallengeModalComponent>,
    private apiService: ApiService
  ) {}

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
        this.dialogRef.close({ success: true, challenge: response.data });
      },
      error: (error) => {
        this.isSubmitting = false;
        this.errorMessage = error.error?.message || 'Failed to create challenge';
      }
    });
  }

  onCancel() {
    this.dialogRef.close({ success: false });
  }
}
