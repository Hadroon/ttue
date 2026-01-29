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

export interface Post {
  id: number;
  title: string;
  content: string;
  user_id: number;
  score: number;
  view_count: number;
  created_at: string;
  updated_at: string;
  user?: User;
  comments?: Comment[];
  vote_count?: number;
}

export interface Comment {
  id: number;
  content: string;
  post_id: number;
  user_id: number;
  parent_id?: number;
  score: number;
  created_at: string;
  updated_at: string;
  user?: User;
  replies?: Comment[];
}

export interface Vote {
  id: number;
  user_id: number;
  post_id?: number;
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

export interface PostRevision {
  id: number;
  post_id: number;
  title: string;
  content: string;
  revision_number: number;
  created_at: string;
  user_id: number;
}

// API request/response interfaces
export interface CreatePostRequest {
  title: string;
  content: string;
}

export interface UpdatePostRequest {
  title?: string;
  content?: string;
}

export interface CreateCommentRequest {
  content: string;
  post_id: number;
  parent_id?: number;
}

export interface CreateVoteRequest {
  vote_type: 'up' | 'down';
  post_id?: number;
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
  private readonly _posts = signal<PaginatedResponse<Post> | null>(null);
  private readonly _currentUser = signal<User | null>(null);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // Computed properties for reactive access
  readonly posts = this._posts.asReadonly();
  readonly currentUser = this._currentUser.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  // BehaviorSubjects for complex data streams
  private readonly postsSubject = new BehaviorSubject<PaginatedResponse<Post> | null>(null);
  private readonly userSubject = new BehaviorSubject<User | null>(null);

  // Observable streams
  readonly posts$ = this.postsSubject.asObservable();
  readonly currentUser$ = this.userSubject.asObservable();


  checkWelcome(password: string): Observable<ApiResponse<boolean>> {
    console.log("Checking welcome with password:", password, this.baseUrl);
    return this.http.post<ApiResponse<boolean>>(`${this.baseUrl}/welcome`, { password });
  }
  /**
   * Load posts with pagination
   */
  loadPosts(page: number = 1, limit: number = 20): Observable<PaginatedResponse<Post>> {
    this._loading.set(true);
    this._error.set(null);

    const request = this.http.get<PaginatedResponse<Post>>(`${this.baseUrl}/posts`, {
      params: { page: page.toString(), limit: limit.toString() }
    });

    request.subscribe({
      next: (data) => {
        this._posts.set(data);
        this.postsSubject.next(data);
        this._loading.set(false);
      },
      error: (error) => {
        this._error.set(error.message || 'Failed to load posts');
        this._loading.set(false);
      }
    });

    return request;
  }

  /**
   * Get a single post by ID
   */
  getPost(postId: number): Observable<Post> {
    return this.http.get<Post>(`${this.baseUrl}/posts/${postId}`);
  }

  /**
   * Get comments for a specific post
   */
  getComments(postId: number): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.baseUrl}/posts/${postId}/comments`);
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
   * Search posts
   */
  searchPosts(query: string, page: number = 1, limit: number = 20): Observable<PaginatedResponse<Post>> {
    return this.http.get<PaginatedResponse<Post>>(`${this.baseUrl}/posts/search`, {
      params: {
        q: query,
        page: page.toString(),
        limit: limit.toString()
      }
    });
  }

  /**
   * Get post revisions
   */
  getPostRevisions(postId: number): Observable<PostRevision[]> {
    return this.http.get<PostRevision[]>(`${this.baseUrl}/posts/${postId}/revisions`);
  }

  // CRUD Operations using HTTP methods

  /**
   * Create a new post
   */
  createPost(data: CreatePostRequest) {
    return this.http.post<ApiResponse<Post>>(`${this.baseUrl}/posts`, data);
  }

  /**
   * Update an existing post
   */
  updatePost(postId: number, data: UpdatePostRequest) {
    return this.http.put<ApiResponse<Post>>(`${this.baseUrl}/posts/${postId}`, data);
  }

  /**
   * Delete a post
   */
  deletePost(postId: number) {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/posts/${postId}`);
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
   * Vote on a post or comment
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
   * Get user's votes for a post
   */
  getUserVotes(postId: number) {
    return this.http.get<Vote[]>(`${this.baseUrl}/posts/${postId}/user-votes`);
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
   * Load trending posts
   */
  loadTrendingPosts(timeframe: 'day' | 'week' | 'month' = 'week'): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.baseUrl}/posts/trending`, {
      params: { timeframe }
    });
  }

  /**
   * Load user's posts
   */
  loadUserPosts(userId: number, page: number = 1, limit: number = 20): Observable<PaginatedResponse<Post>> {
    return this.http.get<PaginatedResponse<Post>>(`${this.baseUrl}/users/${userId}/posts`, {
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
    total_posts: number;
    total_comments: number;
    total_users: number;
    active_users_today: number;
  }> {
    return this.http.get<{
      total_posts: number;
      total_comments: number;
      total_users: number;
      active_users_today: number;
    }>(`${this.baseUrl}/stats`);
  }

  /**
   * Increment post view count
   */
  incrementPostViews(postId: number): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/posts/${postId}/view`, {});
  }

  // Challenge methods

  /**
   * Get all challenges with pagination
   */
  getChallenges(page: number = 1, limit: number = 2): Observable<Challenge[]> {
    return this.http.get<Challenge[]>(`${this.baseUrl}/challenges`, {
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
    return this.http.post<ApiResponse<{ message: string; voted: boolean }>>(
      `${this.baseUrl}/challenges/vote`,
      { challengeId }
    );
  }
}
