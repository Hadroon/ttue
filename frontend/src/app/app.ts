import { Component, inject, signal, WritableSignal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HealthResponse, HealthService } from './shared/services/health.service';
import { DonationReturnService } from './shared/services/donation-return.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('earth-forum-app');
  healthStatus: WritableSignal<HealthResponse> = signal({ status: '', timestamp: '' });

  constructor(private healthService: HealthService) {
    inject(DonationReturnService).init();
  }

  getHealth() {
    this.healthService.getHealth().subscribe({
      next: (response) => {
        console.log('Health status:', response);
        this.healthStatus.set(response);
      },
      error: (error) => {
        console.error('Error fetching health status:', error);
      }
    });
  }
}
