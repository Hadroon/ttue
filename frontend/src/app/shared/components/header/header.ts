import { Component, ElementRef, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { SigninModalComponent } from '../signin-modal/signin-modal';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class Header {
  private navOpen = false;
  private elementRef = inject(ElementRef);
  private dialog = inject(MatDialog);
  readonly authService = inject(AuthService);
  // toggleNav
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

  openSignInModal() {
    this.dialog.open(SigninModalComponent, {
      width: '400px',
      panelClass: 'signin-modal',
      data: {
        title: 'Sign In',
        message: 'Sign in to participate in discussions and create proposals'
      }
    });
  }

  logout() {
    this.authService.logout();
  }
}
