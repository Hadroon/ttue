import { Component, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { AuthGuardService } from '../../shared/services/auth-guard.service';
import { DonationModalComponent, DonationModalData, DonationModalResult } from '../../shared/components/donation-modal/donation-modal';
import { ActionsStore, CivicTask, TaskStatus, VOICE_CREDITS } from './actions.store';
import { DonationOption, donationOptions } from './donation-options';

const QUICK_AMOUNTS = [10, 50, 100];

const SKILLS = ['Electrician', 'Software Engineer', 'Heavy Equipment Operator', 'Legal Advisor', 'Builder', 'Environmental Scientist', 'Organiser'];
const COLUMNS: TaskStatus[] = ['Open', 'Funded', 'In Progress', 'Verification', 'Completed'];

function safeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

@Component({
  selector: 'app-direct-action',
  imports: [DecimalPipe],
  styleUrl: './actions-shared.css',
  styles: [`
    .board { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(250px, 1fr); gap: 12px; overflow-x: auto; padding-bottom: 6px; }
    .column { display: grid; gap: 10px; align-content: start; padding: 10px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg); }
    .column h5 { margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
    .column .item { background: var(--card); }
    .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
    .gallery img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); }
    .ba { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .ba figcaption { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
    .ba figure { margin: 0; display: grid; gap: 4px; }
    .alloc { display: flex; align-items: center; gap: 10px; }
    .alloc output { min-width: 2ch; text-align: center; font-weight: 700; }
  `],
  template: `
    <section class="feature" aria-labelledby="da-propose">
      <header>
        <h4 id="da-propose">Propose a task</h4>
        <p class="muted">Break a local fix into a task people can fund and pick up, for example a mesh network, a water filter or a pocket park.</p>
      </header>
      <form class="form-grid" (submit)="addTask($event)">
        <label class="field wide">Task title <input name="title" required maxlength="200"></label>
        <fieldset class="wide" style="border:none;padding:0;margin:0">
          <legend class="muted" style="margin-bottom:6px;font-weight:600">Skills required</legend>
          <div class="tags">
            @for (s of skills; track s) { <label class="check"><input type="checkbox" name="skills" [value]="s"> {{ s }}</label> }
          </div>
        </fieldset>
        <label class="field">Estimated materials cost <input name="cost" type="number" min="0" step="1" required></label>
        <label class="field">Location <input name="location" maxlength="200" placeholder="Place or coordinates"></label>
        <label class="field wide">Milestones (one per line) <textarea name="milestones" rows="3" required></textarea></label>
        <div class="btn-row wide"><button class="abtn primary" type="submit">Add task</button></div>
      </form>
    </section>

    <section class="feature" aria-labelledby="da-board">
      <header>
        <h4 id="da-board">Civic bounty board</h4>
        <p class="muted">Funding a task is a real donation through Stripe, earmarked for that task. A new task is reviewed by an admin first, and funding opens once it is approved. Paying it out to the people doing the work, and the auditor review that releases it, are not automated yet.</p>
      </header>
      <div class="tags" role="group" aria-label="Filter by skill">
        <span class="muted" style="align-self:center">Skill matcher:</span>
        @for (s of skills; track s) {
          <button type="button" class="abtn sm" [class.primary]="filter().has(s)" [attr.aria-pressed]="filter().has(s)" (click)="toggleFilter(s)">{{ s }}</button>
        }
        @if (filter().size > 0) { <button type="button" class="abtn sm quiet" (click)="filter.set(emptySet())">Clear</button> }
      </div>
      @if (tasks().length === 0) {
        <div class="empty">No tasks yet. Propose the first one above.</div>
      } @else {
        <div class="board">
          @for (col of columns; track col) {
            <div class="column" role="group" [attr.aria-label]="col">
              <h5>{{ col }} ({{ inColumn(col).length }})</h5>
              @for (t of inColumn(col); track t.id) {
                <div class="item">
                  <span class="item-title">{{ t.title }}</span>
                  @if (t.approval === 'Pending') { <span class="tag warn">Under approval</span> }
                  @if (t.location) { <span class="muted">📍 {{ t.location }}</span> }
                  <div class="tags">@for (s of t.skills; track s) { <span class="tag">{{ s }}</span> }</div>
                  <div class="progress" role="progressbar" [attr.aria-valuenow]="pct(t)" aria-valuemin="0" aria-valuemax="100"><span [style.width.%]="pct(t)"></span></div>
                  <span class="muted">{{ t.funded | number }} of {{ t.cost | number }} funded</span>

                  @if (t.status === 'Open' || t.status === 'Funded') {
                    <div class="btn-row">
                      @for (option of options(t); track option.amount) {
                        <button class="abtn sm" type="button" [disabled]="t.approval !== 'Approved'"
                                [attr.title]="t.approval === 'Approved' ? null : 'Funding opens once an admin approves this task'"
                                (click)="fund(t, option.amount)">{{ option.rest ? 'Fund the rest: ' + option.amount : '+ ' + option.amount }}</button>
                      } @empty {
                        <span class="muted">Fully funded.</span>
                      }
                    </div>
                    @if (t.approval === 'Pending') {
                      <span class="muted">Funding is disabled until an admin approves this task.</span>
                    }
                  }
                  @if (t.status === 'Funded' || (t.status === 'In Progress' && !t.applied)) {
                    <details>
                      <summary>Apply / start work ({{ t.applicationCount }} {{ t.applicationCount === 1 ? 'application' : 'applications' }})</summary>
                      <form class="form-grid" style="margin-top:8px" (submit)="apply($event, t)">
                        <label class="field wide">Cover note <textarea name="note" rows="2" required maxlength="1000"></textarea></label>
                        <label class="field">Availability <input name="availability" required maxlength="200" placeholder="e.g. weekends from May"></label>
                        <label class="field">Tools and hardware I have <input name="tools" maxlength="200"></label>
                        <div class="btn-row wide"><button class="abtn primary sm" type="submit">Apply and start</button></div>
                      </form>
                    </details>
                  }
                  @if (t.status === 'In Progress' && (t.applied || canRemove(t.ownerId))) {
                    <details>
                      <summary>Submit completion</summary>
                      <form class="form-grid" style="margin-top:8px" (submit)="complete($event, t)">
                        <label class="field wide">"Before" image link <input name="before" type="url" required maxlength="500"></label>
                        <label class="field wide">"After" image link <input name="after" type="url" required maxlength="500"></label>
                        <label class="field wide">What was done <textarea name="note" rows="2" required maxlength="1000"></textarea></label>
                        <fieldset class="wide" style="border:none;padding:0;margin:0">
                          <legend class="muted" style="font-weight:600">Milestones completed</legend>
                          @for (m of t.milestones; track m) { <label class="check"><input type="checkbox" name="milestone"> {{ m }}</label> }
                        </fieldset>
                        <label class="field wide">Expenditure receipts <input name="receipts" type="file" multiple></label>
                        <div class="btn-row wide"><button class="abtn primary sm" type="submit">Send for verification</button></div>
                      </form>
                    </details>
                  }
                  @if (t.status === 'Verification') {
                    <span class="notice">Waiting for independent auditors. This step is not available until the backend can pick auditors and release funds.</span>
                  }
                  @if (canRemove(t.ownerId)) { <button class="abtn sm quiet" type="button" (click)="removeTask(t)">Remove</button> }
                </div>
              }
            </div>
          }
        </div>
      }
    </section>

    <section class="feature" aria-labelledby="da-gallery">
      <header>
        <h4 id="da-gallery">Proof of completion</h4>
        <p class="muted">Before and after evidence from finished work, for the community to check.</p>
      </header>
      @if (proofs().length === 0) {
        <div class="empty">Nothing submitted yet.</div>
      } @else {
        <div class="gallery">
          @for (t of proofs(); track t.id) {
            <article class="item">
              <span class="item-title">{{ t.title }}</span>
              <div class="ba">
                @if (safe(t.proof!.beforeUrl); as before) { <figure><img [src]="before" alt="Before: {{ t.title }}" referrerpolicy="no-referrer" loading="lazy"><figcaption>Before</figcaption></figure> }
                @if (safe(t.proof!.afterUrl); as after) { <figure><img [src]="after" alt="After: {{ t.title }}" referrerpolicy="no-referrer" loading="lazy"><figcaption>After</figcaption></figure> }
              </div>
              <span class="muted">{{ t.proof!.note }}</span>
              <span class="muted">{{ t.proof!.milestonesDone }} of {{ t.milestones.length }} milestones · {{ t.proof!.receipts }} receipts attached · <strong>{{ t.status }}</strong></span>
            </article>
          }
        </div>
      }
    </section>

    <section class="feature" aria-labelledby="da-budget">
      <header>
        <h4 id="da-budget">Participatory budgeting</h4>
        <p class="muted">You have {{ credits }} voice credits. Each extra vote on the same project costs more (votes squared), so spreading support is cheaper than piling it on one project. Your allocation is saved to your account; it isn't counted towards any decision yet.</p>
      </header>
      <div class="stats">
        <div class="stat-box"><strong>{{ creditsLeft() }}</strong><span>credits left</span></div>
        <div class="stat-box"><strong>{{ creditsUsed() }}</strong><span>credits used</span></div>
      </div>
      @if (votable().length === 0) {
        <div class="empty">Open or funded tasks will appear here.</div>
      } @else {
        <ul class="list">
          @for (t of votable(); track t.id) {
            <li class="item">
              <div class="item-head">
                <span class="item-title">{{ t.title }}</span>
                <div class="alloc">
                  <button class="abtn sm" type="button" [attr.aria-label]="'Remove a vote from ' + t.title" [disabled]="votes(t) === 0" (click)="vote(t, -1)">−</button>
                  <output [attr.aria-label]="'Votes for ' + t.title">{{ votes(t) }}</output>
                  <button class="abtn sm" type="button" [attr.aria-label]="'Add a vote to ' + t.title" [disabled]="!canAdd(t)" (click)="vote(t, 1)">+</button>
                </div>
              </div>
              <span class="muted">Costs {{ votes(t) * votes(t) }} credits. The next vote costs {{ 2 * votes(t) + 1 }}.</span>
            </li>
          }
        </ul>
      }
    </section>
  `
})
export class DirectAction {
  readonly challengeId = input<number | null>(null);

  private readonly store = inject(ActionsStore);
  private readonly guard = inject(AuthGuardService);
  private readonly dialog = inject(MatDialog);

  readonly skills = SKILLS;
  readonly columns = COLUMNS;
  readonly credits = VOICE_CREDITS;
  readonly filter = signal<Set<string>>(new Set());

  readonly tasks = computed(() => this.store.data().tasks);
  readonly proofs = computed(() => this.tasks().filter(t => t.proof !== null));
  readonly votable = computed(() => this.tasks().filter(t => t.approval === 'Approved' && (t.status === 'Open' || t.status === 'Funded')));
  readonly creditsUsed = computed(() => {
    const allocation = this.store.data().allocation;
    return this.tasks().reduce((sum, t) => sum + (allocation[t.id] ?? 0) ** 2, 0);
  });
  readonly creditsLeft = computed(() => VOICE_CREDITS - this.creditsUsed());

  emptySet(): Set<string> { return new Set(); }

  toggleFilter(skill: string): void {
    const next = new Set(this.filter());
    if (!next.delete(skill)) next.add(skill);
    this.filter.set(next);
  }

  inColumn(status: TaskStatus): CivicTask[] {
    const wanted = this.filter();
    return this.tasks().filter(t =>
      t.status === status && (wanted.size === 0 || t.skills.some(s => wanted.has(s))));
  }

  pct(t: CivicTask): number {
    return t.cost > 0 ? Math.min(100, Math.round((t.funded / t.cost) * 100)) : 100;
  }

  options(t: CivicTask): DonationOption[] {
    return donationOptions(t.cost - t.funded, QUICK_AMOUNTS);
  }

  safe(url: string): string | null { return safeUrl(url); }

  votes(t: CivicTask): number { return this.store.data().allocation[t.id] ?? 0; }

  canAdd(t: CivicTask): boolean {
    const v = this.votes(t);
    return (v + 1) ** 2 - v ** 2 <= this.creditsLeft();
  }

  async vote(t: CivicTask, delta: 1 | -1): Promise<void> {
    if (delta === 1 && !this.canAdd(t)) return;
    if (!this.guard.requireAuth('allocate your budget votes')) return;
    const current = this.store.data().allocation;
    // Only send votes for tasks that still exist
    const votes: Record<string, number> = {};
    for (const task of this.tasks()) votes[task.id] = current[task.id] ?? 0;
    votes[t.id] = Math.max(0, votes[t.id] + delta);
    await this.store.create('allocation', { votes });
  }

  canRemove(ownerId: number | null): boolean {
    return this.store.canRemove(ownerId);
  }

  private fields(event: Event): { form: HTMLFormElement; data: FormData } {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    return { form, data: new FormData(form) };
  }

  async addTask(event: Event): Promise<void> {
    const { form, data } = this.fields(event);
    if (!this.guard.requireAuth('propose a task')) return;
    const ok = await this.store.create('task', {
      title: String(data.get('title')).trim(),
      skills: data.getAll('skills').map(String),
      cost: Math.max(0, Math.round(Number(data.get('cost')) || 0)),
      milestones: String(data.get('milestones')).split('\n').map(s => s.trim()).filter(Boolean),
      location: String(data.get('location') ?? '').trim()
    });
    if (ok) form.reset();
  }

  async removeTask(t: CivicTask): Promise<void> {
    await this.store.remove(t.id);
  }

  fund(t: CivicTask, amount: number): void {
    if (t.approval !== 'Approved') return;
    if (!this.guard.requireAuth('fund this task')) return;
    const challengeId = this.challengeId();
    const data: DonationModalData = {
      amount,
      label: t.location ? `${t.title} (${t.location})` : t.title,
      context: challengeId === null ? undefined : {
        challengeId,
        actionKey: 'direct',
        targetId: String(t.id),
        targetTitle: t.title,
        targetLocation: t.location || undefined
      }
    };
    this.dialog
      .open<DonationModalComponent, DonationModalData, DonationModalResult>(DonationModalComponent, { data, width: '520px', maxWidth: '90vw' })
      .afterClosed()
      .subscribe(result => {
        if (result?.paid) void this.store.reload(challengeId);
      });
  }

  async apply(event: Event, t: CivicTask): Promise<void> {
    const { data } = this.fields(event);
    if (!this.guard.requireAuth('apply for this task')) return;
    await this.store.create('application', {
      note: String(data.get('note')).trim(),
      availability: String(data.get('availability')).trim(),
      tools: String(data.get('tools') ?? '').trim()
    }, t.id);
  }

  async complete(event: Event, t: CivicTask): Promise<void> {
    const { data } = this.fields(event);
    const before = safeUrl(String(data.get('before')));
    const after = safeUrl(String(data.get('after')));
    if (!before || !after) return;
    if (!this.guard.requireAuth('submit completion proof')) return;
    const receipts = data.getAll('receipts').filter(f => f instanceof File && f.size > 0).length;
    await this.store.create('proof', {
      beforeUrl: before,
      afterUrl: after,
      note: String(data.get('note')).trim(),
      milestonesDone: data.getAll('milestone').length,
      receipts
    }, t.id);
  }
}
