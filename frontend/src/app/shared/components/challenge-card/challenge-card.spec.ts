import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChallengeCard } from './challenge-card';
import { Challenge } from '../../models/baseModels';

describe('ChallengeCard', () => {
  let component: ChallengeCard;
  let fixture: ComponentFixture<ChallengeCard>;

  const mockChallenge: Challenge = {
    id: 'test-challenge',
    category: 'Environment',
    title: 'Test Challenge',
    description: 'Test description',
    urgency: 'High',
    participantCount: 100,
    rewardPool: '$10,000',
    deadline: new Date('2025-12-31'),
    tags: ['test', 'example'],
    votes: 50
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChallengeCard]
    }).compileComponents();

    fixture = TestBed.createComponent(ChallengeCard);
    component = fixture.componentInstance;
    component.challenge = mockChallenge;
    component.ideasCount = 5;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display challenge information', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('h3').textContent).toContain('Test Challenge');
    expect(compiled.querySelector('.challenge-description').textContent).toContain('Test description');
  });

  it('should emit voteChallenge event when vote button is clicked', () => {
    spyOn(component.voteChallenge, 'emit');
    const voteButton = fixture.nativeElement.querySelector('.vote-btn-large');
    voteButton.click();
    expect(component.voteChallenge.emit).toHaveBeenCalledWith('test-challenge');
  });

  it('should return correct urgency class', () => {
    expect(component.getUrgencyClass('Critical')).toBe('urgency-critical');
    expect(component.getUrgencyClass('High')).toBe('urgency-high');
    expect(component.getUrgencyClass('Medium')).toBe('urgency-medium');
    expect(component.getUrgencyClass('Low')).toBe('urgency-low');
  });

  it('should format deadline correctly', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(component.formatDeadline(tomorrow)).toBe('Due tomorrow');

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    expect(component.formatDeadline(nextWeek)).toContain('days left');
  });
});
