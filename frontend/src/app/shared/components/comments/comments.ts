import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Comment } from '../../models/baseModels';

@Component({
  selector: 'app-comments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comments.html',
  styleUrl: './comments.css'
})
export class Comments implements OnInit {
  @Input() entityId!: string;
  @Input() entityType: 'challenge' | 'idea' = 'challenge';
  @Input() allComments: Comment[] = [];
  @Input() compact: boolean = false;

  filteredComments: Comment[] = [];
  displayedComments: Comment[] = [];
  newCommentText: string = '';
  replyToId: string | null = null;
  replyText: string = '';
  sortBy: 'recent' | 'votes' | 'oldest' = 'recent';
  showCommentBox: boolean = false;

  ngOnInit() {
    this.filterAndSortComments();
  }

  ngOnChanges() {
    this.filterAndSortComments();
  }

  filterAndSortComments() {
    // Filter top-level comments by entity
    if (this.entityType === 'challenge') {
      this.filteredComments = this.allComments.filter(c => c.challengeId === this.entityId && !c.parentId);
    } else {
      this.filteredComments = this.allComments.filter(c => c.ideaId === this.entityId && !c.parentId);
    }

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
      this.displayedComments = this.filteredComments.slice(0, 3);
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
    this.showCommentBox = !this.showCommentBox;
    if (!this.showCommentBox) {
      this.newCommentText = '';
    }
  }

  submitComment() {
    if (this.newCommentText.trim()) {
      const newComment: Comment = {
        id: 'comment-' + Date.now(),
        author: 'Current User',
        content: this.newCommentText,
        createdAt: new Date(),
        votes: 0,
        challengeId: this.entityType === 'challenge' ? this.entityId : undefined,
        ideaId: this.entityType === 'idea' ? this.entityId : undefined
      };
      
      this.allComments.push(newComment);
      this.newCommentText = '';
      this.showCommentBox = false;
      this.filterAndSortComments();
    }
  }

  startReply(commentId: string) {
    this.replyToId = commentId;
    this.replyText = '';
  }

  cancelReply() {
    this.replyToId = null;
    this.replyText = '';
  }

  submitReply(parentId: string) {
    if (this.replyText.trim()) {
      const newReply: Comment = {
        id: 'reply-' + Date.now(),
        author: 'Current User',
        content: this.replyText,
        createdAt: new Date(),
        votes: 0,
        parentId: parentId,
        challengeId: this.entityType === 'challenge' ? this.entityId : undefined,
        ideaId: this.entityType === 'idea' ? this.entityId : undefined
      };
      
      this.allComments.push(newReply);
      this.replyText = '';
      this.replyToId = null;
      this.filterAndSortComments();
    }
  }

  onVoteComment(commentId: string) {
    const comment = this.allComments.find(c => c.id === commentId);
    if (comment) {
      if (comment.voted) {
        comment.votes--;
        comment.voted = false;
      } else {
        comment.votes++;
        comment.voted = true;
      }
    }
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
