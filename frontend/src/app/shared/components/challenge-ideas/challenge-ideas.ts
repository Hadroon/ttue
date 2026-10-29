import { Component, Input, Output, EventEmitter, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Idea } from '../../models/baseModels';
import { MatIconModule } from "@angular/material/icon";
import { ContentActionsMenu } from '../content-actions-menu/content-actions-menu';
import { Comments } from '../comments/comments';
import { ShareButton } from '../share-button/share-button';

@Component({
  selector: 'app-challenge-ideas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, ContentActionsMenu, Comments, ShareButton],
  templateUrl: './challenge-ideas.html',
  styleUrl: './challenge-ideas.css'
})
export class ChallengeIdeas implements OnInit {
  @Input() challengeId!: string | number;
  @Input() allIdeas: Idea[] = [];
  @Input() compact: boolean = true;
  @Input() totalCount?: number;
  @Output() voteIdea = new EventEmitter<string>();

  isExpanded = false;
  filteredIdeas: Idea[] = [];
  displayedIdeas: Idea[] = [];
  sortBy: 'votes' | 'recent' | 'oldest' | 'title' = 'votes';
  filterStatus: string = 'all';
  currentPage = 1;
  readonly pageSize = 10;
  readonly openComments = new Set<string>();
  readonly highlightedId = signal<string | null>(null);

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  // A shared link like #idea-12 to bring into view once the ideas have loaded
  private pendingFragment: string | null = (() => {
    const fragment = inject(ActivatedRoute).snapshot.fragment;
    return fragment?.startsWith('idea-') ? fragment : null;
  })();

  toggleComments(ideaId: string): void {
    if (!this.openComments.delete(ideaId)) {
      this.openComments.add(ideaId);
    }
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredIdeas.length / this.pageSize));
  }

  get visiblePageNumbers(): number[] {
    const total = this.totalPages;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: number[] = [1];
    const start = Math.max(2, this.currentPage - 2);
    const end = Math.min(total - 1, this.currentPage + 2);
    if (start > 2) pages.push(-1); // ellipsis
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < total - 1) pages.push(-2); // ellipsis
    pages.push(total);
    return pages;
  }

  ngOnInit() {
    this.filterAndSortIdeas();
  }

  ngOnChanges() {
    this.filterAndSortIdeas();
  }

  toggleExpand() {
    this.isExpanded = !this.isExpanded;
    this.updateDisplayedIdeas();
  }

  filterAndSortIdeas() {
    // Filter ideas by challengeId
    this.filteredIdeas = this.allIdeas.filter(idea => idea.challengeId === this.challengeId?.toString());

    // Apply status filter
    if (this.filterStatus !== 'all') {
      this.filteredIdeas = this.filteredIdeas.filter(idea => idea.status === this.filterStatus);
    }

    // Sort ideas
    this.sortIdeas();
    // Reset to first page when filter/sort changes
    this.currentPage = 1;
    this.updateDisplayedIdeas();
    this.revealPendingFragment();
  }

  private revealPendingFragment(): void {
    const target = this.pendingFragment;
    if (!target || !this.isBrowser || this.compact) {
      return;
    }
    const index = this.filteredIdeas.findIndex(idea => `idea-${idea.id}` === target);
    if (index < 0) {
      return;
    }
    this.pendingFragment = null;
    this.currentPage = Math.floor(index / this.pageSize) + 1;
    this.updateDisplayedIdeas();
    // Wait for the card to render before scrolling to it
    setTimeout(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.highlightedId.set(target);
      setTimeout(() => this.highlightedId.set(null), 3000);
    }, 100);
  }

  sortIdeas() {
    switch (this.sortBy) {
      case 'votes':
        this.filteredIdeas.sort((a, b) => b.votes - a.votes);
        break;
      case 'recent':
        this.filteredIdeas.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case 'oldest':
        this.filteredIdeas.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
      case 'title':
        this.filteredIdeas.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }
  }

  updateDisplayedIdeas() {
    if (this.compact && !this.isExpanded) {
      this.displayedIdeas = this.filteredIdeas.slice(0, 3);
    } else {
      const start = (this.currentPage - 1) * this.pageSize;
      this.displayedIdeas = this.filteredIdeas.slice(start, start + this.pageSize);
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updateDisplayedIdeas();
    }
  }

  nextPage(): void { this.goToPage(this.currentPage + 1); }
  prevPage(): void { this.goToPage(this.currentPage - 1); }

  onSortChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.sortBy = select.value as 'votes' | 'recent' | 'oldest' | 'title';
    this.filterAndSortIdeas();
  }

  onFilterChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.filterStatus = select.value;
    this.filterAndSortIdeas();
  }

  onVoteIdea(ideaId: string) {
    this.voteIdea.emit(ideaId);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Implemented': return 'status-implemented';
      case 'In Development': return 'status-development';
      case 'Under Review': return 'status-review';
      default: return 'status-new';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'Implemented': return '✓';
      case 'In Development': return '⚙';
      case 'Under Review': return '👁';
      default: return '✦';
    }
  }
}
