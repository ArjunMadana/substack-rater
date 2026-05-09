export type ClaimStatus =
  | 'unresolved'
  | 'verified_true'
  | 'verified_false'
  | 'mixed'
  | 'expired_unresolved';

export type ArticleSource = 'rss' | 'archive' | 'email' | 'manual';

export interface Publication {
  id: number;
  name: string;
  baseUrl: string;
  feedUrl: string;
  isPremium: boolean;
  active: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Article {
  id: number;
  publicationId: number | null;
  publicationName: string | null;
  title: string;
  url: string;
  guid: string | null;
  author: string | null;
  publishedAt: string | null;
  summary: string | null;
  contentText: string | null;
  source: ArticleSource;
  isPremiumPreview: boolean;
  needsFullText: boolean;
  qualityScore: number;
  relevanceScore: number;
  importanceScore: number;
  rankingReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Claim {
  id: number;
  articleId: number;
  publicationId: number | null;
  claimText: string;
  claimType: string;
  ticker: string | null;
  timeHorizon: string | null;
  dueDate: string | null;
  confidence: string | null;
  evidence: string | null;
  sourceSnippet: string | null;
  status: ClaimStatus;
  outcomeNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeedItem extends Article {
  claimCount: number;
  publicationAccuracy: number | null;
}

export interface PublicationInput {
  url: string;
  name?: string;
  isPremium?: boolean;
}

export interface EmailImportInput {
  rawEmail?: string;
  pastedText?: string;
  publicationId?: number;
}
