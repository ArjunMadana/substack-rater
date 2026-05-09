import { simpleParser } from 'mailparser';
import { canonicalizeArticleUrl } from './url.js';
import { stripHtml, summarizeText } from './text.js';

export interface ParsedNewsletterEmail {
  senderEmail: string;
  senderName: string | null;
  subject: string;
  date: string | null;
  html: string;
  text: string;
  articleUrl: string | null;
  publicationName: string | null;
  summary: string | null;
}

const substackArticleUrlPattern = /https:\/\/[^\s"'<>]+\.substack\.com\/p\/[^\s"'<>?)]+/gi;

export function parseEmailAddress(input: string | undefined | null) {
  const value = input ?? '';
  const emailMatch = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const email = emailMatch?.[0].toLowerCase() ?? '';
  const name = value
    .replace(/<[^>]+>/g, '')
    .replace(email, '')
    .replace(/["']/g, '')
    .trim();

  return {
    email,
    name: name || null
  };
}

export function findCanonicalSubstackArticleUrl(input: string) {
  const matches = [...input.matchAll(substackArticleUrlPattern)].map((match) => canonicalizeArticleUrl(match[0]));
  return matches[0] ?? null;
}

export function isLikelySubstackPublicationSender(email: string) {
  const lower = email.toLowerCase();
  return lower.endsWith('@substack.com') && !['substack@substack.com', 'no-reply@substack.com'].includes(lower);
}

export async function parseNewsletterEmail(rawEmail: string): Promise<ParsedNewsletterEmail> {
  const parsed = await simpleParser(rawEmail);
  const parsedHtml = typeof parsed.html === 'string' ? parsed.html : '';
  const text = parsed.text || stripHtml(parsedHtml);
  const from = parseEmailAddress(parsed.from?.text);
  const articleUrl = findCanonicalSubstackArticleUrl(`${parsedHtml}\n${text}`);

  return {
    senderEmail: from.email,
    senderName: from.name,
    subject: parsed.subject ?? 'Untitled Substack article',
    date: parsed.date ? parsed.date.toISOString() : null,
    html: parsedHtml,
    text,
    articleUrl,
    publicationName: from.name,
    summary: summarizeText(text)
  };
}

export function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}
