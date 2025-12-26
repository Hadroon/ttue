import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChallengeCard } from '../challenge-card/challenge-card';
import { ChallengeIdeas } from '../challenge-ideas/challenge-ideas';
import { Comments } from '../comments/comments';
import { Challenge, Idea, Comment } from '../../models/baseModels';

@Component({
  selector: 'app-challenge-item',
  standalone: true,
  imports: [CommonModule, ChallengeCard, ChallengeIdeas, Comments],
  templateUrl: './challenge-item.html',
  styleUrls: ['./challenge-item.css'],
})
export class ChallengeItem {
  @Input() challenge!: Challenge;
  @Input() allIdeas: Idea[] = [];
  @Input() allComments: Comment[] = [];
  @Output() voteChallenge = new EventEmitter<string>();

  getIdeasCount(challengeId: string): number {
    return this.allIdeas.filter(idea => idea.challengeId === challengeId).length;
  }

  onVoteChallenge(challengeId: string): void {
    this.voteChallenge.emit(challengeId);
  }
}
