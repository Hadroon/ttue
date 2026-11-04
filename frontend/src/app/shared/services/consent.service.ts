import { Injectable, PLATFORM_ID, afterNextRender, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface ConsentState {
  analytics: boolean;
  timestamp: string;
}

const CONSENT_KEY = 'cookie_consent';

@Injectable({ providedIn: 'root' })
export class ConsentService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly consent = signal<ConsentState | null>(this.load());
  readonly bannerVisible = signal<boolean>(false);

  constructor() {
    // Show only after hydration so SSR and client markup match.
    afterNextRender(() => this.bannerVisible.set(this.consent() === null));
  }

  /** True only if the user explicitly opted in to analytics. */
  hasAnalyticsConsent(): boolean {
    return this.consent()?.analytics === true;
  }

  acceptAll(): void {
    this.save(true);
  }

  rejectOptional(): void {
    this.save(false);
  }

  /** Re-open the banner so the user can change their choice. */
  reopen(): void {
    this.bannerVisible.set(true);
  }

  private save(analytics: boolean): void {
    const state: ConsentState = { analytics, timestamp: new Date().toISOString() };
    this.consent.set(state);
    this.bannerVisible.set(false);
    if (this.isBrowser) {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
    }
  }

  private load(): ConsentState | null {
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem(CONSENT_KEY);
      return raw ? (JSON.parse(raw) as ConsentState) : null;
    } catch {
      return null;
    }
  }
}
