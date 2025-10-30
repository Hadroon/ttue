import { Routes } from '@angular/router';
import { Home } from './home/home';
import { HowItWorks } from './how-it-works/how-it-works';
import { Test } from './test/test';

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
    path: 'test',
    component: Test
  },
  {
    path: '**',
    component: Home
  }
];
