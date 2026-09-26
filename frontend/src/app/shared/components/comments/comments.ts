import { Component, Input, Output, EventEmitter, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Comment } from '../../models/baseModels';
import { MatIconModule } from "@angular/material/icon";
import { AuthGuardService } from '../../services/auth-guard.service';
import { ApiService } from '../../services/api.service';
import { ContentActionsMenu } from '../content-actions-menu/content-actions-menu';
import { AutofocusDirective } from '../../directives/autofocus.directive';

@Component({
  selector: 'app-comments',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, ContentActionsMenu, AutofocusDirective],
  templateUrl: './comments.html',
  styleUrl: './comments.css'
})
export class Comments implements OnInit {
  @Input() entityId!: string | number;
  @Input() entityType: 'challenge' | 'idea' = 'challenge';
  @Input() allComments: Comment[] = [];
  @Input() compact: boolean = false;
  @Input() parentIsMarked: boolean = false;
  @Input() hideAddCommentButton: boolean = false;
  @Output() voteComment = new EventEmitter<string>();

  private authGuard = inject(AuthGuardService);
  private apiService = inject(ApiService);

  filteredComments = signal<Comment[]>([]);
  displayedComments = signal<Comment[]>([]);
  newCommentText = signal('');
  replyToId = signal<string | null>(null);
  replyText = signal('');
  sortBy = signal<'recent' | 'votes' | 'oldest'>('recent');
  showCommentBox = signal(false);

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
    // Filter top-level comments by entity
    let filtered: Comment[];
    if (this.entityType === 'challenge') {
      filtered = this.allComments.filter(c => c.challengeId === this.entityId?.toString() && !c.parentId);
    } else {
      filtered = this.allComments.filter(c => c.ideaId === this.entityId?.toString() && !c.parentId);
    }

    // Attach replies to each comment
    filtered.forEach(comment => {
      comment.replies = this.allComments.filter(c => c.parentId === comment.id);
    });

    this.sortComments(filtered);
    this.filteredComments.set(filtered);
    this.updateDisplayedComments(filtered);
  }

  sortComments(list: Comment[]) {
    switch (this.sortBy()) {
      case 'votes':
        list.sort((a, b) => b.votes - a.votes);
        break;
      case 'recent':
        list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case 'oldest':
        list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
    }
  }

  updateDisplayedComments(filtered: Comment[]) {
    this.displayedComments.set(this.compact ? filtered.slice(0, 1) : filtered);
  }

  onSortChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.sortBy.set(select.value as 'recent' | 'votes' | 'oldest');
    this.filterAndSortComments();
  }

  toggleCommentBox() {
    if (!this.showCommentBox()) {
      // Opening comment box - check auth
      if (!this.authGuard.requireAuth('comment on this')) {
        return; // Auth modal shown, don't open comment box
      }
    }
    this.showCommentBox.update(v => !v);
    if (!this.showCommentBox()) {
      this.newCommentText.set('');
    }
  }

  submitComment() {
    // Double-check auth before submitting
    if (!this.authGuard.requireAuth('comment on this')) {
      return;
    }

    if (this.newCommentText().trim()) {
      const data: any = { content: this.newCommentText() };
      if (this.entityType === 'idea') {
        data.ideaId = Number(this.entityId);
      } else {
        data.challengeId = Number(this.entityId);
      }

      this.apiService.createComment(data).subscribe({
        next: (res) => {
          const c = res.comment;
          const newComment: Comment = {
            id: String(c.id),
            author: c.authorDisplayName || c.authorUsername || 'Anonymous',
            authorUsername: c.authorUsername,
            content: c.content,
            createdAt: new Date(c.createdAt || Date.now()),
            votes: c.score ?? 0,
            ideaId: this.entityType === 'idea' ? String(this.entityId) : undefined,
            challengeId: this.entityType === 'challenge' ? String(this.entityId) : undefined,
          };
          this.allComments.push(newComment);
          this.newCommentText.set('');
          this.showCommentBox.set(false);
          this.filterAndSortComments();
        },
        error: () => {
          // Keep comment box open so user can retry
        }
      });
    }
  }

  startReply(commentId: string) {
    // Check auth before allowing reply
    if (!this.authGuard.requireAuth('reply to this comment')) {
      return;
    }
    this.replyToId.set(commentId);
    this.replyText.set('');
  }

  cancelReply() {
    this.replyToId.set(null);
    this.replyText.set('');
  }

  submitReply(parentId: string) {
    // Double-check auth before submitting
    if (!this.authGuard.requireAuth('reply to this comment')) {
      return;
    }

    if (this.replyText().trim()) {
      const data: any = { content: this.replyText(), parentId: Number(parentId) };
      if (this.entityType === 'idea') {
        data.ideaId = Number(this.entityId);
      } else {
        data.challengeId = Number(this.entityId);
      }

      this.apiService.createComment(data).subscribe({
        next: (res) => {
          const c = res.comment;
          const newReply: Comment = {
            id: String(c.id),
            author: c.authorDisplayName || c.authorUsername || 'Anonymous',
            authorUsername: c.authorUsername,
            content: c.content,
            createdAt: new Date(c.createdAt || Date.now()),
            votes: c.score ?? 0,
            parentId: String(parentId),
            ideaId: this.entityType === 'idea' ? String(this.entityId) : undefined,
            challengeId: this.entityType === 'challenge' ? String(this.entityId) : undefined,
          };
          this.allComments.push(newReply);
          this.replyText.set('');
          this.replyToId.set(null);
          this.filterAndSortComments();
        },
        error: () => {
          // Keep reply box open so user can retry
        }
      });
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
