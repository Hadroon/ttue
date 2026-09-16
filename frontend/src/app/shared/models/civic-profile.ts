export type CivicRank = 'CITIZEN' | 'SCRIBE' | 'TRIBUNE' | 'ARCHON';
export type CivicActivityKind = 'all' | 'challenge' | 'idea' | 'comment' | 'proposal';

export interface CivicDomain {
  id: number;
  slug: string;
  name: string;
  description: string | null;
}

export interface CivicIdentity {
  id: number;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  websiteUrl: string | null;
  joinedAt: string;
  email?: string;
}

export interface CivicStatus {
  rank: CivicRank;
  reputation: number;
  nextRank: { title: CivicRank; minimumReputation: number } | null;
  rankProgress: number;
}

export interface DomainReputation {
  domainId: number;
  domainSlug: string;
  domainName: string;
  description: string | null;
  score: number;
  lastActivityAt: string | null;
}

export interface ContributionCounts {
  challenges: number;
  ideas: number;
  comments: number;
  drafts: number;
  acceptedProposals: number;
}

export interface CivicActivity {
  kind: Exclude<CivicActivityKind, 'all'>;
  contentId: number;
  title: string;
  summary: string;
  status: string;
  score: number;
  challengeId: number | null;
  domainName: string;
  createdAt: string;
}

export interface ReputationEntry {
  id: number;
  amount: number;
  actionType: 'IDEA_VOTE' | 'COMMENT_VOTE' | 'CHALLENGE_VOTE';
  contentType: 'idea' | 'comment' | 'challenge';
  contentId: number;
  domainSlug: string;
  domainName: string;
  createdAt: string;
}

export interface Page<T> {
  items?: T[];
  rows?: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface CivicProfile {
  identity: CivicIdentity;
  isOwner: boolean;
  civicStatus: CivicStatus;
  reputationBreakdown: DomainReputation[];
  contributionCounts: ContributionCounts;
  activity: Page<CivicActivity>;
  reputationHistory: Page<ReputationEntry>;
}

export interface UpdateCivicProfile {
  displayName: string | null;
  bio: string | null;
  location: string | null;
  websiteUrl: string | null;
}