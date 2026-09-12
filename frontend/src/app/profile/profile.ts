import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Header } from '../shared/components';
import { AuthService } from '../shared/services/auth.service';

@Component({
  selector: 'app-profile',
  imports: [DatePipe, Header, RouterLink],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile {
  readonly authService = inject(AuthService);
  readonly user = this.authService.currentUser;
  readonly initial = computed(() => {
    const user = this.user();
    return (user?.displayName || user?.username || '?').charAt(0).toUpperCase();
  });
}