import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AuthGuardService } from '../../shared/services/auth-guard.service';
import { ActionsStore, Confidentiality, Evidence, LegalCase } from './actions.store';

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

@Component({
  selector: 'app-legal-action',
  imports: [DecimalPipe],
  styleUrl: './actions-shared.css',
  template: `
    <section class="feature" aria-labelledby="legal-setup">
      <header>
        <h4 id="legal-setup">Start a legal action</h4>
        <p class="muted">Attach a case to this challenge so lawyers, funders and evidence collectors can find it.</p>
      </header>
      <form class="form-grid" (submit)="createCase($event)">
        <label class="field">Target entity <input name="target" required placeholder="Company, agency or official"></label>
        <label class="field">Jurisdiction / court level <input name="jurisdiction" required placeholder="e.g. Regional court, EU level"></label>
        <label class="field">Legal basis
          <select name="basis" required>
            <option value="">Choose…</option>
            <option>Environmental violation</option>
            <option>Civil rights breach</option>
            <option>Consumer protection</option>
            <option>Public-health regulation</option>
            <option>Administrative / procedural failure</option>
            <option>Other</option>
          </select>
        </label>
        <label class="field">Target retainer budget <input name="budget" type="number" min="0" step="1" required placeholder="Filing fees + expert witnesses"></label>
        <label class="field wide">Primary legal lead <input name="lead" placeholder="Name of the lawyer or organisation, if known"></label>
        <div class="btn-row wide"><button class="abtn primary" type="submit">Create case</button></div>
      </form>
    </section>

    <section class="feature" aria-labelledby="legal-cases">
      <header>
        <h4 id="legal-cases">Case files</h4>
        <p class="muted">Inspect filings, targets and linked evidence. Pledges are intent only; nothing is charged and no money is held in escrow yet.</p>
      </header>
      @if (cases().length === 0) {
        <div class="empty">No cases yet. Create the first one above.</div>
      } @else {
        <ul class="list">
          @for (c of cases(); track c.id) {
            <li class="item">
              <div class="item-head">
                <span class="item-title">{{ c.target }}</span>
                <span class="tag">{{ c.basis }}</span>
              </div>
              <span class="muted">{{ c.jurisdiction }} · Lead: {{ c.lead || 'not assigned' }}</span>
              <div class="progress" role="progressbar" aria-label="Retainer pledged"
                   [attr.aria-valuenow]="percent(c)" aria-valuemin="0" aria-valuemax="100"><span [style.width.%]="percent(c)"></span></div>
              <span class="muted">{{ c.pledged | number }} pledged of {{ c.budget | number }} target ({{ percent(c) }}%)</span>
              <div class="btn-row">
                @for (amount of [10, 25, 50, 100]; track amount) {
                  <button class="abtn sm" type="button" (click)="pledge(c, amount)">+ {{ amount }}</button>
                }
              </div>
              <details>
                <summary>Case file ({{ c.filings.length }} filings, {{ evidenceFor(c).length }} evidence items)</summary>
                <div class="list" style="margin-top:10px">
                  @for (f of c.filings; track f.url) {
                    <a [href]="f.url" target="_blank" rel="noopener noreferrer">{{ f.title }}</a>
                  }
                  @for (e of evidenceFor(c); track e.id) {
                    <span class="muted">📎 {{ e.name }} · {{ e.confidentiality }}</span>
                  }
                </div>
                <form class="btn-row" style="margin-top:10px" (submit)="addFiling($event, c)">
                  <input class="plain-input" style="flex:1 1 140px" name="title" placeholder="Filing title" required aria-label="Filing title">
                  <input class="plain-input" style="flex:2 1 200px" name="url" type="url" placeholder="https://…" required aria-label="Filing link">
                  <button class="abtn sm" type="submit">Add filing</button>
                </form>
              </details>
            </li>
          }
        </ul>
      }
    </section>

    <section class="feature" aria-labelledby="legal-evidence">
      <header>
        <h4 id="legal-evidence">Evidence vault</h4>
        <p class="muted">Each file is hashed (SHA-256) in your browser. Only the hash and the chain-of-custody details are recorded; the file itself is not uploaded anywhere yet.</p>
      </header>
      <form class="form-grid" (submit)="addEvidence($event)">
        <label class="field wide">Evidence file <input name="file" type="file" required></label>
        <label class="field">Case
          <select name="caseId">
            <option value="">Not linked to a case</option>
            @for (c of cases(); track c.id) { <option [value]="c.id">{{ c.target }}</option> }
          </select>
        </label>
        <label class="field">Confidentiality
          <select name="confidentiality">
            <option>Public</option><option>Redacted</option><option>Court-only</option>
          </select>
        </label>
        <label class="field">Date captured <input name="capturedAt" type="date" required></label>
        <label class="field">Geo-location <input name="location" required placeholder="Place or coordinates"></label>
        <label class="field wide">Raw device metadata <input name="device" placeholder="Camera / sensor model, firmware, settings"></label>
        <label class="check wide"><input type="checkbox" name="affidavit" required> I confirm under oath that this evidence is authentic and unaltered.</label>
        <div class="btn-row wide">
          <button class="abtn primary" type="submit" [disabled]="hashing()">{{ hashing() ? 'Hashing…' : 'Record evidence' }}</button>
        </div>
      </form>
      @if (evidence().length > 0) {
        <ul class="list">
          @for (e of evidence(); track e.id) {
            <li class="item">
              <div class="item-head"><span class="item-title">{{ e.name }}</span><span class="tag" [class.warn]="e.confidentiality !== 'Public'">{{ e.confidentiality }}</span></div>
              <span class="muted">Captured {{ e.capturedAt }} at {{ e.location }} · {{ e.size | number }} bytes</span>
              <span class="mono">SHA-256 {{ e.sha256 }}</span>
            </li>
          }
        </ul>
      }
    </section>

    <section class="feature" aria-labelledby="legal-counsel">
      <header>
        <h4 id="legal-counsel">Pro-bono lawyer verification</h4>
        <p class="muted">Legal professionals can ask to be verified before taking ownership of a case.</p>
      </header>
      @if (lawyer(); as l) {
        <div class="notice">Request submitted {{ l.submittedAt }} for {{ l.jurisdiction }}. Status: <strong>pending review</strong>. Credentials are checked by platform staff once that review exists; until then no "Legal Counsel" status is granted.</div>
        <div class="btn-row"><button class="abtn quiet" type="button" (click)="withdrawLawyer()">Withdraw request</button></div>
      } @else {
        <form class="form-grid" (submit)="requestLawyer($event)">
          <label class="field">Full name <input name="name" required></label>
          <label class="field">Bar / jurisdiction <input name="jurisdiction" required></label>
          <label class="field wide">Registration or credential reference <input name="credentialRef" required placeholder="For reviewers only. Not saved in this preview."></label>
          <div class="btn-row wide"><button class="abtn primary" type="submit">Request verification</button></div>
        </form>
      }
    </section>
  `
})
export class LegalAction {
  private readonly store = inject(ActionsStore);
  private readonly guard = inject(AuthGuardService);

  readonly cases = computed(() => this.store.data().cases);
  readonly evidence = computed(() => this.store.data().evidence);
  readonly lawyer = computed(() => this.store.data().lawyerRequest);
  readonly hashing = signal(false);

  percent(c: LegalCase): number {
    return c.budget > 0 ? Math.min(100, Math.round((c.pledged / c.budget) * 100)) : 0;
  }

  evidenceFor(c: LegalCase): Evidence[] {
    return this.evidence().filter(e => e.caseId === c.id);
  }

  private formData(event: Event): { form: HTMLFormElement; data: FormData } {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    return { form, data: new FormData(form) };
  }

  createCase(event: Event): void {
    const { form, data } = this.formData(event);
    if (!this.guard.requireAuth('start a legal action')) return;
    const c: LegalCase = {
      id: this.store.nextId(),
      target: String(data.get('target')).trim(),
      jurisdiction: String(data.get('jurisdiction')).trim(),
      basis: String(data.get('basis')),
      budget: Math.max(0, Number(data.get('budget')) || 0),
      lead: String(data.get('lead') ?? '').trim(),
      pledged: 0,
      filings: [],
      createdAt: new Date().toISOString()
    };
    this.store.update(d => ({ ...d, cases: [...d.cases, c] }));
    form.reset();
  }

  pledge(c: LegalCase, amount: number): void {
    if (!this.guard.requireAuth('pledge to this case')) return;
    this.store.update(d => ({ ...d, cases: d.cases.map(x => x.id === c.id ? { ...x, pledged: x.pledged + amount } : x) }));
  }

  addFiling(event: Event, c: LegalCase): void {
    const { form, data } = this.formData(event);
    if (!this.guard.requireAuth('add a filing')) return;
    const filing = { title: String(data.get('title')).trim(), url: String(data.get('url')).trim() };
    this.store.update(d => ({ ...d, cases: d.cases.map(x => x.id === c.id ? { ...x, filings: [...x.filings, filing] } : x) }));
    form.reset();
  }

  async addEvidence(event: Event): Promise<void> {
    const { form, data } = this.formData(event);
    const file = data.get('file');
    if (!(file instanceof File) || file.size === 0) return;
    if (!this.guard.requireAuth('record evidence')) return;
    this.hashing.set(true);
    try {
      const caseId = data.get('caseId') ? Number(data.get('caseId')) : null;
      const entry: Evidence = {
        id: this.store.nextId(),
        caseId,
        name: file.name,
        size: file.size,
        sha256: await sha256Hex(file),
        confidentiality: String(data.get('confidentiality')) as Confidentiality,
        capturedAt: String(data.get('capturedAt')),
        location: String(data.get('location')).trim(),
        device: String(data.get('device') ?? '').trim()
      };
      this.store.update(d => ({ ...d, evidence: [...d.evidence, entry] }));
      form.reset();
    } finally {
      this.hashing.set(false);
    }
  }

  requestLawyer(event: Event): void {
    const { data } = this.formData(event);
    if (!this.guard.requireAuth('request lawyer verification')) return;
    this.store.update(d => ({
      ...d,
      lawyerRequest: {
        name: String(data.get('name')).trim(),
        jurisdiction: String(data.get('jurisdiction')).trim(),
        submittedAt: new Date().toLocaleDateString()
      }
    }));
  }

  withdrawLawyer(): void {
    this.store.update(d => ({ ...d, lawyerRequest: null }));
  }
}
