import { Component } from '@angular/core';
import { Header } from '../shared/components';
import { Challenge, Idea } from '../shared/models/baseModels';

@Component({
  selector: 'app-challenges',
  imports: [Header],
  templateUrl: './challenges.html',
  styleUrl: './challenges.css'
})
export class Challenges {
  activeTab: 'challenges' | 'ideas' = 'challenges';

  challenges: Challenge[] = [
    {
      id: 'climate-adaptation',
      category: 'Environment',
      title: 'Climate Adaptation Strategies',
      description: 'Develop comprehensive policy frameworks for cities to adapt to climate change impacts including flooding, heat waves, and extreme weather events.',
      urgency: 'Critical',
      participantCount: 347,
      rewardPool: '$50,000',
      deadline: new Date('2025-12-15'),
      tags: ['climate', 'adaptation', 'urban-planning', 'emergency-response'],
      votes: 124
    },
    {
      id: 'digital-equity',
      category: 'Technology',
      title: 'Digital Equity and Access',
      description: 'Create policies ensuring equitable access to digital infrastructure, devices, and digital literacy programs for underserved communities.',
      urgency: 'High',
      participantCount: 892,
      rewardPool: '$25,000',
      deadline: new Date('2025-11-30'),
      tags: ['digital-divide', 'accessibility', 'education', 'infrastructure'],
      votes: 85
    },
    {
      id: 'affordable-housing',
      category: 'Housing',
      title: 'Affordable Housing Innovation',
      description: 'Design innovative policy solutions to address the affordable housing crisis while promoting sustainable development.',
      urgency: 'Critical',
      participantCount: 1456,
      rewardPool: '$75,000',
      deadline: new Date('2026-01-31'),
      tags: ['housing', 'affordability', 'zoning', 'sustainability'],
      votes: 203
    }
  ];

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

  getStatusClass(status: string): string {
    switch (status) {
      case 'Implemented': return 'status-implemented';
      case 'In Development': return 'status-development';
      case 'Under Review': return 'status-review';
      default: return 'status-new';
    }
  }

  onVoteIdea(ideaId: string) {
    const idea = this.ideas.find(i => i.id === ideaId);
    if (idea) {
      idea.votes++;
    }
  }

  onVoteChallenge(challengeId: string) {
    const challenge = this.challenges.find(c => c.id === challengeId);
    if (challenge) {
      if (challenge.voted) {
        challenge.votes--;
        challenge.voted = false;
      } else {
        challenge.votes++;
        challenge.voted = true;
      }
    }
  }

  getIdeasCount(challengeId: string): number {
    return this.ideas.filter(i => i.challengeId === challengeId).length;
  }
}
