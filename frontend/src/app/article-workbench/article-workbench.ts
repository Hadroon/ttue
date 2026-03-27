import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Inject, PLATFORM_ID, ViewChild, WritableSignal, signal, computed } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Header } from '../shared/components';
import { ApiService, Challenge, ChallengeDraft, ChallengeDraftRevision, ChallengeDraftProposal, Idea } from '../shared/services/api.service';
import { AuthService } from '../shared/services/auth.service';
import { ChallengeIdeas } from '../shared/components/challenge-ideas/challenge-ideas';
import { Idea as BaseIdea } from '../shared/models/baseModels';

type DiffKind = 'added' | 'removed' | 'unchanged';

interface DiffSegment {
  kind: DiffKind;
  text: string;
}

interface CommentThreadEntry {
  id: number;
  author: string;
  role: string;
  timestampLabel: string;
  content: string;
  votes: number;
}

interface RevisionSnapshot {
  id: number;
  label: string;
  summary: string;
  createdAtLabel: string;
}

@Component({
  selector: 'app-article-workbench',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, Header, ChallengeIdeas],
  templateUrl: './article-workbench.html',
  styleUrl: './article-workbench.css'
})
export class ArticleWorkbench implements AfterViewInit {
  @ViewChild('editorArea') private editorArea?: ElementRef<HTMLDivElement>;

  readonly isBrowser: boolean;
  readonly isEditing: WritableSignal<boolean> = signal(false);
  readonly activeSection: WritableSignal<string> = signal('draft');

  readonly previousDraft: WritableSignal<string> = signal('');
  readonly draftHtml: WritableSignal<string> = signal('');
  readonly noDraft: WritableSignal<boolean> = signal(false);

  readonly diffSegments = computed(() => this.createDiffSegments(
    this.stripHtml(this.previousDraft()),
    this.stripHtml(this.draftHtml())
  ));

  readonly diffStats = computed(() => {
    const segments = this.diffSegments();
    const added = this.countWordsForKind(segments, 'added');
    const removed = this.countWordsForKind(segments, 'removed');
    return { added, removed };
  });

  readonly revisions: WritableSignal<RevisionSnapshot[]> = signal([
    {
      id: 1,
      label: 'Revision 3 - Equity focus',
      summary: 'Elevated investment floor for frontline districts and added quarterly transparency metrics.',
      createdAtLabel: 'Oct 22, 2025'
    },
    {
      id: 2,
      label: 'Revision 2 - Infrastructure map',
      summary: 'Introduced mitigation timelines and procurement transparency requirements.',
      createdAtLabel: 'Oct 12, 2025'
    },
    {
      id: 3,
      label: 'Revision 1 - Initial fund setup',
      summary: 'Seeded the Climate Resilience Fund and defined advisory panel scope.',
      createdAtLabel: 'Oct 1, 2025'
    }
  ]);

  readonly comments: WritableSignal<CommentThreadEntry[]> = signal([
    {
      id: 101,
      author: 'Leah Kim',
      role: 'Community resilience organizer',
      timestampLabel: 'Oct 24, 2025 - 19:10',
      content: 'Love the quarterly dashboards. Recommend tying those metrics to rapid response budgets so agencies feel it.',
      votes: 42
    },
    {
      id: 102,
      author: 'Dr. Manuel Ortiz',
      role: 'Climate scientist',
      timestampLabel: 'Oct 23, 2025 - 08:55',
      content: 'Consider referencing the latest floodplain projections in Section II so mitigation targets map to observed risk shifts.',
      votes: 31
    }
  ]);

  readonly supportVotes: WritableSignal<number> = signal(284);
  readonly opposeVotes: WritableSignal<number> = signal(9);
  readonly userVote: WritableSignal<'support' | 'oppose' | null> = signal(null);

  commentDraft = '';

  readonly formattingActions = [
    { icon: 'B', label: 'Bold', command: 'bold' },
    { icon: 'I', label: 'Italic', command: 'italic' },
    { icon: 'U', label: 'Underline', command: 'underline' },
    { icon: 'UL', label: 'Bullets', command: 'insertUnorderedList' },
    { icon: '1.', label: 'Numbered', command: 'insertOrderedList' }
  ];

  readonly challengeId: WritableSignal<number | null> = signal(null);
  readonly challenge: WritableSignal<Challenge | null> = signal(null);
  readonly loadingChallenge: WritableSignal<boolean> = signal(false);
  readonly challengeError: WritableSignal<string | null> = signal(null);

  // Ideas state
  readonly ideas: WritableSignal<Idea[]> = signal([]);
  readonly ideasLoading: WritableSignal<boolean> = signal(false);
  readonly ideasError: WritableSignal<string | null> = signal(null);
  readonly ideasPage: WritableSignal<number> = signal(1);
  readonly ideasHasMore: WritableSignal<boolean> = signal(false);
  readonly ideasLimit = 50;

  readonly mappedIdeas = computed<BaseIdea[]>(() =>
    this.ideas().map(idea => ({
      id: String(idea.id),
      title: idea.title,
      description: idea.content || '',
      author: idea.authorDisplayName || idea.authorUsername || 'Anonymous',
      votes: idea.score,
      voted: idea.voted,
      status: 'New' as const,
      isMarked: idea.isMarked,
      createdAt: new Date(idea.createdAt || idea.created_at || Date.now()),
      challengeId: String(this.challengeId() ?? idea.challengeId ?? ''),
      category: ''
    }))
  );

  // Backend draft state
  readonly backendDraft: WritableSignal<ChallengeDraft | null> = signal(null);
  readonly loadingDraft: WritableSignal<boolean> = signal(false);
  readonly savingDraft: WritableSignal<boolean> = signal(false);
  readonly draftError: WritableSignal<string | null> = signal(null);
  readonly backendRevisions: WritableSignal<ChallengeDraftRevision[]> = signal([]);

  // Proposal state
  readonly proposals: WritableSignal<ChallengeDraftProposal[]> = signal([]);
  readonly selectedProposal: WritableSignal<ChallengeDraftProposal | null> = signal(null);
  readonly editingProposal: WritableSignal<boolean> = signal(false);
  readonly editedProposalContent: WritableSignal<string> = signal('');
  readonly loadingProposals: WritableSignal<boolean> = signal(false);

  readonly isDraftCreator = computed(() => {
    const draft = this.backendDraft();
    const user = this.authService.currentUser();
    return draft !== null && user !== null && draft.creatorId === user.id;
  });

  readonly pendingProposals = computed(() =>
    this.proposals().filter(p => p.status === 'pending')
  );

  readonly proposalDiffSegments = computed(() => {
    const proposal = this.selectedProposal();
    const draft = this.backendDraft();
    if (!proposal || !draft) return [];
    const proposalText = this.editingProposal()
      ? this.editedProposalContent()
      : proposal.content;
    return this.createDiffSegments(
      this.stripHtml(draft.content),
      this.stripHtml(proposalText)
    );
  });

  readonly proposalDiffStats = computed(() => {
    const segments = this.proposalDiffSegments();
    const added = this.countWordsForKind(segments, 'added');
    const removed = this.countWordsForKind(segments, 'removed');
    return { added, removed };
  });

  constructor(
    @Inject(PLATFORM_ID) private readonly platformId: object,
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private authService: AuthService
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    
    // Read challengeId from query parameters and fetch challenge
    this.route.queryParams.subscribe(params => {
      const id = params['challengeId'];
      if (id) {
        const numericId = Number(id);
        this.challengeId.set(numericId);
        console.log('Article Workbench loaded with challengeId:', id);
        this.fetchChallenge(numericId);
      }
    });
  }

  private fetchChallenge(id: number): void {
    this.loadingChallenge.set(true);
    this.challengeError.set(null);
    
    this.apiService.getChallenge(id).subscribe({
      next: (challenge) => {
        this.challenge.set(challenge);
        this.loadingChallenge.set(false);
        console.log('Challenge loaded:', challenge);
        // Load draft after challenge is loaded
        this.loadDraft(id);
        // Load ideas after challenge is loaded
        this.loadIdeas();
      },
      error: (error) => {
        console.error('Error loading challenge:', error);
        this.challengeError.set('Failed to load challenge');
        this.loadingChallenge.set(false);
      }
    });
  }

  private loadDraft(challengeId: number): void {
    this.loadingDraft.set(true);
    this.draftError.set(null);
    this.noDraft.set(false);
    
    this.apiService.getChallengeDraft(challengeId).subscribe({
      next: (draft: ChallengeDraft) => {
        this.backendDraft.set(draft);
        this.draftHtml.set(draft.content);
        this.previousDraft.set(draft.content);
        this.loadingDraft.set(false);
        console.log('Draft loaded:', draft);
        
        // Update editor if it exists
        if (this.editorArea) {
          this.editorArea.nativeElement.innerHTML = draft.content;
        }
        
        // Load revision history
        this.loadRevisions(challengeId);
        // Load proposals
        this.loadProposals(challengeId);
      },
      error: (error: any) => {
        this.loadingDraft.set(false);
        if (error.status === 404) {
          // No draft exists yet for this challenge
          this.noDraft.set(true);
          console.log('No draft exists for this challenge yet');
        } else {
          console.error('Error loading draft:', error);
          this.draftError.set('Failed to load draft');
        }
      }
    });
  }

  private loadRevisions(challengeId: number): void {
    this.apiService.getChallengeDraftRevisions(challengeId).subscribe({
      next: (revisions: ChallengeDraftRevision[]) => {
        this.backendRevisions.set(revisions);
        // Convert to local format for display
        this.revisions.set(revisions.map((rev, index) => ({
          id: rev.id,
          label: `Revision ${revisions.length - index} by ${rev.editorUsername}`,
          summary: this.makeSummary(this.stripHtml(rev.content)),
          createdAtLabel: new Date(rev.createdAt).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        })));
      },
      error: (error: any) => {
        console.error('Error loading revisions:', error);
      }
    });
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser || !this.editorArea) {
      return;
    }

    this.editorArea.nativeElement.innerHTML = this.draftHtml();
  }

  onEditorInput(): void {
    if (!this.editorArea) {
      return;
    }

    this.draftHtml.set(this.editorArea.nativeElement.innerHTML);
  }

  toggleEditMode(): void {
    this.isEditing.set(!this.isEditing());
    if (this.isEditing()) {
      // Sync content to DOM when entering edit mode
      setTimeout(() => {
        if (this.editorArea) {
          this.editorArea.nativeElement.innerHTML = this.draftHtml();
        }
      }, 0);
    }
  }

  scrollToSection(sectionId: string): void {
    if (!this.isBrowser) {
      return;
    }

    const element = document.getElementById(sectionId);
    if (element) {
      const navHeight = 64; // Height of page-nav
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - navHeight - 20;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });

      this.activeSection.set(sectionId);
    }
  }

  applyFormatting(command: string): void {
    if (!this.isBrowser) {
      return;
    }

    document.execCommand(command);
    this.syncDraftFromEditor();
  }

  formatBlock(tagName: string): void {
    if (!this.isBrowser) {
      return;
    }

    document.execCommand('formatBlock', false, tagName);
    this.syncDraftFromEditor();
  }

  insertLink(): void {
    if (!this.isBrowser) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.toString().trim().length === 0) {
      return;
    }

    const url = window.prompt('Enter link URL', 'https://');
    if (!url) {
      return;
    }

    document.execCommand('createLink', false, url);
    this.syncDraftFromEditor();
  }

  clearFormatting(): void {
    if (!this.isBrowser) {
      return;
    }

    document.execCommand('removeFormat');
    this.syncDraftFromEditor();
  }

  saveSnapshot(): void {
    const challengeId = this.challengeId();
    if (!challengeId) {
      console.error('No challenge ID available');
      return;
    }

    const content = this.draftHtml();
    const draft = this.backendDraft();
    
    this.savingDraft.set(true);
    this.draftError.set(null);

    if (draft) {
      // Update existing draft (or create proposal if non-creator)
      this.apiService.updateChallengeDraft(challengeId, content).subscribe({
        next: (response: any) => {
          if (response.type === 'proposal') {
            // Non-creator: a proposal was created instead
            this.savingDraft.set(false);
            console.log('Proposal submitted successfully');
            // Reload proposals to show the new one
            this.loadProposals(challengeId);
            // Revert editor to current draft content (proposal doesn't change active draft)
            this.draftHtml.set(this.previousDraft());
            this.updateEditorContent();
          } else {
            // Creator: draft updated directly
            const updatedDraft = response as ChallengeDraft;
            this.backendDraft.set(updatedDraft);
            this.previousDraft.set(content);
            this.savingDraft.set(false);
            console.log('Draft saved successfully');
            // Reload revisions to show the new one
            this.loadRevisions(challengeId);
          }
        },
        error: (error: any) => {
          console.error('Error saving draft:', error);
          this.draftError.set('Failed to save draft');
          this.savingDraft.set(false);
        }
      });
    } else {
      // Create new draft
      this.apiService.createChallengeDraft(challengeId, content).subscribe({
        next: (response: any) => {
          const newDraft = 'data' in response ? response.data : response;
          this.backendDraft.set(newDraft as ChallengeDraft);
          this.previousDraft.set(content);
          this.noDraft.set(false);
          this.savingDraft.set(false);
          console.log('Draft created successfully');
        },
        error: (error: any) => {
          console.error('Error creating draft:', error);
          this.draftError.set('Failed to create draft');
          this.savingDraft.set(false);
        }
      });
    }
  }

  private loadProposals(challengeId: number): void {
    this.loadingProposals.set(true);
    this.apiService.getDraftProposals(challengeId).subscribe({
      next: (proposals: ChallengeDraftProposal[]) => {
        this.proposals.set(proposals);
        this.loadingProposals.set(false);
      },
      error: (error: any) => {
        console.error('Error loading proposals:', error);
        this.loadingProposals.set(false);
      }
    });
  }

  loadIdeas(page?: number): void {
    const challengeId = this.challengeId();
    const targetPage = page ?? this.ideasPage();
    this.ideasLoading.set(true);
    this.ideasError.set(null);
    const offset = (targetPage - 1) * this.ideasLimit;
    this.apiService.getIdeas({ challengeId: challengeId ?? undefined, limit: this.ideasLimit, offset }).subscribe({
      next: (res) => {
        this.ideas.set(res.ideas);
        this.ideasHasMore.set(res.ideas.length === this.ideasLimit);
        this.ideasPage.set(targetPage);
        this.ideasLoading.set(false);
      },
      error: () => {
        this.ideasError.set('Failed to load ideas');
        this.ideasLoading.set(false);
      }
    });
  }

  nextIdeasPage(): void {
    if (this.ideasHasMore()) {
      this.loadIdeas(this.ideasPage() + 1);
    }
  }

  prevIdeasPage(): void {
    if (this.ideasPage() > 1) {
      this.loadIdeas(this.ideasPage() - 1);
    }
  }

  navigateToAddIdea(): void {
    const challengeId = this.challengeId();
    const extras = challengeId != null ? { queryParams: { challengeId } } : {};
    this.router.navigate(['/add-idea'], extras);
  }

  onVoteIdea(ideaId: string): void {
    const numId = Number(ideaId);
    this.apiService.voteIdea(numId).subscribe({
      next: (res) => {
        this.ideas.update(list =>
          list.map(idea => idea.id === numId ? { ...idea, score: res.score, voted: res.voted } : idea)
        );
      },
      error: () => {}
    });
  }

  selectProposal(proposal: ChallengeDraftProposal): void {
    this.selectedProposal.set(proposal);
    this.editingProposal.set(false);
    this.editedProposalContent.set(this.stripHtml(proposal.content));
  }

  clearProposalView(): void {
    this.selectedProposal.set(null);
    this.editingProposal.set(false);
  }

  toggleProposalEdit(): void {
    this.editingProposal.set(!this.editingProposal());
  }

  onProposalEditInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.editedProposalContent.set(target.value);
  }

  resolveProposal(action: 'accept' | 'reject'): void {
    const proposal = this.selectedProposal();
    const challengeId = this.challengeId();
    if (!proposal || !challengeId) return;

    const editedContent = this.editingProposal() ? this.editedProposalContent() : undefined;
    this.apiService.resolveDraftProposal(challengeId, proposal.id, action, editedContent).subscribe({
      next: (resolved: ChallengeDraftProposal) => {
        console.log(`Proposal ${action}ed successfully`);
        this.selectedProposal.set(null);
        // Reload draft if accepted (content changed)
        if (action === 'accept') {
          this.loadDraft(challengeId);
        }
        // Reload proposals to update statuses
        this.loadProposals(challengeId);
      },
      error: (error: any) => {
        console.error(`Error ${action}ing proposal:`, error);
        this.draftError.set(`Failed to ${action} proposal`);
      }
    });
  }

  revertToSnapshot(): void {
    this.draftHtml.set(this.previousDraft());
    this.updateEditorContent();
  }

  resetDraft(): void {
    this.draftHtml.set('');
    this.updateEditorContent();
  }

  publishDraft(): void {
    // For now, save as snapshot (same as saveSnapshot)
    // In future, this could publish to ideas/posts
    this.saveSnapshot();
  }

  castVote(choice: 'support' | 'oppose'): void {
    const current = this.userVote();
    if (current === choice) {
      return;
    }

    if (current === 'support') {
      this.supportVotes.update((value) => Math.max(0, value - 1));
    }

    if (current === 'oppose') {
      this.opposeVotes.update((value) => Math.max(0, value - 1));
    }

    if (choice === 'support') {
      this.supportVotes.update((value) => value + 1);
    } else {
      this.opposeVotes.update((value) => value + 1);
    }

    this.userVote.set(choice);
  }

  submitComment(): void {
    const content = this.commentDraft.trim();
    if (!content) {
      return;
    }

    const entry: CommentThreadEntry = {
      id: Date.now(),
      author: 'You',
      role: 'Contributor',
      timestampLabel: this.buildTimestampLabel(new Date()),
      content,
      votes: 1
    };

    this.comments.update((current) => [entry, ...current]);
    this.commentDraft = '';
  }

  upvoteComment(id: number): void {
    this.comments.update((current) => current.map((comment) =>
      comment.id === id ? { ...comment, votes: comment.votes + 1 } : comment
    ));
  }

  private syncDraftFromEditor(): void {
    if (!this.editorArea) {
      return;
    }

    this.draftHtml.set(this.editorArea.nativeElement.innerHTML);
  }

  private updateEditorContent(): void {
    if (!this.editorArea) {
      return;
    }

    this.editorArea.nativeElement.innerHTML = this.draftHtml();
  }

  stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private countWordsForKind(segments: DiffSegment[], kind: DiffKind): number {
    return segments
      .filter((segment) => segment.kind === kind)
      .reduce((total, segment) => {
        const words = segment.text.split(/\s+/).filter(Boolean);
        return total + words.length;
      }, 0);
  }

  private createDiffSegments(previousText: string, currentText: string): DiffSegment[] {
    // Implements a lightweight LCS-based diff so the UI can highlight added and removed words.
    if (!previousText && !currentText) {
      return [];
    }

    const oldWords = previousText.split(/\s+/).filter(Boolean);
    const newWords = currentText.split(/\s+/).filter(Boolean);
    const m = oldWords.length;
    const n = newWords.length;

    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        if (oldWords[i] === newWords[j]) {
          dp[i][j] = dp[i + 1][j + 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    const segments: DiffSegment[] = [];
    let currentSegment: DiffSegment | null = null;

    const pushSegment = (kind: DiffKind, word: string) => {
      if (!currentSegment || currentSegment.kind !== kind) {
        if (currentSegment) {
          segments.push(currentSegment);
        }

        currentSegment = { kind, text: word };
      } else {
        currentSegment.text += ' ' + word;
      }
    };

    let i = 0;
    let j = 0;

    while (i < m && j < n) {
      if (oldWords[i] === newWords[j]) {
        pushSegment('unchanged', newWords[j]);
        i += 1;
        j += 1;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        pushSegment('removed', oldWords[i]);
        i += 1;
      } else {
        pushSegment('added', newWords[j]);
        j += 1;
      }
    }

    while (i < m) {
      pushSegment('removed', oldWords[i]);
      i += 1;
    }

    while (j < n) {
      pushSegment('added', newWords[j]);
      j += 1;
    }

    if (currentSegment) {
      segments.push(currentSegment);
    }

    return segments;
  }

  makeSummary(text: string): string {
    if (!text) {
      return 'Draft submitted with structural changes.';
    }

    const summary = text.slice(0, 140).trim();
  return summary.length < text.length ? summary + '...' : summary;
  }

  private buildTimestampLabel(date: Date): string {
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${month} ${day}, ${year} - ${hours}:${minutes}`;
  }
}
