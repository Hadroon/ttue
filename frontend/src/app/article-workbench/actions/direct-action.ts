import { Component, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { AuthGuardService } from '../../shared/services/auth-guard.service';
import { DonationModalComponent, DonationModalData, DonationModalResult } from '../../shared/components/donation-modal/donation-modal';
import { ActionsStore, CivicTask, TaskStatus, VOICE_CREDITS } from './actions.store';

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
        <label class="field wide">Task title <input name="title" required></label>
        <fieldset class="wide" style="border:none;padding:0;margin:0">
          <legend class="muted" style="margin-bottom:6px;font-weight:600">Skills required</legend>
          <div class="tags">
            @for (s of skills; track s) { <label class="check"><input type="checkbox" name="skills" [value]="s"> {{ s }}</label> }
          </div>
        </fieldset>
        <label class="field">Estimated materials cost <input name="cost" type="number" min="0" step="1" required></label>
        <label class="field">Location <input name="location" placeholder="Place or coordinates"></label>
        <label class="field wide">Milestones (one per line) <textarea name="milestones" rows="3" required></textarea></label>
        <div class="btn-row wide"><button class="abtn primary" type="submit">Add task</button></div>
      </form>
    </section>

    <section class="feature" aria-labelledby="da-board">
      <header>
        <h4 id="da-board">Civic bounty board</h4>
        <p class="muted">Funding a task is a real donation through Stripe, earmarked for that task. Paying it out to the people doing the work, and the auditor review that releases it, are not automated yet.</p>
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
                  @if (t.location) { <span class="muted">📍 {{ t.location }}</span> }
                  <div class="tags">@for (s of t.skills; track s) { <span class="tag">{{ s }}</span> }</div>
                  <div class="progress" role="progressbar" [attr.aria-valuenow]="pct(t)" aria-valuemin="0" aria-valuemax="100"><span [style.width.%]="pct(t)"></span></div>
                  <span class="muted">{{ t.funded | number }} of {{ t.cost | number }} funded</span>

                  @if (t.status === 'Open' || t.status === 'Funded') {
                    <div class="btn-row">
                      @for (a of [10, 50, 100]; track a) { <button class="abtn sm" type="button" (click)="fund(t, a)">+ {{ a }}</button> }
                    </div>
                  }
                  @if (t.status === 'Funded') {
                    <details>
                      <summary>Apply / start work ({{ t.applications.length }} applications)</summary>
                      <form class="form-grid" style="margin-top:8px" (submit)="apply($event, t)">
                        <label class="field wide">Cover note <textarea name="note" rows="2" required></textarea></label>
                        <label class="field">Availability <input name="availability" required placeholder="e.g. weekends from May"></label>
                        <label class="field">Tools and hardware I have <input name="tools"></label>
                        <div class="btn-row wide"><button class="abtn primary sm" type="submit">Apply and start</button></div>
                      </form>
                    </details>
                  }
                  @if (t.status === 'In Progress') {
                    <details>
                      <summary>Submit completion</summary>
                      <form class="form-grid" style="margin-top:8px" (submit)="complete($event, t)">
                        <label class="field wide">"Before" image link <input name="before" type="url" required></label>
                        <label class="field wide">"After" image link <input name="after" type="url" required></label>
                        <label class="field wide">What was done <textarea name="note" rows="2" required></textarea></label>
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
                  <button class="abtn sm quiet" type="button" (click)="removeTask(t)">Remove</button>
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
        <p class="muted">You have {{ credits }} voice credits. Each extra vote on the same project costs more (votes squared), so spreading support is cheaper than piling it on one project. Your allocation is saved on this device and not yet counted anywhere.</p>
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
  readonly votable = computed(() => this.tasks().filter(t => t.status === 'Open' || t.status === 'Funded'));
  readonly creditsUsed = computed(() =>
    Object.values(this.store.data().allocation).reduce((sum, v) => sum + v * v, 0));
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

  safe(url: string): string | null { return safeUrl(url); }

  votes(t: CivicTask): number { return this.store.data().allocation[t.id] ?? 0; }

  canAdd(t: CivicTask): boolean {
    const v = this.votes(t);
    return (v + 1) ** 2 - v ** 2 <= this.creditsLeft();
  }

  vote(t: CivicTask, delta: 1 | -1): void {
    if (delta === 1 && !this.canAdd(t)) return;
    if (!this.guard.requireAuth('allocate your budget votes')) return;
    this.store.update(d => ({ ...d, allocation: { ...d.allocation, [t.id]: Math.max(0, (d.allocation[t.id] ?? 0) + delta) } }));
  }

  private fields(event: Event): { form: HTMLFormElement; data: FormData } {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    return { form, data: new FormData(form) };
  }

  private patch(t: CivicTask, change: (x: CivicTask) => CivicTask): void {
    this.store.update(d => ({ ...d, tasks: d.tasks.map(x => x.id === t.id ? change(x) : x) }));
  }

  addTask(event: Event): void {
    const { form, data } = this.fields(event);
    if (!this.guard.requireAuth('propose a task')) return;
    const task: CivicTask = {
      id: this.store.nextId(),
      title: String(data.get('title')).trim(),
      skills: data.getAll('skills').map(String),
      cost: Math.max(0, Number(data.get('cost')) || 0),
      funded: 0,
      milestones: String(data.get('milestones')).split('\n').map(s => s.trim()).filter(Boolean),
      location: String(data.get('location') ?? '').trim(),
      status: 'Open',
      applications: [],
      assignee: false,
      proof: null
    };
    this.store.update(d => ({ ...d, tasks: [...d.tasks, task] }));
    form.reset();
  }

  removeTask(t: CivicTask): void {
    this.store.update(d => {
      const { [t.id]: _removed, ...allocation } = d.allocation;
      return { ...d, tasks: d.tasks.filter(x => x.id !== t.id), allocation };
    });
  }

  fund(t: CivicTask, amount: number): void {
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
        if (result?.paid) this.store.addFunding(challengeId, t.id, result.amount);
      });
  }

  apply(event: Event, t: CivicTask): void {
    const { data } = this.fields(event);
    if (!this.guard.requireAuth('apply for this task')) return;
    const application = {
      note: String(data.get('note')).trim(),
      availability: String(data.get('availability')).trim(),
      tools: String(data.get('tools') ?? '').trim()
    };
    this.patch(t, x => ({ ...x, applications: [...x.applications, application], assignee: true, status: 'In Progress' }));
  }

  complete(event: Event, t: CivicTask): void {
    const { data } = this.fields(event);
    const before = safeUrl(String(data.get('before')));
    const after = safeUrl(String(data.get('after')));
    if (!before || !after) return;
    if (!this.guard.requireAuth('submit completion proof')) return;
    const receipts = data.getAll('receipts').filter(f => f instanceof File && f.size > 0).length;
    this.patch(t, x => ({
      ...x,
      status: 'Verification',
      proof: {
        beforeUrl: before,
        afterUrl: after,
        note: String(data.get('note')).trim(),
        milestonesDone: data.getAll('milestone').length,
        receipts
      }
    }));
  }
}
