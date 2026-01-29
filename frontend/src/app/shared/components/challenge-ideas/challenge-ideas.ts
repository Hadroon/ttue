import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Idea } from '../../models/baseModels';
import { MatIconModule } from "@angular/material/icon";

@Component({
  selector: 'app-challenge-ideas',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './challenge-ideas.html',
  styleUrl: './challenge-ideas.css'
})
export class ChallengeIdeas implements OnInit {
  @Input() challengeId!: string | number;
  @Input() allIdeas: Idea[] = [];
  @Input() compact: boolean = true;

  isExpanded = false;
  filteredIdeas: Idea[] = [];
  displayedIdeas: Idea[] = [];
  sortBy: 'votes' | 'recent' | 'status' = 'votes';
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
    this.filteredIdeas = this.allIdeas.filter(idea => idea.challengeId === this.challengeId);

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
      case 'status':
        const statusOrder = { 'New': 0, 'Under Review': 1, 'In Development': 2, 'Implemented': 3 };
        this.filteredIdeas.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
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
    this.sortBy = select.value as 'votes' | 'recent' | 'status';
    this.filterAndSortIdeas();
  }

  onFilterChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.filterStatus = select.value;
    this.filterAndSortIdeas();
  }

  onVoteIdea(ideaId: string) {
    const idea = this.allIdeas.find(i => i.id === ideaId);
    if (idea) {
      idea.votes++;
    }
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
