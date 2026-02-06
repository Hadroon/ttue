import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { Header, ChallengeItem } from '../shared/components';
import { ApiService, FeaturedChallenge } from '../shared/services/api.service';
import { Idea, Comment as BaseComment } from '../shared/models/baseModels';

@Component({
  selector: 'app-challenges',
  imports: [Header, ChallengeItem],
  templateUrl: './challenges.html',
  styleUrl: './challenges.css'
})
export class Challenges implements OnInit {
  private apiService = inject(ApiService);
  
  // State management with signals
  challengesData = signal<FeaturedChallenge[]>([]); // Made public for debugging
  currentPage = signal(1);
  isLoading = signal(false);
  hasMore = signal(true);
  loadError = signal<string | null>(null);
  
  readonly pageSize = 20;

  // Transform API data to match component expectations
  challenges = computed(() => {
    return this.challengesData().map(item => ({
      challenge: item.challenge,
      ideas: item.topIdea ? [this.apiIdeaToIdea(item.topIdea)] : [],
      comments: item.comments.map(c => this.apiCommentToBaseComment(c, item.challenge.id))
    }));
  });

  private apiIdeaToIdea(idea: any): Idea {
    return {
      id: idea.id.toString(),
      title: idea.title,
      description: idea.content,
      author: idea.authorDisplayName || idea.authorUsername || 'Unknown',
      votes: idea.score,
      voted: idea.voted,
      category: '', // Not available in Idea
      status: 'New', // Default status
      createdAt: new Date(idea.createdAt),
      challengeId: idea.challengeId?.toString()
    };
  }

  private apiCommentToBaseComment(comment: any, challengeId: number): BaseComment {
    return {
      id: comment.id.toString(),
      author: comment.authorDisplayName || comment.authorUsername || 'Unknown',
      authorRole: undefined, // Not available
      content: comment.content,
      createdAt: new Date(comment.createdAt),
      votes: comment.score,
      voted: comment.voted,
      parentId: comment.parentId?.toString(),
      replies: [],
      ideaId: comment.ideaId?.toString(),
      challengeId: challengeId.toString()
    };
  }

  ngOnInit() {
    this.loadChallenges();
  }

  loadChallenges(append: boolean = false) {
    if (this.isLoading()) {
      return;
    }
    
    // Don't reload if we already have data on initial load
    if (!append && this.challengesData().length > 0) {
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);
    const page = append ? this.currentPage() + 1 : 1;

    console.log('Loading challenges, page:', page, 'append:', append);

    this.apiService.getChallenges(page, this.pageSize).subscribe({
      next: (data) => {
        console.log('Challenges loaded:', data);
        if (append) {
          // Append for infinite scroll
          this.challengesData.set([...this.challengesData(), ...data]);
        } else {
          // Replace on initial load
          this.challengesData.set(data);
        }
        
        this.currentPage.set(page);
        this.hasMore.set(data.length === this.pageSize);
        this.isLoading.set(false);
        console.log('Challenges state updated:', this.challengesData().length, 'challenges');
      },
      error: (error) => {
        console.error('Error loading challenges:', error);
        this.loadError.set('Failed to load challenges. Please try again.');
        this.isLoading.set(false);
      }
    });
  }
  
  retry() {
    this.challengesData.set([]);
    this.loadError.set(null);
    this.loadChallenges();
  }

  loadMore() {
    if (!this.isLoading() && this.hasMore()) {
      this.loadChallenges(true);
    }
  }

  onVoteChallenge(challengeId: number) {
    // Optimistically update UI
    const currentChallenges = this.challengesData();
    const challengeIndex = currentChallenges.findIndex(c => c.challenge.id === challengeId);
    
    if (challengeIndex === -1) return;
    
    const challengeData = currentChallenges[challengeIndex];
    const challenge = challengeData.challenge;
    const wasVoted = challenge.voted || false;
    
    // Update local state optimistically
    const updatedChallenges = [...currentChallenges];
    updatedChallenges[challengeIndex] = {
      ...challengeData,
      challenge: {
        ...challenge,
        voted: !wasVoted,
        votes: wasVoted ? challenge.votes - 1 : challenge.votes + 1
      }
    };
    this.challengesData.set(updatedChallenges);

    // Call API
    this.apiService.voteChallenge(challengeId).subscribe({
      next: (response) => {
        // API confirmed, sync with response if needed
        const challenges = this.challengesData();
        const idx = challenges.findIndex(c => c.challenge.id === challengeId);
        if (idx !== -1) {
          const updated = [...challenges];
          updated[idx] = {
            ...updated[idx],
            challenge: { ...updated[idx].challenge, voted: response.voted }
          };
          this.challengesData.set(updated);
        }
      },
      error: (error) => {
        console.error('Error voting on challenge:', error);
        // Revert optimistic update on error
        const challenges = this.challengesData();
        const idx = challenges.findIndex(c => c.challenge.id === challengeId);
        if (idx !== -1) {
          const reverted = [...challenges];
          reverted[idx] = {
            ...reverted[idx],
            challenge: {
              ...reverted[idx].challenge,
              voted: wasVoted,
              votes: wasVoted ? reverted[idx].challenge.votes + 1 : reverted[idx].challenge.votes - 1
            }
          };
          this.challengesData.set(reverted);
        }
      }
    });
  }

  onVoteIdea(ideaId: string) {
    const postId = parseInt(ideaId);
    // Find and update the idea optimistically
    const currentChallenges = this.challengesData();
    const challengeIndex = currentChallenges.findIndex(c => c.topIdea?.id === postId);
    
    if (challengeIndex === -1 || !currentChallenges[challengeIndex].topIdea) return;
    
    const challengeData = currentChallenges[challengeIndex];
    const idea = challengeData.topIdea!;
    const wasVoted = idea.voted || false;
    
    // Update local state optimistically
    const updatedChallenges = [...currentChallenges];
    updatedChallenges[challengeIndex] = {
      ...challengeData,
      topIdea: {
        ...idea,
        voted: !wasVoted,
        score: wasVoted ? idea.score - 1 : idea.score + 1
      }
    };
    this.challengesData.set(updatedChallenges);

    // Call API
    this.apiService.voteIdea(postId).subscribe({
      next: (response: { message: string; score: number; voted: boolean }) => {
        const challenges = this.challengesData();
        const idx = challenges.findIndex(c => c.topIdea?.id === postId);
        if (idx !== -1 && challenges[idx].topIdea) {
          const updated = [...challenges];
          updated[idx] = {
            ...updated[idx],
            topIdea: {
              ...updated[idx].topIdea!,
              voted: response.voted,
              score: response.score
            }
          };
          this.challengesData.set(updated);
        }
      },
      error: (error: any) => {
        console.error('Error voting on idea:', error);
        // Revert on error
        const challenges = this.challengesData();
        const idx = challenges.findIndex(c => c.topIdea?.id === postId);
        if (idx !== -1 && challenges[idx].topIdea) {
          const reverted = [...challenges];
          reverted[idx] = {
            ...reverted[idx],
            topIdea: {
              ...reverted[idx].topIdea!,
              voted: wasVoted,
              score: wasVoted ? reverted[idx].topIdea!.score + 1 : reverted[idx].topIdea!.score - 1
            }
          };
          this.challengesData.set(reverted);
        }
      }
    });
  }

  onVoteComment(commentIdStr: string) {
    const commentId = parseInt(commentIdStr);
    // Find and update the comment optimistically
    const currentChallenges = this.challengesData();
    let challengeIndex = -1;
    let commentIndex = -1;
    
    for (let i = 0; i < currentChallenges.length; i++) {
      const idx = currentChallenges[i].comments.findIndex(c => c.id === commentId);
      if (idx !== -1) {
        challengeIndex = i;
        commentIndex = idx;
        break;
      }
    }
    
    if (challengeIndex === -1 || commentIndex === -1) return;
    
    const challengeData = currentChallenges[challengeIndex];
    const comment = challengeData.comments[commentIndex];
    const wasVoted = comment.voted || false;
    
    // Update local state optimistically
    const updatedChallenges = [...currentChallenges];
    const updatedComments = [...challengeData.comments];
    updatedComments[commentIndex] = {
      ...comment,
      voted: !wasVoted,
      score: wasVoted ? comment.score - 1 : comment.score + 1
    };
    updatedChallenges[challengeIndex] = {
      ...challengeData,
      comments: updatedComments
    };
    this.challengesData.set(updatedChallenges);

    // Call API
    this.apiService.voteComment(commentId).subscribe({
      next: (response) => {
        const challenges = this.challengesData();
        let chIdx = -1;
        let cmIdx = -1;
        
        for (let i = 0; i < challenges.length; i++) {
          const idx = challenges[i].comments.findIndex(c => c.id === commentId);
          if (idx !== -1) {
            chIdx = i;
            cmIdx = idx;
            break;
          }
        }
        
        if (chIdx !== -1 && cmIdx !== -1) {
          const updated = [...challenges];
          const updatedComments = [...updated[chIdx].comments];
          updatedComments[cmIdx] = {
            ...updatedComments[cmIdx],
            voted: response.voted,
            score: response.score
          };
          updated[chIdx] = {
            ...updated[chIdx],
            comments: updatedComments
          };
          this.challengesData.set(updated);
        }
      },
      error: (error) => {
        console.error('Error voting on comment:', error);
        // Revert on error
        const challenges = this.challengesData();
        let chIdx = -1;
        let cmIdx = -1;
        
        for (let i = 0; i < challenges.length; i++) {
          const idx = challenges[i].comments.findIndex(c => c.id === commentId);
          if (idx !== -1) {
            chIdx = i;
            cmIdx = idx;
            break;
          }
        }
        
        if (chIdx !== -1 && cmIdx !== -1) {
          const reverted = [...challenges];
          const revertedComments = [...reverted[chIdx].comments];
          revertedComments[cmIdx] = {
            ...revertedComments[cmIdx],
            voted: wasVoted,
            score: wasVoted ? revertedComments[cmIdx].score + 1 : revertedComments[cmIdx].score - 1
          };
          reverted[chIdx] = {
            ...reverted[chIdx],
            comments: revertedComments
          };
          this.challengesData.set(reverted);
        }
      }
    });
  }
}
