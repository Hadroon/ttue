import { Injectable, PLATFORM_ID, effect, inject, signal, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ActionItem, ActionItemAggregate, ApiService } from '../../shared/services/api.service';
import { AuthService } from '../../shared/services/auth.service';

/**
 * Everything on the Actions tab lives on the server (/api/challenges/:id/action-items).
 * The store loads a challenge's entries and turns them into the view models the components render.
 * Components change data through create/save/remove, which refetch afterwards so totals stay correct.
 */

export type Confidentiality = 'Public' | 'Redacted' | 'Court-only';

/** Shared entries know who added them, so only the author or an admin gets a remove button */
export interface Owned {
  ownerId: number | null;
}

export interface Filing extends Owned {
  id: number;
  title: string;
  url: string;
}

export interface LegalCase extends Owned {
  id: number;
  target: string;
  jurisdiction: string;
  basis: string;
  budget: number;
  lead: string;
  /** pledged by everyone; intent only, nothing is charged */
  pledged: number;
  filings: Filing[];
  createdAt: string;
}

export interface Evidence extends Owned {
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
  id: number;
  name: string;
  jurisdiction: string;
  submittedAt: string;
}

export interface Subsidiary extends Owned {
  id: number;
  name: string;
  citation: string;
}

export interface EconTarget extends Owned {
  id: number;
  brand: string;
  parent: string;
  subsidiaries: Subsidiary[];
  alternative: { name: string; note: string } | null;
}

/** The signed-in user's own pledge */
export interface EconPledge {
  id: number;
  targetId: number;
  kind: 'boycott' | 'buycott';
  monthly: number;
  duration: string;
  alternative: string;
}

export type TaskStatus = 'Open' | 'Funded' | 'In Progress' | 'Verification' | 'Completed';

export interface TaskProof {
  beforeUrl: string;
  afterUrl: string;
  note: string;
  milestonesDone: number;
  receipts: number;
}

export interface CivicTask extends Owned {
  id: number;
  title: string;
  skills: string[];
  cost: number;
  /** confirmed donations, in major currency units */
  funded: number;
  milestones: string[];
  location: string;
  status: TaskStatus;
  applicationCount: number;
  /** the signed-in user has applied */
  applied: boolean;
  proof: TaskProof | null;
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

export interface MediaAsset extends Owned {
  id: number;
  title: string;
  type: 'Infographic' | 'Logo' | 'Video' | 'Press kit';
  url: string;
  license: string;
}

export interface ShareResolution extends Owned {
  id: number;
  ticker: string;
  text: string;
  threshold: number;
  /** the signed-in user's shares and whether they count towards the threshold */
  mine: number;
  cosponsor: boolean;
  /** shares pledged by everyone who co-sponsors */
  pooled: number;
}

export interface Outreach {
  postalCode: string;
  email: number;
  call: number;
  mail: number;
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
  outreach: Outreach;
  media: MediaAsset[];
  resolutions: ShareResolution[];
}

export const VOICE_CREDITS = 100;

const emptyBill = (): BillDraft => ({ title: '', intent: '', amendments: [], impact: '', citations: '' });
const emptyOutreach = (): Outreach => ({ postalCode: '', email: 0, call: 0, mail: 0 });

const emptyData = (): ActionsData => ({
  cases: [], evidence: [], lawyerRequest: null,
  targets: [], pledges: [],
  tasks: [], allocation: {},
  bill: emptyBill(), reps: [], outreach: emptyOutreach(),
  media: [], resolutions: []
});

function build(items: ActionItem[], aggregates: ActionItemAggregate[]): ActionsData {
  const ofKind = (kind: string) => items.filter(i => i.kind === kind);
  const childrenOf = (kind: string, parentId: number) => items.filter(i => i.kind === kind && i.parentId === parentId);
  const total = (kind: string, parentId: number) => aggregates.find(a => a.kind === kind && a.parentId === parentId);
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  const num = (v: unknown) => (typeof v === 'number' ? v : 0);

  const cases: LegalCase[] = ofKind('case').map(i => ({
    id: i.id, ownerId: i.userId,
    target: text(i.data['target']), jurisdiction: text(i.data['jurisdiction']), basis: text(i.data['basis']),
    budget: num(i.data['budget']), lead: text(i.data['lead']),
    pledged: total('case_pledge', i.id)?.total ?? 0,
    filings: childrenOf('filing', i.id).map(f => ({ id: f.id, ownerId: f.userId, title: text(f.data['title']), url: text(f.data['url']) })),
    createdAt: i.createdAt
  }));

  const evidence: Evidence[] = ofKind('evidence').map(i => ({
    id: i.id, ownerId: i.userId, caseId: i.parentId,
    name: text(i.data['name']), size: num(i.data['size']), sha256: text(i.data['sha256']),
    confidentiality: text(i.data['confidentiality']) as Confidentiality,
    capturedAt: text(i.data['capturedAt']).slice(0, 10),
    location: text(i.data['location']), device: text(i.data['device'])
  }));

  const lawyer = ofKind('lawyer_request')[0];

  const targets: EconTarget[] = ofKind('target').map(i => {
    const alt = i.data['alternative'] as { name?: string; note?: string } | null;
    return {
      id: i.id, ownerId: i.userId, brand: text(i.data['brand']), parent: text(i.data['parent']),
      subsidiaries: childrenOf('subsidiary', i.id).map(s => ({ id: s.id, ownerId: s.userId, name: text(s.data['name']), citation: text(s.data['citation']) })),
      alternative: alt ? { name: text(alt.name), note: text(alt.note) } : null
    };
  });

  const pledges: EconPledge[] = ofKind('pledge').map(i => ({
    id: i.id, targetId: i.parentId ?? 0,
    kind: i.data['kind'] === 'buycott' ? 'buycott' : 'boycott',
    monthly: num(i.data['monthly']), duration: text(i.data['duration']), alternative: text(i.data['alternative'])
  }));

  const tasks: CivicTask[] = ofKind('task').map(i => {
    const proof = childrenOf('proof', i.id).at(-1);
    return {
      id: i.id, ownerId: i.userId, title: text(i.data['title']),
      skills: (i.data['skills'] as string[]) ?? [], cost: num(i.data['cost']),
      funded: (total('donation', i.id)?.total ?? 0) / 100,
      milestones: (i.data['milestones'] as string[]) ?? [], location: text(i.data['location']),
      status: (text(i.data['status']) || 'Open') as TaskStatus,
      applicationCount: total('application', i.id)?.count ?? 0,
      applied: childrenOf('application', i.id).length > 0,
      proof: proof ? {
        beforeUrl: text(proof.data['beforeUrl']), afterUrl: text(proof.data['afterUrl']), note: text(proof.data['note']),
        milestonesDone: num(proof.data['milestonesDone']), receipts: num(proof.data['receipts'])
      } : null
    };
  });

  const votes = (ofKind('allocation')[0]?.data['votes'] ?? {}) as Record<string, number>;
  const allocation: Record<number, number> = {};
  for (const [taskId, n] of Object.entries(votes)) allocation[Number(taskId)] = n;

  const draft = ofKind('bill_draft')[0]?.data;
  const bill: BillDraft = draft ? {
    title: text(draft['title']), intent: text(draft['intent']), impact: text(draft['impact']), citations: text(draft['citations']),
    amendments: ((draft['amendments'] as Omit<BillAmendment, 'id'>[]) ?? []).map((a, id) => ({ id, section: a.section, oldText: a.oldText, newText: a.newText }))
  } : emptyBill();

  const reps: Representative[] = ofKind('representative').map(i => ({
    id: i.id, name: text(i.data['name']), office: text(i.data['office']), email: text(i.data['email']), phone: text(i.data['phone'])
  }));

  const o = ofKind('outreach')[0]?.data;
  const outreach: Outreach = o
    ? { postalCode: text(o['postalCode']), email: num(o['email']), call: num(o['call']), mail: num(o['mail']) }
    : emptyOutreach();

  const media: MediaAsset[] = ofKind('media').map(i => ({
    id: i.id, ownerId: i.userId, title: text(i.data['title']), type: text(i.data['type']) as MediaAsset['type'],
    url: text(i.data['url']), license: text(i.data['license'])
  }));

  const resolutions: ShareResolution[] = ofKind('resolution').map(i => {
    const mine = childrenOf('resolution_cosponsor', i.id)[0]?.data;
    return {
      id: i.id, ownerId: i.userId, ticker: text(i.data['ticker']), text: text(i.data['text']), threshold: num(i.data['threshold']),
      mine: num(mine?.['shares']), cosponsor: mine?.['cosponsor'] === true,
      pooled: total('resolution_cosponsor', i.id)?.total ?? 0
    };
  });

  return {
    cases, evidence,
    lawyerRequest: lawyer ? { id: lawyer.id, name: text(lawyer.data['name']), jurisdiction: text(lawyer.data['jurisdiction']), submittedAt: new Date(lawyer.createdAt).toLocaleDateString() } : null,
    targets, pledges, tasks, allocation, bill, reps, outreach, media, resolutions
  };
}

@Injectable({ providedIn: 'root' })
export class ActionsStore {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  private challengeId: number | null = null;
  private request = 0;

  readonly data = signal<ActionsData>(emptyData());
  readonly error = signal<string | null>(null);

  constructor() {
    // Personal entries depend on who is signed in
    effect(() => {
      this.auth.currentUser();
      untracked(() => void this.refresh());
    });
  }

  load(challengeId: number | null): void {
    this.challengeId = challengeId;
    this.data.set(emptyData());
    this.error.set(null);
    void this.refresh();
  }

  /** Refetch after a payment came back; only matters if that challenge is the one on screen */
  reload(challengeId: number | null): Promise<void> {
    return challengeId === this.challengeId ? this.refresh() : Promise.resolve();
  }

  async refresh(): Promise<void> {
    const id = this.challengeId;
    if (id === null || !this.isBrowser) return;
    const request = ++this.request;
    try {
      const { items, aggregates } = await firstValueFrom(this.api.getActionItems(id));
      if (request === this.request) {
        this.data.set(build(items, aggregates));
        this.error.set(null);
      }
    } catch (error) {
      if (request === this.request) this.error.set(this.message(error, 'Could not load the action data.'));
    }
  }

  /** Whether the signed-in user may remove an entry: its author, or an admin */
  canRemove(ownerId: number | null): boolean {
    const user = this.auth.currentUser();
    return !!user && (user.isAdmin === true || (ownerId !== null && ownerId === user.id));
  }

  async create(kind: string, data: Record<string, unknown>, parentId?: number): Promise<ActionItem | null> {
    return this.run(api => firstValueFrom(api.createActionItem(this.requireChallenge(), kind, data, parentId)));
  }

  async save(itemId: number, data: Record<string, unknown>): Promise<ActionItem | null> {
    return this.run(api => firstValueFrom(api.updateActionItem(this.requireChallenge(), itemId, data)));
  }

  async remove(itemId: number): Promise<boolean> {
    return (await this.run(api => firstValueFrom(api.deleteActionItem(this.requireChallenge(), itemId)))) !== null;
  }

  private requireChallenge(): number {
    if (this.challengeId === null) throw new Error('No challenge is loaded');
    return this.challengeId;
  }

  private async run<T>(call: (api: ApiService) => Promise<T>): Promise<T | null> {
    try {
      const result = await call(this.api);
      this.error.set(null);
      await this.refresh();
      return result;
    } catch (error) {
      this.error.set(this.message(error, 'Could not save your changes.'));
      return null;
    }
  }

  private message(error: unknown, fallback: string): string {
    return error instanceof HttpErrorResponse && typeof error.error?.error === 'string' ? error.error.error : fallback;
  }
}
