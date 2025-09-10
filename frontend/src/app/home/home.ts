import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Header } from '../shared/components';

@Component({
  selector: 'app-home',
  imports: [RouterLink, Header],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home {

}
