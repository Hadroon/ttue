import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Everything on the Actions tab is stored on this device (localStorage, per challenge)
 * until the backend has endpoints for it. Components only talk to this store, so
 * swapping in an API later means changing this file.
 */

export type Confidentiality = 'Public' | 'Redacted' | 'Court-only';

export interface LegalCase {
  id: number;
  target: string;
  jurisdiction: string;
  basis: string;
  budget: number;
  lead: string;
  pledged: number;
  filings: { title: string; url: string }[];
  createdAt: string;
}

export interface Evidence {
  id: number;
  caseId: number | null;
  name: string;
  size: number;
  sha256: string;
  confidentiality: Confidentiality;
  capturedAt: string;
  location: string;
  device: string;
}

export interface LawyerRequest {
  name: string;
  jurisdiction: string;
  submittedAt: string;
}

export interface EconTarget {
  id: number;
  brand: string;
  parent: string;
  subsidiaries: { name: string; citation: string }[];
  alternative: { name: string; note: string } | null;
}

export interface EconPledge {
  id: number;
  targetId: number;
  kind: 'boycott' | 'buycott';
  monthly: number;
  duration: string;
  alternative: string;
}

export type TaskStatus = 'Open' | 'Funded' | 'In Progress' | 'Verification' | 'Completed';

export interface CivicTask {
  id: number;
  title: string;
  skills: string[];
  cost: number;
  funded: number;
  milestones: string[];
  location: string;
  status: TaskStatus;
  applications: { note: string; availability: string; tools: string }[];
  assignee: boolean;
  proof: { beforeUrl: string; afterUrl: string; note: string; milestonesDone: number; receipts: number } | null;
}

export interface BillAmendment {
  id: number;
  section: string;
  oldText: string;
  newText: string;
}

export interface BillDraft {
  title: string;
  intent: string;
  amendments: BillAmendment[];
  impact: string;
  citations: string;
}

export interface Representative {
  id: number;
  name: string;
  office: string;
  email: string;
  phone: string;
}

export interface MediaAsset {
  id: number;
  title: string;
  type: 'Infographic' | 'Logo' | 'Video' | 'Press kit';
  url: string;
  license: string;
}

export interface ShareResolution {
  id: number;
  ticker: string;
  text: string;
  threshold: number;
  mine: number;
  cosponsor: boolean;
}

export interface ActionsData {
  cases: LegalCase[];
  evidence: Evidence[];
  lawyerRequest: LawyerRequest | null;
  targets: EconTarget[];
  pledges: EconPledge[];
  tasks: CivicTask[];
  /** votes per task id; cost is votes squared (quadratic voting) */
  allocation: Record<number, number>;
  bill: BillDraft;
  reps: Representative[];
  postalCode: string;
  outreach: { email: number; call: number; mail: number };
  media: MediaAsset[];
  resolutions: ShareResolution[];
}

export const VOICE_CREDITS = 100;

const emptyBill = (): BillDraft => ({ title: '', intent: '', amendments: [], impact: '', citations: '' });

const emptyData = (): ActionsData => ({
  cases: [], evidence: [], lawyerRequest: null,
  targets: [], pledges: [],
  tasks: [], allocation: {},
  bill: emptyBill(), reps: [], postalCode: '', outreach: { email: 0, call: 0, mail: 0 },
  media: [], resolutions: []
});

@Injectable({ providedIn: 'root' })
export class ActionsStore {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private key = 'ef-actions-v2-unknown';

  readonly data = signal<ActionsData>(emptyData());

  load(challengeId: number | null): void {
    this.key = this.keyFor(challengeId);
    let next = emptyData();
    if (this.isBrowser) {
      try {
        const raw = localStorage.getItem(this.key);
        if (raw) next = { ...emptyData(), ...JSON.parse(raw) };
      } catch { /* corrupt or blocked storage: start empty */ }
    }
    this.data.set(next);
  }

  /**
   * Add a paid amount to a bounty-board task. Works whether or not that challenge is the one
   * currently loaded, e.g. when a donor comes back from a payment redirect.
   */
  addFunding(challengeId: number | null, taskId: number, amount: number): void {
    const fund = (d: ActionsData): ActionsData => ({
      ...d,
      tasks: d.tasks.map(t => {
        if (t.id !== taskId) return t;
        const funded = t.funded + amount;
        return { ...t, funded, status: t.status === 'Open' && funded >= t.cost ? 'Funded' : t.status };
      })
    });
    const key = this.keyFor(challengeId);
    if (key === this.key) {
      this.update(fund);
      return;
    }
    if (!this.isBrowser) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) localStorage.setItem(key, JSON.stringify(fund({ ...emptyData(), ...JSON.parse(raw) })));
    } catch { /* storage unavailable: nothing to update */ }
  }

  private keyFor(challengeId: number | null): string {
    return `ef-actions-v2-${challengeId ?? 'unknown'}`;
  }

  update(change: (data: ActionsData) => ActionsData): void {
    const next = change(this.data());
    this.data.set(next);
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(this.key, JSON.stringify(next));
    } catch { /* storage full or unavailable: state stays in memory */ }
  }

  nextId(): number {
    return Date.now() * 1000 + Math.floor(Math.random() * 1000);
  }
}
