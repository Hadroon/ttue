import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { ApiService, ChallengeActionKey, ChallengeActionState } from '../../shared/services/api.service';
import { AuthGuardService } from '../../shared/services/auth-guard.service';
import { AuthService } from '../../shared/services/auth.service';
import { ActionsStore } from './actions.store';
import { LegalAction } from './legal-action';
import { EconomicPressure } from './economic-pressure';
import { DirectAction } from './direct-action';
import { PolicyLobbying } from './policy-lobbying';
import { InfoCampaigns } from './info-campaigns';

interface ActionInfo {
  key: ChallengeActionKey;
  icon: string;
  title: string;
  summary: string;
  includes: string[];
}

const ACTIONS: ActionInfo[] = [
  { key: 'legal', icon: '⚖️', title: 'Legal Action & Strategic Litigation',
    summary: 'When institutions ignore community demands, legal frameworks often force them to comply.',
    includes: ['Case files and filings', 'Evidence vault with hashing', 'Pro-bono lawyer verification', 'Retainer crowdfunding'] },
  { key: 'economic', icon: '🛒', title: 'Economic & Market Pressure',
    summary: 'Boycotts, buycotts and divestment: organised economic leverage forces a faster response.',
    includes: ['Targets and sub-brand mapping', 'Ethical alternatives', 'Pledge tracker', 'Divestment letters'] },
  { key: 'direct', icon: '🛠️', title: 'Direct Action & Alternative Infrastructure',
    summary: 'Instead of asking permission to fix a problem, build parallel, self-governing solutions.',
    includes: ['Civic bounty board', 'Skill matcher', 'Proof-of-completion gallery', 'Participatory budgeting'] },
  { key: 'policy', icon: '📜', title: 'Policy Injection & Direct Lobbying',
    summary: 'Draft the text, then put it in front of the people who decide.',
    includes: ['Legislative studio with diffs', 'Representative outreach', 'Campaign tracker'] },
  { key: 'info', icon: '📣', title: 'Information Warfare & Shareholder Activism',
    summary: 'Share open campaign material and coordinate small shareholders.',
    includes: ['Media and meme library', 'Shareholder resolutions', 'Whistleblower vault (not available yet)'] }
];

@Component({
  selector: 'app-actions',
  imports: [NgTemplateOutlet, LegalAction, EconomicPressure, DirectAction, PolicyLobbying, InfoCampaigns],
  styles: [`
    :host { display: grid; gap: 20px; }
    h2, h3 { margin: 0; }
    .lead { margin: 4px 0 0; color: var(--muted); font-size: 14px; line-height: 1.5; }
    .banner { margin: 12px 0 0; padding: 10px 14px; border: 1px solid var(--border); border-left: 3px solid var(--brand); border-radius: 8px; background: var(--bg); color: var(--muted); font-size: 13px; }
    .cards { display: grid; gap: 12px; }
    .card { display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: start; padding: 16px 18px; border: 1px solid var(--border); border-radius: 14px; background: var(--card); }
    .card.on { border-color: color-mix(in srgb, var(--accent) 60%, var(--border)); background: color-mix(in srgb, var(--accent) 6%, var(--card)); }
    .icon { width: 40px; height: 40px; display: grid; place-items: center; font-size: 20px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg); }
    .body { display: grid; gap: 6px; min-width: 0; }
    .title-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .title-row h3 { font-size: 16px; }
    .summary { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.5; }
    .includes { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .includes li { padding: 2px 8px; border: 1px solid var(--border); border-radius: 999px; font-size: 12px; color: var(--muted); }
    .tag { padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; border: 1px solid var(--border); }
    .tag.active { background: color-mix(in srgb, var(--accent) 22%, var(--card)); }
    .tag.lead-tag { background: color-mix(in srgb, #f59e0b 22%, var(--card)); }
    .side { display: grid; gap: 8px; justify-items: end; }
    .count { font-size: 12px; color: var(--muted); }
    .count strong { font-size: 20px; color: var(--text); letter-spacing: -.02em; margin-right: 4px; }
    .btn { font: inherit; font-size: 13px; font-weight: 600; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--border); background: var(--card); color: var(--text); cursor: pointer; white-space: nowrap; }
    .btn:hover:not(:disabled) { border-color: var(--brand); }
    .btn:disabled { opacity: .55; cursor: wait; }
    .btn.primary { background: var(--brand-600); border-color: var(--brand-600); color: #fff; }
    .btn.quiet { border-color: transparent; background: transparent; color: var(--muted); text-decoration: underline; padding: 2px 6px; font-weight: 500; }
    .state { padding: 14px; border: 1px dashed var(--border); border-radius: 10px; color: var(--muted); font-size: 14px; text-align: center; }
    .state.error { color: #ef4444; border-color: #ef4444; }
    .tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
    .tab { flex: 0 0 auto; padding: 8px 14px; border: 1px solid var(--border); border-radius: 999px; background: var(--card); color: var(--text); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
    .tab[aria-selected="true"] { border-color: var(--brand); background: color-mix(in srgb, var(--brand) 9%, var(--card)); }
    .panel { display: grid; gap: 16px; }
    .preview { display: grid; gap: 12px; padding: 16px; border: 1px dashed var(--border); border-radius: 14px; }
    .preview-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
    .preview-frame { display: grid; gap: 16px; opacity: .6; user-select: none; pointer-events: none; }
    h4 { margin: 0; font-size: 18px; }
    @media (max-width: 640px) {
      .card { grid-template-columns: auto 1fr; }
      .side { grid-column: 1 / -1; grid-auto-flow: column; justify-content: space-between; justify-items: start; align-items: center; }
    }
  `],
  template: `
    <header>
      <h2>Actions</h2>
      <p class="lead">
        Anyone can recommend which actions this challenge should use, and preview what each one looks like.
        The tools can only be used once an admin approves the action.
      </p>
    </header>

    @if (loading()) {
      <div class="state" role="status">Loading actions…</div>
    } @else {
      @if (error()) {
        <div class="state error" role="alert">
          {{ error() }} <button class="btn quiet" type="button" (click)="reload()">Try again</button>
        </div>
      }
      <ul class="cards" style="list-style:none;margin:0;padding:0" aria-label="Recommend actions">
        @for (info of infos; track info.key) {
          @let s = stateOf(info.key);
          <li class="card" [class.on]="s.activated">
            <span class="icon" aria-hidden="true">{{ info.icon }}</span>
            <div class="body">
              <div class="title-row">
                <h3>{{ info.title }}</h3>
                @if (s.activated) { <span class="tag active">Active</span> }
                @else if (info.key === leader()) { <span class="tag lead-tag">Most recommended</span> }
              </div>
              <p class="summary">{{ info.summary }}</p>
              <ul class="includes" aria-label="What it includes">
                @for (item of info.includes; track item) { <li>{{ item }}</li> }
              </ul>
            </div>
            <div class="side">
              <span class="count"><strong>{{ s.votes }}</strong>{{ s.votes === 1 ? 'recommendation' : 'recommendations' }}</span>
              <button class="btn" [class.primary]="s.voted" type="button" [attr.aria-pressed]="s.voted"
                      [disabled]="busy() === info.key" (click)="recommend(info.key)">
                {{ s.voted ? '✓ Recommended' : 'Recommend' }}
              </button>
              @if (!s.activated) {
                <button class="btn quiet" type="button" [attr.aria-expanded]="preview() === info.key"
                        (click)="togglePreview(info.key)">
                  {{ preview() === info.key ? 'Hide preview' : 'Preview' }}
                </button>
              }
            </div>
          </li>
        }
      </ul>

      @if (previewInfo(); as p) {
        <section class="preview" [attr.aria-label]="'Preview of ' + p.title">
          <div class="preview-head">
            <h3>{{ p.icon }} {{ p.title }}</h3>
            <button class="btn quiet" type="button" (click)="preview.set(null)">Close preview</button>
          </div>
          <p class="banner" role="note">
            Preview only. This action is not approved yet, so the tools below are read-only.
            Recommend it above to help get it approved.
          </p>
          <div class="preview-frame" inert aria-hidden="true">
            <ng-container *ngTemplateOutlet="tools; context: { $implicit: p.key }" />
          </div>
        </section>
      }

      @if (activeInfos().length === 0) {
        <div class="state">No action is active yet. Voting is open, so recommend the ones you want to see.</div>
      } @else {
        <section aria-label="Active actions">
          <h3>Active actions</h3>
          <p class="banner" role="note">
            The tools below are an early version: what you add is saved in this browser only, and escrow,
            verification and secure drops are not live yet. Funding a bounty-board task takes a real donation through Stripe.
            Each section says what is and isn't working.
          </p>
          <div class="tabs" role="tablist" aria-label="Active actions" style="margin-top:12px">
            @for (info of activeInfos(); track info.key) {
              <button class="tab" role="tab" type="button" [id]="'act-tab-' + info.key" [attr.aria-selected]="shown() === info.key"
                      [attr.aria-controls]="'act-panel-' + info.key" [tabindex]="shown() === info.key ? 0 : -1"
                      (click)="selected.set(info.key)" (keydown)="onKey($event)">{{ info.icon }} {{ info.title }}</button>
            }
          </div>
          <div class="panel" role="tabpanel" style="margin-top:16px" [id]="'act-panel-' + shown()" [attr.aria-labelledby]="'act-tab-' + shown()">
            <ng-container *ngTemplateOutlet="tools; context: { $implicit: shown() }" />
          </div>
        </section>
      }
    }

    <ng-template #tools let-key>
      @switch (key) {
        @case ('legal') { <app-legal-action /> }
        @case ('economic') { <app-economic-pressure [challengeTitle]="challengeTitle()" /> }
        @case ('direct') { <app-direct-action [challengeId]="challengeId()" /> }
        @case ('policy') { <app-policy-lobbying [challengeTitle]="challengeTitle()" (openDraft)="openDraft.emit()" /> }
        @case ('info') { <app-info-campaigns /> }
      }
    </ng-template>
  `
})
export class Actions {
  readonly challengeId = input<number | null>(null);
  readonly challengeTitle = input('');
  readonly openDraft = output<void>();

  private readonly api = inject(ApiService);
  private readonly guard = inject(AuthGuardService);
  private readonly auth = inject(AuthService);
  private readonly store = inject(ActionsStore);

  readonly infos = ACTIONS;
  readonly states = signal<ChallengeActionState[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal<ChallengeActionKey | null>(null);
  readonly selected = signal<ChallengeActionKey | null>(null);
  readonly preview = signal<ChallengeActionKey | null>(null);

  /** The read-only preview, hidden once that action gets approved */
  readonly previewInfo = computed(() => {
    const key = this.preview();
    if (key === null || this.states().some(s => s.key === key && s.activated)) return null;
    return ACTIONS.find(a => a.key === key) ?? null;
  });

  togglePreview(key: ChallengeActionKey): void {
    this.preview.update(current => current === key ? null : key);
  }

  readonly activeInfos = computed(() =>
    ACTIONS.filter(a => this.states().some(s => s.key === a.key && s.activated)));

  /** The tab that is open: the chosen one if still active, otherwise the first active action */
  readonly shown = computed<ChallengeActionKey>(() => {
    const active = this.activeInfos();
    return active.find(a => a.key === this.selected())?.key ?? active[0]?.key ?? 'legal';
  });

  readonly leader = computed<ChallengeActionKey | null>(() => {
    const open = this.states().filter(s => !s.activated && s.votes > 0);
    if (open.length === 0) return null;
    const top = Math.max(...open.map(s => s.votes));
    const leaders = open.filter(s => s.votes === top);
    return leaders.length === 1 ? leaders[0].key : null;
  });

  constructor() {
    effect(() => {
      const id = this.challengeId();
      untracked(() => {
        this.store.load(id);
        this.reload();
      });
    });
    // Votes are per user, so refetch when someone signs in or out
    effect(() => {
      this.auth.currentUser();
      untracked(() => { if (this.challengeId() !== null) this.reload(); });
    });
  }

  stateOf(key: ChallengeActionKey): ChallengeActionState {
    return this.states().find(s => s.key === key) ?? { key, votes: 0, voted: false, activated: false, activatedAt: null };
  }

  reload(): void {
    const id = this.challengeId();
    if (id === null) return;
    this.api.getChallengeActions(id).subscribe({
      next: ({ actions }) => {
        this.states.set(actions);
        this.error.set(null);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load the actions.');
        this.loading.set(false);
      }
    });
  }

  private apply(updated: ChallengeActionState): void {
    this.states.update(list => list.some(s => s.key === updated.key)
      ? list.map(s => s.key === updated.key ? updated : s)
      : [...list, updated]);
  }

  recommend(key: ChallengeActionKey): void {
    const id = this.challengeId();
    if (id === null || !this.guard.requireAuth('recommend an action')) return;
    this.busy.set(key);
    this.api.voteChallengeAction(id, key).subscribe({
      next: ({ action }) => { this.apply(action); this.error.set(null); this.busy.set(null); },
      error: () => { this.error.set('Could not save your recommendation.'); this.busy.set(null); }
    });
  }

  onKey(event: KeyboardEvent): void {
    const keys = this.activeInfos().map(a => a.key);
    const index = keys.indexOf(this.shown());
    const next = event.key === 'ArrowRight' ? (index + 1) % keys.length
      : event.key === 'ArrowLeft' ? (index + keys.length - 1) % keys.length
      : event.key === 'Home' ? 0
      : event.key === 'End' ? keys.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    this.selected.set(keys[next]);
    (document.getElementById('act-tab-' + keys[next]) as HTMLElement | null)?.focus();
  }
}
