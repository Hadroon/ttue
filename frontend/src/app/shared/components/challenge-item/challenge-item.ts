import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
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
export class ChallengeItem implements OnInit {
  @Input() challenge!: Challenge;
  @Input() allIdeas: Idea[] = [];
  @Input() allComments: Comment[] = [];
  @Output() voteChallenge = new EventEmitter<number>();
  @Output() voteIdea = new EventEmitter<string>();
  @Output() voteComment = new EventEmitter<string>();

  ngOnInit() {
    console.log('ChallengeItem initialized with challenge:', this.challenge);
    console.log('Challenge type:', typeof this.challenge);
    console.log('Challenge id:', this.challenge?.id);
    console.log('All ideas:', this.allIdeas);
    console.log('All comments:', this.allComments);
  }
  getIdeasCount(challengeId: number): number {
    return this.allIdeas.filter(idea => idea.challengeId === challengeId.toString()).length;
  }

  onVoteChallenge(challengeId: number): void {
    this.voteChallenge.emit(challengeId);
  }

  onVoteIdea(ideaId: string): void {
    this.voteIdea.emit(ideaId);
  }

  onVoteComment(commentId: string): void {
    this.voteComment.emit(commentId);
  }
}
