import { Routes } from '@angular/router';
import { Home } from './home/home';
import { HowItWorks } from './how-it-works/how-it-works';
import { ArticleWorkbench } from './article-workbench/article-workbench';
import { Test } from './test/test';
import { Challenges } from './challenges/challenges';

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
    path: 'article-workbench',
    component: ArticleWorkbench
  },
  {
    path: 'challenges',
    component: Challenges
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
