import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  ApiService,
  AdminStats,
  AdminUser,
  AdminIdea,
  AdminComment,
  AdminChallenge
} from '../shared/services/api.service';

type AdminTab = 'dashboard' | 'users' | 'content';
type ContentTab = 'ideas' | 'comments' | 'challenges';

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

  truncate(text: string, max = 80): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }
}
