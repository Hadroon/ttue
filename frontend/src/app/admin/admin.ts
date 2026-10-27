import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  ApiService,
  AdminStats,
  AdminUser,
  AdminIdea,
  AdminComment,
  AdminChallenge,
  AdminDonation,
  AdminActionRecommendation,
  ChallengeActionKey,
  Flag
} from '../shared/services/api.service';

type AdminTab = 'dashboard' | 'users' | 'content' | 'flags' | 'actions' | 'donations';
type ContentTab = 'ideas' | 'comments' | 'challenges';

const ACTION_LABELS: Record<ChallengeActionKey, string> = {
  legal: 'Legal action',
  economic: 'Economic pressure',
  direct: 'Direct action',
  policy: 'Policy & lobbying',
  info: 'Information campaigns'
};

@Component({
  selector: 'app-admin',
  imports: [CommonModule, RouterLink],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class Admin implements OnInit {
  private apiService = inject(ApiService);

  activeTab = signal<AdminTab>('dashboard');
  activeContentTab = signal<ContentTab>('ideas');

  stats = signal<AdminStats | null>(null);
  users = signal<AdminUser[]>([]);
  ideas = signal<AdminIdea[]>([]);
  comments = signal<AdminComment[]>([]);
  challenges = signal<AdminChallenge[]>([]);
  flags = signal<Flag[]>([]);
  flagStatusFilter = signal<'pending' | 'marked' | 'all'>('pending');
  donations = signal<AdminDonation[]>([]);
  recommendations = signal<AdminActionRecommendation[]>([]);
  recommendationFilter = signal<'pending' | 'approved' | 'all'>('pending');
  visibleRecommendations = computed(() => {
    const filter = this.recommendationFilter();
    return this.recommendations().filter(r =>
      filter === 'all' || (filter === 'approved') === (r.activatedAt !== null));
  });
  busyRecommendation = signal<string | null>(null);
  /** Totals per currency, in major units */
  donationTotals = computed(() => {
    const totals = new Map<string, number>();
    for (const d of this.donations()) {
      totals.set(d.currency, (totals.get(d.currency) ?? 0) + d.amount / 100);
    }
    return [...totals].map(([currency, total]) => ({ currency: currency.toUpperCase(), total }));
  });

  loading = signal(false);
  error = signal<string | null>(null);

  ngOnInit() {
    this.loadStats();
  }

  setTab(tab: AdminTab) {
    this.activeTab.set(tab);
    this.error.set(null);
    if (tab === 'dashboard') this.loadStats();
    else if (tab === 'users') this.loadUsers();
    else if (tab === 'content') this.loadIdeas();
    else if (tab === 'flags') this.loadFlags();
    else if (tab === 'actions') this.loadRecommendations();
    else if (tab === 'donations') this.loadDonations();
  }

  setContentTab(tab: ContentTab) {
    this.activeContentTab.set(tab);
    this.error.set(null);
    if (tab === 'ideas') this.loadIdeas();
    else if (tab === 'comments') this.loadComments();
    else if (tab === 'challenges') this.loadChallenges();
  }

  loadStats() {
    this.loading.set(true);
    this.apiService.getAdminStats().subscribe({
      next: (data) => { this.stats.set(data); this.loading.set(false); },
      error: () => { this.error.set('Failed to load stats'); this.loading.set(false); }
    });
  }

  loadUsers() {
    this.loading.set(true);
    this.apiService.getAdminUsers().subscribe({
      next: (data) => { this.users.set(data); this.loading.set(false); },
      error: () => { this.error.set('Failed to load users'); this.loading.set(false); }
    });
  }

  loadIdeas() {
    this.loading.set(true);
    this.apiService.getAdminIdeas().subscribe({
      next: (data) => { this.ideas.set(data); this.loading.set(false); },
      error: () => { this.error.set('Failed to load ideas'); this.loading.set(false); }
    });
  }

  loadComments() {
    this.loading.set(true);
    this.apiService.getAdminComments().subscribe({
      next: (data) => { this.comments.set(data); this.loading.set(false); },
      error: () => { this.error.set('Failed to load comments'); this.loading.set(false); }
    });
  }

  loadChallenges() {
    this.loading.set(true);
    this.apiService.getAdminChallenges().subscribe({
      next: (data) => { this.challenges.set(data); this.loading.set(false); },
      error: () => { this.error.set('Failed to load challenges'); this.loading.set(false); }
    });
  }

  toggleAdmin(user: AdminUser) {
    this.apiService.toggleAdminUser(user.id, !user.isAdmin).subscribe({
      next: (updated) => {
        this.users.update(list => list.map(u => u.id === user.id ? { ...u, isAdmin: updated.isAdmin } : u));
      },
      error: () => this.error.set('Failed to update user')
    });
  }

  deleteIdea(id: number) {
    if (!confirm('Delete this idea? This cannot be undone.')) return;
    this.apiService.deleteAdminIdea(id).subscribe({
      next: () => this.ideas.update(list => list.filter(i => i.id !== id)),
      error: () => this.error.set('Failed to delete idea')
    });
  }

  deleteComment(id: number) {
    if (!confirm('Delete this comment? This cannot be undone.')) return;
    this.apiService.deleteAdminComment(id).subscribe({
      next: () => this.comments.update(list => list.filter(c => c.id !== id)),
      error: () => this.error.set('Failed to delete comment')
    });
  }

  deleteChallenge(id: number) {
    if (!confirm('Delete this challenge? This cannot be undone.')) return;
    this.apiService.deleteAdminChallenge(id).subscribe({
      next: () => this.challenges.update(list => list.filter(c => c.id !== id)),
      error: () => this.error.set('Failed to delete challenge')
    });
  }

  loadFlags() {
    this.loading.set(true);
    this.apiService.getAdminFlags(this.flagStatusFilter()).subscribe({
      next: (data) => { this.flags.set(data); this.loading.set(false); },
      error: () => { this.error.set('Failed to load flags'); this.loading.set(false); }
    });
  }

  setFlagFilter(status: 'pending' | 'marked' | 'all') {
    this.flagStatusFilter.set(status);
    this.loadFlags();
  }

  resolveFlag(id: number, status: 'reviewed' | 'dismissed') {
    this.apiService.resolveAdminFlag(id, status).subscribe({
      next: () => this.flags.update(list => list.filter(f => f.id !== id)),
      error: () => this.error.set('Failed to resolve flag')
    });
  }

  markContent(flag: Flag) {
    this.apiService.markAdminContent(flag.id).subscribe({
      next: () => this.loadFlags(),
      error: () => this.error.set('Failed to mark content')
    });
  }

  loadRecommendations() {
    this.loading.set(true);
    this.apiService.getAdminActionRecommendations().subscribe({
      next: (data) => { this.recommendations.set(data); this.loading.set(false); },
      error: () => { this.error.set('Failed to load action recommendations'); this.loading.set(false); }
    });
  }

  toggleApproval(r: AdminActionRecommendation) {
    const id = `${r.challengeId}:${r.actionKey}`;
    const approve = r.activatedAt === null;
    this.busyRecommendation.set(id);
    this.apiService.setChallengeActionActive(r.challengeId, r.actionKey, approve).subscribe({
      next: ({ action }) => {
        this.recommendations.update(list => list.map(x =>
          x.challengeId === r.challengeId && x.actionKey === r.actionKey
            ? { ...x, activatedAt: action.activatedAt }
            : x));
        this.busyRecommendation.set(null);
      },
      error: () => { this.error.set('Failed to update the action'); this.busyRecommendation.set(null); }
    });
  }

  loadDonations() {
    this.loading.set(true);
    this.apiService.getAdminDonations().subscribe({
      next: (data) => { this.donations.set(data); this.loading.set(false); },
      error: () => { this.error.set('Failed to load donations'); this.loading.set(false); }
    });
  }

  actionLabel(key: ChallengeActionKey | null): string {
    return key ? ACTION_LABELS[key] ?? key : 'General donation';
  }

  stripeUrl(d: AdminDonation): string | null {
    if (!d.stripePaymentIntentId) return null;
    return `https://dashboard.stripe.com/${d.livemode ? '' : 'test/'}payments/${d.stripePaymentIntentId}`;
  }

  truncate(text: string, max = 80): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }
}
