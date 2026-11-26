import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { HowItWorksDemo } from './demo';

describe('HowItWorksDemo', () => {
  let demo: HowItWorksDemo;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(HowItWorksDemo);
    fixture.detectChanges();
    demo = fixture.componentInstance;
  });

  it('toggles an idea upvote and moves the author reputation with it', () => {
    const maya = demo.ideas[0];
    const start = demo.authorRep();
    demo.voteIdea(maya);
    expect(demo.authorRep()).toBe(start + 1);
    demo.voteIdea(maya);
    expect(demo.authorRep()).toBe(start);
  });

  it('normalizes tags, rejects duplicates and caps at 10', () => {
    demo.tagInput.set('  Water ');
    demo.addTag();
    expect(demo.tags().filter(t => t === 'water').length).toBe(1);
    expect(demo.tagError()).toBeTruthy();
    for (let i = 0; i < 12; i++) { demo.tagInput.set(`t${i}`); demo.addTag(); }
    expect(demo.tags().length).toBe(10);
  });

  it('blocks voting on your own idea', () => {
    const mine = demo.ideas.find(i => i.mine)!;
    demo.voteIdea(mine);
    expect(demo.ownVoteBlocked()).toBeTrue();
    expect(demo.rankedIdeas().find(i => i.mine)!.score).toBe(mine.base);
  });

  it('ranks the author up once reputation crosses 100', () => {
    expect(demo.authorRank()).toBe('CITIZEN');
    demo.letCommunityVote();
    expect(demo.authorRank()).toBe('SCRIBE');
    expect(demo.log()[0].text).toContain('ranked up to SCRIBE');
  });

  it('only allows admin approval when one action clearly leads', () => {
    expect(demo.leader()).toBeNull();
    demo.approveLeader();
    expect(demo.activated()).toBeNull();

    demo.recommend('policy');
    expect(demo.leader()).toBe('policy');
    demo.approveLeader();
    expect(demo.activated()).toBe('policy');
    expect(demo.completed().actions).toBeTrue();
  });
});
