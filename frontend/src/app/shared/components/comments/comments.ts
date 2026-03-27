import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Comment } from '../../models/baseModels';
import { MatIconModule } from "@angular/material/icon";
import { AuthGuardService } from '../../services/auth-guard.service';
import { ApiService } from '../../services/api.service';
import { ContentActionsMenu } from '../content-actions-menu/content-actions-menu';

@Component({
  selector: 'app-comments',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, ContentActionsMenu],
  templateUrl: './comments.html',
  styleUrl: './comments.css'
})
export class Comments implements OnInit {
  @Input() entityId!: string | number;
  @Input() entityType: 'challenge' | 'idea' = 'challenge';
  @Input() allComments: Comment[] = [];
  @Input() compact: boolean = false;
  @Output() voteComment = new EventEmitter<string>();

  private authGuard = inject(AuthGuardService);
  private apiService = inject(ApiService);

  filteredComments: Comment[] = [];
  displayedComments: Comment[] = [];
  newCommentText: string = '';
  replyToId: string | null = null;
  replyText: string = '';
  sortBy: 'recent' | 'votes' | 'oldest' = 'recent';
  showCommentBox: boolean = false;

  ngOnInit() {
    console.log('Comments initialized:', {
      entityId: this.entityId,
      entityType: this.entityType,
      allComments: this.allComments,
      allCommentsCount: this.allComments.length
    });
    this.filterAndSortComments();
  }

  ngOnChanges() {
    console.log('Comments changed:', {
      entityId: this.entityId,
      entityType: this.entityType,
      allComments: this.allComments
    });
    this.filterAndSortComments();
  }

  filterAndSortComments() {
    console.log('Filtering comments for:', this.entityType, this.entityId);
    // Filter top-level comments by entity
    if (this.entityType === 'challenge') {
      this.filteredComments = this.allComments.filter(c => c.challengeId === this.entityId?.toString() && !c.parentId);
    } else {
      this.filteredComments = this.allComments.filter(c => c.ideaId === this.entityId?.toString() && !c.parentId);
    }
    console.log('Filtered comments:', this.filteredComments.length, this.filteredComments);

    // Attach replies to each comment
    this.filteredComments.forEach(comment => {
      comment.replies = this.allComments.filter(c => c.parentId === comment.id);
    });

    this.sortComments();
    this.updateDisplayedComments();
  }

  sortComments() {
    switch (this.sortBy) {
      case 'votes':
        this.filteredComments.sort((a, b) => b.votes - a.votes);
        break;
      case 'recent':
        this.filteredComments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case 'oldest':
        this.filteredComments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
    }
  }

  updateDisplayedComments() {
    if (this.compact) {
      this.displayedComments = this.filteredComments.slice(0, 1);
    } else {
      this.displayedComments = this.filteredComments;
    }
  }

  onSortChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.sortBy = select.value as 'recent' | 'votes' | 'oldest';
    this.filterAndSortComments();
  }

  toggleCommentBox() {
    if (!this.showCommentBox) {
      // Opening comment box - check auth
      if (!this.authGuard.requireAuth('comment on this')) {
        return; // Auth modal shown, don't open comment box
      }
    }
    this.showCommentBox = !this.showCommentBox;
    if (!this.showCommentBox) {
      this.newCommentText = '';
    }
  }

  submitComment() {
    // Double-check auth before submitting
    if (!this.authGuard.requireAuth('comment on this')) {
      return;
    }

    if (this.newCommentText.trim()) {
      const newComment: Comment = {
        id: 'comment-' + Date.now(),
        author: 'Current User',
        content: this.newCommentText,
        createdAt: new Date(),
        votes: 0,
        challengeId: this.entityType === 'challenge' ? String(this.entityId) : undefined,
        ideaId: this.entityType === 'idea' ? String(this.entityId) : undefined
      };
      
      this.allComments.push(newComment);
      this.newCommentText = '';
      this.showCommentBox = false;
      this.filterAndSortComments();
    }
  }

  startReply(commentId: string) {
    // Check auth before allowing reply
    if (!this.authGuard.requireAuth('reply to this comment')) {
      return;
    }
    this.replyToId = commentId;
    this.replyText = '';
  }

  cancelReply() {
    this.replyToId = null;
    this.replyText = '';
  }

  submitReply(parentId: string) {
    // Double-check auth before submitting
    if (!this.authGuard.requireAuth('reply to this comment')) {
      return;
    }

    if (this.replyText.trim()) {
      const newReply: Comment = {
        id: 'reply-' + Date.now(),
        author: 'Current User',
        content: this.replyText,
        createdAt: new Date(),
        votes: 0,
        parentId: parentId,
        challengeId: this.entityType === 'challenge' ? String(this.entityId) : undefined,
        ideaId: this.entityType === 'idea' ? String(this.entityId) : undefined
      };
      
      this.allComments.push(newReply);
      this.replyText = '';
      this.replyToId = null;
      this.filterAndSortComments();
    }
  }

  onVoteComment(commentId: string) {
    // Check auth before voting
    if (!this.authGuard.requireAuth('vote on comments')) {
      return;
    }

    // Emit event to parent component to handle the vote
    this.voteComment.emit(commentId);
  }

  formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }
}
