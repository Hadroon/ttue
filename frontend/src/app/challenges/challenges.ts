import { Component } from '@angular/core';
import { Header, ChallengeIdeas, Comments } from '../shared/components';
import { Challenge, Idea, Comment } from '../shared/models/baseModels';

@Component({
  selector: 'app-challenges',
  imports: [Header, ChallengeIdeas, Comments],
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

  comments: Comment[] = [
    {
      id: 'comment-1',
      author: 'Dr. Michael Rodriguez',
      authorRole: 'Climate Expert',
      content: 'This is a critical challenge. We need to consider both immediate interventions and long-term infrastructure changes. I recommend breaking this into phased approaches.',
      createdAt: new Date('2025-11-15'),
      votes: 42,
      challengeId: 'climate-adaptation'
    },
    {
      id: 'comment-2',
      author: 'Sarah Kim',
      content: 'Has anyone looked at what Amsterdam and Rotterdam are doing? Their water management systems could be excellent case studies.',
      createdAt: new Date('2025-11-18'),
      votes: 28,
      challengeId: 'climate-adaptation'
    },
    {
      id: 'reply-1',
      author: 'Dr. Michael Rodriguez',
      authorRole: 'Climate Expert',
      content: 'Excellent point! The Dutch "Room for the River" program is particularly relevant. I can share some research papers if interested.',
      createdAt: new Date('2025-11-18'),
      votes: 15,
      parentId: 'comment-2',
      challengeId: 'climate-adaptation'
    },
    {
      id: 'comment-3',
      author: 'James Chen',
      content: 'What\'s the expected timeline for implementation? Some of these strategies require decades of infrastructure work.',
      createdAt: new Date('2025-11-20'),
      votes: 12,
      challengeId: 'climate-adaptation'
    },
    {
      id: 'comment-4',
      author: 'Maria Gonzalez',
      authorRole: 'Policy Advisor',
      content: 'We should also consider the equity implications. Climate adaptation measures often benefit wealthier neighborhoods first.',
      createdAt: new Date('2025-11-21'),
      votes: 35,
      challengeId: 'climate-adaptation'
    },
    {
      id: 'comment-5',
      author: 'Alex Thompson',
      content: 'The digital divide is getting worse, not better. Rural communities are being left behind completely.',
      createdAt: new Date('2025-11-10'),
      votes: 18,
      challengeId: 'digital-equity'
    },
    {
      id: 'comment-6',
      author: 'Jennifer Park',
      authorRole: 'Tech Policy Expert',
      content: 'We need to think beyond just infrastructure. Digital literacy programs are equally important.',
      createdAt: new Date('2025-11-12'),
      votes: 24,
      challengeId: 'digital-equity'
    },
    {
      id: 'comment-7',
      author: 'David Brown',
      content: 'Zoning reform is the elephant in the room. Without addressing restrictive zoning, no amount of funding will solve this.',
      createdAt: new Date('2025-11-08'),
      votes: 56,
      challengeId: 'affordable-housing'
    },
    {
      id: 'reply-2',
      author: 'Lisa Martinez',
      content: 'Agreed. Minneapolis upzoned the entire city and saw significant improvements. We should study their model.',
      createdAt: new Date('2025-11-09'),
      votes: 31,
      parentId: 'comment-7',
      challengeId: 'affordable-housing'
    },
    {
      id: 'comment-8',
      author: 'Robert Johnson',
      authorRole: 'Housing Advocate',
      content: 'Community land trusts have been successful in several cities. They remove speculation from the equation.',
      createdAt: new Date('2025-11-14'),
      votes: 22,
      challengeId: 'affordable-housing'
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
