import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { Observable, BehaviorSubject, map } from 'rxjs';
import {
  CivicActivity,
  CivicActivityKind,
  CivicDomain,
  CivicIdentity,
  CivicProfile,
  FollowingUpdates,
  FollowState,
  Page,
  ReputationEntry,
  UpdateCivicProfile
} from '../models/civic-profile';

// Core interfaces for forum entities
export interface User {
  id: number;
  username: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  websiteUrl?: string;
  reputation: number;
  isAdmin?: boolean;
  createdAt?: string;
  updatedAt?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Idea {
  id: number;
  title: string;
  content: string;
  authorId?: number; // New snake_case from backend
  user_id?: number; // Legacy support
  challengeId?: number; // New field for challenge relation
  score: number;
  viewCount?: number; // New camelCase from backend
  view_count?: number; // Legacy support
  isPinned?: boolean;
  isClosed?: boolean;
  isMarked?: boolean;
  createdAt?: string; // New camelCase from backend
  created_at?: string; // Legacy support
  updatedAt?: string; // New camelCase from backend
  updated_at?: string; // Legacy support
  // Author info from JOIN
  authorUsername?: string;
  authorDisplayName?: string;
  authorAvatarUrl?: string;
  user?: User; // Legacy nested user
  comments?: Comment[];
  vote_count?: number;
  voted?: boolean; // Whether the current user has voted on this idea
}

export interface Comment {
  id: number;
  content: string;
  ideaId?: number; // New camelCase from backend
  idea_id?: number; // Legacy support
  challengeId?: number; // For challenge-level comments
  draftId?: number; // For draft-level comments
  authorId?: number; // New camelCase from backend
  user_id?: number; // Legacy support
  parentId?: number | null; // New camelCase from backend
  parent_id?: number; // Legacy support
  score: number;
  isAccepted?: boolean;
  isMarked?: boolean;
  createdAt?: string; // New camelCase from backend
  created_at?: string; // Legacy support
  updatedAt?: string; // New camelCase from backend
  updated_at?: string; // Legacy support
  // Author info from JOIN
  authorUsername?: string;
  authorDisplayName?: string;
  authorAvatarUrl?: string;
  user?: User; // Legacy nested user
  replies?: Comment[];
  voted?: boolean; // Whether the current user has voted on this comment
}

export interface Vote {
  id: number;
  user_id: number;
  idea_id?: number;
  comment_id?: number;
  vote_type: 'up' | 'down';
  created_at: string;
}

export interface Challenge {
  id: number;
  creatorId?: number | null;
  creatorUsername?: string | null;
  domainId?: number;
  domainSlug?: string;
  domainName?: string;
  category: string;
  title: string;
  description: string;
  urgency: 'Low' | 'Medium' | 'High' | 'Critical';
  participantCount: number;
  rewardPool?: string;
  deadline?: Date | string;
  tags: string[];
  votes: number;
  voted?: boolean;
  isMarked?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ChallengeActionKey = 'legal' | 'economic' | 'direct' | 'policy' | 'info';

export interface ChallengeActionState {
  key: ChallengeActionKey;
  votes: number;
  voted: boolean;
  activated: boolean;
  activatedAt: string | null;
}

export interface AdminActionRecommendation {
  challengeId: number;
  challengeTitle: string;
  actionKey: ChallengeActionKey;
  votes: number;
  activatedAt: string | null;
}

export interface ActionItem {
  id: number;
  challengeId: number;
  actionKey: ChallengeActionKey;
  kind: string;
  parentId: number | null;
  userId: number | null;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  authorUsername: string | null;
  authorDisplayName: string | null;
}

/** Per-parent totals: pledged amounts, applications, co-sponsored shares, and donations (in cents) to a task */
export interface ActionItemAggregate {
  kind: string;
  parentId: number;
  count: number;
  total: number;
}

export interface ChallengeLink {
  id: number;
  challengeId: number;
  userId: number;
  url: string;
  title: string;
  description: string | null;
  createdAt: string;
  authorUsername: string;
  authorDisplayName: string | null;
}

export interface DraftVoteSummary {
  support: number;
  oppose: number;
  myVote: 'support' | 'oppose' | null;
}

export interface ChallengeDraft {
  id: number;
  challengeId: number;
  creatorId: number;
  creatorUsername: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChallengeDraftRevision {
  id: number;
  draftId: number;
  editorId: number;
  editorUsername: string;
  content: string;
  createdAt: string;
}

export interface ChallengeDraftProposal {
  id: number;
  draftId: number;
  proposerId: number;
  proposerUsername: string;
  content: string;
  status: 'pending' | 'accepted' | 'rejected';
  resolvedAt: string | null;
  createdAt: string;
}

// Admin interfaces
export interface AdminStats {
  userCount: number;
  ideaCount: number;
  commentCount: number;
  challengeCount: number;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  displayName?: string;
  isAdmin: boolean;
  reputation: number;
  createdAt: string;
}

export interface AdminIdea {
  id: number;
  title: string;
  authorUsername: string;
  score: number;
  createdAt: string;
}

export interface AdminComment {
  id: number;
  content: string;
  authorUsername: string;
  createdAt: string;
}

export interface AdminChallenge {
  id: number;
  title: string;
  category: string;
  urgency: string;
  votes: number;
  createdAt: string;
}

export interface Flag {
  id: number;
  contentType: 'idea' | 'comment' | 'challenge';
  contentId: number;
  reason: string;
  status: 'pending' | 'reviewed' | 'dismissed' | 'marked';
  createdAt: string;
  reviewedAt?: string | null;
  reporterUsername?: string;
  contentTitle?: string | null;
}

/** Where a donation is given; omit for a general donation */
export interface DonationContext {
  challengeId: number;
  actionKey: ChallengeActionKey;
  targetId?: string;
  targetTitle?: string;
  targetLocation?: string;
}

export interface DonationConfirmation {
  paid: boolean;
  status: string | null;
  paymentStatus: string;
  amount: number; // smallest currency unit
  currency: string | null;
  challengeId: number | null;
  actionKey: ChallengeActionKey | null;
  targetId: string | null;
}

export interface AdminDonation {
  id: number;
  amount: number; // smallest currency unit
  currency: string;
  livemode: boolean;
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
  donorEmail: string | null;
  donorName: string | null;
  donorUsername: string | null;
  challengeId: number | null;
  challengeTitle: string | null;
  actionKey: ChallengeActionKey | null;
  targetId: string | null;
  targetTitle: string | null;
  targetLocation: string | null;
  paidAt: string;
}

export interface FeaturedChallenge {
  challenge: Challenge;
  topIdea: Idea | null;
  ideaCount: number;
  comments: Comment[];
}

export interface ChallengeSearch {
  page: number;
  limit: number;
  q?: string;
  from?: Date | null;
  to?: Date | null;
  tags?: string[];
}

export interface IdeaRevision {
  id: number;
  idea_id: number;
  title: string;
  content: string;
  revision_number: number;
  created_at: string;
  user_id: number;
}

// API request/response interfaces
export interface CreateIdeaRequest {
  title: string;
  content: string;
  challengeId?: number;
}

export interface UpdateIdeaRequest {
  title?: string;
  content?: string;
}

export interface CreateCommentRequest {
  content: string;
  ideaId?: number;
  challengeId?: number;
  draftId?: number;
  parentId?: number;
}

export interface CreateVoteRequest {
  vote_type: 'up' | 'down';
  idea_id?: number;
  comment_id?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // Signal-based reactive state management
  private readonly _ideas = signal<PaginatedResponse<Idea> | null>(null);
  private readonly _currentUser = signal<User | null>(null);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // Computed properties for reactive access
  readonly ideas = this._ideas.asReadonly();
  readonly currentUser = this._currentUser.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  // BehaviorSubjects for complex data streams
  private readonly ideasSubject = new BehaviorSubject<PaginatedResponse<Idea> | null>(null);
  private readonly userSubject = new BehaviorSubject<User | null>(null);

  // Observable streams
  readonly ideas$ = this.ideasSubject.asObservable();
  readonly currentUser$ = this.userSubject.asObservable();


  checkWelcome(password: string): Observable<ApiResponse<boolean>> {
    console.log("Checking welcome with password:", password, this.baseUrl);
    return this.http.post<ApiResponse<boolean>>(`${this.baseUrl}/welcome`, { password });
  }
  /**
   * Load ideas with pagination
   */
  loadIdeas(page: number = 1, limit: number = 20): Observable<PaginatedResponse<Idea>> {
    this._loading.set(true);
    this._error.set(null);

    const request = this.http.get<PaginatedResponse<Idea>>(`${this.baseUrl}/ideas`, {
      params: { page: page.toString(), limit: limit.toString() }
    });

    request.subscribe({
      next: (data) => {
        this._ideas.set(data);
        this.ideasSubject.next(data);
        this._loading.set(false);
      },
      error: (error) => {
        this._error.set(error.message || 'Failed to load ideas');
        this._loading.set(false);
      }
    });

    return request;
  }

  /**
   * Get ideas with optional challengeId filter and pagination
   */
  getIdeas(params: { challengeId?: number; limit?: number; offset?: number } = {}): Observable<{ ideas: Idea[]; limit: number; offset: number }> {
    const queryParams: Record<string, string> = {
      limit: (params.limit ?? 10).toString(),
      offset: (params.offset ?? 0).toString()
    };
    if (params.challengeId != null) {
      queryParams['challengeId'] = params.challengeId.toString();
    }
    return this.http.get<{ ideas: Idea[]; limit: number; offset: number }>(`${this.baseUrl}/ideas`, { params: queryParams });
  }

  /**
   * Get a single idea by ID
   */
  getIdea(ideaId: number): Observable<Idea> {
    return this.http.get<Idea>(`${this.baseUrl}/ideas/${ideaId}`);
  }

  /**
   * Get a paginated comment thread for a challenge, draft or idea
   */
  getCommentThread(
    entityType: 'challenge' | 'draft' | 'idea',
    entityId: number,
    options: { sort?: 'recent' | 'votes' | 'oldest' | 'replies'; page?: number; limit?: number } = {}
  ): Observable<{ comments: Comment[]; total: number; page: number; limit: number; hasNext: boolean }> {
    const { sort = 'recent', page = 1, limit = 20 } = options;
    const base = { challenge: 'challenges', draft: 'drafts', idea: 'ideas' }[entityType];
    return this.http.get<{ comments: Comment[]; total: number; page: number; limit: number; hasNext: boolean }>(
      `${this.baseUrl}/${base}/${entityId}/comments`,
      { params: { sort, page, limit } }
    );
  }

  /**
   * Get challenge-level comments
   */
  getChallengeComments(
    challengeId: number,
    options: { sort?: 'recent' | 'votes' | 'oldest' | 'replies'; page?: number; limit?: number } = {}
  ): Observable<{ comments: Comment[]; total: number; page: number; limit: number; hasNext: boolean }> {
    return this.getCommentThread('challenge', challengeId, options);
  }

  /**
   * Get user by ID
   */
  getUser(userId: number): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/users/${userId}`);
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): Observable<User> {
    const request = this.http.get<User>(`${this.baseUrl}/auth/me`);
    
    request.subscribe({
      next: (user) => {
        this._currentUser.set(user);
        this.userSubject.next(user);
      },
      error: (error) => {
        this._currentUser.set(null);
        this.userSubject.next(null);
      }
    });

    return request;
  }

  getDomains(): Observable<{ domains: CivicDomain[] }> {
    return this.http.get<{ domains: CivicDomain[] }>(`${this.baseUrl}/domains`);
  }

  getCivicProfile(username: string): Observable<CivicProfile> {
    return this.http.get<CivicProfile>(`${this.baseUrl}/users/${encodeURIComponent(username)}/profile`);
  }

  getCivicActivity(
    username: string,
    kind: CivicActivityKind,
    limit: number = 20,
    offset: number = 0
  ): Observable<Page<CivicActivity>> {
    return this.http.get<Page<CivicActivity>>(
      `${this.baseUrl}/users/${encodeURIComponent(username)}/activity`,
      { params: { kind, limit: limit.toString(), offset: offset.toString() } }
    );
  }

  getReputationHistory(
    username: string,
    limit: number = 20,
    offset: number = 0
  ): Observable<Page<ReputationEntry>> {
    return this.http.get<Page<ReputationEntry>>(
      `${this.baseUrl}/users/${encodeURIComponent(username)}/reputation`,
      { params: { limit: limit.toString(), offset: offset.toString() } }
    );
  }

  updateCivicProfile(profile: UpdateCivicProfile): Observable<{ user: CivicIdentity }> {
    return this.http.put<{ user: CivicIdentity }>(`${this.baseUrl}/auth/profile`, profile);
  }

  followUser(username: string): Observable<FollowState> {
    return this.http.post<FollowState>(`${this.baseUrl}/users/${encodeURIComponent(username)}/follow`, {});
  }

  unfollowUser(username: string): Observable<FollowState> {
    return this.http.delete<FollowState>(`${this.baseUrl}/users/${encodeURIComponent(username)}/follow`);
  }

  getFollowingUpdates(): Observable<FollowingUpdates> {
    return this.http.get<FollowingUpdates>(`${this.baseUrl}/users/me/following-updates`);
  }

  /**
   * Search ideas
   */
  searchIdeas(query: string, page: number = 1, limit: number = 20): Observable<PaginatedResponse<Idea>> {
    return this.http.get<PaginatedResponse<Idea>>(`${this.baseUrl}/ideas/search`, {
      params: {
        q: query,
        page: page.toString(),
        limit: limit.toString()
      }
    });
  }

  /**
   * Get idea revisions
   */
  getIdeaRevisions(ideaId: number): Observable<IdeaRevision[]> {
    return this.http.get<IdeaRevision[]>(`${this.baseUrl}/ideas/${ideaId}/revisions`);
  }

  // CRUD Operations using HTTP methods

  /**
   * Create a new idea
   */
  createIdea(data: CreateIdeaRequest) {
    return this.http.post<ApiResponse<Idea>>(`${this.baseUrl}/ideas`, data);
  }

  /**
   * Update an existing idea
   */
  updateIdea(ideaId: number, data: UpdateIdeaRequest) {
    return this.http.put<ApiResponse<Idea>>(`${this.baseUrl}/ideas/${ideaId}`, data);
  }

  /**
   * Delete an idea
   */
  deleteIdea(ideaId: number) {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/ideas/${ideaId}`);
  }

  /**
   * Create a new comment
   */
  createComment(data: CreateCommentRequest) {
    return this.http.post<{ comment: Comment }>(`${this.baseUrl}/comments`, data);
  }

  /**
   * Update a comment
   */
  updateComment(commentId: number, content: string) {
    return this.http.put<ApiResponse<Comment>>(`${this.baseUrl}/comments/${commentId}`, { content });
  }

  /**
   * Delete a comment
   */
  deleteComment(commentId: number) {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/comments/${commentId}`);
  }

  /**
   * Vote on an idea or comment
   */
  vote(data: CreateVoteRequest) {
    return this.http.post<ApiResponse<Vote>>(`${this.baseUrl}/votes`, data);
  }

  /**
   * Remove a vote
   */
  removeVote(voteId: number) {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/votes/${voteId}`);
  }

  /**
   * Get user's votes for an idea
   */
  getUserVotes(ideaId: number) {
    return this.http.get<Vote[]>(`${this.baseUrl}/ideas/${ideaId}/user-votes`);
  }

  // Authentication methods

  /**
   * Login user
   */
  login(email: string, password: string) {
    return this.http.post<ApiResponse<{ user: User; token: string }>>(`${this.baseUrl}/auth/login`, {
      email,
      password
    });
  }

  /**
   * Register new user
   */
  register(username: string, email: string, password: string) {
    return this.http.post<ApiResponse<{ user: User; token: string }>>(`${this.baseUrl}/auth/register`, {
      username,
      email,
      password
    });
  }

  /**
   * Login with Google ID token
   */
  loginWithGoogle(idToken: string) {
    return this.http.post<ApiResponse<{ user: User; token: string; isNewUser: boolean }>>(`${this.baseUrl}/auth/google`, {
      idToken
    });
  }

  /**
   * Get Google OAuth configuration (client ID)
   */
  getGoogleConfig() {
    return this.http.get<{ clientId: string | null; enabled: boolean }>(`${this.baseUrl}/auth/google/config`);
  }

  /**
   * Get donation (Stripe) configuration
   */
  getDonationConfig() {
    return this.http.get<{ publishableKey: string | null; currency: string; minAmount: number; maxAmount: number; enabled: boolean }>(
      `${this.baseUrl}/donations/config`
    );
  }

  /**
   * Create a one-time donation Checkout Session; amount is in the smallest currency unit
   */
  createDonationSession(amount: number, context?: DonationContext) {
    return this.http.post<{ client_secret: string; session_id: string }>(`${this.baseUrl}/donations/checkout-session`, { amount, context });
  }

  /**
   * Ask the backend to check a finished Checkout Session with Stripe and record it if paid
   */
  confirmDonation(sessionId: string) {
    return this.http.post<DonationConfirmation>(`${this.baseUrl}/donations/confirm`, { sessionId });
  }

  /**
   * Logout user
   */
  logout() {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/auth/logout`, {});
  }

  /**
   * Refresh authentication token
   */
  refreshToken() {
    return this.http.post<ApiResponse<{ token: string }>>(`${this.baseUrl}/auth/refresh`, {});
  }

  // Additional utility methods

  /**
   * Load trending ideas
   */
  loadTrendingIdeas(timeframe: 'day' | 'week' | 'month' = 'week'): Observable<Idea[]> {
    return this.http.get<Idea[]>(`${this.baseUrl}/ideas/trending`, {
      params: { timeframe }
    });
  }

  /**
   * Load user's ideas
   */
  loadUserIdeas(userId: number, page: number = 1, limit: number = 20): Observable<PaginatedResponse<Idea>> {
    return this.http.get<PaginatedResponse<Idea>>(`${this.baseUrl}/users/${userId}/ideas`, {
      params: { page: page.toString(), limit: limit.toString() }
    });
  }

  /**
   * Load user's comments
   */
  loadUserComments(userId: number, page: number = 1, limit: number = 20): Observable<PaginatedResponse<Comment>> {
    return this.http.get<PaginatedResponse<Comment>>(`${this.baseUrl}/users/${userId}/comments`, {
      params: { page: page.toString(), limit: limit.toString() }
    });
  }

  /**
   * Get forum statistics
   */
  getForumStats(): Observable<{
    total_ideas: number;
    total_comments: number;
    total_users: number;
    active_users_today: number;
  }> {
    return this.http.get<{
      total_ideas: number;
      total_comments: number;
      total_users: number;
      active_users_today: number;
    }>(`${this.baseUrl}/stats`);
  }

  /**
   * Increment idea view count
   */
  incrementIdeaViews(ideaId: number): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/ideas/${ideaId}/view`, {});
  }

  // Challenge methods

  /**
   * Get all challenges with pagination, including top idea and comments
   */
  getChallenges(page: number = 1, limit: number = 5): Observable<FeaturedChallenge[]> {
    return this.http.get<FeaturedChallenge[]>(`${this.baseUrl}/challenges`, {
      params: { 
        page: page.toString(), 
        limit: limit.toString() 
      }
    });
  }

  /**
   * Search challenges on the server; `to` is exclusive
   */
  searchChallenges(filter: ChallengeSearch): Observable<{ items: FeaturedChallenge[]; total: number }> {
    const params: Record<string, string | string[]> = {
      page: filter.page.toString(),
      limit: filter.limit.toString()
    };
    if (filter.q) params['q'] = filter.q;
    if (filter.from) params['from'] = filter.from.toISOString();
    if (filter.to) params['to'] = filter.to.toISOString();
    if (filter.tags?.length) params['tag'] = filter.tags;

    return this.http
      .get<FeaturedChallenge[]>(`${this.baseUrl}/challenges`, { params, observe: 'response' })
      .pipe(map(res => ({
        items: res.body ?? [],
        total: Number(res.headers.get('X-Total-Count') ?? res.body?.length ?? 0)
      })));
  }

  getChallengeTags(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/challenges/tags`);
  }

  /**
   * Get a single challenge by ID
   */
  getChallenge(challengeId: number): Observable<Challenge> {
    return this.http.get<Challenge>(`${this.baseUrl}/challenges/${challengeId}`);
  }

  /**
   * Create a new challenge
   */
  createChallenge(data: {
    category: string;
    domainSlug: string;
    title: string;
    description: string;
    urgency: string;
    rewardPool?: string;
    deadline?: string;
    tags?: string[];
  }): Observable<Challenge> {
    return this.http.post<Challenge>(`${this.baseUrl}/challenges`, data);
  }

  /**
   * Vote on a challenge
   */
  voteChallenge(challengeId: number) {
    return this.http.post<{ message: string; votes: number; voted: boolean }>(
      `${this.baseUrl}/challenges/vote`,
      { challengeId }
    );
  }

  /** Recommendation counts and activation state of every community action for a challenge */
  getChallengeActions(challengeId: number) {
    return this.http.get<{ actions: ChallengeActionState[] }>(`${this.baseUrl}/challenges/${challengeId}/actions`);
  }

  /** Toggle the caller's recommendation for an action */
  voteChallengeAction(challengeId: number, key: ChallengeActionKey) {
    return this.http.post<{ message: string; action: ChallengeActionState }>(
      `${this.baseUrl}/challenges/${challengeId}/actions/${key}/vote`, {});
  }

  /** Recommendation counts per challenge and action (admin only) */
  getAdminActionRecommendations(): Observable<AdminActionRecommendation[]> {
    return this.http.get<AdminActionRecommendation[]>(`${this.baseUrl}/admin/action-recommendations`);
  }

  /** Approve or revoke an action (admin only) */
  setChallengeActionActive(challengeId: number, key: ChallengeActionKey, active: boolean) {
    return this.http.put<{ message: string; action: ChallengeActionState }>(
      `${this.baseUrl}/challenges/${challengeId}/actions/${key}/activation`, { active });
  }

  /** Entries submitted through the action forms: shared ones for everyone, personal ones for the caller */
  getActionItems(challengeId: number) {
    return this.http.get<{ items: ActionItem[]; aggregates: ActionItemAggregate[] }>(
      `${this.baseUrl}/challenges/${challengeId}/action-items`);
  }

  /** Add an entry; kinds that allow one per user replace the caller's existing entry */
  createActionItem(challengeId: number, kind: string, data: Record<string, unknown>, parentId?: number) {
    return this.http.post<ActionItem>(`${this.baseUrl}/challenges/${challengeId}/action-items`, { kind, parentId, data });
  }

  updateActionItem(challengeId: number, itemId: number, data: Record<string, unknown>) {
    return this.http.put<ActionItem>(`${this.baseUrl}/challenges/${challengeId}/action-items/${itemId}`, { data });
  }

  deleteActionItem(challengeId: number, itemId: number) {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/challenges/${challengeId}/action-items/${itemId}`);
  }

  /** Links users have attached to a challenge, newest first */
  getChallengeLinks(challengeId: number) {
    return this.http.get<ChallengeLink[]>(`${this.baseUrl}/challenges/${challengeId}/links`);
  }

  addChallengeLink(challengeId: number, link: { url: string; title?: string; description?: string }) {
    return this.http.post<ChallengeLink>(`${this.baseUrl}/challenges/${challengeId}/links`, link);
  }

  /** Allowed for the link's author and admins */
  deleteChallengeLink(challengeId: number, linkId: number) {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/challenges/${challengeId}/links/${linkId}`);
  }

  /** Support/oppose tallies and the caller's own choice for a challenge's draft */
  getDraftVotes(challengeId: number) {
    return this.http.get<DraftVoteSummary>(`${this.baseUrl}/challenges/${challengeId}/draft/votes`);
  }

  /** Cast, switch or remove (by repeating the choice) the caller's draft vote */
  voteDraft(challengeId: number, choice: 'support' | 'oppose') {
    return this.http.post<DraftVoteSummary & { message: string }>(
      `${this.baseUrl}/challenges/${challengeId}/draft/votes`, { choice });
  }

  /**
   * Vote on an idea (toggle upvote)
   */
  voteIdea(ideaId: number) {
    console.log("Voting on idea:", ideaId);
    return this.http.post<{ message: string; score: number; voted: boolean }>(
      `${this.baseUrl}/ideas/${ideaId}/vote`,
      { value: 1 }
    );
  }

  /**
   * Vote on a comment (toggle upvote)
   */
  voteComment(commentId: number) {
    return this.http.post<{ message: string; score: number; voted: boolean }>(
      `${this.baseUrl}/comments/${commentId}/vote`,
      { value: 1 }
    );
  }

  /**
   * Get featured challenges (top 3) with top idea and comments
   */
  getFeaturedChallenge(): Observable<FeaturedChallenge[]> {
    return this.http.get<FeaturedChallenge[]>(`${this.baseUrl}/challenges/featured`);
  }

  // Challenge draft methods

  /**
   * Create a draft for a challenge
   */
  createChallengeDraft(challengeId: number, content: string): Observable<ApiResponse<ChallengeDraft>> {
    return this.http.post<ApiResponse<ChallengeDraft>>(
      `${this.baseUrl}/challenges/${challengeId}/draft`,
      { content }
    );
  }

  /**
   * Get the draft for a challenge
   */
  getChallengeDraft(challengeId: number): Observable<ChallengeDraft> {
    return this.http.get<ChallengeDraft>(`${this.baseUrl}/challenges/${challengeId}/draft`);
  }

  /**
   * Update the draft for a challenge
   */
  updateChallengeDraft(challengeId: number, content: string): Observable<ChallengeDraft> {
    return this.http.put<ChallengeDraft>(
      `${this.baseUrl}/challenges/${challengeId}/draft`,
      { content }
    );
  }

  /**
   * Get revision history for a challenge draft
   */
  getChallengeDraftRevisions(challengeId: number): Observable<ChallengeDraftRevision[]> {
    return this.http.get<ChallengeDraftRevision[]>(
      `${this.baseUrl}/challenges/${challengeId}/draft/revisions`
    );
  }

  /**
   * Get proposals for a challenge draft
   */
  getDraftProposals(challengeId: number): Observable<ChallengeDraftProposal[]> {
    return this.http.get<ChallengeDraftProposal[]>(
      `${this.baseUrl}/challenges/${challengeId}/draft/proposals`
    );
  }

  /**
   * Resolve a draft proposal (accept or reject)
   */
  resolveDraftProposal(challengeId: number, proposalId: number, action: 'accept' | 'reject', editedContent?: string): Observable<ChallengeDraftProposal> {
    const body: any = { action };
    if (editedContent !== undefined) {
      body.editedContent = editedContent;
    }
    return this.http.post<ChallengeDraftProposal>(
      `${this.baseUrl}/challenges/${challengeId}/draft/proposals/${proposalId}/resolve`,
      body
    );
  }

  // Admin methods

  getAdminStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.baseUrl}/admin/stats`);
  }

  getAdminUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${this.baseUrl}/admin/users`);
  }

  toggleAdminUser(userId: number, isAdmin: boolean): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.baseUrl}/admin/users/${userId}`, { isAdmin });
  }

  getAdminIdeas(): Observable<AdminIdea[]> {
    return this.http.get<AdminIdea[]>(`${this.baseUrl}/admin/ideas`);
  }

  deleteAdminIdea(ideaId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/admin/ideas/${ideaId}`);
  }

  getAdminComments(): Observable<AdminComment[]> {
    return this.http.get<AdminComment[]>(`${this.baseUrl}/admin/comments`);
  }

  deleteAdminComment(commentId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/admin/comments/${commentId}`);
  }

  getAdminChallenges(): Observable<AdminChallenge[]> {
    return this.http.get<AdminChallenge[]>(`${this.baseUrl}/admin/challenges`);
  }

  deleteAdminChallenge(challengeId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/admin/challenges/${challengeId}`);
  }

  // Flag methods

  flagContent(contentType: string, contentId: string | number, reason: string): Observable<Flag> {
    return this.http.post<Flag>(`${this.baseUrl}/flags`, { contentType, contentId, reason });
  }

  unflagContent(contentType: string, contentId: string | number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/flags/${contentType}/${contentId}`);
  }

  checkFlagged(contentType: string, contentId: string | number): Observable<{ flagged: boolean }> {
    return this.http.get<{ flagged: boolean }>(`${this.baseUrl}/flags/me`, {
      params: { contentType, contentId: contentId.toString() }
    });
  }

  getAdminFlags(status: 'pending' | 'marked' | 'all' = 'pending'): Observable<Flag[]> {
    return this.http.get<Flag[]>(`${this.baseUrl}/admin/flags`, { params: { status } });
  }

  getAdminDonations(): Observable<AdminDonation[]> {
    return this.http.get<AdminDonation[]>(`${this.baseUrl}/admin/donations`);
  }

  resolveAdminFlag(flagId: number, status: 'reviewed' | 'dismissed'): Observable<{ id: number; status: string }> {
    return this.http.patch<{ id: number; status: string }>(`${this.baseUrl}/admin/flags/${flagId}`, { status });
  }

  markAdminContent(flagId: number): Observable<{ id: number; status: string }> {
    return this.http.patch<{ id: number; status: string }>(`${this.baseUrl}/admin/flags/${flagId}/mark`, {});
  }
}
