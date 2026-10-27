import { Component, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { AuthGuardService } from '../../shared/services/auth-guard.service';
import { DonationModalComponent, DonationModalData, DonationModalResult } from '../../shared/components/donation-modal/donation-modal';
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
        <p class="muted">Inspect filings, targets and linked evidence. A new case is reviewed by an admin first; once approved, you can support it with a donation through Stripe. Paying a retainer out to lawyers is not automated yet.</p>
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
                @if (c.approval === 'Pending') { <span class="tag warn">Under approval</span> }
              </div>
              <span class="muted">{{ c.jurisdiction }} · Lead: {{ c.lead || 'not assigned' }}</span>
              <div class="progress" role="progressbar" aria-label="Retainer donated"
                   [attr.aria-valuenow]="percent(c)" aria-valuemin="0" aria-valuemax="100"><span [style.width.%]="percent(c)"></span></div>
              <span class="muted">{{ c.donated | number }} donated of {{ c.budget | number }} target ({{ percent(c) }}%)</span>
              <div class="btn-row">
                @for (amount of [10, 25, 50, 100]; track amount) {
                  <button class="abtn sm" type="button" [disabled]="c.approval !== 'Approved'"
                          [attr.title]="c.approval === 'Approved' ? null : 'Donations open once an admin approves this case'"
                          (click)="donate(c, amount)">+ {{ amount }}</button>
                }
              </div>
              @if (c.approval === 'Pending') {
                <span class="muted">Donations are disabled until an admin approves this case.</span>
              }
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
  readonly challengeId = input<number | null>(null);

  private readonly store = inject(ActionsStore);
  private readonly guard = inject(AuthGuardService);
  private readonly dialog = inject(MatDialog);

  readonly cases = computed(() => this.store.data().cases);
  readonly evidence = computed(() => this.store.data().evidence);
  readonly lawyer = computed(() => this.store.data().lawyerRequest);
  readonly hashing = signal(false);

  percent(c: LegalCase): number {
    return c.budget > 0 ? Math.min(100, Math.round((c.donated / c.budget) * 100)) : 0;
  }

  evidenceFor(c: LegalCase): Evidence[] {
    return this.evidence().filter(e => e.caseId === c.id);
  }

  private formData(event: Event): { form: HTMLFormElement; data: FormData } {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    return { form, data: new FormData(form) };
  }

  async createCase(event: Event): Promise<void> {
    const { form, data } = this.formData(event);
    if (!this.guard.requireAuth('start a legal action')) return;
    const ok = await this.store.create('case', {
      target: String(data.get('target')).trim(),
      jurisdiction: String(data.get('jurisdiction')).trim(),
      basis: String(data.get('basis')),
      budget: Math.max(0, Math.round(Number(data.get('budget')) || 0)),
      lead: String(data.get('lead') ?? '').trim()
    });
    if (ok) form.reset();
  }

  donate(c: LegalCase, amount: number): void {
    const challengeId = this.challengeId();
    if (c.approval !== 'Approved' || challengeId === null) return;
    if (!this.guard.requireAuth('donate to this case')) return;
    const data: DonationModalData = {
      amount,
      label: `${c.target} (${c.jurisdiction})`,
      context: { challengeId, actionKey: 'legal', targetId: String(c.id), targetTitle: c.target, targetLocation: c.jurisdiction }
    };
    this.dialog
      .open<DonationModalComponent, DonationModalData, DonationModalResult>(DonationModalComponent, { data, width: '520px', maxWidth: '90vw' })
      .afterClosed()
      .subscribe(result => {
        if (result?.paid) void this.store.reload(challengeId);
      });
  }

  async addFiling(event: Event, c: LegalCase): Promise<void> {
    const { form, data } = this.formData(event);
    if (!this.guard.requireAuth('add a filing')) return;
    const ok = await this.store.create('filing', { title: String(data.get('title')).trim(), url: String(data.get('url')).trim() }, c.id);
    if (ok) form.reset();
  }

  async addEvidence(event: Event): Promise<void> {
    const { form, data } = this.formData(event);
    const file = data.get('file');
    if (!(file instanceof File) || file.size === 0) return;
    if (!this.guard.requireAuth('record evidence')) return;
    this.hashing.set(true);
    try {
      const caseId = data.get('caseId') ? Number(data.get('caseId')) : undefined;
      const ok = await this.store.create('evidence', {
        name: file.name,
        size: file.size,
        sha256: await sha256Hex(file),
        confidentiality: String(data.get('confidentiality')) as Confidentiality,
        capturedAt: String(data.get('capturedAt')),
        location: String(data.get('location')).trim(),
        device: String(data.get('device') ?? '').trim()
      }, caseId);
      if (ok) form.reset();
    } finally {
      this.hashing.set(false);
    }
  }

  async requestLawyer(event: Event): Promise<void> {
    const { data } = this.formData(event);
    if (!this.guard.requireAuth('request lawyer verification')) return;
    await this.store.create('lawyer_request', {
      name: String(data.get('name')).trim(),
      jurisdiction: String(data.get('jurisdiction')).trim()
    });
  }

  async withdrawLawyer(): Promise<void> {
    const request = this.lawyer();
    if (request) await this.store.remove(request.id);
  }
}
