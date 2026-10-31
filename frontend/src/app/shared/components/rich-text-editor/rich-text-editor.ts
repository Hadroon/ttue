import {
  AfterViewInit,
  Component,
  ElementRef,
  PLATFORM_ID,
  booleanAttribute,
  forwardRef,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

type FormatCommand = 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList';

interface ToolbarAction {
  command: FormatCommand;
  label: string;
  icon: string;
}

let nextId = 0;

@Component({
  selector: 'app-rich-text-editor',
  templateUrl: './rich-text-editor.html',
  styleUrl: './rich-text-editor.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextEditor),
      multi: true
    }
  ]
})
export class RichTextEditor implements ControlValueAccessor, AfterViewInit {
  readonly label = input<string>('');
  readonly placeholder = input<string>('');
  readonly required = input(false, { transform: booleanAttribute });
  readonly minHeight = input<string>('180px');

  readonly labelId = `rte-label-${nextId++}`;

  readonly actions: ToolbarAction[] = [
    { command: 'bold', label: 'Bold', icon: 'format_bold' },
    { command: 'italic', label: 'Italic', icon: 'format_italic' },
    { command: 'underline', label: 'Underline', icon: 'format_underlined' },
    { command: 'insertUnorderedList', label: 'Bulleted list', icon: 'format_list_bulleted' },
    { command: 'insertOrderedList', label: 'Numbered list', icon: 'format_list_numbered' }
  ];

  readonly activeCommands = signal<ReadonlySet<FormatCommand>>(new Set());
  readonly isEmpty = signal(true);
  readonly isFocused = signal(false);
  readonly disabled = signal(false);

  readonly linkPanelOpen = signal(false);
  readonly linkUrl = signal('');
  readonly linkError = signal('');

  private readonly surface = viewChild.required<ElementRef<HTMLDivElement>>('surface');
  private readonly linkInput = viewChild<ElementRef<HTMLInputElement>>('linkInput');
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private viewReady = false;
  private pendingValue = '';
  private savedRange: Range | null = null;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.render(this.pendingValue);
  }

  writeValue(value: string | null): void {
    // Reactive forms may call this before the view exists
    this.pendingValue = value ?? '';
    if (this.viewReady) {
      this.render(this.pendingValue);
    }
  }

  private render(html: string): void {
    this.surface().nativeElement.innerHTML = html;
    this.isEmpty.set(this.isContentEmpty());
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  onFocus(): void {
    this.isFocused.set(true);
    // Make Enter create <p> instead of <div>
    document.execCommand('defaultParagraphSeparator', false, 'p');
  }

  onBlur(): void {
    this.isFocused.set(false);
    this.onTouched();
  }

  onInput(): void {
    const empty = this.isContentEmpty();
    this.isEmpty.set(empty);
    this.onChange(empty ? '' : this.surface().nativeElement.innerHTML);
  }

  onPaste(event: ClipboardEvent): void {
    // Paste as plain text to keep markup minimal and predictable
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, text);
  }

  apply(command: FormatCommand): void {
    if (!this.isBrowser || this.disabled()) {
      return;
    }
    this.surface().nativeElement.focus();
    document.execCommand(command);
    this.refreshActiveState();
    this.onInput();
  }

  openLinkPanel(): void {
    if (!this.isBrowser || this.disabled()) {
      return;
    }
    const surface = this.surface().nativeElement;
    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    if (range && surface.contains(range.commonAncestorContainer)) {
      this.savedRange = range.cloneRange();
    } else {
      // No caret in the editor yet: insert at the end
      this.savedRange = document.createRange();
      this.savedRange.selectNodeContents(surface);
      this.savedRange.collapse(false);
    }

    const existing = this.findAnchor(this.savedRange.commonAncestorContainer);
    this.linkUrl.set(existing?.getAttribute('href') ?? '');
    this.linkError.set('');
    this.linkPanelOpen.set(true);
    setTimeout(() => this.linkInput()?.nativeElement.focus());
  }

  applyLink(): void {
    const url = this.normalizeUrl(this.linkUrl());
    if (!url) {
      this.linkError.set('Enter a valid web address, e.g. example.com');
      return;
    }

    this.restoreSelection();
    const existing = this.savedRange && this.findAnchor(this.savedRange.commonAncestorContainer);
    if (existing) {
      existing.setAttribute('href', url);
    } else if (this.savedRange?.collapsed) {
      this.insertLinkAtCaret(this.savedRange, url);
    } else {
      document.execCommand('createLink', false, url);
    }
    this.surface().nativeElement.querySelectorAll('a').forEach(a => {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    });
    this.closeLinkPanel();
    this.onInput();
  }

  removeLink(): void {
    this.restoreSelection();
    const existing = this.savedRange && this.findAnchor(this.savedRange.commonAncestorContainer);
    if (existing) {
      existing.replaceWith(...Array.from(existing.childNodes));
    } else {
      document.execCommand('unlink');
    }
    this.closeLinkPanel();
    this.onInput();
  }

  cancelLink(): void {
    this.restoreSelection();
    this.closeLinkPanel();
  }

  onLinkKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.applyLink();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelLink();
    }
  }

  onLinkUrlInput(value: string): void {
    this.linkUrl.set(value);
    this.linkError.set('');
  }

  hasExistingLink(): boolean {
    return !!(this.savedRange && this.findAnchor(this.savedRange.commonAncestorContainer));
  }

  private closeLinkPanel(): void {
    this.linkPanelOpen.set(false);
    this.savedRange = null;
  }

  private restoreSelection(): void {
    if (!this.savedRange) {
      return;
    }
    this.surface().nativeElement.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(this.savedRange);
  }

  private findAnchor(node: Node | null): HTMLAnchorElement | null {
    const surface = this.surface().nativeElement;
    let current: Node | null = node;
    while (current && current !== surface) {
      if (current instanceof HTMLAnchorElement) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  }

  private normalizeUrl(raw: string): string | null {
    let value = raw.trim();
    if (!value || /\s/.test(value)) {
      return null;
    }
    if (/^[^@/:]+@[^@/]+\.[^@/]+$/.test(value)) {
      value = `mailto:${value}`;
    } else if (value.startsWith('//')) {
      value = `https:${value}`;
    } else if (!/^([a-z][a-z0-9+.-]*:\/\/|mailto:)/i.test(value)) {
      value = `https://${value}`;
    }

    try {
      const url = new URL(value);
      if (url.protocol === 'mailto:') {
        return value;
      }
      // Only web links, and the host must look like a real domain (or localhost)
      if ((url.protocol === 'https:' || url.protocol === 'http:') &&
          (url.hostname.includes('.') || url.hostname === 'localhost')) {
        return url.href;
      }
    } catch {
      // fall through
    }
    return null;
  }

  private insertLinkAtCaret(range: Range, url: string): void {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.textContent = this.linkUrl().trim();
    range.insertNode(anchor);
    range.setStartAfter(anchor);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  clearFormatting(): void {
    if (!this.isBrowser || this.disabled()) {
      return;
    }
    document.execCommand('removeFormat');
    document.execCommand('unlink');
    this.refreshActiveState();
    this.onInput();
  }

  refreshActiveState(): void {
    if (!this.isBrowser) {
      return;
    }
    const active = new Set<FormatCommand>();
    for (const { command } of this.actions) {
      if (document.queryCommandState(command)) {
        active.add(command);
      }
    }
    this.activeCommands.set(active);
  }

  private isContentEmpty(): boolean {
    const el = this.surface().nativeElement;
    return (el.textContent ?? '').trim().length === 0 && !el.querySelector('li');
  }
}
