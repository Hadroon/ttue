export interface Idea {
  id: string;
  title: string;
  description: string;
  author: string;
  votes: number;
  voted?: boolean;
  category: string;
  status: 'New' | 'Under Review' | 'In Development' | 'Implemented';
  createdAt: Date;
  challengeId?: string;
}

export interface Challenge {
  id: number;
  category: string;
  title: string;
  description: string;
  urgency: 'Low' | 'Medium' | 'High' | 'Critical';
  participantCount: number;
  rewardPool?: string;
  deadline?: Date | string;
  tags: string[];
  votes: number;
  voted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChallengeDraft {
  id: number;
  challengeId: number;
  creatorId: number;
  creatorUsername: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChallengeDraftRevision {
  id: number;
  draftId: number;
  editorId: number;
  editorUsername: string;
  content: string;
  createdAt: string;
}

export interface ChallengeDraftProposal {
  id: number;
  draftId: number;
  proposerId: number;
  proposerUsername: string;
  content: string;
  status: 'pending' | 'accepted' | 'rejected';
  resolvedAt: string | null;
  createdAt: string;
}

export interface Comment {
  id: string;
  author: string;
  authorRole?: string;
  content: string;
  createdAt: Date;
  votes: number;
  voted?: boolean;
  parentId?: string;
  replies?: Comment[];
  challengeId?: string;
  ideaId?: string;
}