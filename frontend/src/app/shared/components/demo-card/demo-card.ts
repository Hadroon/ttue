import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-demo-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './demo-card.html',
  styleUrl: './demo-card.css'
})
export class DemoCard {
  @Input() title: string = 'Public Tree Canopy Standard';
  @Input() category: string = 'Environment';
  @Input() status: string = 'Active';
  @Input() leadText: string = 'Building a better future at timetounite.earth — and we can\'t do it without you.';
  @Input() messageText: string = 'Your participation is what drives this mission forward. Have ideas on how we can better serve our planet and community?';
  @Input() strongText: string = 'We want to hear from you.';
  @Input() ctaText: string = 'Together, we can make a real difference.';
  @Input() votes: string = '2.8k';
  @Input() comments: string = '142';
  @Input() experts: string = '12';
  @Input() featured: boolean = true;
}
