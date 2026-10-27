import { Component, computed, inject, input, output, signal } from '@angular/core';
import { AuthGuardService } from '../../shared/services/auth-guard.service';
import { AuthService } from '../../shared/services/auth.service';
import { ActionsStore, BillAmendment, BillDraft, Representative } from './actions.store';

interface DiffPart { kind: 'same' | 'added' | 'removed'; text: string; }

/** Word-level diff via longest common subsequence. Fine for clause-sized text. */
function wordDiff(before: string, after: string): DiffPart[] {
  const a = before.split(/\s+/).filter(Boolean);
  const b = after.split(/\s+/).filter(Boolean);
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const parts: DiffPart[] = [];
  const push = (kind: DiffPart['kind'], text: string) => {
    const last = parts[parts.length - 1];
    if (last && last.kind === kind) last.text += ' ' + text;
    else parts.push({ kind, text });
  };
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { push('same', a[i]); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { push('removed', a[i]); i++; }
    else { push('added', b[j]); j++; }
  }
  while (i < a.length) push('removed', a[i++]);
  while (j < b.length) push('added', b[j++]);
  return parts;
}

@Component({
  selector: 'app-policy-lobbying',
  styleUrl: './actions-shared.css',
  styles: [`
    .diff { margin: 0; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); font-size: 14px; line-height: 1.6; }
    ins { background: color-mix(in srgb, #22c55e 25%, transparent); text-decoration: none; border-radius: 3px; padding: 0 2px; }
    del { background: color-mix(in srgb, #ef4444 25%, transparent); border-radius: 3px; padding: 0 2px; }
  `],
  template: `
    <section class="feature" aria-labelledby="pl-studio">
      <header>
        <h4 id="pl-studio">Legislative studio</h4>
        <p class="muted">Draft an ordinance or amendment in a standard template. Changes to existing text are compared word by word as you type.</p>
      </header>
      <div class="btn-row">
        <button class="abtn sm" type="button" (click)="openDraft.emit()">Start from this challenge's draft →</button>
      </div>
      <div class="form-grid">
        <label class="field wide">Policy title
          <input [value]="bill().title" (change)="setField('title', $any($event.target).value)">
        </label>
        <label class="field wide">Legislative intent
          <textarea rows="3" [value]="bill().intent" (change)="setField('intent', $any($event.target).value)"></textarea>
        </label>
      </div>

      <h5 style="margin:6px 0 0">Section amendments</h5>
      @for (a of bill().amendments; track a.id) {
        <div class="item">
          <div class="item-head"><span class="item-title">{{ a.section }}</span>
            <button class="abtn sm quiet" type="button" (click)="removeAmendment(a)">Remove</button></div>
          <p class="diff" aria-label="Changes in this section">
            @for (p of diff(a); track $index) {
              @switch (p.kind) {
                @case ('added') { <ins>{{ p.text }}</ins>{{ ' ' }} }
                @case ('removed') { <del>{{ p.text }}</del>{{ ' ' }} }
                @default { {{ p.text }}{{ ' ' }} }
              }
            }
          </p>
        </div>
      }
      <form class="form-grid" (submit)="addAmendment($event)">
        <label class="field wide">Section reference <input name="section" required placeholder="e.g. Municipal Code §12.4(b)"></label>
        <label class="field">Old text <textarea name="oldText" rows="3" placeholder="Leave empty for a new section"></textarea></label>
        <label class="field">Proposed text <textarea name="newText" rows="3" required></textarea></label>
        <div class="btn-row wide"><button class="abtn" type="submit">Add amendment</button></div>
      </form>

      <div class="form-grid">
        <label class="field wide">Regulatory impact assessment
          <textarea rows="3" [value]="bill().impact" (change)="setField('impact', $any($event.target).value)" placeholder="Who is affected, expected costs and benefits"></textarea>
        </label>
        <label class="field wide">Citation links (one per line)
          <textarea rows="3" [value]="bill().citations" (change)="setField('citations', $any($event.target).value)"></textarea>
        </label>
      </div>
      <div class="btn-row">
        <button class="abtn primary" type="button" (click)="copyBill()">{{ billCopied() ? 'Copied ✓' : 'Copy as Markdown' }}</button>
        <button class="abtn quiet" type="button" (click)="clearBill()">Clear draft</button>
      </div>
    </section>

    <section class="feature" aria-labelledby="pl-reps">
      <header>
        <h4 id="pl-reps">Your representatives</h4>
        <p class="muted">Automatic lookup from an address needs a geocoding service that isn't connected yet. Add the people you want to contact yourself; official contact pages are the best source.</p>
      </header>
      @if (reps().length > 0) {
        <ul class="list">
          @for (r of reps(); track r.id) {
            <li class="item">
              <div class="item-head"><span class="item-title">{{ r.name }}</span><span class="tag">{{ r.office }}</span></div>
              <span class="muted">{{ r.email || 'no email' }} · {{ r.phone || 'no phone' }}</span>
              <div class="btn-row"><button class="abtn sm quiet" type="button" (click)="removeRep(r)">Remove</button></div>
            </li>
          }
        </ul>
      }
      <form class="form-grid" (submit)="addRep($event)">
        <label class="field">Name <input name="name" required></label>
        <label class="field">Office <input name="office" required placeholder="City council, parliament…"></label>
        <label class="field">Email <input name="email" type="email"></label>
        <label class="field">Phone <input name="phone" type="tel"></label>
        <div class="btn-row wide"><button class="abtn" type="submit">Add representative</button></div>
      </form>
    </section>

    <section class="feature" aria-labelledby="pl-dispatch">
      <header>
        <h4 id="pl-dispatch">Contact campaign</h4>
        <p class="muted">Messages open in your own email app or phone, so nothing is sent through the platform and your contact details stay with you. Constituent postal codes can't be checked yet.</p>
      </header>
      <div class="form-grid">
        <label class="field">Representative
          <select [value]="repId() ?? ''" (change)="repId.set($any($event.target).value ? +$any($event.target).value : null)">
            <option value="">Choose…</option>
            @for (r of reps(); track r.id) { <option [value]="r.id">{{ r.name }} ({{ r.office }})</option> }
          </select>
        </label>
        <label class="field">Your postal code
          <input [value]="postalCode()" (change)="setPostal($any($event.target).value)" autocomplete="postal-code">
        </label>
        <label class="field wide">Message (editable)
          <textarea rows="8" [value]="message()" (input)="messageOverride.set($any($event.target).value)"></textarea>
        </label>
      </div>
      <div class="btn-row">
        <a class="abtn primary" [href]="mailto()" (click)="log('email')">Open in email</a>
        @if (selectedRep()?.phone; as phone) { <a class="abtn" [href]="'tel:' + phone" (click)="log('call')">Call</a> }
        <button class="abtn" type="button" (click)="copyMessage()">{{ copied() ? 'Copied ✓' : 'Copy message' }}</button>
        <button class="abtn" type="button" (click)="log('mail')">I posted a letter</button>
        @if (messageOverride() !== null) { <button class="abtn quiet" type="button" (click)="messageOverride.set(null)">Reset text</button> }
      </div>
      <div class="stats" aria-label="Your outreach">
        <div class="stat-box"><strong>{{ outreach().email }}</strong><span>emails you started</span></div>
        <div class="stat-box"><strong>{{ outreach().call }}</strong><span>calls you started</span></div>
        <div class="stat-box"><strong>{{ outreach().mail }}</strong><span>letters you posted</span></div>
      </div>
    </section>
  `
})
export class PolicyLobbying {
  readonly challengeTitle = input('');
  readonly openDraft = output<void>();

  private readonly store = inject(ActionsStore);
  private readonly guard = inject(AuthGuardService);
  private readonly auth = inject(AuthService);

  readonly bill = computed(() => this.store.data().bill);
  readonly reps = computed(() => this.store.data().reps);
  readonly postalCode = computed(() => this.store.data().outreach.postalCode);
  readonly outreach = computed(() => this.store.data().outreach);

  readonly repId = signal<number | null>(null);
  readonly messageOverride = signal<string | null>(null);
  readonly copied = signal(false);
  readonly billCopied = signal(false);

  readonly selectedRep = computed(() => this.reps().find(r => r.id === this.repId()) ?? null);
  readonly message = computed(() => this.messageOverride() ?? this.defaultMessage());

  diff(a: BillAmendment): DiffPart[] { return wordDiff(a.oldText, a.newText); }

  /** The draft is one personal entry; every change saves the whole draft */
  private async saveBill(next: BillDraft): Promise<boolean> {
    if (!this.guard.requireAuth('save your policy draft')) return false;
    return (await this.store.create('bill_draft', {
      title: next.title, intent: next.intent, impact: next.impact, citations: next.citations,
      amendments: next.amendments.map(({ section, oldText, newText }) => ({ section, oldText, newText }))
    })) !== null;
  }

  async setField(field: 'title' | 'intent' | 'impact' | 'citations', value: string): Promise<void> {
    await this.saveBill({ ...this.bill(), [field]: value.trim() });
  }

  async addAmendment(event: Event): Promise<void> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    const amendment: BillAmendment = {
      id: this.bill().amendments.length,
      section: String(data.get('section')).trim(),
      oldText: String(data.get('oldText') ?? '').trim(),
      newText: String(data.get('newText')).trim()
    };
    const ok = await this.saveBill({ ...this.bill(), amendments: [...this.bill().amendments, amendment] });
    if (ok) form.reset();
  }

  async removeAmendment(a: BillAmendment): Promise<void> {
    await this.saveBill({ ...this.bill(), amendments: this.bill().amendments.filter(x => x.id !== a.id) });
  }

  async clearBill(): Promise<void> {
    await this.saveBill({ title: '', intent: '', amendments: [], impact: '', citations: '' });
  }

  private billMarkdown(): string {
    const b = this.bill();
    const amendments = b.amendments.map(a =>
      `### ${a.section}\n\n${a.oldText ? `**Current text:** ${a.oldText}\n\n` : ''}**Proposed text:** ${a.newText}`).join('\n\n');
    return [`# ${b.title || 'Untitled policy'}`, `## Intent\n\n${b.intent}`, `## Amendments\n\n${amendments}`,
      `## Impact assessment\n\n${b.impact}`, `## Citations\n\n${b.citations}`].join('\n\n');
  }

  async copyBill(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.billMarkdown());
      this.billCopied.set(true);
      setTimeout(() => this.billCopied.set(false), 2000);
    } catch { /* clipboard blocked */ }
  }

  async addRep(event: Event): Promise<void> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    if (!this.guard.requireAuth('save a representative')) return;
    const ok = await this.store.create('representative', {
      name: String(data.get('name')).trim(),
      office: String(data.get('office')).trim(),
      email: String(data.get('email') ?? '').trim(),
      phone: String(data.get('phone') ?? '').trim()
    });
    if (ok) form.reset();
  }

  async removeRep(r: Representative): Promise<void> {
    if (await this.store.remove(r.id) && this.repId() === r.id) this.repId.set(null);
  }

  async setPostal(value: string): Promise<void> {
    if (!this.guard.requireAuth('save your postal code')) return;
    await this.store.create('outreach', { ...this.outreach(), postalCode: value.trim() });
  }

  private defaultMessage(): string {
    const rep = this.selectedRep();
    const topic = this.challengeTitle() || 'a matter of public concern';
    const name = this.auth.currentUser()?.displayName ?? '';
    const postal = this.postalCode();
    return `Dear ${rep ? rep.name : 'Representative'},\n\nI am a constituent${postal ? ` (postal code ${postal})` : ''} writing about: ${topic}.\n\nI ask you to support concrete action on this issue and to tell me where you stand.\n\nThank you,\n${name}`.trimEnd();
  }

  mailto(): string {
    const subject = encodeURIComponent(`Constituent message: ${this.challengeTitle() || 'public concern'}`);
    const to = this.selectedRep()?.email ?? '';
    return `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${encodeURIComponent(this.message())}`;
  }

  async copyMessage(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.message());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch { /* clipboard blocked */ }
  }

  async log(kind: 'email' | 'call' | 'mail'): Promise<void> {
    if (!this.guard.requireAuth('log your outreach')) return;
    const current = this.outreach();
    await this.store.create('outreach', { ...current, [kind]: current[kind] + 1 });
  }
}
