import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home {
  toggleNav() {
    document.body.classList.toggle('nav-open');
    const toggle = document.querySelector('.hamburger') as HTMLButtonElement;
    if (toggle) {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
    }
  }
}
