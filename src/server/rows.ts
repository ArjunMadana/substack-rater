import type { Article, Claim, FeedItem, Publication } from '../shared/types.js';

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
    qualityScore: Number(row.quality_score),
    relevanceScore: Number(row.relevance_score),
    importanceScore: Number(row.importance_score),
    rankingReason: row.ranking_reason ? String(row.ranking_reason) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
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
