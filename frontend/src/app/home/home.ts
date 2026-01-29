import { Component, inject, OnInit, Signal, signal, WritableSignal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Header, ChallengeGrid2x2, ChallengeCard, ChallengeIdeas, Comments, ChallengeItem } from '../shared/components';
import { ApiService } from '../shared/services/api.service';
import { FormsModule } from '@angular/forms';
import { environment } from '../shared/environments/environment';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Challenge, Idea, Comment } from '../shared/models/baseModels';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-home',
  imports: [RouterLink, Header, FormsModule, MatFormFieldModule, MatInputModule, ChallengeItem, MatIconModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {
  environment = environment;
  apiService = inject(ApiService);
  activeTab: 'challenges' | 'ideas' = 'challenges';
  welcome : WritableSignal<boolean> = signal(false);
  welcomePassword = '';
  challenges = signal<Challenge[]>([]);
  isLoadingChallenges = false;

  ngOnInit() {
    let needWelcome = window.location.hostname?.toString().includes('localhost')
    this.welcome.set(needWelcome);
    this.loadChallenges();
  }

  loadChallenges() {
    this.isLoadingChallenges = true;
    this.apiService.getChallenges().subscribe({
      next: (challenges) => {
        console.log('Loaded challenges:', challenges);
        this.challenges.set(challenges.map(c => ({
          ...c,
          deadline: c.deadline ? new Date(c.deadline) : undefined
        })));
        this.isLoadingChallenges = false;
        console.log('Processed challenges:', this.challenges());
      },
      error: (error) => {
        console.error('Error loading challenges:', error);
        this.isLoadingChallenges = false;
      }
    });
}

  // getIdeasCount(challengeId: string): number {
  //   return this.ideas.filter(i => i.challengeId === challengeId).length;
  // }

  onVoteChallenge(challengeId: number) {
    this.apiService.voteChallenge(challengeId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const challenge = this.challenges().find(c => c.id === challengeId);
          if (challenge) {
            if (response.data.voted) {
              challenge.votes++;
              challenge.voted = true;
            } else {
              challenge.votes--;
              challenge.voted = false;
            }
          }
        }
      },
      error: (error) => {
        console.error('Error voting on challenge:', error);
      }
    });
  }

  ideas: Idea[] = [
    {
      id: 'community-energy',
      title: 'Community Energy Cooperatives',
      description: 'Enable neighborhoods to form energy cooperatives for shared renewable energy systems with favorable regulatory frameworks.',
      author: 'Dr. Sarah Chen',
      votes: 234,
      category: 'Energy',
      status: 'Under Review',
      createdAt: new Date('2025-08-15'),
      challengeId: 'climate-adaptation'
    },
    {
      id: 'mobile-voting',
      title: 'Secure Mobile Voting Platform',
      description: 'Develop blockchain-based mobile voting system for local elections with enhanced security and accessibility features.',
      author: 'Marcus Rodriguez',
      votes: 189,
      category: 'Democracy',
      status: 'In Development',
      createdAt: new Date('2025-07-22')
    },
    {
      id: 'green-tax-incentives',
      title: 'Progressive Green Tax Incentives',
      description: 'Implement tiered tax incentives for businesses and individuals based on measurable environmental impact reductions.',
      author: 'Prof. Elena Vasquez',
      votes: 156,
      category: 'Environment',
      status: 'New',
      createdAt: new Date('2025-09-01'),
      challengeId: 'climate-adaptation'
    },
    // {
    //   id: 'urban-cooling',
    //   title: 'Smart Urban Cooling Networks',
    //   description: 'Deploy interconnected green corridors and reflective surfaces to reduce urban heat islands in densely populated areas.',
    //   author: 'Dr. James Liu',
    //   votes: 98,
    //   category: 'Environment',
    //   status: 'New',
    //   createdAt: new Date('2025-09-12'),
    //   challengeId: 'climate-adaptation'
    // }
  ];

  comments: Comment[] = [
    {
      id: 'comment-1',
      author: 'Dr. Michael Green',
      authorRole: 'Climate Expert',
      content: 'This challenge addresses critical infrastructure gaps. We need to prioritize flood prevention systems in vulnerable districts.',
      createdAt: new Date('2025-11-15'),
      votes: 42,
      challengeId: 'climate-adaptation'
    },
    {
      id: 'comment-2',
      author: 'Sarah Thompson',
      content: 'Great initiative! I suggest including community feedback sessions to identify local priorities.',
      createdAt: new Date('2025-11-20'),
      votes: 28,
      challengeId: 'climate-adaptation'
    },
    {
      id: 'comment-3',
      author: 'Prof. Anna Martinez',
      authorRole: 'Urban Planner',
      content: 'We should integrate this with existing urban development plans to maximize efficiency and avoid redundancy.',
      createdAt: new Date('2025-11-25'),
      votes: 35,
      challengeId: 'climate-adaptation'
    }
  ];

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
    const idea = this.ideas.find(i => i.id === ideaId);
    if (idea) {
      idea.votes++;
    }
  }

  onVoteComment(commentId: string) {
    const comment = this.comments.find(c => c.id === commentId);
    if (comment) {
      comment.votes++;
    }
  }

  getIdeasForChallenge(challengeId: number): Idea[] {
    return this.ideas.filter(idea => idea.challengeId === challengeId.toString());
  }

  getCommentsForChallenge(challengeId: number): Comment[] {
    return this.comments.filter(comment => comment.challengeId === challengeId.toString());
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
}
