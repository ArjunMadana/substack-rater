import { getDb } from './db.js';
import { mapArticle, mapClaim, mapFeedItem, mapPublication } from './rows.js';
import type { Article, Claim, Publication } from '../shared/types.js';
import { scoreArticle } from './services/scoring.js';

interface ArticleInsert {
  publicationId: number | null;
  title: string;
  url: string;
  guid: string | null;
  author: string | null;
  publishedAt: string | null;
  summary: string | null;
  contentText: string | null;
  source: string;
  isPremiumPreview: boolean;
  needsFullText: boolean;
}

export function listPublications() {
  const rows = getDb()
    .prepare('SELECT * FROM publications ORDER BY name ASC')
    .all() as Record<string, unknown>[];
  return rows.map(mapPublication);
}

export function getPublication(id: number) {
  const row = getDb().prepare('SELECT * FROM publications WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? mapPublication(row) : null;
}

export function upsertPublication(input: {
  name: string;
  baseUrl: string;
  feedUrl: string;
  isPremium: boolean;
}) {
  const existing = getDb().prepare('SELECT * FROM publications WHERE base_url = ?').get(input.baseUrl) as
    | Record<string, unknown>
    | undefined;

  if (existing) {
    getDb()
      .prepare(
        `UPDATE publications
         SET name = ?, feed_url = ?, is_premium = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(input.name, input.feedUrl, input.isPremium ? 1 : 0, Number(existing.id));
    return getPublication(Number(existing.id)) as Publication;
  }

  const result = getDb()
    .prepare('INSERT INTO publications (name, base_url, feed_url, is_premium) VALUES (?, ?, ?, ?)')
    .run(input.name, input.baseUrl, input.feedUrl, input.isPremium ? 1 : 0);
  return getPublication(Number(result.lastInsertRowid)) as Publication;
}

export function updatePublicationSync(id: number, status: string) {
  getDb()
    .prepare(
      `UPDATE publications
       SET last_sync_at = CURRENT_TIMESTAMP, last_sync_status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .run(status, id);
}

export function upsertArticle(input: ArticleInsert) {
  const scores = scoreArticle({
    title: input.title,
    contentText: input.contentText,
    isPremiumPreview: input.isPremiumPreview
  });

  const existing = getDb().prepare('SELECT id FROM articles WHERE url = ?').get(input.url) as
    | { id: number }
    | undefined;

  if (existing) {
    getDb()
      .prepare(
        `UPDATE articles
         SET publication_id = COALESCE(?, publication_id),
             title = ?,
             guid = COALESCE(?, guid),
             author = COALESCE(?, author),
             published_at = COALESCE(?, published_at),
             summary = COALESCE(?, summary),
             content_text = CASE
               WHEN LENGTH(COALESCE(?, '')) > LENGTH(COALESCE(content_text, '')) THEN ?
               ELSE content_text
             END,
             source = CASE WHEN source = 'rss' AND ? != 'rss' THEN ? ELSE source END,
             is_premium_preview = ?,
             needs_full_text = ?,
             quality_score = ?,
             relevance_score = ?,
             importance_score = ?,
             ranking_reason = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(
        input.publicationId,
        input.title,
        input.guid,
        input.author,
        input.publishedAt,
        input.summary,
        input.contentText,
        input.contentText,
        input.source,
        input.source,
        input.isPremiumPreview ? 1 : 0,
        input.needsFullText ? 1 : 0,
        scores.qualityScore,
        scores.relevanceScore,
        scores.importanceScore,
        scores.rankingReason,
        existing.id
      );
    return getArticle(existing.id) as Article;
  }

  const result = getDb()
    .prepare(
      `INSERT INTO articles (
        publication_id, title, url, guid, author, published_at, summary, content_text,
        source, is_premium_preview, needs_full_text, quality_score, relevance_score,
        importance_score, ranking_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.publicationId,
      input.title,
      input.url,
      input.guid,
      input.author,
      input.publishedAt,
      input.summary,
      input.contentText,
      input.source,
      input.isPremiumPreview ? 1 : 0,
      input.needsFullText ? 1 : 0,
      scores.qualityScore,
      scores.relevanceScore,
      scores.importanceScore,
      scores.rankingReason
    );
  return getArticle(Number(result.lastInsertRowid)) as Article;
}

export function getArticle(id: number) {
  const row = getDb()
    .prepare(
      `SELECT a.*, p.name AS publication_name
       FROM articles a
       LEFT JOIN publications p ON p.id = a.publication_id
       WHERE a.id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapArticle(row) : null;
}

export function listFeed() {
  const rows = getDb()
    .prepare(
      `SELECT
        a.*,
        p.name AS publication_name,
        COUNT(c.id) AS claim_count,
        (
          SELECT CASE
            WHEN COUNT(*) = 0 THEN NULL
            ELSE ROUND(100.0 * SUM(CASE WHEN status = 'verified_true' THEN 1 ELSE 0 END) / COUNT(*))
          END
          FROM claims pc
          WHERE pc.publication_id = p.id
            AND pc.status IN ('verified_true', 'verified_false', 'mixed')
        ) AS publication_accuracy
       FROM articles a
       LEFT JOIN publications p ON p.id = a.publication_id
       LEFT JOIN claims c ON c.article_id = a.id
       GROUP BY a.id
       ORDER BY a.importance_score DESC, COALESCE(a.published_at, a.created_at) DESC
       LIMIT 200`
    )
    .all() as Record<string, unknown>[];
  return rows.map(mapFeedItem);
}

export function listClaims() {
  const rows = getDb()
    .prepare('SELECT * FROM claims ORDER BY updated_at DESC, id DESC')
    .all() as Record<string, unknown>[];
  return rows.map(mapClaim);
}

export function listClaimsForArticle(articleId: number) {
  const rows = getDb()
    .prepare('SELECT * FROM claims WHERE article_id = ? ORDER BY id ASC')
    .all(articleId) as Record<string, unknown>[];
  return rows.map(mapClaim);
}

export function insertClaim(input: Omit<Claim, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'outcomeNotes'>) {
  const result = getDb()
    .prepare(
      `INSERT INTO claims (
        article_id, publication_id, claim_text, claim_type, ticker, time_horizon,
        due_date, confidence, evidence, source_snippet
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.articleId,
      input.publicationId,
      input.claimText,
      input.claimType,
      input.ticker,
      input.timeHorizon,
      input.dueDate,
      input.confidence,
      input.evidence,
      input.sourceSnippet
    );
  const row = getDb().prepare('SELECT * FROM claims WHERE id = ?').get(Number(result.lastInsertRowid)) as Record<
    string,
    unknown
  >;
  return mapClaim(row);
}

export function updateClaimStatus(id: number, status: string, outcomeNotes: string | null) {
  getDb()
    .prepare(
      `UPDATE claims
       SET status = ?, outcome_notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .run(status, outcomeNotes, id);
  const row = getDb().prepare('SELECT * FROM claims WHERE id = ?').get(id) as Record<string, unknown>;
  return mapClaim(row);
}
