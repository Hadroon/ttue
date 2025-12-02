import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Comments } from './comments';
import { Comment } from '../../models/baseModels';

describe('Comments', () => {
  let component: Comments;
  let fixture: ComponentFixture<Comments>;

  const mockComments: Comment[] = [
    {
      id: 'comment-1',
      author: 'Alice Johnson',
      authorRole: 'Expert',
      content: 'Great challenge! I have some ideas to contribute.',
      createdAt: new Date('2025-11-20'),
      votes: 15,
      challengeId: 'climate-adaptation'
    },
    {
      id: 'comment-2',
      author: 'Bob Smith',
      content: 'What is the timeline for submissions?',
      createdAt: new Date('2025-11-22'),
      votes: 3,
      challengeId: 'climate-adaptation'
    },
    {
      id: 'reply-1',
      author: 'Challenge Organizer',
      authorRole: 'Organizer',
      content: 'Submissions are due by December 15th.',
      createdAt: new Date('2025-11-22'),
      votes: 8,
      parentId: 'comment-2',
      challengeId: 'climate-adaptation'
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Comments]
    }).compileComponents();

    fixture = TestBed.createComponent(Comments);
    component = fixture.componentInstance;
    component.entityId = 'climate-adaptation';
    component.entityType = 'challenge';
    component.allComments = mockComments;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should filter comments by challengeId', () => {
    component.ngOnInit();
    expect(component.filteredComments.length).toBe(2);
    expect(component.filteredComments.every(c => c.challengeId === 'climate-adaptation' && !c.parentId)).toBe(true);
  });

  it('should attach replies to parent comments', () => {
    component.ngOnInit();
    const parentComment = component.filteredComments.find(c => c.id === 'comment-2');
    expect(parentComment?.replies?.length).toBe(1);
    expect(parentComment?.replies?.[0].id).toBe('reply-1');
  });

  it('should sort comments by votes', () => {
    component.sortBy = 'votes';
    component.filterAndSortComments();
    expect(component.filteredComments[0].votes).toBeGreaterThanOrEqual(component.filteredComments[1].votes);
  });

  it('should toggle comment box', () => {
    expect(component.showCommentBox).toBe(false);
    component.toggleCommentBox();
    expect(component.showCommentBox).toBe(true);
    component.toggleCommentBox();
    expect(component.showCommentBox).toBe(false);
  });

  it('should submit new comment', () => {
    const initialLength = component.allComments.length;
    component.newCommentText = 'This is a test comment';
    component.submitComment();
    expect(component.allComments.length).toBe(initialLength + 1);
    expect(component.newCommentText).toBe('');
    expect(component.showCommentBox).toBe(false);
  });

  it('should vote on comment', () => {
    const comment = mockComments[0];
    const initialVotes = comment.votes;
    component.onVoteComment(comment.id);
    expect(comment.votes).toBe(initialVotes + 1);
    expect(comment.voted).toBe(true);
    component.onVoteComment(comment.id);
    expect(comment.votes).toBe(initialVotes);
    expect(comment.voted).toBe(false);
  });

  it('should format time correctly', () => {
    const now = new Date();
    const justNow = new Date(now.getTime() - 30000);
    expect(component.formatTimeAgo(justNow)).toBe('Just now');

    const fiveMinutesAgo = new Date(now.getTime() - 300000);
    expect(component.formatTimeAgo(fiveMinutesAgo)).toBe('5m ago');

    const twoHoursAgo = new Date(now.getTime() - 7200000);
    expect(component.formatTimeAgo(twoHoursAgo)).toBe('2h ago');
  });
});
