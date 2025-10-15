import { Component, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class Header {
  private navOpen = false;

  constructor(private elementRef: ElementRef) {}

  toggleNav() {
    this.navOpen = !this.navOpen;
    if (this.navOpen) {
      this.elementRef.nativeElement.classList.add('nav-open');
    } else {
      this.elementRef.nativeElement.classList.remove('nav-open');
    }
    
    const toggle = this.elementRef.nativeElement.querySelector('.hamburger') as HTMLButtonElement;
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(this.navOpen));
    }
  }
}
