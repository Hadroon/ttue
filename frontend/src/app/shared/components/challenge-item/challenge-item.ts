import { Component, Input, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChallengeCard } from '../challenge-card/challenge-card';
import { ChallengeIdeas } from '../challenge-ideas/challenge-ideas';
import { Comments } from '../comments/comments';
import { Challenge, Idea, Comment, ChallengeDraft } from '../../models/baseModels';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-challenge-item',
  standalone: true,
  imports: [CommonModule, FormsModule, ChallengeCard, ChallengeIdeas, Comments],
  templateUrl: './challenge-item.html',
  styleUrls: ['./challenge-item.css'],
})
export class ChallengeItem implements OnInit {
  @Input() challenge!: Challenge;
  @Input() allIdeas: Idea[] = [];
  @Input() allComments: Comment[] = [];
  @Output() voteChallenge = new EventEmitter<number>();
  @Output() voteIdea = new EventEmitter<string>();
  @Output() voteComment = new EventEmitter<string>();

  private apiService = inject(ApiService);
  
  // Draft state
  draft = signal<ChallengeDraft | null>(null);
  draftContent = signal('');
  isEditingDraft = signal(false);
  isSavingDraft = signal(false);
  draftError = signal<string | null>(null);
  showRevisions = signal(false);
  revisions = signal<any[]>([]);
  
  // Check if user is creator
  get isAuthenticated(): boolean {
    return this.apiService.currentUser() !== null;
  }
  
  get currentUserId(): number | null {
    const user = this.apiService.currentUser();
    return user ? user.id : null;
  }
  
  get isDraftCreator(): boolean {
    const currentDraft = this.draft();
    const userId = this.currentUserId;
    return !!(currentDraft && userId && userId === currentDraft.creatorId);
  }

  ngOnInit() {
    console.log('ChallengeItem initialized with challenge:', this.challenge);
    console.log('Challenge type:', typeof this.challenge);
    console.log('Challenge id:', this.challenge?.id);
    console.log('All ideas:', this.allIdeas);
    console.log('All comments:', this.allComments);
    
    // Load draft if exists
    this.loadDraft();
  }
  
  loadDraft() {
    this.apiService.getChallengeDraft(this.challenge.id).subscribe({
      next: (draft) => {
        this.draft.set(draft);
        this.draftContent.set(draft.content);
      },
      error: (error) => {
        // 404 means no draft exists, which is fine
        if (error.status !== 404) {
          console.error('Error loading draft:', error);
        }
      }
    });
  }
  
  createDraft() {
    if (!this.isAuthenticated) {
      this.draftError.set('You must be logged in to create a draft');
      return;
    }
    
    this.isEditingDraft.set(true);
    this.draftContent.set('');
  }
  
  editDraft() {
    this.isEditingDraft.set(true);
    this.draftContent.set(this.draft()?.content || '');
  }
  
  cancelEdit() {
    this.isEditingDraft.set(false);
    this.draftContent.set(this.draft()?.content || '');
    this.draftError.set(null);
  }
  
  saveDraft() {
    const content = this.draftContent().trim();
    
    if (!content) {
      this.draftError.set('Draft content cannot be empty');
      return;
    }
    
    if (content.length > 5000) {
      this.draftError.set('Draft content must be less than 5000 characters');
      return;
    }
    
    this.isSavingDraft.set(true);
    this.draftError.set(null);
    
    const currentDraft = this.draft();
    
    if (currentDraft) {
      // Update existing draft
      this.apiService.updateChallengeDraft(this.challenge.id, content).subscribe({
        next: (draftData: ChallengeDraft) => {
          this.draft.set(draftData);
          this.draftContent.set(draftData.content);
          this.isEditingDraft.set(false);
          this.isSavingDraft.set(false);
        },
        error: (error: any) => {
          console.error('Error updating draft:', error);
          this.draftError.set(error.error?.error || 'Failed to update draft');
          this.isSavingDraft.set(false);
        }
      });
    } else {
      // Create new draft
      this.apiService.createChallengeDraft(this.challenge.id, content).subscribe({
        next: (response: any) => {
          const draftData = 'data' in response ? response.data : response;
          this.draft.set(draftData as ChallengeDraft);
          this.draftContent.set(draftData.content);
          this.isEditingDraft.set(false);
          this.isSavingDraft.set(false);
        },
        error: (error: any) => {
          console.error('Error creating draft:', error);
          this.draftError.set(error.error?.error || 'Failed to create draft');
          this.isSavingDraft.set(false);
        }
      });
    }
  }
  
  toggleRevisions() {
    if (!this.showRevisions()) {
      this.loadRevisions();
    }
    this.showRevisions.update(v => !v);
  }
  
  loadRevisions() {
    this.apiService.getChallengeDraftRevisions(this.challenge.id).subscribe({
      next: (revisions) => {
        this.revisions.set(revisions);
      },
      error: (error) => {
        console.error('Error loading revisions:', error);
      }
    });
  }
  
  getIdeasCount(challengeId: number): number {
    return this.allIdeas.filter(idea => idea.challengeId === challengeId.toString()).length;
  }

  onVoteChallenge(challengeId: number): void {
    this.voteChallenge.emit(challengeId);
  }

  onVoteIdea(ideaId: string): void {
    this.voteIdea.emit(ideaId);
  }

  onVoteComment(commentId: string): void {
    this.voteComment.emit(commentId);
  }
}
