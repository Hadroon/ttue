import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChallengeGrid2x2 } from './challenge-grid-2x2';

describe('ChallengeGrid2x2', () => {
  let component: ChallengeGrid2x2;
  let fixture: ComponentFixture<ChallengeGrid2x2>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChallengeGrid2x2]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChallengeGrid2x2);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should limit ideas to maxIdeas', () => {
    component.ideas = [
      { id: '1', title: 'Idea 1', description: 'Desc 1', author: 'Author', votes: 10, category: 'Cat', status: 'New', createdAt: new Date() },
      { id: '2', title: 'Idea 2', description: 'Desc 2', author: 'Author', votes: 20, category: 'Cat', status: 'New', createdAt: new Date() },
      { id: '3', title: 'Idea 3', description: 'Desc 3', author: 'Author', votes: 30, category: 'Cat', status: 'New', createdAt: new Date() }
    ];
    component.maxIdeas = 2;
    
    expect(component.filteredIdeas.length).toBe(2);
  });

  it('should calculate total comments correctly', () => {
    component.comments = [
      { id: '1', author: 'User1', content: 'Comment 1', createdAt: new Date(), votes: 5 },
      { id: '2', author: 'User2', content: 'Comment 2', createdAt: new Date(), votes: 3 }
    ];
    
    expect(component.totalComments).toBe(2);
  });

  it('should emit challengeClick event', () => {
    spyOn(component.challengeClick, 'emit');
    component.challenge = { 
      id: 'test-challenge',
      category: 'Test',
      title: 'Test Challenge',
      description: 'Desc',
      urgency: 'High',
      participantCount: 100,
      tags: ['test'],
      votes: 50
    };
    
    component.onChallengeClick();
    
    expect(component.challengeClick.emit).toHaveBeenCalledWith('test-challenge');
  });

  it('should format deadline correctly', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    expect(component.formatDeadline(tomorrow)).toBe('1 day left');
  });

  it('should return correct urgency class', () => {
    expect(component.getUrgencyClass('Critical')).toBe('urgency-critical');
    expect(component.getUrgencyClass('High')).toBe('urgency-high');
    expect(component.getUrgencyClass('Medium')).toBe('urgency-medium');
    expect(component.getUrgencyClass('Low')).toBe('urgency-low');
  });

  it('should return correct status class', () => {
    expect(component.getStatusClass('New')).toBe('status-new');
    expect(component.getStatusClass('Under Review')).toBe('status-review');
    expect(component.getStatusClass('In Development')).toBe('status-development');
    expect(component.getStatusClass('Implemented')).toBe('status-implemented');
  });
});
