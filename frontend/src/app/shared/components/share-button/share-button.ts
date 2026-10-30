import { Component, ElementRef, HostListener, PLATFORM_ID, computed, inject, input, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

export type ShareParams = Record<string, string | number | null | undefined>;

interface ShareTarget {
  id: string;
  label: string;
  href: string;
}

@Component({
  selector: 'app-share-button',
  standalone: true,
  templateUrl: './share-button.html',
  styleUrl: './share-button.css'
})
export class ShareButton {
  /** Headline used as the shared title/subject */
  readonly title = input<string>('');
  readonly text = input<string>('');
  /** App route to share, e.g. '/article-workbench' */
  readonly path = input<string>('/');
  readonly queryParams = input<ShareParams>({});
  readonly fragment = input<string | null>(null);
  /** Shown next to the icon; leave empty for an icon-only button */
  readonly label = input<string>('');
  readonly ariaLabel = input<string>('Share');
  /** Share the page the user is on, including its query string and fragment */
  readonly currentPage = input<boolean>(false);
  /** Read just before the menu opens, for content that only the rendered page knows */
  readonly resolveContent = input<(() => { title?: string; text?: string }) | null>(null);

  readonly isOpen = signal(false);
  readonly copied = signal(false);
  readonly shareUrl = signal('');
  readonly canNativeShare = signal(false);
  private readonly resolved = signal<{ title?: string; text?: string } | null>(null);

  readonly effectiveTitle = computed(() => this.resolved()?.title || this.title());
  readonly effectiveText = computed(() => this.resolved()?.text || this.text());

  readonly plainText = computed(() => {
    const raw = this.effectiveText();
    if (!raw) {
      return '';
    }
    const decoded = raw.includes('<') && this.isBrowser
      ? (new DOMParser().parseFromString(raw, 'text/html').body.textContent ?? '')
      : raw;
    const clean = decoded.replace(/\s+/g, ' ').trim();
    return clean.length > this.maxTextLength ? clean.slice(0, this.maxTextLength - 1).trimEnd() + '…' : clean;
  });

  readonly targets = computed<ShareTarget[]>(() => {
    const url = this.shareUrl();
    if (!url) {
      return [];
    }
    const u = encodeURIComponent(url);
    const title = this.effectiveTitle() || 'Earth Forum';
    const t = encodeURIComponent(title);
    const summary = this.plainText();
    const withSummary = summary ? `${title}\n\n${summary}\n\n${url}` : `${title} ${url}`;
    return [
      { id: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(withSummary)}` },
      { id: 'x', label: 'X (Twitter)', href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
      { id: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
      { id: 'linkedin', label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
      // A text post lets the summary travel with the link; a link post would only carry the title
      {
        id: 'reddit',
        label: 'Reddit',
        href: `https://www.reddit.com/submit?type=TEXT&selftext=true&title=${t}&text=${encodeURIComponent(summary ? `${summary}\n\n${url}` : url)}`
      },
      { id: 'telegram', label: 'Telegram', href: `https://t.me/share/url?url=${u}&text=${encodeURIComponent(summary ? `${title}\n\n${summary}` : title)}` },
      { id: 'email', label: 'Email', href: `mailto:?subject=${t}&body=${encodeURIComponent(summary ? `${summary}\n\n${url}` : url)}` },
    ];
  });

  private readonly maxTextLength = 300;

  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private copiedTimer?: ReturnType<typeof setTimeout>;

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    if (this.isOpen()) {
      this.isOpen.set(false);
      return;
    }
    this.resolved.set(this.resolveContent()?.() ?? null);
    this.shareUrl.set(this.buildUrl());
    this.canNativeShare.set(this.isBrowser && typeof navigator !== 'undefined' && typeof navigator.share === 'function');
    this.copied.set(false);
    this.isOpen.set(true);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen() && !this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    this.isOpen.set(false);
  }

  async copyLink(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const url = this.shareUrl();
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      ok = this.legacyCopy(url);
    }
    if (ok) {
      this.copied.set(true);
      clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => this.copied.set(false), 2000);
    }
  }

  async nativeShare(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.isOpen.set(false);
    try {
      await navigator.share({ title: this.effectiveTitle() || undefined, text: this.plainText() || undefined, url: this.shareUrl() });
    } catch {
      // The user dismissed the share sheet
    }
  }

  closeMenu(): void {
    this.isOpen.set(false);
  }

  private buildUrl(): string {
    if (!this.isBrowser) {
      return '';
    }
    if (this.currentPage()) {
      return window.location.origin + this.router.url;
    }
    const queryParams: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(this.queryParams())) {
      if (value != null && value !== '') {
        queryParams[key] = value;
      }
    }
    const tree = this.router.createUrlTree([this.path()], {
      queryParams,
      fragment: this.fragment() ?? undefined
    });
    return window.location.origin + this.router.serializeUrl(tree);
  }

  private legacyCopy(text: string): boolean {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}
