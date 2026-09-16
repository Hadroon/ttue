import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CivicProfile } from '../shared/models/civic-profile';
import { ApiService } from '../shared/services/api.service';
import { AuthService } from '../shared/services/auth.service';
import { Profile } from './profile';

const publicProfile: CivicProfile = {
  identity: {
    id: 7,
    username: 'ada',
    displayName: 'Ada Citizen',
    bio: 'Open science contributor',
    avatarUrl: null,
    location: 'Europe',
    websiteUrl: null,
    joinedAt: '2026-01-02T00:00:00.000Z'
  },
  isOwner: false,
  civicStatus: {
    rank: 'SCRIBE',
    reputation: 120,
    nextRank: { title: 'TRIBUNE', minimumReputation: 500 },
    rankProgress: 0.05
  },
  reputationBreakdown: [
    {
      domainId: 1,
      domainSlug: 'open-science',
      domainName: 'Open Science',
      description: null,
      score: 120,
      lastActivityAt: '2026-09-01T00:00:00.000Z'
    }
  ],
  contributionCounts: {
    challenges: 1,
    ideas: 2,
    comments: 3,
    drafts: 1,
    acceptedProposals: 1
  },
  activity: {
    items: [{
      kind: 'idea',
      contentId: 4,
      title: 'Open research commons',
      summary: 'A transparent public research proposal.',
      status: 'Open',
      score: 12,
      challengeId: 2,
      domainName: 'Open Science',
      createdAt: '2026-09-01T00:00:00.000Z'
    }],
    total: 1,
    limit: 10,
    offset: 0,
    hasMore: false
  },
  reputationHistory: {
    rows: [],
    total: 0,
    limit: 10,
    offset: 0,
    hasMore: false
  }
};

describe('Profile', () => {
  let fixture: ComponentFixture<Profile>;
  let component: Profile;

  beforeEach(async () => {
    const apiService = jasmine.createSpyObj<ApiService>('ApiService', [
      'getCivicProfile',
      'getCivicActivity',
      'getReputationHistory',
      'updateCivicProfile'
    ]);
    apiService.getCivicProfile.and.returnValue(of(publicProfile));

    const authService = {
      currentUser: signal(null),
      isLoggedIn: signal(false),
      isAdmin: signal(false),
      logout: jasmine.createSpy('logout')
    };

    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ApiService, useValue: apiService },
        { provide: AuthService, useValue: authService },
        { provide: MatDialog, useValue: { open: jasmine.createSpy('open') } },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ username: 'ada' })) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Profile);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders public civic status without private account data', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Ada Citizen');
    expect(text).toContain('SCRIBE');
    expect(text).toContain('Open Science');
    expect(text).not.toContain('Private account detail');
  });

  it('switches to the contribution portfolio', () => {
    component.selectTab('contributions');
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Contribution portfolio');
    expect(text).toContain('Open research commons');
  });
});