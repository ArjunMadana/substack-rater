export type ClaimStatus =
  | 'unresolved'
  | 'verified_true'
  | 'verified_false'
  | 'mixed'
  | 'expired_unresolved';

export type ArticleSource = 'rss' | 'archive' | 'email' | 'email_subscription' | 'manual';
export type SenderTrustStatus = 'trusted' | 'ignored' | 'pending';
export type AccessLevel = 'public_full' | 'premium_preview' | 'premium_full' | 'unknown';
export type FullTextStatus = 'complete' | 'partial' | 'needs_email_import' | 'parse_failed';
export type ArticleAnalysisMode = 'credibility' | 'read_value' | 'both' | 'ignore';

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
  accessLevel: AccessLevel;
  fullTextStatus: FullTextStatus;
  detectionEvidence: string | null;
  gmailMessageId: string | null;
  emailSender: string | null;
  emailLabels: string | null;
  qualityScore: number;
  relevanceScore: number;
  importanceScore: number;
  credibilityScore: number;
  readValueScore: number;
  analysisMode: ArticleAnalysisMode;
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

export interface EmailSender {
  id: number;
  email: string;
  name: string | null;
  publicationId: number | null;
  trustStatus: SenderTrustStatus;
  lastImportedAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GmailCandidate {
  messageId: string;
  threadId: string | null;
  senderEmail: string;
  senderName: string | null;
  subject: string;
  receivedAt: string | null;
  labels: string[];
  articleUrl: string | null;
  publicationName: string | null;
  trustStatus: SenderTrustStatus;
  importStatus: 'candidate' | 'ignored' | 'already_imported';
  messageIgnored: boolean;
  reason: string;
}

export interface CoverageItem {
  sender: EmailSender;
  publicationName: string | null;
  articleCount: number;
  newestEmailArticleAt: string | null;
  newestRssOrArchiveAt: string | null;
  status: 'ok' | 'stale' | 'rss_gap' | 'no_email_articles';
  note: string;
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
