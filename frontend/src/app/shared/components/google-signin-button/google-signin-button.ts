import { Component, OnInit, OnDestroy, Output, EventEmitter, inject, PLATFORM_ID, signal, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleInitConfig) => void;
          renderButton: (element: HTMLElement, config: GoogleButtonConfig) => void;
          prompt: () => void;
          cancel: () => void;
        };
      };
    };
  }
}

interface GoogleInitConfig {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
}

interface GoogleButtonConfig {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: number;
}

interface GoogleCredentialResponse {
  credential: string;
  select_by: string;
}

@Component({
  selector: 'app-google-signin-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './google-signin-button.html',
  styleUrl: './google-signin-button.css'
})
export class GoogleSigninButtonComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('googleButton', { static: false }) googleButton!: ElementRef;
  
  private readonly apiService = inject(ApiService);
  private readonly platformId = inject(PLATFORM_ID);

  @Output() loginSuccess = new EventEmitter<{ user: any; token: string; isNewUser: boolean }>();
  @Output() loginError = new EventEmitter<string>();
  @Output() loginStart = new EventEmitter<void>();

  isLoading = signal(false);
  isEnabled = signal(false);
  errorMessage = signal<string | null>(null);
  private clientId: string | null = null;
  private scriptLoaded = false;

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadGoogleConfig();
    }
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId) && this.isEnabled() && this.scriptLoaded) {
      this.renderGoogleButton();
    }
  }

  ngOnDestroy() {
    // Cancel Google One Tap when component is destroyed
    if (window.google?.accounts?.id) {
      window.google.accounts.id.cancel();
    }
  }

  private loadGoogleConfig() {
    this.apiService.getGoogleConfig().subscribe({
      next: (config) => {
        if (config.enabled && config.clientId) {
          this.clientId = config.clientId;
          this.isEnabled.set(true);
          this.loadGoogleScript();
        }
      },
      error: (err) => {
        console.error('Failed to load Google config:', err);
        this.errorMessage.set('Google Sign-In is not available');
      }
    });
  }

  private loadGoogleScript() {
    // Check if script is already loaded
    if (window.google?.accounts) {
      this.scriptLoaded = true;
      this.renderGoogleButton();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      this.scriptLoaded = true;
      this.renderGoogleButton();
    };
    script.onerror = () => {
      this.errorMessage.set('Failed to load Google Sign-In');
      this.isEnabled.set(false);
    };
    document.head.appendChild(script);
  }

  private initializeGoogleSignIn() {
    if (!window.google?.accounts || !this.clientId) return;

    window.google.accounts.id.initialize({
      client_id: this.clientId,
      callback: (response) => this.handleGoogleCallback(response)
    });
  }

  private renderGoogleButton() {
    // Make sure the script and button element are ready
    if (!window.google?.accounts || !this.googleButton?.nativeElement) {
      // Retry after a short delay if element not ready
      setTimeout(() => this.renderGoogleButton(), 100);
      return;
    }

    this.initializeGoogleSignIn();

    const buttonElement = this.googleButton.nativeElement;
    
    // Clear previous renders
    buttonElement.innerHTML = '';
    
    try {
      window.google.accounts.id.renderButton(buttonElement, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 280
      });
    } catch (error) {
      console.error('Error rendering Google button:', error);
      this.errorMessage.set('Failed to render Google Sign-In button');
    }
  }

  private handleGoogleCallback(response: GoogleCredentialResponse) {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.loginStart.emit();

    this.apiService.loginWithGoogle(response.credential).subscribe({
      next: (result) => {
        console.log('Google login result:', result);
        this.isLoading.set(false);
        // Handle both response formats: direct data or wrapped in data property
        const loginData = (result as any).data || result;
        
        if (loginData && loginData.user && loginData.token) {
          console.log('Emitting loginSuccess with:', loginData);
          this.loginSuccess.emit({
            user: loginData.user,
            token: loginData.token,
            isNewUser: loginData.isNewUser || false
          });
        } else {
          console.warn('Invalid login response:', result);
          this.errorMessage.set('Invalid login response from server');
          this.loginError.emit('Invalid login response');
        }
      },
      error: (err) => {
        console.error('HTTP error from google login:', err);
        this.isLoading.set(false);
        const message = err.error?.error || 'Google sign-in failed';
        this.errorMessage.set(message);
        this.loginError.emit(message);
      }
    });
  }
}
