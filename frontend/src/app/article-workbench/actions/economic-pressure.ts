import { Component, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AuthGuardService } from '../../shared/services/auth-guard.service';
import { AuthService } from '../../shared/services/auth.service';
import { ActionsStore, EconPledge, EconTarget } from './actions.store';

@Component({
  selector: 'app-economic-pressure',
  imports: [DecimalPipe],
  styleUrl: './actions-shared.css',
  template: `
    <section class="feature" aria-labelledby="eco-impact">
      <header>
        <h4 id="eco-impact">Your impact</h4>
        <p class="muted">Totals of your own pledges. Pledges are intent only; nothing is charged.</p>
      </header>
      <div class="stats">
        <div class="stat-box"><strong>{{ pledges().length }}</strong><span>your pledges</span></div>
        <div class="stat-box"><strong>{{ monthlyTotal() | number }}</strong><span>per month redirected</span></div>
        <div class="stat-box"><strong>{{ coveredBrands() }}</strong><span>brands covered incl. subsidiaries</span></div>
      </div>
    </section>

    <section class="feature" aria-labelledby="eco-targets">
      <header>
        <h4 id="eco-targets">Action center: targets</h4>
        <p class="muted">Corporations, their parent companies and sub-brands. Pledging against a brand covers its sister brands too.</p>
      </header>
      @if (targets().length === 0) {
        <div class="empty">No targets yet. Add the first one below.</div>
      } @else {
        <ul class="list">
          @for (t of targets(); track t.id) {
            <li class="item">
              <div class="item-head">
                <span class="item-title">{{ t.brand }}</span>
                <span class="tag">Parent: {{ t.parent || 'unknown' }}</span>
              </div>
              @if (t.subsidiaries.length > 0) {
                <div class="tags" aria-label="Sub-brands">
                  @for (s of t.subsidiaries; track s.name) {
                    <a class="tag warn" [href]="s.citation" target="_blank" rel="noopener noreferrer" title="Source (unverified by peers yet)">{{ s.name }}</a>
                  }
                </div>
              }
              @if (t.alternative; as alt) {
                <div class="two-col" role="group" [attr.aria-label]="'Compare ' + t.brand + ' with ' + alt.name">
                  <div class="item"><span class="muted">Instead of</span><span class="item-title">{{ t.brand }}</span></div>
                  <div class="item"><span class="muted">Try</span><span class="item-title">{{ alt.name }}</span>@if (alt.note) { <span class="muted">{{ alt.note }}</span> }</div>
                </div>
              }
              <div class="btn-row">
                <button class="abtn sm" type="button" (click)="selected.set(t.id)">Pledge on this target</button>
                @if (canRemove(t.ownerId)) { <button class="abtn sm quiet" type="button" (click)="removeTarget(t)">Remove</button> }
              </div>
            </li>
          }
        </ul>
      }
      <details>
        <summary>Add a target</summary>
        <form class="form-grid" style="margin-top:10px" (submit)="addTarget($event)">
          <label class="field">Brand <input name="brand" required></label>
          <label class="field">Parent company <input name="parent"></label>
          <label class="field">Ethical alternative (optional) <input name="altName" placeholder="Local business or cooperative"></label>
          <label class="field">Why it is a good alternative <input name="altNote"></label>
          <div class="btn-row wide"><button class="abtn primary" type="submit">Add target</button></div>
        </form>
      </details>
    </section>

    <section class="feature" aria-labelledby="eco-pledge">
      <header>
        <h4 id="eco-pledge">Make a commitment</h4>
        <p class="muted">Boycott a brand, or buycott by shifting spending to an alternative.</p>
      </header>
      @if (targets().length === 0) {
        <div class="empty">Add a target first.</div>
      } @else {
        <form class="form-grid" (submit)="addPledge($event)">
          <label class="field">Brand
            <select name="targetId" required [value]="selected() ?? ''">
              <option value="">Choose…</option>
              @for (t of targets(); track t.id) { <option [value]="t.id" [selected]="selected() === t.id">{{ t.brand }}</option> }
            </select>
          </label>
          <label class="field">Type
            <select name="kind"><option value="boycott">Boycott</option><option value="buycott">Buycott (divert spending)</option></select>
          </label>
          <label class="field">Estimated monthly spend <input name="monthly" type="number" min="0" step="1" required></label>
          <label class="field">Duration
            <select name="duration"><option>1 month</option><option>3 months</option><option>6 months</option><option>Until demands are met</option></select>
          </label>
          <label class="field wide">Alternative vendor I will switch to (optional) <input name="alternative"></label>
          <div class="btn-row wide"><button class="abtn primary" type="submit">Pledge</button></div>
        </form>
        @if (pledges().length > 0) {
          <ul class="list">
            @for (p of pledges(); track p.id) {
              <li class="item">
                <div class="item-head">
                  <span class="item-title">{{ p.kind === 'boycott' ? 'Boycott' : 'Buycott' }}: {{ brandName(p.targetId) }}</span>
                  <button class="abtn sm quiet" type="button" (click)="removePledge(p)">Withdraw</button>
                </div>
                <span class="muted">{{ p.monthly | number }} / month · {{ p.duration }}@if (p.alternative) { · switching to {{ p.alternative }} }</span>
                @if (subsOf(p.targetId).length > 0) { <span class="muted">Also covers: {{ subsOf(p.targetId).join(', ') }}</span> }
              </li>
            }
          </ul>
        }
      }
    </section>

    <section class="feature" aria-labelledby="eco-map">
      <header>
        <h4 id="eco-map">Subsidiary mapping</h4>
        <p class="muted">Link a lesser-known sub-brand to its parent. A source link is required so others can check it.</p>
      </header>
      @if (targets().length === 0) {
        <div class="empty">Add a target first.</div>
      } @else {
        <form class="form-grid" (submit)="addSubsidiary($event)">
          <label class="field">Target
            <select name="targetId" required>
              <option value="">Choose…</option>
              @for (t of targets(); track t.id) { <option [value]="t.id">{{ t.brand }}</option> }
            </select>
          </label>
          <label class="field">Sub-brand <input name="name" required></label>
          <label class="field wide">Citation link <input name="citation" type="url" required placeholder="Company registry, annual report or news source"></label>
          <div class="btn-row wide"><button class="abtn primary" type="submit">Add mapping</button></div>
        </form>
        <p class="muted">Peer verification of mappings is not available yet, so every mapping is shown as unverified.</p>
      }
    </section>

    <section class="feature" aria-labelledby="eco-letter">
      <header>
        <h4 id="eco-letter">Divestment letter generator</h4>
        <p class="muted">Draft a formal demand to an institution that holds shares in a target company.</p>
      </header>
      <div class="form-grid">
        <label class="field">Institution <input #inst placeholder="Pension fund, bank or university" (input)="institution.set(inst.value)"></label>
        <label class="field">Company to divest from <input #comp placeholder="Company name" (input)="company.set(comp.value)"></label>
      </div>
      <label class="field">Letter (editable)
        <textarea rows="10" [value]="letter()" (input)="letterOverride.set($any($event.target).value)"></textarea>
      </label>
      <div class="btn-row">
        <button class="abtn primary" type="button" (click)="copyLetter()">{{ copied() ? 'Copied ✓' : 'Copy letter' }}</button>
        <a class="abtn" [href]="mailto()">Open in email</a>
        @if (letterOverride() !== null) { <button class="abtn quiet" type="button" (click)="letterOverride.set(null)">Reset text</button> }
      </div>
    </section>
  `
})
export class EconomicPressure {
  readonly challengeTitle = input('');

  private readonly store = inject(ActionsStore);
  private readonly guard = inject(AuthGuardService);
  private readonly auth = inject(AuthService);

  readonly targets = computed(() => this.store.data().targets);
  readonly pledges = computed(() => this.store.data().pledges);
  readonly selected = signal<number | null>(null);
  readonly institution = signal('');
  readonly company = signal('');
  readonly letterOverride = signal<string | null>(null);
  readonly copied = signal(false);

  readonly monthlyTotal = computed(() => this.pledges().reduce((sum, p) => sum + p.monthly, 0));
  readonly coveredBrands = computed(() => {
    const ids = new Set(this.pledges().map(p => p.targetId));
    return this.targets().filter(t => ids.has(t.id)).reduce((n, t) => n + 1 + t.subsidiaries.length, 0);
  });

  readonly letter = computed(() => this.letterOverride() ?? this.defaultLetter());

  brandName(id: number): string {
    return this.targets().find(t => t.id === id)?.brand ?? 'Removed target';
  }

  subsOf(id: number): string[] {
    return this.targets().find(t => t.id === id)?.subsidiaries.map(s => s.name) ?? [];
  }

  private fields(event: Event): { form: HTMLFormElement; data: FormData } {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    return { form, data: new FormData(form) };
  }

  async addTarget(event: Event): Promise<void> {
    const { form, data } = this.fields(event);
    if (!this.guard.requireAuth('add a target')) return;
    const altName = String(data.get('altName') ?? '').trim();
    const ok = await this.store.create('target', {
      brand: String(data.get('brand')).trim(),
      parent: String(data.get('parent') ?? '').trim(),
      alternative: altName ? { name: altName, note: String(data.get('altNote') ?? '').trim() } : null
    });
    if (ok) form.reset();
  }

  canRemove(ownerId: number | null): boolean {
    return this.store.canRemove(ownerId);
  }

  async removeTarget(t: EconTarget): Promise<void> {
    await this.store.remove(t.id);
  }

  async addPledge(event: Event): Promise<void> {
    const { form, data } = this.fields(event);
    if (!this.guard.requireAuth('make a pledge')) return;
    const ok = await this.store.create('pledge', {
      kind: data.get('kind') === 'buycott' ? 'buycott' : 'boycott',
      monthly: Math.max(0, Math.round(Number(data.get('monthly')) || 0)),
      duration: String(data.get('duration')),
      alternative: String(data.get('alternative') ?? '').trim()
    }, Number(data.get('targetId')));
    if (ok) {
      form.reset();
      this.selected.set(null);
    }
  }

  async removePledge(p: EconPledge): Promise<void> {
    await this.store.remove(p.id);
  }

  async addSubsidiary(event: Event): Promise<void> {
    const { form, data } = this.fields(event);
    if (!this.guard.requireAuth('map a subsidiary')) return;
    const ok = await this.store.create('subsidiary', {
      name: String(data.get('name')).trim(),
      citation: String(data.get('citation')).trim()
    }, Number(data.get('targetId')));
    if (ok) form.reset();
  }

  private defaultLetter(): string {
    const inst = this.institution().trim() || '[Institution]';
    const comp = this.company().trim() || '[Company]';
    const topic = this.challengeTitle() || 'a pressing public concern';
    const sender = this.auth.currentUser()?.displayName ?? '[Your name]';
    return `To the Board of ${inst},\n\nI am writing as a member of the public concerned about ${topic}.\n\nWe understand that ${inst} holds investments in ${comp}. We ask that you review these holdings and publish a timeline for divesting from ${comp} unless it changes the practices at the centre of this issue.\n\nPlease confirm receipt of this letter and tell us when we can expect a response.\n\nYours faithfully,\n${sender}`;
  }

  async copyLetter(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.letter());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch { /* clipboard blocked: text can still be selected manually */ }
  }

  mailto(): string {
    const subject = encodeURIComponent(`Divestment request: ${this.company().trim() || 'company'}`);
    return `mailto:?subject=${subject}&body=${encodeURIComponent(this.letter())}`;
  }
}
