import { Component, Input, Output, EventEmitter, Signal, input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Challenge } from '../../models/baseModels';
import { ContentActionsMenu } from '../content-actions-menu/content-actions-menu';

@Component({
  selector: 'app-challenge-card',
  standalone: true,
  imports: [CommonModule, ContentActionsMenu],
  templateUrl: './challenge-card.html',
  styleUrl: './challenge-card.css'
})
export class ChallengeCard implements OnInit {
  challenge = input.required<Challenge>();
  @Input() ideasCount: number = 0;
  @Output() voteChallenge = new EventEmitter<number>();
  
  private router = inject(Router);

  constructor() {
    console.log('ChallengeCard created');
  }

  ngOnInit() {
    console.log('ChallengeCard challenge:', this.challenge());
  }

  getUrgencyClass(urgency: string): string {
    switch (urgency) {
      case 'Critical': return 'urgency-critical';
      case 'High': return 'urgency-high';
      case 'Medium': return 'urgency-medium';
      default: return 'urgency-low';
    }
  }

  formatDeadline(deadline?: Date): string {
    if (!deadline) return '';
    const now = new Date();
    const timeDiff = deadline.getTime() - now.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    if (daysDiff < 0) return 'Deadline passed';
    if (daysDiff === 0) return 'Due today';
    if (daysDiff === 1) return 'Due tomorrow';
    if (daysDiff < 30) return `${daysDiff} days left`;

    const monthsDiff = Math.ceil(daysDiff / 30);
    return `${monthsDiff} month${monthsDiff > 1 ? 's' : ''} left`;
  }

  onVote() {
    this.voteChallenge.emit(this.challenge().id);
  }

  navigateToWorkbench() {
    this.router.navigate(['/article-workbench'], { 
      queryParams: { challengeId: this.challenge().id } 
    });
  }
}
