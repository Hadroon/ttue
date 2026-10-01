import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject, signal, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Comment } from '../../models/baseModels';
import { MatIconModule } from "@angular/material/icon";
import { AuthGuardService } from '../../services/auth-guard.service';
import { AuthService } from '../../services/auth.service';
import { ApiService, Comment as ApiComment } from '../../services/api.service';
import { ContentActionsMenu } from '../content-actions-menu/content-actions-menu';
import { AutofocusDirective } from '../../directives/autofocus.directive';

export type CommentSort = 'recent' | 'votes' | 'oldest' | 'replies';

@Component({
  selector: 'app-comments',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, ContentActionsMenu, AutofocusDirective],
  templateUrl: './comments.html',
  styleUrl: './comments.css'
})
export class Comments implements OnInit, OnChanges {
  @Input() entityId!: string | number;
  @Input() entityType: 'challenge' | 'idea' | 'draft' = 'challenge';
  @Input() allComments: Comment[] = [];
  @Input() compact: boolean = false;
  @Input() parentIsMarked: boolean = false;
  @Input() hideAddCommentButton: boolean = false;
  // When true, sorting/paging is done by the parent via the backend
  @Input() serverPaging: boolean = false;
  @Input() totalCount: number = 0;
  @Input() hasMore: boolean = false;
  @Input() loadingMore: boolean = false;
  // When true, the component fetches, pages, sorts and votes on its own thread
  @Input() autoLoad: boolean = false;
  @Output() voteComment = new EventEmitter<string>();
  @Output() sortChange = new EventEmitter<CommentSort>();
  @Output() loadMore = new EventEmitter<void>();

  private authGuard = inject(AuthGuardService);
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private page = 1;
  loading = signal(false);

  constructor() {
    // Refetch so voted state reflects the logged-in user
    this.authService.loginSuccess$.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => {
      if (this.autoLoad) {
        this.fetchThread(1);
      }
    });
  }

  filteredComments = signal<Comment[]>([]);
  displayedComments = signal<Comment[]>([]);
  newCommentText = signal('');
  replyToId = signal<string | null>(null);
  replyText = signal('');
  expandedReplies = signal<ReadonlySet<string>>(new Set());
  sortBy = signal<CommentSort>('recent');
  showCommentBox = signal(false);
  // Top-level comments posted locally since the last totalCount from the server
  private addedSinceLoad = signal(0);

  get commentCount(): number {
    return this.serverPaging || this.autoLoad ? this.totalCount + this.addedSinceLoad() : this.filteredComments().length;
  }

  get isServerPaged(): boolean {
    return this.serverPaging || this.autoLoad;
  }

  ngOnInit() {
    this.filterAndSortComments();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['totalCount']) {
      this.addedSinceLoad.set(0);
    }
    if (this.autoLoad && (changes['entityId'] || changes['autoLoad'])) {
      this.fetchThread(1);
      return;
    }
    this.filterAndSortComments();
  }

  private fetchThread(page: number) {
    if (this.entityId == null || this.entityId === '') {
      return;
    }
    const append = page > 1;
    if (append) {
      this.loadingMore = true;
    } else if (this.allComments.length === 0) {
      this.loading.set(true);
    }
    this.apiService.getCommentThread(this.entityType, Number(this.entityId), { sort: this.sortBy(), page }).subscribe({
      next: (res) => {
        const mapped = res.comments.map(c => this.toViewComment(c));
        if (append) {
          // Skip items already shown (e.g. shifted into this page by newly posted comments)
          const existing = new Set(this.allComments.map(c => c.id));
          this.allComments = [...this.allComments, ...mapped.filter(c => !existing.has(c.id))];
        } else {
          this.allComments = mapped;
        }
        this.page = res.page;
        this.totalCount = res.total;
        this.addedSinceLoad.set(0);
        this.hasMore = res.hasNext;
        this.loadingMore = false;
        this.loading.set(false);
        this.filterAndSortComments();
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingMore = false;
        this.loading.set(false);
        this.cdr.markForCheck();
      }
    });
  }

  private toViewComment(c: ApiComment): Comment {
    return {
      id: String(c.id),
      author: c.authorDisplayName || c.authorUsername || 'Anonymous',
      authorUsername: c.authorUsername,
      content: c.content,
      createdAt: new Date(c.createdAt || c.created_at || Date.now()),
      votes: c.score ?? 0,
      voted: c.voted,
      isMarked: c.isMarked,
      parentId: c.parentId != null ? String(c.parentId) : undefined,
      ideaId: c.ideaId != null ? String(c.ideaId) : undefined,
      challengeId: c.challengeId != null ? String(c.challengeId) : undefined,
      draftId: c.draftId != null ? String(c.draftId) : undefined,
    };
  }

  onLoadMore() {
    if (this.autoLoad) {
      if (!this.loadingMore) {
        this.fetchThread(this.page + 1);
      }
      return;
    }
    this.loadMore.emit();
  }

  filterAndSortComments() {
    // Filter top-level comments by entity
    const key = ({ challenge: 'challengeId', idea: 'ideaId', draft: 'draftId' } as const)[this.entityType];
    const filtered = this.allComments.filter(c => c[key] === this.entityId?.toString() && !c.parentId);

    // Attach replies to each comment
    filtered.forEach(comment => {
      comment.replies = this.allComments.filter(c => c.parentId === comment.id);
    });

    if (!this.isServerPaged) {
      this.sortComments(filtered);
    }
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
      case 'replies':
        list.sort((a, b) =>
          (b.replies?.length ?? 0) - (a.replies?.length ?? 0) ||
          b.createdAt.getTime() - a.createdAt.getTime()
        );
        break;
    }
  }

  updateDisplayedComments(filtered: Comment[]) {
    this.displayedComments.set(this.compact ? filtered.slice(0, 1) : filtered);
  }

  onSortChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.sortBy.set(select.value as CommentSort);
    if (this.autoLoad) {
      this.fetchThread(1);
      return;
    }
    if (this.serverPaging) {
      this.sortChange.emit(this.sortBy());
      return;
    }
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
      const data: any = { content: this.newCommentText(), ...this.targetFields() };

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
            ...this.targetViewFields(),
          };
          this.allComments.unshift(newComment);
          this.addedSinceLoad.update(n => n + 1);
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

  toggleReplies(commentId: string) {
    this.expandedReplies.update(set => {
      const next = new Set(set);
      if (!next.delete(commentId)) {
        next.add(commentId);
      }
      return next;
    });
  }

  submitReply(parentId: string) {
    // Double-check auth before submitting
    if (!this.authGuard.requireAuth('reply to this comment')) {
      return;
    }

    if (this.replyText().trim()) {
      const data: any = { content: this.replyText(), parentId: Number(parentId), ...this.targetFields() };

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
            ...this.targetViewFields(),
          };
          this.allComments.push(newReply);
          this.expandedReplies.update(set => new Set(set).add(String(parentId)));
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

    if (this.autoLoad) {
      this.apiService.voteComment(Number(commentId)).subscribe({
        next: (res) => {
          this.allComments = this.allComments.map(c => c.id === commentId ? { ...c, votes: res.score, voted: res.voted } : c);
          this.filterAndSortComments();
        },
        error: () => {}
      });
      return;
    }

    // Emit event to parent component to handle the vote
    this.voteComment.emit(commentId);
  }

  private targetFields(): { ideaId?: number; challengeId?: number; draftId?: number } {
    const id = Number(this.entityId);
    return { idea: { ideaId: id }, challenge: { challengeId: id }, draft: { draftId: id } }[this.entityType];
  }

  private targetViewFields(): Pick<Comment, 'ideaId' | 'challengeId' | 'draftId'> {
    const id = String(this.entityId);
    return { idea: { ideaId: id }, challenge: { challengeId: id }, draft: { draftId: id } }[this.entityType];
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
