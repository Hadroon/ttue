import { Routes } from '@angular/router';
import { Home } from './home/home';
import { HowItWorks } from './how-it-works/how-it-works';
import { ArticleWorkbench } from './article-workbench/article-workbench';
import { Test } from './test/test';
import { Challenges } from './challenges/challenges';
import { AddChallenge } from './add-challenge/add-challenge';
import { AddIdea } from './add-idea/add-idea';
import { Admin } from './admin/admin';
import { adminGuard } from './shared/guards/admin.guard';

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
    path: 'add-challenge',
    component: AddChallenge
  },
  {
    path: 'add-idea',
    component: AddIdea
  },
  {
    path: 'admin',
    component: Admin,
    canActivate: [adminGuard]
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
