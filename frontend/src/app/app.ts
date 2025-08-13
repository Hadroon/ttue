import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HealthService } from './shared/services/health.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('earth-forum-app');
  healthStatus: string = '';

  constructor(private healthService: HealthService) {}

  getHealth() {
    this.healthService.getHealth().subscribe({
      next: (response) => {
        console.log('Health status:', response);
        this.healthStatus = response.status;
      },
      error: (error) => {
        console.error('Error fetching health status:', error);
      }
    });
  }
}
