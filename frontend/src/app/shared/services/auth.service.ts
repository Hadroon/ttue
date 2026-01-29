import { Injectable, signal, computed } from '@angular/core';
import { ApiService, User } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly _currentUser = signal<User | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  // Read-only signals for components
  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isLoggedIn = computed(() => this._currentUser() !== null);

  constructor(private apiService: ApiService) {
    this.initializeAuth();
  }

  /**
   * Initialize auth from localStorage token if available
   */
  private initializeAuth() {
    const token = localStorage.getItem('auth_token');
    if (token) {
      // Token exists, could verify it here or just mark as logged in
      // For now, we'll rely on the token being valid
      const userJson = localStorage.getItem('current_user');
      if (userJson) {
        try {
          this._currentUser.set(JSON.parse(userJson));
        } catch {
          this.logout();
        }
      }
    }
  }

  /**
   * Handle successful login
   */
  setLoggedInUser(user: User, token: string) {
    this._currentUser.set(user);
    localStorage.setItem('auth_token', token);
    localStorage.setItem('current_user', JSON.stringify(user));
    this._error.set(null);
  }

  /**
   * Handle logout
   */
  logout() {
    this._currentUser.set(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
    this._error.set(null);
  }

  /**
   * Set error message
   */
  setError(error: string) {
    this._error.set(error);
  }

  /**
   * Clear error message
   */
  clearError() {
    this._error.set(null);
  }

  /**
   * Set loading state
   */
  setLoading(loading: boolean) {
    this._isLoading.set(loading);
  }

  /**
   * Get current auth token
   */
  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.getToken() !== null && this._currentUser() !== null;
  }
}
