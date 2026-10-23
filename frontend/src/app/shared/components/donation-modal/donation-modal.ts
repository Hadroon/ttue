import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { ApiService } from '../../services/api.service';

const STRIPE_JS_URL = 'https://js.stripe.com/dahlia/stripe.js';

const APPEARANCE = {
  theme: 'stripe',
  labels: 'auto',
  inputs: 'spaced',
  variables: {
    borderRadius: '4px',
    colorBackground: '#ffffff',
    colorDanger: '#df1b41',
    colorPrimary: '#0570de',
    colorSuccess: '#00c853',
    colorText: '#30313d',
    fontFamily: 'default',
    fontSizeBase: '16px',
    spacingUnit: '4px'
  }
};

// Stripe.js must be loaded from Stripe's servers (PCI), never bundled
function loadStripeJs(): Promise<void> {
  if ((window as any).Stripe) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${STRIPE_JS_URL}"]`);
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Failed to load Stripe.js')));
    if (!existing) {
      script.src = STRIPE_JS_URL;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

@Component({
  selector: 'app-donation-modal',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './donation-modal.html',
  styleUrl: './donation-modal.css'
})
export class DonationModalComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly dialogRef = inject(MatDialogRef<DonationModalComponent>);

  readonly step = signal<'loading' | 'amount' | 'paying' | 'done' | 'unavailable'>('loading');
  readonly busy = signal(false);
  readonly error = signal('');

  amount: number | null = 10;
  currency = 'usd';
  minAmount = 100;
  maxAmount = 100000;
  private publishableKey = '';
  private form: any;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.form?.destroy?.());
  }

  ngOnInit() {
    this.api.getDonationConfig().subscribe({
      next: (cfg) => {
        if (!cfg.enabled || !cfg.publishableKey) {
          this.step.set('unavailable');
          return;
        }
        this.publishableKey = cfg.publishableKey;
        this.currency = cfg.currency;
        this.minAmount = cfg.minAmount;
        this.maxAmount = cfg.maxAmount;
        this.step.set('amount');
      },
      error: () => this.step.set('unavailable')
    });
  }

  get minMajor() {
    return this.minAmount / 100;
  }

  get maxMajor() {
    return this.maxAmount / 100;
  }

  get currencyLabel() {
    return this.currency.toUpperCase();
  }

  async continue() {
    const cents = Math.round((this.amount ?? 0) * 100);
    if (!Number.isFinite(cents) || cents < this.minAmount || cents > this.maxAmount) {
      this.error.set(`Please enter an amount between ${this.minMajor} and ${this.maxMajor} ${this.currencyLabel}.`);
      return;
    }
    this.error.set('');
    this.busy.set(true);

    try {
      await loadStripeJs();
      const stripe = (window as any).Stripe(this.publishableKey);
      const clientSecret = firstValueFrom(this.api.createDonationSession(cents)).then((res) => res.client_secret);

      const checkout = stripe.initCheckoutFormSdk({ clientSecret, appearance: APPEARANCE });
      this.step.set('paying');
      // Let the container render before mounting
      await new Promise((r) => setTimeout(r));

      this.form = checkout.createForm({ layout: 'expanded' });
      this.form.mount('#checkout-form');

      const loaded = await checkout.loadActions();
      if (loaded.type === 'success') {
        this.form.on('confirm', async (event: unknown) => {
          try {
            await loaded.actions.confirm({ formConfirmEvent: event });
            this.step.set('done');
          } catch (err) {
            console.error('Payment confirmation error:', err);
            this.error.set('The payment could not be confirmed. Please try again.');
          }
        });
      }
    } catch (err) {
      console.error('Donation checkout error:', err);
      this.form?.destroy?.();
      this.form = null;
      this.error.set('Could not start the payment. Please try again later.');
      this.step.set('amount');
    } finally {
      this.busy.set(false);
    }
  }

  close() {
    this.dialogRef.close();
  }
}
