import { Routes } from '@angular/router';
import { adminGuard } from './shared/guards/admin.guard';
import { authGuard } from './shared/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home/home').then(({ Home }) => Home)
  },
  {
    path: 'how-it-works',
    loadComponent: () => import('./how-it-works/how-it-works').then(({ HowItWorks }) => HowItWorks)
  },
  {
    path: 'article-workbench',
    loadComponent: () => import('./article-workbench/article-workbench').then(({ ArticleWorkbench }) => ArticleWorkbench)
  },
  {
    path: 'challenges',
    loadComponent: () => import('./challenges/challenges').then(({ Challenges }) => Challenges)
  },
  {
    path: 'add-challenge',
    loadComponent: () => import('./add-challenge/add-challenge').then(({ AddChallenge }) => AddChallenge)
  },
  {
    path: 'add-idea',
    loadComponent: () => import('./add-idea/add-idea').then(({ AddIdea }) => AddIdea)
  },
  {
    path: 'admin',
    loadComponent: () => import('./admin/admin').then(({ Admin }) => Admin),
    canActivate: [adminGuard]
  },
  {
    path: 'profile',
    loadComponent: () => import('./profile/profile').then(({ Profile }) => Profile),
    canActivate: [authGuard]
  },
  {
    path: 'profile/:username',
    loadComponent: () => import('./profile/profile').then(({ Profile }) => Profile)
  },
  {
    path: 'test',
    loadComponent: () => import('./test/test').then(({ Test }) => Test)
  },
  {
    path: '**',
    loadComponent: () => import('./home/home').then(({ Home }) => Home)
  }
];
