import { Component, Inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { ApiService } from '../../services/api.service';

export interface FlagModalData {
  contentType: 'idea' | 'comment' | 'challenge';
  contentId: string | number;
  contentLabel: string;
}

@Component({
  selector: 'app-flag-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './flag-modal.html',
  styleUrl: './flag-modal.css'
})
export class FlagModalComponent {
  reason = '';
  submitting = signal(false);
  error = signal<string | null>(null);

  constructor(
    private dialogRef: MatDialogRef<FlagModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FlagModalData,
    private apiService: ApiService
  ) {}

  submit() {
    if (this.reason.trim().length < 5) {
      this.error.set('Please provide a reason (at least 5 characters).');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.apiService.flagContent(this.data.contentType, this.data.contentId, this.reason.trim()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.dialogRef.close({ reported: true });
      },
      error: (err) => {
        this.submitting.set(false);
        const msg = err?.error?.error;
        if (msg === 'You have already reported this content') {
          this.error.set('You have already reported this content.');
        } else {
          this.error.set('Failed to submit report. Please try again.');
        }
      }
    });
  }

  cancel() {
    this.dialogRef.close();
  }
}
