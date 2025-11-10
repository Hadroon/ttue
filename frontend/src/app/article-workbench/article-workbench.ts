import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Inject, PLATFORM_ID, ViewChild, WritableSignal, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Header } from '../shared/components';

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
  imports: [CommonModule, FormsModule, RouterLink, Header],
  templateUrl: './article-workbench.html',
  styleUrl: './article-workbench.css'
})
export class ArticleWorkbench implements AfterViewInit {
  @ViewChild('editorArea') private editorArea?: ElementRef<HTMLDivElement>;

  private readonly publishedHtml = `<p>Section I. Establish a Climate Resilience Fund focused on coastal defense pilots in three priority districts with annual reporting limited to flood mitigation metrics.</p><p>Section II. Direct the Infrastructure Directorate to catalog vulnerable assets and publish a summary of remediation costs without binding implementation targets.</p><p>Section III. Create an advisory panel composed of agency staff and invited experts to provide optional guidance on community relocation.</p>`;

  private readonly draftSeedHtml = `<h2>Citywide Climate Resilience and Justice Act</h2><p>Section I. Establish a Climate Resilience Fund to accelerate coastal, heat, and wildfire defenses in every district, beginning with communities facing the highest risk over the last five years.</p><p>The fund shall dedicate no less than 45% to frontline neighborhoods and must publish quarterly dashboards that track project progress, contractor diversity, and measurable risk reductions.</p><p>Section II. Direct the Infrastructure Directorate to map vulnerable assets, publish open procurement schedules, and co-design mitigation timelines with resident councils.</p><ul><li>Phase critical hospital and utility hardening within 18 months.</li><li>Deliver safe evacuation routes and cooling access by the second summer after passage.</li><li>Provide translation and accessibility for every public meeting.</li></ul><p>Section III. Establish a standing Community Adaptation Assembly with voting seats for residents, planners, public health professionals, and small business owners.</p><p>The Assembly shall publish binding recommendations, diff reports comparing revisions, and score departmental compliance each quarter.</p>`;

  readonly isBrowser: boolean;

  readonly previousDraft: WritableSignal<string> = signal(this.publishedHtml);
  readonly draftHtml: WritableSignal<string> = signal(this.draftSeedHtml);

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

  constructor(@Inject(PLATFORM_ID) private readonly platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
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
    this.previousDraft.set(this.draftHtml());
  }

  revertToSnapshot(): void {
    this.draftHtml.set(this.previousDraft());
    this.updateEditorContent();
  }

  resetDraft(): void {
    this.draftHtml.set(this.draftSeedHtml);
    this.updateEditorContent();
  }

  publishDraft(): void {
    const html = this.draftHtml();
    const summary = this.makeSummary(this.stripHtml(html));

    this.revisions.update((current) => [
      {
        id: Date.now(),
    label: 'Revision ' + (current.length + 1) + ' - Submitted',
        summary,
        createdAtLabel: this.buildTimestampLabel(new Date())
      },
      ...current
    ]);

    this.previousDraft.set(html);
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

  private stripHtml(html: string): string {
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

  private makeSummary(text: string): string {
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
