import { getDb } from './db.js';
import { mapArticle, mapClaim, mapCoverageItem, mapEmailSender, mapFeedItem, mapPublication } from './rows.js';
import type { Article, Claim, EmailSender, Publication, SenderTrustStatus } from '../shared/types.js';
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
  accessLevel?: string;
  fullTextStatus?: string;
  detectionEvidence?: string | null;
  gmailMessageId?: string | null;
  emailSender?: string | null;
  emailLabels?: string | null;
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

  const existing = getDb()
    .prepare('SELECT id FROM articles WHERE url = ? OR (gmail_message_id IS NOT NULL AND gmail_message_id = ?)')
    .get(input.url, input.gmailMessageId ?? null) as
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
             source = CASE
               WHEN ? = 'email_subscription' THEN ?
               WHEN source = 'rss' AND ? != 'rss' THEN ?
               ELSE source
             END,
             is_premium_preview = ?,
             needs_full_text = ?,
             access_level = ?,
             full_text_status = ?,
             detection_evidence = COALESCE(?, detection_evidence),
             gmail_message_id = COALESCE(?, gmail_message_id),
             email_sender = COALESCE(?, email_sender),
             email_labels = COALESCE(?, email_labels),
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
        input.source,
        input.source,
        input.isPremiumPreview ? 1 : 0,
        input.needsFullText ? 1 : 0,
        input.accessLevel ?? (input.isPremiumPreview ? 'premium_preview' : 'unknown'),
        input.fullTextStatus ?? (input.needsFullText ? 'needs_email_import' : 'complete'),
        input.detectionEvidence ?? null,
        input.gmailMessageId ?? null,
        input.emailSender ?? null,
        input.emailLabels ?? null,
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
        source, is_premium_preview, needs_full_text, access_level, full_text_status,
        detection_evidence, gmail_message_id, email_sender, email_labels, quality_score,
        relevance_score, importance_score, ranking_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      input.accessLevel ?? (input.isPremiumPreview ? 'premium_preview' : 'unknown'),
      input.fullTextStatus ?? (input.needsFullText ? 'needs_email_import' : 'complete'),
      input.detectionEvidence ?? null,
      input.gmailMessageId ?? null,
      input.emailSender ?? null,
      input.emailLabels ?? null,
      scores.qualityScore,
      scores.relevanceScore,
      scores.importanceScore,
      scores.rankingReason
    );
  return getArticle(Number(result.lastInsertRowid)) as Article;
}

export function getArticleByGmailMessageId(messageId: string) {
  const row = getDb()
    .prepare(
      `SELECT a.*, p.name AS publication_name
       FROM articles a
       LEFT JOIN publications p ON p.id = a.publication_id
       WHERE a.gmail_message_id = ?`
    )
    .get(messageId) as Record<string, unknown> | undefined;
  return row ? mapArticle(row) : null;
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
  const existing = getDb()
    .prepare('SELECT * FROM claims WHERE article_id = ? AND claim_text = ?')
    .get(input.articleId, input.claimText) as Record<string, unknown> | undefined;
  if (existing) {
    return mapClaim(existing);
  }

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

export function upsertEmailSender(input: {
  email: string;
  name?: string | null;
  publicationId?: number | null;
  trustStatus?: SenderTrustStatus;
}) {
  const normalizedEmail = input.email.toLowerCase();
  const existing = getDb().prepare('SELECT * FROM email_senders WHERE email = ?').get(normalizedEmail) as
    | Record<string, unknown>
    | undefined;

  if (existing) {
    getDb()
      .prepare(
        `UPDATE email_senders
         SET name = COALESCE(?, name),
             publication_id = COALESCE(?, publication_id),
             trust_status = COALESCE(?, trust_status),
             last_seen_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE email = ?`
      )
      .run(input.name ?? null, input.publicationId ?? null, input.trustStatus ?? null, normalizedEmail);
  } else {
    getDb()
      .prepare(
        `INSERT INTO email_senders (email, name, publication_id, trust_status, last_seen_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
      )
      .run(normalizedEmail, input.name ?? null, input.publicationId ?? null, input.trustStatus ?? 'pending');
  }

  return getEmailSender(normalizedEmail) as EmailSender;
}

export function getEmailSender(email: string) {
  const row = getDb()
    .prepare('SELECT * FROM email_senders WHERE email = ?')
    .get(email.toLowerCase()) as Record<string, unknown> | undefined;
  return row ? mapEmailSender(row) : null;
}

export function listEmailSenders() {
  const rows = getDb()
    .prepare('SELECT * FROM email_senders ORDER BY trust_status ASC, email ASC')
    .all() as Record<string, unknown>[];
  return rows.map(mapEmailSender);
}

export function updateEmailSenderTrust(email: string, trustStatus: SenderTrustStatus, publicationId?: number | null) {
  getDb()
    .prepare(
      `UPDATE email_senders
       SET trust_status = ?, publication_id = COALESCE(?, publication_id), updated_at = CURRENT_TIMESTAMP
       WHERE email = ?`
    )
    .run(trustStatus, publicationId ?? null, email.toLowerCase());
  return getEmailSender(email) as EmailSender;
}

export function markEmailSenderImported(email: string, importedAt: string | null) {
  getDb()
    .prepare(
      `UPDATE email_senders
       SET last_imported_at = COALESCE(?, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE email = ?`
    )
    .run(importedAt, email.toLowerCase());
}

export function ignoreGmailMessage(input: { messageId: string; senderEmail?: string | null; subject?: string | null; reason?: string | null }) {
  getDb()
    .prepare(
      `INSERT INTO ignored_gmail_messages (message_id, sender_email, subject, reason, ignored_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(message_id) DO UPDATE SET
         sender_email = COALESCE(excluded.sender_email, sender_email),
         subject = COALESCE(excluded.subject, subject),
         reason = COALESCE(excluded.reason, reason),
         ignored_at = CURRENT_TIMESTAMP`
    )
    .run(input.messageId, input.senderEmail ?? null, input.subject ?? null, input.reason ?? null);
}

export function isGmailMessageIgnored(messageId: string) {
  const row = getDb().prepare('SELECT message_id FROM ignored_gmail_messages WHERE message_id = ?').get(messageId);
  return Boolean(row);
}

export function listCoverageItems(staleDays = 21) {
  const rows = getDb()
    .prepare(
      `SELECT
        s.*,
        p.name AS publication_name,
        COUNT(a.id) AS article_count,
        MAX(CASE WHEN a.source = 'email_subscription' THEN COALESCE(a.published_at, a.created_at) END) AS newest_email_article_at,
        MAX(CASE WHEN a.source IN ('rss', 'archive') THEN COALESCE(a.published_at, a.created_at) END) AS newest_rss_or_archive_at,
        CASE
          WHEN COUNT(CASE WHEN a.source = 'email_subscription' THEN 1 END) = 0 THEN 'no_email_articles'
          WHEN MAX(CASE WHEN a.source IN ('rss', 'archive') THEN COALESCE(a.published_at, a.created_at) END) >
               MAX(CASE WHEN a.source = 'email_subscription' THEN COALESCE(a.published_at, a.created_at) END) THEN 'rss_gap'
          WHEN julianday('now') - julianday(MAX(CASE WHEN a.source = 'email_subscription' THEN COALESCE(a.published_at, a.created_at) END)) > ? THEN 'stale'
          ELSE 'ok'
        END AS coverage_status,
        CASE
          WHEN COUNT(CASE WHEN a.source = 'email_subscription' THEN 1 END) = 0 THEN 'No Gmail articles imported for this trusted sender yet.'
          WHEN MAX(CASE WHEN a.source IN ('rss', 'archive') THEN COALESCE(a.published_at, a.created_at) END) >
               MAX(CASE WHEN a.source = 'email_subscription' THEN COALESCE(a.published_at, a.created_at) END) THEN 'RSS/archive has a newer article than Gmail.'
          WHEN julianday('now') - julianday(MAX(CASE WHEN a.source = 'email_subscription' THEN COALESCE(a.published_at, a.created_at) END)) > ? THEN 'No recent Gmail article imports for this sender.'
          ELSE 'Gmail coverage looks current.'
        END AS coverage_note
       FROM email_senders s
       LEFT JOIN publications p ON p.id = s.publication_id
       LEFT JOIN articles a ON LOWER(a.email_sender) = s.email
       WHERE s.trust_status = 'trusted'
       GROUP BY s.id
       ORDER BY coverage_status DESC, s.email ASC`
    )
    .all(staleDays, staleDays) as Record<string, unknown>[];
  return rows.map(mapCoverageItem);
}

export function getAppState(key: string) {
  const row = getDb().prepare('SELECT value FROM app_state WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setAppState(key: string, value: string) {
  getDb()
    .prepare(
      `INSERT INTO app_state (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
    )
    .run(key, value);
}
