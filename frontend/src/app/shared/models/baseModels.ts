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