import { Component, inject } from '@angular/core';
import { ConsentService } from '../../services/consent.service';

@Component({
  selector: 'app-cookie-banner',
  templateUrl: './cookie-banner.html',
  styleUrl: './cookie-banner.css'
})
export class CookieBanner {
  protected readonly consent = inject(ConsentService);
}
