import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { SigninModalComponent } from '../components/signin-modal/signin-modal';
import { AuthService } from './auth.service';

/**
 * Utility function to check auth and show modal if not logged in
 * Returns true if user is authenticated, false if modal was shown
 */
@Injectable({
  providedIn: 'root'
})
export class AuthGuardService {
  private dialog = inject(MatDialog);
  private authService = inject(AuthService);

  /**
   * Check if user is authenticated before performing an action
   * If not authenticated, opens sign-in modal
   * @param actionName - Name of the action for the modal message
   * @returns true if user is authenticated, false if modal was shown
   */
  requireAuth(actionName: string = 'This action'): boolean {
    if (this.authService.isAuthenticated()) {
      return true;
    }

    // Open sign-in modal
    this.dialog.open(SigninModalComponent, {
      width: '400px',
      panelClass: 'signin-modal',
      data: {
        title: 'Sign In Required',
        message: `Sign in to ${actionName.toLowerCase()}`
      }
    });

    return false;
  }
}
