import { simpleParser } from 'mailparser';
import {
  getArticle,
  getPublication,
  insertClaim,
  updatePublicationSync,
  upsertArticle,
  upsertPublication
} from '../repository.js';
import { archiveUrlForPublication, canonicalizeArticleUrl, normalizePublicationUrl } from './url.js';
import { parseRss } from './rss.js';
import { detectPartialArticleHtml, stripHtml, summarizeText } from './text.js';
import { discoverArchiveLinks, extractArticleText } from './archive.js';
import { getAiProvider } from './ai.js';

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'SubstackRater/0.1 (+local research tool)',
      Accept: 'text/html,application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8'
    }
  });

  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status}`);
  }

  return response.text();
}

export async function addPublication(input: { url: string; name?: string; isPremium?: boolean }) {
  const normalized = normalizePublicationUrl(input.url);
  const fallbackName = normalized.hostname.replace('.substack.com', '');

  return upsertPublication({
    name: input.name?.trim() || fallbackName,
    baseUrl: normalized.baseUrl,
    feedUrl: normalized.feedUrl,
    isPremium: Boolean(input.isPremium)
  });
}

export async function syncPublicationRss(publicationId: number) {
  const publication = getPublication(publicationId);
  if (!publication) {
    throw new Error('Publication not found');
  }

  const xml = await fetchText(publication.feedUrl);
  const items = parseRss(xml);
  const articles = items.map((item) => upsertArticle({ ...item, publicationId: publication.id }));
  updatePublicationSync(publication.id, `RSS synced ${articles.length} article(s)`);
  return articles;
}

export async function backfillPublicationArchive(publicationId: number, limit = 30) {
  const publication = getPublication(publicationId);
  if (!publication) {
    throw new Error('Publication not found');
  }

  const archiveHtml = await fetchText(archiveUrlForPublication(publication.baseUrl));
  const links = discoverArchiveLinks(archiveHtml, publication.baseUrl).slice(0, limit);
  const articles = [];

  for (const url of links) {
    try {
      const html = await fetchText(url);
      const text = extractArticleText(html);
      const title = stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? url);
      const partial = detectPartialArticleHtml({ html, articleUrl: url });
      const isPremiumPreview = partial.isPartial;
      articles.push(
        upsertArticle({
          publicationId: publication.id,
          title,
          url: canonicalizeArticleUrl(url),
          guid: null,
          author: publication.name,
          publishedAt: null,
          summary: summarizeText(text),
          contentText: text,
          source: 'archive',
          isPremiumPreview,
          needsFullText: isPremiumPreview,
          accessLevel: isPremiumPreview ? 'premium_preview' : 'public_full',
          fullTextStatus: isPremiumPreview ? 'needs_email_import' : 'complete',
          detectionEvidence: partial.evidence
        })
      );
    } catch {
      // Keep archive backfill best-effort so one bad post does not stop the run.
    }
  }

  updatePublicationSync(publication.id, `Archive backfilled ${articles.length} article(s)`);
  return articles;
}

export async function importEmail(input: { rawEmail?: string; pastedText?: string; publicationId?: number }) {
  const parsed = input.rawEmail ? await simpleParser(input.rawEmail) : null;
  const parsedHtml = typeof parsed?.html === 'string' ? parsed.html : '';
  const text = input.pastedText?.trim() || parsed?.text || stripHtml(parsedHtml);
  const subject = parsed?.subject || text.split('\n').find(Boolean)?.slice(0, 120) || 'Imported premium article';
  const articleUrl =
    parsedHtml.match(/https:\/\/[^\s"'<>]+\.substack\.com\/p\/[^\s"'<>]+/)?.[0] ??
    text.match(/https:\/\/[^\s]+\.substack\.com\/p\/[^\s]+/)?.[0] ??
    `manual-email://${Date.now()}`;
  const publication = input.publicationId ? getPublication(input.publicationId) : null;

  return upsertArticle({
    publicationId: publication?.id ?? null,
    title: subject,
    url: canonicalizeArticleUrl(articleUrl),
    guid: null,
    author: publication?.name ?? parsed?.from?.text ?? null,
    publishedAt: parsed?.date ? parsed.date.toISOString() : null,
    summary: summarizeText(text),
    contentText: text,
    source: 'email',
    isPremiumPreview: false,
    needsFullText: false,
    accessLevel: 'unknown',
    fullTextStatus: text.length > 500 ? 'complete' : 'parse_failed',
    detectionEvidence: 'Manual email/text import.'
  });
}

export async function extractClaimsForArticle(articleId: number) {
  const article = getArticle(articleId);
  if (!article || !article.contentText) {
    throw new Error('Article has no text to analyze');
  }

  const provider = getAiProvider();
  const extracted = await provider.extractClaims({ title: article.title, text: article.contentText });

  return extracted.map((claim) =>
    insertClaim({
      articleId: article.id,
      publicationId: article.publicationId,
      claimText: claim.claimText,
      claimType: claim.claimType,
      ticker: claim.ticker,
      timeHorizon: claim.timeHorizon,
      dueDate: claim.dueDate,
      confidence: claim.confidence,
      evidence: claim.evidence,
      sourceSnippet: claim.sourceSnippet
    })
  );
}
