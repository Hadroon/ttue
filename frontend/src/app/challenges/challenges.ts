import { Component, signal, inject, OnInit, computed, linkedSignal, DestroyRef, Injector } from '@angular/core';
import { toSignal, toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map, debounceTime, distinctUntilChanged, switchMap, tap, catchError, of } from 'rxjs';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { Header, ChallengeItem } from '../shared/components';
import { ApiService, ChallengeType, FeaturedChallenge } from '../shared/services/api.service';
import { Idea, Comment as BaseComment } from '../shared/models/baseModels';
import { AuthGuardService } from '../shared/services/auth-guard.service';
import { AuthService } from '../shared/services/auth.service';

@Component({
  selector: 'app-challenges',
  imports: [Header, ChallengeItem, MatToolbarModule, MatFormFieldModule, MatInputModule, MatIconModule, MatDatepickerModule, MatNativeDateModule, MatChipsModule, MatAutocompleteModule, MatButtonModule, MatSelectModule, MatPaginatorModule],
  templateUrl: './challenges.html',
  styleUrl: './challenges.css'
})
export class Challenges implements OnInit {
  private apiService = inject(ApiService);
  private authGuard = inject(AuthGuardService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  
  // State management with signals
  challengesData = signal<FeaturedChallenge[]>([]); // Made public for debugging
  isLoading = signal(false);
  loadError = signal<string | null>(null);
  total = signal(0);
  searchTerm = signal('');
  fromDate = signal<Date | null>(null);
  toDate = signal<Date | null>(null);
  typeFilter = signal<ChallengeType | null>(null);
  selectedTags = toSignal(
    this.route.queryParamMap.pipe(
      map(params => params.getAll('tag')),
      distinctUntilChanged((a, b) => a.join('\u0000') === b.join('\u0000'))
    ),
    { initialValue: [] as string[] }
  );
  tagSearch = signal('');
  allTags = signal<string[]>([]);

  tagOptions = computed(() => {
    const term = this.tagSearch().trim().toLowerCase();
    const selected = this.selectedTags();
    return this.allTags().filter(tag => !selected.includes(tag) && tag.toLowerCase().includes(term));
  });

  readonly pageSizeOptions = [10, 20, 50, 100];
  pageSize = signal(20);

  private debouncedSearch = toSignal(
    toObservable(this.searchTerm).pipe(debounceTime(300), map(s => s.trim()), distinctUntilChanged()),
    { initialValue: '' }
  );

  private filters = computed(() => {
    const to = this.toDate();
    return {
      q: this.debouncedSearch(),
      from: this.fromDate(),
      // Server treats `to` as exclusive, so send the start of the next day
      to: to ? new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1) : null,
      tags: this.selectedTags(),
      type: this.typeFilter()
    };
  });

  // Resets to the first page whenever filters or page size change
  pageIndex = linkedSignal({
    source: () => [this.filters(), this.pageSize()],
    computation: () => 0
  });

  private reloadTick = signal(0);

  private request = computed(() => {
    this.reloadTick();
    return { ...this.filters(), page: this.pageIndex() + 1, limit: this.pageSize() };
  });

  // Transform API data to match component expectations
  challenges = computed(() => {
    return this.challengesData()
      .map(item => ({
      challenge: item.challenge,
      ideas: item.topIdea ? [this.apiIdeaToIdea(item.topIdea)] : [],
      ideaCount: item.ideaCount,
      comments: item.comments.map(c => this.apiCommentToBaseComment(c, item.challenge.id))
    }));
  });

  addTag(tag: string, input: HTMLInputElement) {
    this.setTags([...this.selectedTags(), tag]);
    input.value = '';
    this.tagSearch.set('');
  }

  removeTag(tag: string) {
    this.setTags(this.selectedTags().filter(t => t !== tag));
  }

  private setTags(tags: string[]) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tag: tags.length ? tags : null },
      queryParamsHandling: 'merge'
    });
  }

  private apiIdeaToIdea(idea: any): Idea {
    return {
      id: idea.id.toString(),
      title: idea.title,
      description: idea.content,
      author: idea.authorDisplayName || idea.authorUsername || 'Unknown',
      authorUsername: idea.authorUsername,
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
      authorUsername: comment.authorUsername,
      authorRole: undefined, // Not available
      content: comment.content,
      createdAt: new Date(comment.createdAt),
      votes: comment.score,
      voted: comment.voted,
      parentId: comment.parentId?.toString(),
      replies: [],
      ideaId: comment.ideaId?.toString(),
      challengeId: comment.challengeId?.toString()
    };
  }

  ngOnInit() {
    toObservable(this.request, { injector: this.injector }).pipe(
      tap(() => {
        this.isLoading.set(true);
        this.loadError.set(null);
      }),
      switchMap(req => this.apiService.searchChallenges(req).pipe(
        catchError(error => {
          console.error('Error loading challenges:', error);
          this.loadError.set('Failed to load challenges. Please try again.');
          return of(null);
        })
      )),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(result => {
      if (result) {
        this.challengesData.set(result.items);
        this.total.set(result.total);
      }
      this.isLoading.set(false);
    });

    this.apiService.getChallengeTags().subscribe({
      next: tags => this.allTags.set(tags),
      error: error => console.error('Error loading tags:', error)
    });

    // Refetch current page so voted state reflects the logged-in user
    this.authService.loginSuccess$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.retry());
  }

  retry() {
    this.reloadTick.update(n => n + 1);
  }

  onPage(event: PageEvent) {
    this.pageSize.set(event.pageSize);
    this.pageIndex.set(event.pageIndex);
  }

  onVoteChallenge(challengeId: number) {
    if (!this.authGuard.requireAuth('vote on this challenge')) {
      return;
    }
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
    if (!this.authGuard.requireAuth('vote on this idea')) {
      return;
    }
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
    if (!this.authGuard.requireAuth('vote on this comment')) {
      return;
    }
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
