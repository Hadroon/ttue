import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Header, ShareButton } from '../shared/components';
import {
  CivicActivity,
  CivicProfile,
  FollowingUpdate,
  ReputationEntry,
  UpdateCivicProfile
} from '../shared/models/civic-profile';
import { ApiService } from '../shared/services/api.service';
import { AuthService } from '../shared/services/auth.service';

type ProfileTab = 'activity' | 'contributions' | 'reputation' | 'following';

@Component({
  selector: 'app-profile',
  imports: [DatePipe, FormsModule, Header, RouterLink, ShareButton],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile {
  private readonly route = inject(ActivatedRoute);
  private readonly apiService = inject(ApiService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = signal<CivicProfile | null>(null);
  readonly requestedUsername = signal('');
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly notFound = signal(false);
  readonly activeTab = signal<ProfileTab>('activity');
  readonly activityItems = signal<CivicActivity[]>([]);
  readonly reputationEntries = signal<ReputationEntry[]>([]);
  readonly activityHasMore = signal(false);
  readonly reputationHasMore = signal(false);
  readonly editing = signal(false);
  readonly isLoggedIn = this.authService.isLoggedIn;
  readonly followerCount = signal(0);
  readonly followingCount = signal(0);
  readonly isFollowing = signal(false);
  readonly followBusy = signal(false);
  readonly followingUpdates = signal<FollowingUpdate[]>([]);
  readonly followingUpdatesSince = signal<string | null>(null);
  readonly followingUpdatesLoaded = signal(false);

  editForm: UpdateCivicProfile = {
    displayName: null,
    bio: null,
    location: null,
    websiteUrl: null
  };

  readonly initial = computed(() => {
    const identity = this.profile()?.identity;
    return (identity?.displayName || identity?.username || '?').charAt(0).toUpperCase();
  });

  readonly maxDomainMagnitude = computed(() => {
    const scores = this.profile()?.reputationBreakdown.map(domain => Math.abs(domain.score)) ?? [];
    return Math.max(1, ...scores);
  });

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const username = params.get('username') || this.authService.currentUser()?.username;
        if (!username) {
          this.loading.set(false);
          this.error.set('Sign in to view your profile.');
          return;
        }

        this.requestedUsername.set(username);
        this.loadProfile();
      });
  }

  loadProfile(): void {
    const username = this.requestedUsername();
    if (!username) return;

    this.loading.set(true);
    this.error.set(null);
    this.notFound.set(false);

    this.apiService.getCivicProfile(username).subscribe({
      next: profile => {
        this.profile.set(profile);
        this.activityItems.set(profile.activity.items ?? []);
        this.reputationEntries.set(profile.reputationHistory.rows ?? []);
        this.activityHasMore.set(profile.activity.hasMore);
        this.reputationHasMore.set(profile.reputationHistory.hasMore);
        this.followerCount.set(profile.followerCount);
        this.followingCount.set(profile.followingCount);
        this.isFollowing.set(profile.isFollowing);
        this.followingUpdates.set([]);
        this.followingUpdatesLoaded.set(false);
        this.loading.set(false);
        if (profile.isOwner) {
          this.loadFollowingUpdates();
        }
      },
      error: response => {
        this.notFound.set(response.status === 404);
        this.error.set(response.status === 404 ? 'This civic profile does not exist.' : 'The civic profile could not be loaded.');
        this.loading.set(false);
      }
    });
  }

  selectTab(tab: ProfileTab): void {
    this.activeTab.set(tab);
  }

  loadFollowingUpdates(): void {
    this.apiService.getFollowingUpdates().subscribe({
      next: ({ since, items }) => {
        this.followingUpdates.set(items);
        this.followingUpdatesSince.set(since);
        this.followingUpdatesLoaded.set(true);
      },
      error: () => {
        this.error.set('Updates from people you follow could not be loaded.');
        this.followingUpdatesLoaded.set(true);
      }
    });
  }

  toggleFollow(): void {
    const profile = this.profile();
    if (!profile || this.followBusy()) return;

    const username = profile.identity.username;
    const request = this.isFollowing() ? this.apiService.unfollowUser(username) : this.apiService.followUser(username);
    this.followBusy.set(true);
    this.error.set(null);
    request.subscribe({
      next: state => {
        this.isFollowing.set(state.isFollowing);
        this.followerCount.set(state.followerCount);
        this.followBusy.set(false);
      },
      error: response => {
        this.error.set(response.error?.error || 'Follow status could not be updated.');
        this.followBusy.set(false);
      }
    });
  }

  domainBarWidth(score: number): number {
    return Math.max(score === 0 ? 0 : 8, Math.round(Math.abs(score) / this.maxDomainMagnitude() * 100));
  }

  activityLabel(kind: CivicActivity['kind']): string {
    return {
      challenge: 'Challenge',
      idea: 'Idea',
      comment: 'Comment',
      proposal: 'Merged contribution'
    }[kind];
  }

  reputationLabel(entry: ReputationEntry): string {
    return `${entry.amount > 0 ? 'Support received on' : 'Vote adjustment on'} ${entry.contentType} #${entry.contentId}`;
  }

  loadMoreActivity(): void {
    const profile = this.profile();
    if (!profile || this.loadingMore() || !this.activityHasMore()) return;

    this.loadingMore.set(true);
    this.apiService.getCivicActivity(profile.identity.username, 'all', 20, this.activityItems().length).subscribe({
      next: page => {
        this.activityItems.update(items => [...items, ...(page.items ?? [])]);
        this.activityHasMore.set(page.hasMore);
        this.loadingMore.set(false);
      },
      error: () => {
        this.error.set('More activity could not be loaded.');
        this.loadingMore.set(false);
      }
    });
  }

  loadMoreReputation(): void {
    const profile = this.profile();
    if (!profile || this.loadingMore() || !this.reputationHasMore()) return;

    this.loadingMore.set(true);
    this.apiService.getReputationHistory(profile.identity.username, 20, this.reputationEntries().length).subscribe({
      next: page => {
        this.reputationEntries.update(entries => [...entries, ...(page.rows ?? [])]);
        this.reputationHasMore.set(page.hasMore);
        this.loadingMore.set(false);
      },
      error: () => {
        this.error.set('More reputation history could not be loaded.');
        this.loadingMore.set(false);
      }
    });
  }

  startEditing(): void {
    const identity = this.profile()?.identity;
    if (!identity) return;

    this.editForm = {
      displayName: identity.displayName,
      bio: identity.bio,
      location: identity.location,
      websiteUrl: identity.websiteUrl
    };
    this.editing.set(true);
  }

  cancelEditing(): void {
    this.editing.set(false);
  }

  saveProfile(): void {
    const profile = this.profile();
    if (!profile?.isOwner || this.saving()) return;

    this.saving.set(true);
    this.error.set(null);
    this.apiService.updateCivicProfile(this.editForm).subscribe({
      next: ({ user }) => {
        this.profile.update(current => current ? {
          ...current,
          identity: { ...current.identity, ...user }
        } : current);
        this.editing.set(false);
        this.saving.set(false);
      },
      error: response => {
        this.error.set(response.error?.error || 'Profile changes could not be saved.');
        this.saving.set(false);
      }
    });
  }
}