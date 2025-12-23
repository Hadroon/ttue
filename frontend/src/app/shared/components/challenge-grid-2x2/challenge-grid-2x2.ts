import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Challenge, Idea, Comment } from '../../models/baseModels';

@Component({
  selector: 'app-challenge-grid-2x2',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './challenge-grid-2x2.html',
  styleUrl: './challenge-grid-2x2.css'
})
export class ChallengeGrid2x2 {
  @Input() challenge?: Challenge;
  @Input() ideas: Idea[] = [];
  @Input() comments: Comment[] = [];
  @Input() maxIdeas: number = 2;
  @Input() maxComments: number = 3;

  @Output() challengeClick = new EventEmitter<string>();
  @Output() ideaClick = new EventEmitter<string>();
  @Output() voteIdea = new EventEmitter<string>();
  @Output() voteComment = new EventEmitter<string>();
  @Output() viewAllComments = new EventEmitter<string>();

  get filteredIdeas(): Idea[] {
    return this.ideas.slice(0, this.maxIdeas);
  }

  get previewComments(): Comment[] {
    return this.comments.slice(0, this.maxComments);
  }

  get totalComments(): number {
    return this.comments.length;
  }

  getUrgencyClass(urgency?: string): string {
    const classes: Record<string, string> = {
      'Critical': 'urgency-critical',
      'High': 'urgency-high',
      'Medium': 'urgency-medium',
      'Low': 'urgency-low'
    };
    return urgency ? classes[urgency] || '' : '';
  }

  getStatusClass(status?: string): string {
    const classes: Record<string, string> = {
      'New': 'status-new',
      'Under Review': 'status-review',
      'In Development': 'status-development',
      'Implemented': 'status-implemented'
    };
    return status ? classes[status] || '' : '';
  }

  formatDeadline(deadline?: Date): string {
    if (!deadline) return '';
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return 'Ended';
    if (days === 0) return 'Ends today';
    if (days === 1) return '1 day left';
    if (days < 7) return `${days} days left`;
    if (days < 30) return `${Math.floor(days / 7)} weeks left`;
    return `${Math.floor(days / 30)} months left`;
  }

  onChallengeClick(): void {
    if (this.challenge?.id) {
      this.challengeClick.emit(this.challenge.id);
    }
  }

  onIdeaClick(ideaId: string): void {
    this.ideaClick.emit(ideaId);
  }

  onVoteIdea(ideaId: string, event: Event): void {
    event.stopPropagation();
    this.voteIdea.emit(ideaId);
  }

  onVoteComment(commentId: string, event: Event): void {
    event.stopPropagation();
    this.voteComment.emit(commentId);
  }

  onViewAllComments(): void {
    if (this.challenge?.id) {
      this.viewAllComments.emit(this.challenge.id);
    }
  }
}
