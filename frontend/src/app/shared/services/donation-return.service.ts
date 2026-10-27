import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter, take } from 'rxjs';
import { ApiService } from './api.service';
import { ActionsStore } from '../../article-workbench/actions/actions.store';

/**
 * Card payments finish inside the donation dialog. Redirect-based payment methods instead send the donor
 * back to the Checkout Session's return_url (?donation=success&session_id=...); this finishes those.
 */
@Injectable({ providedIn: 'root' })
export class DonationReturnService {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly store = inject(ActionsStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  init(): void {
    if (!this.isBrowser) return;
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), take(1))
      .subscribe(() => this.handleReturn());
  }

  private handleReturn(): void {
    const tree = this.router.parseUrl(this.router.url);
    const { donation, session_id: sessionId, ...rest } = tree.queryParams;
    if (donation !== 'success' || typeof sessionId !== 'string') return;

    // Drop the params first so a reload cannot count the same payment twice
    tree.queryParams = rest;
    this.router.navigateByUrl(tree, { replaceUrl: true });

    this.api.confirmDonation(sessionId).subscribe({
      next: (res) => {
        const taskId = Number(res.targetId);
        if (res.paid && res.actionKey === 'direct' && Number.isFinite(taskId)) {
          void this.store.reload(res.challengeId);
        }
        this.snackBar.open(
          res.paid ? 'Thank you for your support! ❤️' : 'Thank you! Your payment is being processed.',
          'Close',
          { duration: 8000 }
        );
      },
      error: () => this.snackBar.open('We could not check your payment yet. It will be recorded once Stripe confirms it.', 'Close', { duration: 8000 })
    });
  }
}
