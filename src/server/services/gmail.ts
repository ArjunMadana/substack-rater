import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config, isGmailConfigured } from '../config.js';
import {
  getAppState,
  getArticleByGmailMessageId,
  getEmailSender,
  ignoreGmailMessage,
  isGmailMessageIgnored,
  markEmailSenderImported,
  setAppState,
  upsertArticle,
  upsertEmailSender
} from '../repository.js';
import type { GmailCandidate } from '../../shared/types.js';
import { decodeBase64Url, isLikelySubstackPublicationSender, parseNewsletterEmail } from './email.js';

const tokenPath = path.resolve(process.cwd(), 'data', 'gmail-token.json');
const statePath = path.resolve(process.cwd(), 'data', 'gmail-oauth-state.txt');
const gmailScope = 'https://www.googleapis.com/auth/gmail.readonly';

interface GmailToken {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  scope?: string;
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
}

interface GmailMessage {
  id: string;
  threadId?: string;
  labelIds?: string[];
  raw?: string;
  internalDate?: string;
}

interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

function ensureDataDir() {
  fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
}

function readToken(): GmailToken | null {
  if (!fs.existsSync(tokenPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(tokenPath, 'utf8')) as GmailToken;
}

function writeToken(token: GmailToken) {
  ensureDataDir();
  fs.writeFileSync(tokenPath, JSON.stringify(token, null, 2));
}

export function getGmailStatus() {
  const token = readToken();
  return {
    configured: isGmailConfigured(),
    connected: Boolean(token?.refresh_token || token?.access_token),
    scope: gmailScope,
    grantedScope: token?.scope ?? null,
    accountEmail: getAppState('gmail_account_email'),
    lastScanAt: getAppState('gmail_last_scan_at'),
    lastScanNewestMessageAt: getAppState('gmail_last_scan_newest_message_at'),
    excludesSpamTrash: true,
    excludesPromotions: true,
    redirectUri: config.googleRedirectUri
  };
}

export function createGmailAuthUrl() {
  if (!isGmailConfigured()) {
    throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
  }

  ensureDataDir();
  const state = crypto.randomBytes(18).toString('hex');
  fs.writeFileSync(statePath, state);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', config.googleClientId);
  url.searchParams.set('redirect_uri', config.googleRedirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', gmailScope);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function handleGmailCallback(code: string, state: string) {
  const expectedState = fs.existsSync(statePath) ? fs.readFileSync(statePath, 'utf8') : '';
  if (!expectedState || state !== expectedState) {
    throw new Error('Invalid Gmail OAuth state');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: config.googleRedirectUri,
      grant_type: 'authorization_code'
    })
  });

  if (!response.ok) {
    throw new Error(`Gmail OAuth token exchange failed: ${response.status}`);
  }

  const token = (await response.json()) as GmailToken;
  writeToken({ ...token, expires_at: Date.now() + Number(token.expires_in ?? 0) * 1000 });
  await refreshGmailProfile();
}

async function getAccessToken() {
  const token = readToken();
  if (!token) {
    throw new Error('Gmail is not connected');
  }

  if (token.access_token && token.expires_at && token.expires_at > Date.now() + 60_000) {
    return token.access_token;
  }

  if (!token.refresh_token) {
    return token.access_token;
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    throw new Error(`Gmail token refresh failed: ${response.status}`);
  }

  const refreshed = (await response.json()) as GmailToken;
  const nextToken = {
    ...token,
    ...refreshed,
    refresh_token: token.refresh_token,
    expires_at: Date.now() + Number(refreshed.expires_in ?? 0) * 1000
  };
  writeToken(nextToken);
  return nextToken.access_token;
}

export function buildGmailArticleQuery(input?: { after?: string; before?: string; sender?: string }) {
  const parts = ['-in:spam', '-in:trash', '-category:promotions'];
  if (input?.sender) {
    parts.push(`from:${input.sender}`);
  }
  if (input?.after) {
    parts.push(`after:${input.after.replaceAll('-', '/')}`);
  }
  if (input?.before) {
    parts.push(`before:${input.before.replaceAll('-', '/')}`);
  }
  return parts.join(' ');
}

async function gmailFetch<T>(url: string) {
  const accessToken = await getAccessToken();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Gmail API request failed: ${response.status}. ${body.slice(0, 500)}`
    );
  }

  return response.json() as Promise<T>;
}

async function getRawMessage(messageId: string) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`);
  url.searchParams.set('format', 'raw');
  return gmailFetch<GmailMessage>(url.toString());
}

export async function refreshGmailProfile() {
  const profile = await gmailFetch<GmailProfile>('https://gmail.googleapis.com/gmail/v1/users/me/profile');
  setAppState('gmail_account_email', profile.emailAddress);
  return profile;
}

export async function searchGmailCandidates(input?: {
  after?: string;
  before?: string;
  sender?: string;
  maxResults?: number;
  fullScan?: boolean;
}) {
  await refreshGmailProfile();
  const lastNewest = getAppState('gmail_last_scan_newest_message_at');
  const incrementalAfter = lastNewest ? oneDayBefore(lastNewest) : undefined;
  const query = buildGmailArticleQuery({
    ...input,
    after: input?.after ?? (input?.fullScan ? undefined : incrementalAfter)
  });
  const messages = await listMessageIds(query, input?.maxResults ?? 1000);
  const candidates: GmailCandidate[] = [];
  let newestInternalDate = 0;

  for (const message of messages) {
    const rawMessage = await getRawMessage(message.id);
    newestInternalDate = Math.max(newestInternalDate, Number(rawMessage.internalDate ?? 0));
    if (!rawMessage.raw) {
      continue;
    }
    if ((rawMessage.labelIds ?? []).includes('CATEGORY_PROMOTIONS')) {
      continue;
    }

    const parsed = await parseNewsletterEmail(decodeBase64Url(rawMessage.raw));
    if (!parsed.senderEmail) {
      continue;
    }
    const existingSender = getEmailSender(parsed.senderEmail);
    const hasArticleUrl = Boolean(parsed.articleUrl);
    const isTrusted = existingSender?.trustStatus === 'trusted';
    const isPublicationSender = isLikelySubstackPublicationSender(parsed.senderEmail);
    const isCandidate = isTrusted || hasArticleUrl || isPublicationSender;

    if (!isCandidate) {
      continue;
    }

    const sender = upsertEmailSender({
      email: parsed.senderEmail,
      name: parsed.senderName,
      trustStatus: existingSender?.trustStatus ?? 'pending'
    });
    const alreadyImported = getArticleByGmailMessageId(message.id);
    const messageIgnored = isGmailMessageIgnored(message.id);

    candidates.push({
      messageId: message.id,
      threadId: rawMessage.threadId ?? message.threadId ?? null,
      senderEmail: parsed.senderEmail,
      senderName: parsed.senderName,
      subject: parsed.subject,
      receivedAt: parsed.date,
      labels: rawMessage.labelIds ?? [],
      articleUrl: parsed.articleUrl,
      publicationName: parsed.publicationName,
      trustStatus: sender.trustStatus,
      importStatus: alreadyImported || messageIgnored ? 'already_imported' : sender.trustStatus === 'ignored' ? 'ignored' : 'candidate',
      messageIgnored,
      reason: isTrusted
        ? 'Trusted publication sender'
        : hasArticleUrl
          ? 'Unknown Substack sender with article URL'
          : 'Unknown Substack sender needs review'
    });
  }

  setAppState('gmail_last_scan_at', new Date().toISOString());
  if (newestInternalDate > 0) {
    setAppState('gmail_last_scan_newest_message_at', new Date(newestInternalDate).toISOString());
  }

  return candidates;
}

async function listMessageIds(query: string, maxToScan: number) {
  const messages: Array<{ id: string; threadId: string }> = [];
  let nextPageToken: string | undefined;

  do {
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    url.searchParams.set('q', query);
    url.searchParams.set('maxResults', String(Math.min(100, maxToScan - messages.length)));
    if (nextPageToken) {
      url.searchParams.set('pageToken', nextPageToken);
    }

    const list = await gmailFetch<GmailListResponse>(url.toString());
    messages.push(...(list.messages ?? []));
    nextPageToken = list.nextPageToken;
  } while (nextPageToken && messages.length < maxToScan);

  return messages;
}

function oneDayBefore(isoDate: string) {
  const date = new Date(isoDate);
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function ignoreGmailCandidate(input: { messageId: string; senderEmail?: string; subject?: string }) {
  ignoreGmailMessage({
    messageId: input.messageId,
    senderEmail: input.senderEmail,
    subject: input.subject,
    reason: 'Ignored manually from Subscription Inbox'
  });
  return { ok: true };
}

export async function importGmailMessage(messageId: string) {
  if (isGmailMessageIgnored(messageId)) {
    throw new Error('Gmail message is ignored');
  }

  const rawMessage = await getRawMessage(messageId);
  if (!rawMessage.raw) {
    throw new Error('Gmail message had no raw payload');
  }

  const parsed = await parseNewsletterEmail(decodeBase64Url(rawMessage.raw));
  const sender = upsertEmailSender({
    email: parsed.senderEmail,
    name: parsed.senderName,
    trustStatus: getEmailSender(parsed.senderEmail)?.trustStatus ?? 'pending'
  });

  if (sender.trustStatus === 'ignored') {
    throw new Error('Sender is ignored');
  }

  const article = upsertArticle({
    publicationId: sender.publicationId,
    title: parsed.subject,
    url: parsed.articleUrl ?? `gmail-message://${messageId}`,
    guid: messageId,
    author: parsed.senderName,
    publishedAt: parsed.date,
    summary: parsed.summary,
    contentText: parsed.text,
    source: 'email_subscription',
    isPremiumPreview: false,
    needsFullText: false,
    accessLevel: sender.trustStatus === 'trusted' ? 'premium_full' : 'unknown',
    fullTextStatus: parsed.text.length > 500 ? 'complete' : 'parse_failed',
    detectionEvidence: 'Imported from Gmail subscription email; spam and trash excluded by Gmail query.',
    gmailMessageId: messageId,
    emailSender: parsed.senderEmail,
    emailLabels: JSON.stringify(rawMessage.labelIds ?? [])
  });

  markEmailSenderImported(parsed.senderEmail, parsed.date);
  return article;
}
