import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { getDb } from './db.js';
import {
  listCoverageItems,
  listEmailSenders,
  getArticle,
  listClaims,
  listClaimsForArticle,
  listFeed,
  listPublications,
  updateEmailSenderTrust,
  updateClaimStatus
} from './repository.js';
import {
  createGmailAuthUrl,
  getGmailStatus,
  handleGmailCallback,
  ignoreGmailCandidate,
  importGmailMessage,
  searchGmailCandidates
} from './services/gmail.js';
import {
  addPublication,
  backfillPublicationArchive,
  extractClaimsForArticle,
  importEmail,
  syncPublicationRss
} from './services/ingestion.js';

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.use(express.json({ limit: '10mb' }));
getDb();

const publicationSchema = z.object({
  url: z.string().min(1),
  name: z.string().optional(),
  isPremium: z.boolean().optional()
});

const emailImportSchema = z.object({
  rawEmail: z.string().optional(),
  pastedText: z.string().optional(),
  publicationId: z.number().optional()
});

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.get('/api/publications', (_request, response) => {
  response.json(listPublications());
});

app.post('/api/publications', async (request, response, next) => {
  try {
    response.json(await addPublication(publicationSchema.parse(request.body)));
  } catch (error) {
    next(error);
  }
});

app.post('/api/publications/:id/sync', async (request, response, next) => {
  try {
    response.json(await syncPublicationRss(Number(request.params.id)));
  } catch (error) {
    next(error);
  }
});

app.post('/api/publications/:id/backfill', async (request, response, next) => {
  try {
    response.json(await backfillPublicationArchive(Number(request.params.id)));
  } catch (error) {
    next(error);
  }
});

app.get('/api/feed', (_request, response) => {
  response.json(listFeed());
});

app.get('/api/articles/:id', (request, response) => {
  const article = getArticle(Number(request.params.id));
  if (!article) {
    response.status(404).json({ error: 'Article not found' });
    return;
  }

  response.json({ article, claims: listClaimsForArticle(article.id) });
});

app.post('/api/articles/:id/extract-claims', async (request, response, next) => {
  try {
    response.json(await extractClaimsForArticle(Number(request.params.id)));
  } catch (error) {
    next(error);
  }
});

app.post('/api/import/email', async (request, response, next) => {
  try {
    response.json(await importEmail(emailImportSchema.parse(request.body)));
  } catch (error) {
    next(error);
  }
});

app.get('/api/gmail/status', (_request, response) => {
  response.json(getGmailStatus());
});

app.get('/api/gmail/oauth/url', (_request, response, next) => {
  try {
    response.json({ url: createGmailAuthUrl() });
  } catch (error) {
    next(error);
  }
});

app.get('/api/gmail/oauth/callback', async (request, response, next) => {
  try {
    await handleGmailCallback(String(request.query.code ?? ''), String(request.query.state ?? ''));
    response.send('Gmail connected. You can close this tab and return to Substack Rater.');
  } catch (error) {
    next(error);
  }
});

app.get('/api/gmail/candidates', async (request, response, next) => {
  try {
    response.json(
      await searchGmailCandidates({
        after: typeof request.query.after === 'string' ? request.query.after : undefined,
        before: typeof request.query.before === 'string' ? request.query.before : undefined,
        sender: typeof request.query.sender === 'string' ? request.query.sender : undefined,
        maxResults: request.query.maxResults ? Number(request.query.maxResults) : undefined,
        fullScan: request.query.fullScan === '1'
      })
    );
  } catch (error) {
    next(error);
  }
});

app.post('/api/gmail/import/:messageId', async (request, response, next) => {
  try {
    response.json(await importGmailMessage(request.params.messageId));
  } catch (error) {
    next(error);
  }
});

app.post('/api/gmail/ignore/:messageId', (request, response, next) => {
  try {
    const body = z
      .object({
        senderEmail: z.string().optional(),
        subject: z.string().optional()
      })
      .parse(request.body ?? {});
    response.json(ignoreGmailCandidate({ messageId: request.params.messageId, ...body }));
  } catch (error) {
    next(error);
  }
});

app.get('/api/email-senders', (_request, response) => {
  response.json(listEmailSenders());
});

app.patch('/api/email-senders/:email', (request, response, next) => {
  try {
    const body = z
      .object({
        trustStatus: z.enum(['trusted', 'ignored', 'pending']),
        publicationId: z.number().nullable().optional()
      })
      .parse(request.body);
    response.json(updateEmailSenderTrust(request.params.email, body.trustStatus, body.publicationId));
  } catch (error) {
    next(error);
  }
});

app.get('/api/coverage', (_request, response) => {
  response.json(listCoverageItems());
});

app.get('/api/claims', (_request, response) => {
  response.json(listClaims());
});

app.patch('/api/claims/:id', (request, response, next) => {
  try {
    const body = z
      .object({
        status: z.enum(['unresolved', 'verified_true', 'verified_false', 'mixed', 'expired_unresolved']),
        outcomeNotes: z.string().nullable().optional()
      })
      .parse(request.body);
    response.json(updateClaimStatus(Number(request.params.id), body.status, body.outcomeNotes ?? null));
  } catch (error) {
    next(error);
  }
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(__dirname, '../client');
app.use(express.static(clientDir));
app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(clientDir, 'index.html'));
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  response.status(400).json({ error: message });
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Substack Research Rater API running at http://127.0.0.1:${port}`);
});
