import { Routes } from '@angular/router';
import { Home } from './home/home';
import { HowItWorks } from './how-it-works/how-it-works';

export const routes: Routes = [
  {
    path: '',
    component: Home
  },
  {
    path: 'how-it-works',
    component: HowItWorks
  },
  {
    path: '**',
    component: Home
  }
];
