import { Component, ElementRef, computed, signal, viewChild } from '@angular/core';

// Client-side simulation of the real flow. Rules mirror the backend:
// - an idea upvote is a toggle; it moves the author's reputation by +1 / -1 (routes/votes.ts, api.service voteIdea)
// - you cannot vote on your own content
// - ranks come from CIVIC_RANKS (services/reputation.ts)
// - challenge tags: at most 10, no duplicates, 50 chars each (add-challenge)
// - anyone can recommend an action, only an admin activates it (routes/challenge-actions.ts)

type StageId = 'challenge' | 'ideas' | 'draft' | 'support' | 'actions';
type Vote = 1 | -1 | 0;

interface Stage { id: StageId; icon: string; title: string; hint: string; }
interface Idea { id: number; author: string; title: string; description: string; base: number; mine: boolean; }
interface Action { key: string; icon: string; title: string; base: number; includes: string[]; }
interface LogEntry { id: number; icon: string; text: string; }

const RANKS = [
  { title: 'CITIZEN', min: 0 },
  { title: 'SCRIBE', min: 100 },
  { title: 'TRIBUNE', min: 500 },
  { title: 'ARCHON', min: 2000 },
] as const;

const COMMUNITY = { support: 38, oppose: 11 };
const COMMUNITY_BOOST = 3;
const AUTHOR_START_REP = 97;
const DEFAULT_TAGS = ['water', 'agriculture'];
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 50;

@Component({
  selector: 'app-how-it-works-demo',
  templateUrl: './demo.html',
  styleUrl: './demo.css'
})
export class HowItWorksDemo {
  readonly stages: Stage[] = [
    { id: 'challenge', icon: '💡', title: 'Raise a challenge', hint: 'Describe a real-world problem, tag it, and post it.' },
    { id: 'ideas', icon: '🗳️', title: 'Vote on ideas', hint: 'Upvote what works. Every vote moves the author’s reputation.' },
    { id: 'draft', icon: '📝', title: 'Draft together', hint: 'Review a proposed edit as a diff, then merge or reject it.' },
    { id: 'support', icon: '🤝', title: 'Back the draft', hint: 'Support or oppose the drafted article.' },
    { id: 'actions', icon: '📣', title: 'Take action', hint: 'Recommend how to push the change into the real world.' },
  ];

  readonly ideas: Idea[] = [
    { id: 1, author: 'maya', title: 'Plant riparian buffer strips along farm edges', base: 14, mine: false,
      description: 'A 10 m strip of grass and trees between fields and the bank soaks up nitrates before they reach the water.' },
    { id: 2, author: 'tomas', title: 'Fund free soil testing for local farms', base: 9, mine: false,
      description: 'When farmers know what their soil actually needs, they spread less fertiliser and save money.' },
    { id: 3, author: 'you', title: 'Publish weekly water-quality readings online', base: 4, mine: true,
      description: 'Volunteers sample the river every week and post the results, so everyone can see whether things improve.' },
  ];

  readonly actions: Action[] = [
    { key: 'legal', icon: '⚖️', title: 'Legal action', base: 6, includes: ['Case files', 'Evidence vault', 'Retainer crowdfunding'] },
    { key: 'economic', icon: '🛒', title: 'Economic pressure', base: 4, includes: ['Boycott targets', 'Ethical alternatives', 'Pledge tracker'] },
    { key: 'direct', icon: '🛠️', title: 'Direct action', base: 7, includes: ['Civic bounty board', 'Skill matcher', 'Proof of completion'] },
    { key: 'policy', icon: '📜', title: 'Policy & lobbying', base: 7, includes: ['Legislative studio', 'Representative outreach'] },
    { key: 'info', icon: '📣', title: 'Info campaigns', base: 3, includes: ['Media library', 'Shareholder resolutions'] },
    { key: 'protest', icon: '📢', title: 'Protests', base: 2, includes: ['Events & map', 'Organiser links'] },
  ];

  readonly challengeTitle = 'Fertiliser runoff is polluting our river';
  readonly challengeDescription = 'Every spring, rain washes fertiliser from nearby fields into the river. Algae blooms follow, fish die off, and the town has had to close the swimming spot two summers in a row.';
  readonly maxTagLength = MAX_TAG_LENGTH;
  readonly draftKept = 'Farms within 50 m of the river ';
  readonly draftRemoved = 'should reduce fertiliser use.';
  readonly draftAdded = 'must keep a 10 m planted buffer strip and report fertiliser use yearly.';

  readonly stageIndex = signal(0);
  readonly stage = computed(() => this.stages[this.stageIndex()]);
  private readonly stageEl = viewChild<ElementRef<HTMLElement>>('stageEl');

  readonly tags = signal<string[]>([...DEFAULT_TAGS]);
  readonly tagInput = signal('');
  readonly tagError = signal<string | null>(null);
  readonly posted = signal(false);

  readonly ideaVotes = signal<Record<number, boolean>>({});
  readonly communityVoted = signal(false);
  readonly ownVoteBlocked = signal(false);

  readonly proposal = signal<'pending' | 'accepted' | 'rejected'>('pending');
  readonly draftVote = signal<Vote>(0);

  readonly recommended = signal<Record<string, boolean>>({});
  readonly activated = signal<string | null>(null);

  readonly log = signal<LogEntry[]>([]);
  private logId = 0;

  readonly completed = computed<Record<StageId, boolean>>(() => ({
    challenge: this.posted(),
    ideas: Object.values(this.ideaVotes()).some(Boolean) || this.communityVoted(),
    draft: this.proposal() !== 'pending',
    support: this.draftVote() !== 0,
    actions: this.activated() !== null,
  }));
  readonly doneCount = computed(() => Object.values(this.completed()).filter(Boolean).length);
  readonly allDone = computed(() => this.doneCount() === this.stages.length);

  readonly rankedIdeas = computed(() =>
    this.ideas
      .map(i => ({ ...i, voted: !!this.ideaVotes()[i.id], score: this.scoreOf(i) }))
      .sort((a, b) => b.score - a.score));

  /** @maya's reputation: a starting point plus every vote her idea received during the demo */
  readonly authorRep = computed(() => AUTHOR_START_REP + this.scoreOf(this.ideas[0]) - this.ideas[0].base);
  readonly authorRank = computed(() => this.rankOf(this.authorRep()).title);
  readonly nextRank = computed(() => RANKS.find(r => r.min > this.authorRep()) ?? null);
  readonly rankProgress = computed(() => {
    const rep = this.authorRep();
    const current = this.rankOf(rep);
    const next = this.nextRank();
    if (!next) return 100;
    return Math.max(0, Math.min(100, ((rep - current.min) / (next.min - current.min)) * 100));
  });

  readonly tally = computed(() => {
    const v = this.draftVote();
    const support = COMMUNITY.support + (v === 1 ? 1 : 0);
    const oppose = COMMUNITY.oppose + (v === -1 ? 1 : 0);
    return { support, oppose, pct: Math.round((support / (support + oppose)) * 100) };
  });

  readonly actionStates = computed(() => this.actions.map(a => {
    const mine = !!this.recommended()[a.key];
    return { ...a, mine, votes: a.base + (mine ? 1 : 0), active: this.activated() === a.key };
  }));
  readonly activeAction = computed(() => this.actionStates().find(a => a.active) ?? null);

  /** Mirrors the "Most recommended" tag: only shown when one open action is strictly ahead */
  readonly leader = computed(() => {
    const open = this.actionStates().filter(a => !a.active && a.votes > 0);
    if (!open.length) return null;
    const top = Math.max(...open.map(a => a.votes));
    const leaders = open.filter(a => a.votes === top);
    return leaders.length === 1 ? leaders[0].key : null;
  });

  goTo(index: number): void {
    this.stageIndex.set(Math.max(0, Math.min(this.stages.length - 1, index)));
    // On small screens the Next button sits far below the stage top, so bring the new stage into view.
    const el = this.stageEl()?.nativeElement;
    if (el && typeof el.scrollIntoView === 'function' && el.getBoundingClientRect().top < 0) {
      el.scrollIntoView({ block: 'start' });
    }
  }

  addTag(): void {
    const tag = this.tagInput().trim().toLowerCase();
    if (!tag) return;
    if (this.tags().includes(tag)) {
      this.tagError.set(`“${tag}” is already added`);
      return;
    }
    if (this.tags().length >= MAX_TAGS) {
      this.tagError.set(`You can add at most ${MAX_TAGS} tags`);
      return;
    }
    this.tags.update(t => [...t, tag.slice(0, MAX_TAG_LENGTH)]);
    this.tagInput.set('');
    this.tagError.set(null);
  }

  removeTag(tag: string): void {
    this.tags.update(t => t.filter(x => x !== tag));
    this.tagError.set(null);
  }

  onTagKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addTag();
    }
  }

  postChallenge(): void {
    if (this.posted()) return;
    this.posted.set(true);
    const tags = this.tags();
    this.addLog('🎯', `Challenge posted${tags.length ? ' · tagged ' + tags.map(t => '#' + t).join(' ') : ''}`);
    if (tags.length) this.addLog('🔎', 'Tags help people find it when browsing and searching challenges');
  }

  voteIdea(idea: Idea): void {
    if (idea.mine) {
      this.ownVoteBlocked.set(true);
      return;
    }
    this.ownVoteBlocked.set(false);
    const voted = !this.ideaVotes()[idea.id];
    this.trackRankUp(() => this.ideaVotes.update(v => ({ ...v, [idea.id]: voted })));
    this.addLog(voted ? '👍' : '↩️', voted
      ? `Upvoted “${idea.title}” → +1 rep to @${idea.author}`
      : `Upvote removed from “${idea.title}” → −1 rep to @${idea.author}`);
  }

  letCommunityVote(): void {
    if (this.communityVoted()) return;
    this.addLog('👥', `The community voted: +${COMMUNITY_BOOST} on each of the other ideas, reputation flows to their authors`);
    this.trackRankUp(() => this.communityVoted.set(true));
  }

  resolveProposal(accept: boolean): void {
    this.proposal.set(accept ? 'accepted' : 'rejected');
    this.addLog(accept ? '✅' : '✖️', accept
      ? 'Proposal by @maya merged — a new draft revision was saved'
      : 'Proposal by @maya rejected — the draft stays as it was');
  }

  castDraftVote(value: 1 | -1): void {
    const next: Vote = this.draftVote() === value ? 0 : value;
    this.draftVote.set(next);
    this.addLog(next === 1 ? '✓' : next === -1 ? '✕' : '↩️',
      next === 0 ? 'Your vote on the draft was withdrawn' : `You ${next === 1 ? 'support' : 'oppose'} the drafted article`);
  }

  recommend(key: string): void {
    const on = !this.recommended()[key];
    this.recommended.update(r => ({ ...r, [key]: on }));
    const title = this.actions.find(a => a.key === key)!.title;
    this.addLog('⭐', on ? `You recommended ${title}` : `Recommendation for ${title} removed`);
  }

  approveLeader(): void {
    const key = this.leader();
    if (!key) return;
    this.activated.set(key);
    const title = this.actions.find(a => a.key === key)!.title;
    this.addLog('🛡️', `An admin approved ${title} — its tools are now live on the challenge`);
  }

  reset(): void {
    this.stageIndex.set(0);
    this.tags.set([...DEFAULT_TAGS]);
    this.tagInput.set('');
    this.tagError.set(null);
    this.posted.set(false);
    this.ideaVotes.set({});
    this.communityVoted.set(false);
    this.ownVoteBlocked.set(false);
    this.proposal.set('pending');
    this.draftVote.set(0);
    this.recommended.set({});
    this.activated.set(null);
    this.log.set([]);
  }

  private scoreOf(idea: Idea): number {
    const boost = this.communityVoted() && !idea.mine ? COMMUNITY_BOOST : 0;
    return idea.base + boost + (this.ideaVotes()[idea.id] ? 1 : 0);
  }

  private rankOf(rep: number) {
    return [...RANKS].reverse().find(r => rep >= r.min)!;
  }

  private trackRankUp(change: () => void): void {
    const before = this.authorRank();
    change();
    const after = this.authorRank();
    if (after !== before) {
      const up = RANKS.findIndex(r => r.title === after) > RANKS.findIndex(r => r.title === before);
      this.addLog(up ? '🏅' : '📉', `@maya ${up ? 'ranked up' : 'dropped'} to ${after}`);
    }
  }

  private addLog(icon: string, text: string): void {
    this.log.update(l => [{ id: ++this.logId, icon, text }, ...l].slice(0, 8));
  }
}
