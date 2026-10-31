import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';

// Focuses the host element right after it's first rendered (e.g. when revealed by an @if block).
@Directive({
  selector: '[appAutofocus]',
  standalone: true
})
export class AutofocusDirective {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  constructor() {
    afterNextRender(() => this.elementRef.nativeElement.focus());
  }
}
