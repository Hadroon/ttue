import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { Observable, BehaviorSubject } from 'rxjs';

// Core interfaces for forum entities
export interface User {
  id: number;
  username: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  reputation: number;
  created_at: string;
  updated_at: string;
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
  authorId?: number; // New camelCase from backend
  user_id?: number; // Legacy support
  parentId?: number | null; // New camelCase from backend
  parent_id?: number; // Legacy support
  score: number;
  isAccepted?: boolean;
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
  createdAt: string;
  updatedAt: string;
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

export interface FeaturedChallenge {
  challenge: Challenge;
  topIdea: Idea | null;
  comments: Comment[];
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
}

export interface UpdateIdeaRequest {
  title?: string;
  content?: string;
}

export interface CreateCommentRequest {
  content: string;
  idea_id: number;
  parent_id?: number;
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
   * Get a single idea by ID
   */
  getIdea(ideaId: number): Observable<Idea> {
    return this.http.get<Idea>(`${this.baseUrl}/ideas/${ideaId}`);
  }

  /**
   * Get comments for a specific idea
   */
  getComments(ideaId: number): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.baseUrl}/ideas/${ideaId}/comments`);
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
    return this.http.post<ApiResponse<Comment>>(`${this.baseUrl}/comments`, data);
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
    title: string;
    description: string;
    urgency: string;
    rewardPool?: string;
    deadline?: string;
    tags?: string[];
  }) {
    return this.http.post<ApiResponse<Challenge>>(`${this.baseUrl}/challenges`, data);
  }

  /**
   * Vote on a challenge
   */
  voteChallenge(challengeId: number) {
    return this.http.post<{ message: string; voted: boolean }>(
      `${this.baseUrl}/challenges/vote`,
      { challengeId }
    );
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
}
