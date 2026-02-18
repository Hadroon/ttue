import { Component, inject, OnInit, Signal, signal, WritableSignal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Header, ChallengeGrid2x2, ChallengeCard, ChallengeIdeas, Comments, ChallengeItem, DemoCard } from '../shared/components';
import { ApiService, FeaturedChallenge, Idea as ApiIdea, Comment as ApiComment } from '../shared/services/api.service';
import { FormsModule } from '@angular/forms';
import { environment } from '../shared/environments/environment';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Challenge, Idea, Comment } from '../shared/models/baseModels';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { AddChallengeModalComponent } from '../shared/components/add-challenge-modal/add-challenge-modal';

@Component({
  selector: 'app-home',
  imports: [RouterLink, Header, FormsModule, MatFormFieldModule, MatInputModule, ChallengeItem, MatIconModule, DemoCard],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {
  environment = environment;
  apiService = inject(ApiService);
  dialog = inject(MatDialog);
  activeTab: 'challenges' | 'ideas' = 'challenges';
  welcome : WritableSignal<boolean> = signal(false);
  welcomePassword = '';
  challenges = signal<Challenge[]>([]);
  isLoadingChallenges = false;
  featuredChallenges = signal<Challenge[]>([]);
  featuredIdeasMap = signal<Map<number, Idea[]>>(new Map());
  featuredCommentsMap = signal<Map<number, Comment[]>>(new Map());
  isLoadingFeatured = false;

  ngOnInit() {
    let needWelcome = window.location.hostname?.toString().includes('localhost')
    this.welcome.set(needWelcome);
    this.loadFeaturedChallenge();
  }

  loadFeaturedChallenge() {
    this.isLoadingFeatured = true;
    this.apiService.getFeaturedChallenge().subscribe({
      next: (featuredList) => {
        console.log('Loaded featured challenges:', featuredList);
        
        const challengesList: Challenge[] = [];
        const ideasMap = new Map<number, Idea[]>();
        const commentsMap = new Map<number, Comment[]>();
        
        // Process each featured challenge
        featuredList.forEach(featured => {
          // Convert API Challenge to component Challenge model
          const challenge: Challenge = {
            ...featured.challenge,
            deadline: featured.challenge.deadline ? new Date(featured.challenge.deadline) : undefined
          };
          challengesList.push(challenge);
          console.log('✅ Processed featured challenge:', challenge);
          
          // Convert API Idea to component Idea model
          if (featured.topIdea) {
            const idea: Idea = {
              id: featured.topIdea.id.toString(),
              title: featured.topIdea.title,
              description: featured.topIdea.content,
              author: featured.topIdea.authorDisplayName || featured.topIdea.authorUsername || 'Unknown',
              votes: featured.topIdea.score,
              category: featured.challenge.category,
              status: 'Under Review',
              createdAt: new Date(featured.topIdea.createdAt || Date.now()),
              challengeId: featured.challenge.id.toString(),
              voted: featured.topIdea.voted || false
            };
            ideasMap.set(challenge.id, [idea]);
            console.log('✅ Set idea for challenge', challenge.id, ':', [idea]);
          } else {
            ideasMap.set(challenge.id, []);
            console.log('⚠️ No top idea found for challenge', challenge.id);
          }
          
          // Convert API Comments to component Comment model
          const comments: Comment[] = featured.comments.map((c: ApiComment) => ({
            id: c.id.toString(),
            author: c.authorDisplayName || c.authorUsername || 'Unknown',
            content: c.content,
            createdAt: new Date(c.createdAt || Date.now()),
            votes: c.score,
            parentId: c.parentId?.toString(),
            challengeId: featured.challenge.id.toString(),
            voted: c.voted || false
          }));
          commentsMap.set(challenge.id, comments);
          console.log('✅ Set comments for challenge', challenge.id, ':', comments);
        });
        
        this.featuredChallenges.set(challengesList);
        this.featuredIdeasMap.set(ideasMap);
        this.featuredCommentsMap.set(commentsMap);
        
        this.isLoadingFeatured = false;
      },
      error: (error) => {
        console.error('Error loading featured challenges:', error);
        this.isLoadingFeatured = false;
        // Set to empty on error
        this.featuredChallenges.set([]);
        this.featuredIdeasMap.set(new Map());
        this.featuredCommentsMap.set(new Map());
      }
    });
  }

  // getIdeasCount(challengeId: string): number {
  //   return this.ideas.filter(i => i.challengeId === challengeId).length;
  // }

  onVoteChallenge(challengeId: number) {
    this.apiService.voteChallenge(challengeId).subscribe({
      next: (response: { message: string; voted: boolean }) => {
        console.log('Vote response for challenge', challengeId, ':', response);
        const voted = response.voted;
        this.featuredChallenges.update(challenges => 
          challenges.map(c => 
            c.id === challengeId 
              ? { ...c, votes: c.votes + (voted ? 1 : -1), voted }
              : c
          )
        );
      },
      error: (error) => {
        console.error('Error voting on challenge:', error);
      }
    });
  }

  switchTab(tabName: 'challenges' | 'ideas') {
    this.activeTab = tabName;
  }

  getUrgencyClass(urgency: string): string {
    switch (urgency) {
      case 'Critical': return 'urgency-critical';
      case 'High': return 'urgency-high';
      case 'Medium': return 'urgency-medium';
      default: return 'urgency-low';
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

  formatDeadline(deadline?: Date): string {
    if (!deadline) return '';
    const now = new Date();
    const timeDiff = deadline.getTime() - now.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    if (daysDiff < 0) return 'Deadline passed';
    if (daysDiff === 0) return 'Due today';
    if (daysDiff === 1) return 'Due tomorrow';
    if (daysDiff < 30) return `${daysDiff} days left`;
    
    const monthsDiff = Math.ceil(daysDiff / 30);
    return `${monthsDiff} month${monthsDiff > 1 ? 's' : ''} left`;
  }

  onVoteIdea(ideaId: string) {
    console.log('Voting on idea:', ideaId);
    const postId = parseInt(ideaId);
    this.apiService.voteIdea(postId).subscribe({
      next: (response: { message: string; score: number; voted: boolean }) => {
        console.log('Vote response for idea', ideaId, ':', response);
        const voted = response.voted;
        this.featuredIdeasMap.update(ideasMap => {
          const newMap = new Map(ideasMap);
          newMap.forEach((ideas, challengeId) => {
            const updatedIdeas = ideas.map(i => 
              i.id === ideaId
                ? { ...i, votes: i.votes + (voted ? 1 : -1), voted }
                : i
            );
            newMap.set(challengeId, updatedIdeas);
          });
          return newMap;
        });
      },
      error: (error: any) => {
        console.error('Error voting on idea:', error);
      }
    });
  }

  onVoteComment(commentId: string) {
    const commentIdNum = parseInt(commentId);
    this.apiService.voteComment(commentIdNum).subscribe({
      next: (response: { message: string; score: number; voted: boolean }) => {
        console.log('Vote response for comment', commentId, ':', response);
        const voted = response.voted;
        this.featuredCommentsMap.update(commentsMap => {
          const newMap = new Map(commentsMap);
          newMap.forEach((comments, challengeId) => {
            const updatedComments = comments.map(c => 
              c.id === commentId
                ? { ...c, votes: c.votes + (voted ? 1 : -1), voted }
                : c
            );
            newMap.set(challengeId, updatedComments);
          });
          return newMap;
        });
      },
      error: (error) => {
        console.error('Error voting on comment:', error);
      }
    });
  }

  getIdeasForChallenge(challengeId: number): Idea[] {
    return this.featuredIdeasMap().get(challengeId) || [];
  }

  getCommentsForChallenge(challengeId: number): Comment[] {
    return this.featuredCommentsMap().get(challengeId) || [];
  }

  onChallengeClick(challengeId: number) {
    console.log('Challenge clicked:', challengeId);
    // Navigate to challenge detail page or open modal
  }

  onIdeaClick(ideaId: string) {
    console.log('Idea clicked:', ideaId);
    // Navigate to idea detail page or open modal
  }

  onViewAllComments(challengeId: number) {
    console.log('View all comments for challenge:', challengeId);
    // Navigate to full discussion page
  }

  enterForum() {
    this.apiService.checkWelcome(this.welcomePassword).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.welcome.set(true);
        } else {
          console.error('Welcome check failed:', response.error || response.message);
          // Optionally show error message to user
        }
      },
      error: (error) => {
        console.error('Error checking welcome:', error);
        // Optionally show error message to user
      }
    });
  }

  openAddChallengeModal() {
    const dialogRef = this.dialog.open(AddChallengeModalComponent, {
      width: '600px',
      maxWidth: '90vw',
      panelClass: 'add-challenge-modal'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        console.log('Challenge created:', result.challenge);
        // Reload challenges to show the new one
        this.loadFeaturedChallenge();
      }
    });
  }
}
