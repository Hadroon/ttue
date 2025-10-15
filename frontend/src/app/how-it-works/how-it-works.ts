import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Header } from '../shared/components';

@Component({
  selector: 'app-how-it-works',
  imports: [RouterLink, Header],
  templateUrl: './how-it-works.html',
  styleUrl: './how-it-works.css'
})
export class HowItWorks {

}
