import { Component, inject, input, model, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService, ChallengeLink } from '../../shared/services/api.service';
import { AuthGuardService } from '../../shared/services/auth-guard.service';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-challenge-links',
  imports: [FormsModule, DatePipe],
  styles: [`
    :host { display: grid; gap: 20px; }
    h2 { margin: 0; }
    .lead { margin: 4px 0 0; color: var(--muted); font-size: 14px; line-height: 1.5; }
    .head { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; justify-content: space-between; }
    form { display: grid; gap: 10px; padding: 16px 18px; border: 1px solid var(--border); border-radius: 14px; background: var(--card); }
    label { display: grid; gap: 4px; font-size: 13px; font-weight: 600; }
    input, textarea { font: inherit; font-weight: 400; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); }
    input:focus, textarea:focus { outline: 2px solid var(--brand); outline-offset: 0; }
    textarea { resize: vertical; min-height: 60px; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; }
    .list { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
    .item { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; padding: 14px 18px; border: 1px solid var(--border); border-radius: 14px; background: var(--card); }
    .body { display: grid; gap: 4px; min-width: 0; }
    .title { font-weight: 700; color: var(--brand); overflow-wrap: anywhere; }
    .host, .meta { font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
    .desc { margin: 0; font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }
    .btn { font: inherit; font-size: 13px; font-weight: 600; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--border); background: var(--card); color: var(--text); cursor: pointer; white-space: nowrap; }
    .btn:hover:not(:disabled) { border-color: var(--brand); }
    .btn:disabled { opacity: .55; cursor: wait; }
    .btn.primary { background: var(--brand-600); border-color: var(--brand-600); color: #fff; }
    .btn.quiet { border-color: transparent; background: transparent; color: var(--muted); text-decoration: underline; padding: 2px 6px; font-weight: 500; }
    .state { padding: 14px; border: 1px dashed var(--border); border-radius: 10px; color: var(--muted); font-size: 14px; text-align: center; }
    .state.error { color: #ef4444; border-color: #ef4444; }
  `],
  template: `
    <header class="head">
      <div>
        <h2>Links</h2>
        <p class="lead">Sources, articles and other resources that are relevant to this challenge.</p>
      </div>
      @if (!formOpen()) {
        <button type="button" class="btn primary" (click)="openForm()">Add link</button>
      }
    </header>

    @if (formOpen()) {
      <form (ngSubmit)="submit()" aria-label="Add a link">
        <label>
          Link
          <input type="text" inputmode="url" autocapitalize="off" spellcheck="false" name="url" required maxlength="200" placeholder="example.org/article" [(ngModel)]="url" />
        </label>
        <label>
          Title (optional)
          <input type="text" name="title" maxlength="200" placeholder="What is this link about?" [(ngModel)]="title" />
        </label>
        <label>
          Description (optional)
          <textarea name="description" maxlength="500" [(ngModel)]="description"></textarea>
        </label>
        <div class="row">
          <button type="submit" class="btn primary" [disabled]="saving() || !url.trim()">{{ saving() ? 'Adding…' : 'Add link' }}</button>
          <button type="button" class="btn" (click)="closeForm()" [disabled]="saving()">Cancel</button>
        </div>
      </form>
    }

    @if (error()) {
      <div class="state error" role="alert">{{ error() }}</div>
    }

    @if (loading()) {
      <div class="state" role="status">Loading links…</div>
    } @else if (loadError()) {
      <div class="state error" role="alert">{{ loadError() }}</div>
    } @else if (links().length === 0) {
      <div class="state">No links yet. Be the first to add one.</div>
    } @else {
      <ul class="list" aria-label="Links">
        @for (link of links(); track link.id) {
          <li class="item">
            <div class="body">
              <a class="title" [href]="link.url" target="_blank" rel="noopener noreferrer nofollow ugc">{{ link.title }}</a>
              <span class="host">{{ hostOf(link.url) }}</span>
              @if (link.description) { <p class="desc">{{ link.description }}</p> }
              <span class="meta">Added by {{ link.authorDisplayName || link.authorUsername }} · {{ link.createdAt | date: 'mediumDate' }}</span>
            </div>
            @if (canRemove(link)) {
              <button type="button" class="btn quiet" [disabled]="removingId() === link.id" (click)="remove(link)"
                      [attr.aria-label]="'Remove link ' + link.title">Remove</button>
            }
          </li>
        }
      </ul>
    }
  `
})
export class ChallengeLinks {
  readonly challengeId = input<number | null>(null);
  readonly links = model<ChallengeLink[]>([]);
  readonly loading = input(false);
  readonly loadError = input<string | null>(null);

  private readonly api = inject(ApiService);
  private readonly guard = inject(AuthGuardService);
  private readonly auth = inject(AuthService);

  readonly formOpen = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly removingId = signal<number | null>(null);

  url = '';
  title = '';
  description = '';

  openForm(): void {
    if (!this.guard.requireAuth('add a link')) return;
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.error.set(null);
    this.url = this.title = this.description = '';
  }

  hostOf(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  canRemove(link: ChallengeLink): boolean {
    const user = this.auth.currentUser();
    return !!user && (user.isAdmin === true || user.id === link.userId);
  }

  submit(): void {
    const id = this.challengeId();
    if (id === null || this.saving() || !this.guard.requireAuth('add a link')) return;

    this.saving.set(true);
    this.error.set(null);
    this.api.addChallengeLink(id, {
      url: this.url.trim(),
      title: this.title.trim(),
      description: this.description.trim()
    }).subscribe({
      next: link => {
        this.links.update(list => [link, ...list]);
        this.saving.set(false);
        this.closeForm();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.error ?? 'Could not add the link.');
        this.saving.set(false);
      }
    });
  }

  remove(link: ChallengeLink): void {
    const id = this.challengeId();
    if (id === null) return;

    this.removingId.set(link.id);
    this.error.set(null);
    this.api.deleteChallengeLink(id, link.id).subscribe({
      next: () => {
        this.links.update(list => list.filter(l => l.id !== link.id));
        this.removingId.set(null);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.error ?? 'Could not remove the link.');
        this.removingId.set(null);
      }
    });
  }
}
