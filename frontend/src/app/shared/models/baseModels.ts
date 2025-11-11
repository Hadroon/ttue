export interface Idea {
  id: string;
  title: string;
  description: string;
  author: string;
  votes: number;
  category: string;
  status: 'New' | 'Under Review' | 'In Development' | 'Implemented';
  createdAt: Date;
}

export interface Challenge {
  id: string;
  category: string;
  title: string;
  description: string;
  urgency: 'Low' | 'Medium' | 'High' | 'Critical';
  participantCount: number;
  rewardPool?: string;
  deadline?: Date;
  tags: string[];
}