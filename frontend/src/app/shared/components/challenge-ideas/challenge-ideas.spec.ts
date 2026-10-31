import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChallengeIdeas } from './challenge-ideas';
import { Idea } from '../../models/baseModels';

describe('ChallengeIdeas', () => {
  let component: ChallengeIdeas;
  let fixture: ComponentFixture<ChallengeIdeas>;

  const mockIdeas: Idea[] = [
    {
      id: 'idea-1',
      title: 'Test Idea 1',
      description: 'Description 1',
      author: 'Author 1',
      votes: 100,
      category: 'Environment',
      status: 'New',
      createdAt: new Date('2025-01-01'),
      challengeId: 'challenge-1'
    },
    {
      id: 'idea-2',
      title: 'Test Idea 2',
      description: 'Description 2',
      author: 'Author 2',
      votes: 50,
      category: 'Technology',
      status: 'Under Review',
      createdAt: new Date('2025-01-15'),
      challengeId: 'challenge-1'
    },
    {
      id: 'idea-3',
      title: 'Test Idea 3',
      description: 'Description 3',
      author: 'Author 3',
      votes: 75,
      category: 'Environment',
      status: 'In Development',
      createdAt: new Date('2025-02-01'),
      challengeId: 'challenge-2'
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChallengeIdeas]
    }).compileComponents();

    fixture = TestBed.createComponent(ChallengeIdeas);
    component = fixture.componentInstance;
    component.challengeId = 'challenge-1';
    component.allIdeas = mockIdeas;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should filter ideas by challengeId', () => {
    component.ngOnInit();
    expect(component.filteredIdeas.length).toBe(2);
    expect(component.filteredIdeas.every(idea => idea.challengeId === 'challenge-1')).toBe(true);
  });

  it('should sort ideas by votes descending by default', () => {
    component.ngOnInit();
    expect(component.filteredIdeas[0].votes).toBe(100);
    expect(component.filteredIdeas[1].votes).toBe(50);
  });

  it('should limit displayed ideas to 3 in compact mode', () => {
    component.compact = true;
    component.isExpanded = false;
    component.ngOnInit();
    expect(component.displayedIdeas.length).toBeLessThanOrEqual(3);
  });

  it('should expand to show all ideas when toggled', () => {
    component.compact = true;
    component.ngOnInit();
    const initialCount = component.displayedIdeas.length;
    component.toggleExpand();
    expect(component.isExpanded).toBe(true);
    expect(component.displayedIdeas.length).toBe(component.filteredIdeas.length);
  });

  it('should increment vote count when voting on idea', () => {
    const idea = mockIdeas[0];
    const initialVotes = idea.votes;
    component.onVoteIdea(idea.id);
    expect(idea.votes).toBe(initialVotes + 1);
  });

  it('should return correct status class', () => {
    expect(component.getStatusClass('New')).toBe('status-new');
    expect(component.getStatusClass('Under Review')).toBe('status-review');
    expect(component.getStatusClass('In Development')).toBe('status-development');
    expect(component.getStatusClass('Implemented')).toBe('status-implemented');
  });

  it('should filter by status', () => {
    component.filterStatus = 'New';
    component.filterAndSortIdeas();
    expect(component.filteredIdeas.every(idea => idea.status === 'New')).toBe(true);
  });

  it('should sort by recent date', () => {
    component.sortBy = 'recent';
    component.filterAndSortIdeas();
    expect(component.filteredIdeas[0].createdAt.getTime()).toBeGreaterThan(
      component.filteredIdeas[1].createdAt.getTime()
    );
  });
});
