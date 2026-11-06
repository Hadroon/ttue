import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Header } from '../shared/components';

@Component({
  selector: 'app-terms',
  imports: [RouterLink, Header],
  templateUrl: './terms.html',
  styleUrl: './terms.css'
})
export class Terms {
  // Plain "#id" links resolve against <base href="/"> and would leave the page, so scroll in place.
  jumpTo(event: Event, id: string) {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
