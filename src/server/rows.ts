import type { Article, Claim, CoverageItem, EmailSender, FeedItem, Publication } from '../shared/types.js';

type Row = Record<string, unknown>;

export function mapPublication(row: Row): Publication {
  return {
    id: Number(row.id),
    name: String(row.name),
    baseUrl: String(row.base_url),
    feedUrl: String(row.feed_url),
    isPremium: Boolean(row.is_premium),
    active: Boolean(row.active),
    lastSyncAt: row.last_sync_at ? String(row.last_sync_at) : null,
    lastSyncStatus: row.last_sync_status ? String(row.last_sync_status) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapArticle(row: Row): Article {
  return {
    id: Number(row.id),
    publicationId: row.publication_id === null ? null : Number(row.publication_id),
    publicationName: row.publication_name ? String(row.publication_name) : null,
    title: String(row.title),
    url: String(row.url),
    guid: row.guid ? String(row.guid) : null,
    author: row.author ? String(row.author) : null,
    publishedAt: row.published_at ? String(row.published_at) : null,
    summary: row.summary ? String(row.summary) : null,
    contentText: row.content_text ? String(row.content_text) : null,
    source: row.source as Article['source'],
    isPremiumPreview: Boolean(row.is_premium_preview),
    needsFullText: Boolean(row.needs_full_text),
    accessLevel: (row.access_level ? String(row.access_level) : 'unknown') as Article['accessLevel'],
    fullTextStatus: (row.full_text_status ? String(row.full_text_status) : 'complete') as Article['fullTextStatus'],
    detectionEvidence: row.detection_evidence ? String(row.detection_evidence) : null,
    gmailMessageId: row.gmail_message_id ? String(row.gmail_message_id) : null,
    emailSender: row.email_sender ? String(row.email_sender) : null,
    emailLabels: row.email_labels ? String(row.email_labels) : null,
    qualityScore: Number(row.quality_score),
    relevanceScore: Number(row.relevance_score),
    importanceScore: Number(row.importance_score),
    rankingReason: row.ranking_reason ? String(row.ranking_reason) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapEmailSender(row: Row): EmailSender {
  return {
    id: Number(row.id),
    email: String(row.email),
    name: row.name ? String(row.name) : null,
    publicationId: row.publication_id === null ? null : Number(row.publication_id),
    trustStatus: row.trust_status as EmailSender['trustStatus'],
    lastImportedAt: row.last_imported_at ? String(row.last_imported_at) : null,
    lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapCoverageItem(row: Row): CoverageItem {
  const sender = mapEmailSender(row);
  return {
    sender,
    publicationName: row.publication_name ? String(row.publication_name) : null,
    articleCount: Number(row.article_count ?? 0),
    newestEmailArticleAt: row.newest_email_article_at ? String(row.newest_email_article_at) : null,
    newestRssOrArchiveAt: row.newest_rss_or_archive_at ? String(row.newest_rss_or_archive_at) : null,
    status: row.coverage_status as CoverageItem['status'],
    note: String(row.coverage_note)
  };
}

export function mapFeedItem(row: Row): FeedItem {
  return {
    ...mapArticle(row),
    claimCount: Number(row.claim_count ?? 0),
    publicationAccuracy: row.publication_accuracy === null ? null : Number(row.publication_accuracy)
  };
}

export function mapClaim(row: Row): Claim {
  return {
    id: Number(row.id),
    articleId: Number(row.article_id),
    publicationId: row.publication_id === null ? null : Number(row.publication_id),
    claimText: String(row.claim_text),
    claimType: String(row.claim_type),
    ticker: row.ticker ? String(row.ticker) : null,
    timeHorizon: row.time_horizon ? String(row.time_horizon) : null,
    dueDate: row.due_date ? String(row.due_date) : null,
    confidence: row.confidence ? String(row.confidence) : null,
    evidence: row.evidence ? String(row.evidence) : null,
    sourceSnippet: row.source_snippet ? String(row.source_snippet) : null,
    status: row.status as Claim['status'],
    outcomeNotes: row.outcome_notes ? String(row.outcome_notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}
