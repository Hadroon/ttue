import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Idea } from '../../models/baseModels';
import { MatIconModule } from "@angular/material/icon";
import { ContentActionsMenu } from '../content-actions-menu/content-actions-menu';

@Component({
  selector: 'app-challenge-ideas',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, ContentActionsMenu],
  templateUrl: './challenge-ideas.html',
  styleUrl: './challenge-ideas.css'
})
export class ChallengeIdeas implements OnInit {
  @Input() challengeId!: string | number;
  @Input() allIdeas: Idea[] = [];
  @Input() compact: boolean = true;
  @Output() voteIdea = new EventEmitter<string>();

  isExpanded = false;
  filteredIdeas: Idea[] = [];
  displayedIdeas: Idea[] = [];
  sortBy: 'votes' | 'recent' | 'oldest' | 'title' = 'votes';
  filterStatus: string = 'all';

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
    this.updateDisplayedIdeas();
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
      this.displayedIdeas = this.filteredIdeas;
    }
  }

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
