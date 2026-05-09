import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Article, Claim, CoverageItem, EmailSender, FeedItem, GmailCandidate, Publication } from '../shared/types';
import './styles.css';

type View = 'feed' | 'inbox' | 'coverage' | 'publications' | 'claims' | 'settings';

interface GmailStatus {
  configured: boolean;
  connected: boolean;
  scope: string;
  excludesSpamTrash: boolean;
  redirectUri: string;
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? response.statusText);
  }

  return response.json() as Promise<T>;
}

function App() {
  const [view, setView] = useState<View>('feed');
  const [publications, setPublications] = useState<Publication[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<{ article: Article; claims: Claim[] } | null>(null);
  const [message, setMessage] = useState('');

  async function refresh() {
    const [publicationData, feedData, claimData] = await Promise.all([
      api<Publication[]>('/api/publications'),
      api<FeedItem[]>('/api/feed'),
      api<Claim[]>('/api/claims')
    ]);
    setPublications(publicationData);
    setFeed(feedData);
    setClaims(claimData);
  }

  useEffect(() => {
    refresh().catch((error: Error) => setMessage(error.message));
  }, []);

  const stats = useMemo(() => {
    const needsImport = feed.filter((article) => article.needsFullText).length;
    const unresolved = claims.filter((claim) => claim.status === 'unresolved').length;
    return { needsImport, unresolved };
  }, [feed, claims]);

  return (
    <main>
      <aside>
        <div className="brand">
          <span className="mark">SR</span>
          <div>
            <h1>Substack Rater</h1>
            <p>Investment research triage</p>
          </div>
        </div>
        <nav>
          {(['feed', 'inbox', 'coverage', 'publications', 'claims', 'settings'] as View[]).map((item) => (
            <button className={view === item ? 'active' : ''} key={item} onClick={() => setView(item)}>
              {item}
            </button>
          ))}
        </nav>
        <section className="sideStats">
          <div>
            <strong>{publications.length}</strong>
            <span>publications</span>
          </div>
          <div>
            <strong>{feed.length}</strong>
            <span>articles</span>
          </div>
          <div>
            <strong>{stats.unresolved}</strong>
            <span>open claims</span>
          </div>
          <div>
            <strong>{stats.needsImport}</strong>
            <span>need full text</span>
          </div>
        </section>
      </aside>

      <section className="workspace">
        {message && <div className="notice">{message}</div>}
        {view === 'feed' && (
          <FeedView
            feed={feed}
            onSelect={async (id) => setSelectedArticle(await api(`/api/articles/${id}`))}
            selectedArticle={selectedArticle}
            onExtract={async (id) => {
              await api(`/api/articles/${id}/extract-claims`, { method: 'POST' });
              await refresh();
              setSelectedArticle(await api(`/api/articles/${id}`));
            }}
          />
        )}
        {view === 'publications' && (
          <PublicationsView
            publications={publications}
            onChanged={refresh}
            setMessage={setMessage}
          />
        )}
        {view === 'inbox' && <InboxView publications={publications} onChanged={refresh} setMessage={setMessage} />}
        {view === 'coverage' && <CoverageView />}
        {view === 'claims' && <ClaimsView claims={claims} onChanged={refresh} />}
        {view === 'settings' && <SettingsView publications={publications} onImported={refresh} />}
      </section>
    </main>
  );
}

function FeedView({
  feed,
  selectedArticle,
  onSelect,
  onExtract
}: {
  feed: FeedItem[];
  selectedArticle: { article: Article; claims: Claim[] } | null;
  onSelect: (id: number) => void;
  onExtract: (id: number) => void;
}) {
  return (
    <div className="twoPane">
      <section>
        <header className="sectionHeader">
          <div>
            <h2>Ranked Feed</h2>
            <p>Sorted by investment relevance, research signal, and available track record.</p>
          </div>
        </header>
        <div className="articleList">
          {feed.map((article) => (
            <button className="articleRow" key={article.id} onClick={() => onSelect(article.id)}>
              <div className="score">{article.importanceScore}</div>
              <div>
                <h3>{article.title}</h3>
                <p>{article.publicationName ?? 'Unknown publication'}</p>
                <span>
                  {article.source} · {article.fullTextStatus} · {article.rankingReason}
                </span>
              </div>
              {article.needsFullText && <b>needs import</b>}
            </button>
          ))}
          {!feed.length && <p className="empty">Add a publication and sync its feed to start ranking articles.</p>}
        </div>
      </section>
      <section className="detailPane">
        {selectedArticle ? (
          <>
            <div className="sectionHeader">
              <div>
                <h2>{selectedArticle.article.title}</h2>
                <p>{selectedArticle.article.publicationName ?? selectedArticle.article.author}</p>
              </div>
              <button onClick={() => onExtract(selectedArticle.article.id)}>Extract Claims</button>
            </div>
            <div className="scoreGrid">
              <Metric label="Importance" value={selectedArticle.article.importanceScore} />
              <Metric label="Research" value={selectedArticle.article.qualityScore} />
              <Metric label="Relevance" value={selectedArticle.article.relevanceScore} />
            </div>
            <div className="metaLine">
              <span>Source: {selectedArticle.article.source}</span>
              <span>Access: {selectedArticle.article.accessLevel}</span>
              <span>Text: {selectedArticle.article.fullTextStatus}</span>
              {selectedArticle.article.emailSender && <span>Sender: {selectedArticle.article.emailSender}</span>}
            </div>
            {selectedArticle.article.detectionEvidence && (
              <p className="notice subtle">{selectedArticle.article.detectionEvidence}</p>
            )}
            <h3>Claims</h3>
            {selectedArticle.claims.map((claim) => (
              <div className="claim" key={claim.id}>
                <strong>{claim.ticker ?? claim.claimType}</strong>
                <p>{claim.claimText}</p>
                <span>{claim.status}</span>
              </div>
            ))}
            {!selectedArticle.claims.length && <p className="empty">No claims extracted yet.</p>}
            <h3>Article Text</h3>
            <p className="articleText">{selectedArticle.article.contentText}</p>
          </>
        ) : (
          <p className="empty">Select an article to inspect ranking details and extracted claims.</p>
        )}
      </section>
    </div>
  );
}

function InboxView({
  publications,
  onChanged,
  setMessage
}: {
  publications: Publication[];
  onChanged: () => Promise<void>;
  setMessage: (message: string) => void;
}) {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [candidates, setCandidates] = useState<GmailCandidate[]>([]);
  const [senders, setSenders] = useState<EmailSender[]>([]);
  const [after, setAfter] = useState('');
  const [before, setBefore] = useState('');
  const [loading, setLoading] = useState(false);

  async function refreshInbox() {
    const [statusData, senderData] = await Promise.all([
      api<GmailStatus>('/api/gmail/status'),
      api<EmailSender[]>('/api/email-senders')
    ]);
    setStatus(statusData);
    setSenders(senderData);
  }

  useEffect(() => {
    refreshInbox().catch((error: Error) => setMessage(error.message));
  }, []);

  async function connect() {
    const result = await api<{ url: string }>('/api/gmail/oauth/url');
    window.location.href = result.url;
  }

  async function search() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (after) params.set('after', after);
      if (before) params.set('before', before);
      const result = await api<GmailCandidate[]>(`/api/gmail/candidates?${params.toString()}`);
      setCandidates(result);
      await refreshInbox();
    } finally {
      setLoading(false);
    }
  }

  async function trust(email: string, trustStatus: EmailSender['trustStatus'], publicationId?: string) {
    await api(`/api/email-senders/${encodeURIComponent(email)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        trustStatus,
        publicationId: publicationId ? Number(publicationId) : undefined
      })
    });
    await refreshInbox();
    setCandidates((items) =>
      items.map((item) => (item.senderEmail === email ? { ...item, trustStatus, reason: `Sender marked ${trustStatus}` } : item))
    );
  }

  async function importMessage(messageId: string) {
    await api(`/api/gmail/import/${messageId}`, { method: 'POST' });
    await onChanged();
    setCandidates((items) =>
      items.map((item) => (item.messageId === messageId ? { ...item, importStatus: 'already_imported' } : item))
    );
  }

  return (
    <section>
      <header className="sectionHeader">
        <div>
          <h2>Subscription Inbox</h2>
          <p>Use Gmail as ground truth for subscribed Substack articles. Spam and Trash are always excluded.</p>
        </div>
        {status?.connected ? <button onClick={search}>{loading ? 'Searching...' : 'Find Emails'}</button> : <button onClick={connect}>Connect Gmail</button>}
      </header>
      <div className="statusGrid">
        <Metric label="Configured" value={status?.configured ? 1 : 0} />
        <Metric label="Connected" value={status?.connected ? 1 : 0} />
        <Metric label="Spam/Trash Excluded" value={status?.excludesSpamTrash ? 1 : 0} />
      </div>
      {!status?.configured && (
        <p className="notice">Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env, then restart the server.</p>
      )}
      <div className="formLine inboxFilters">
        <input type="date" value={after} onChange={(event) => setAfter(event.target.value)} aria-label="After date" />
        <input type="date" value={before} onChange={(event) => setBefore(event.target.value)} aria-label="Before date" />
        <button onClick={search} disabled={!status?.connected || loading}>
          Search Gmail
        </button>
      </div>
      <h3>Candidate Emails</h3>
      <div className="table">
        {candidates.map((candidate) => (
          <div className="tableRow inboxRow" key={candidate.messageId}>
            <div>
              <strong>{candidate.subject}</strong>
              <span>
                {candidate.senderName ?? candidate.senderEmail} · {candidate.senderEmail}
              </span>
              <small>
                {candidate.reason} · {candidate.labels.join(', ') || 'no labels'} · {candidate.receivedAt ?? 'unknown date'}
              </small>
              {candidate.articleUrl && <small>{candidate.articleUrl}</small>}
            </div>
            <select
              defaultValue=""
              onChange={(event) => trust(candidate.senderEmail, 'trusted', event.target.value || undefined)}
              aria-label="Trust sender and map publication"
            >
              <option value="">Trust sender...</option>
              {publications.map((publication) => (
                <option value={publication.id} key={publication.id}>
                  {publication.name}
                </option>
              ))}
            </select>
            <button onClick={() => trust(candidate.senderEmail, 'ignored')}>Ignore</button>
            <button disabled={candidate.importStatus === 'already_imported'} onClick={() => importMessage(candidate.messageId)}>
              {candidate.importStatus === 'already_imported' ? 'Imported' : 'Import'}
            </button>
          </div>
        ))}
        {!candidates.length && <p className="empty">Connect Gmail and search for Substack candidates.</p>}
      </div>
      <h3>Known Senders</h3>
      <div className="table">
        {senders.map((sender) => (
          <div className="tableRow senderRow" key={sender.email}>
            <div>
              <strong>{sender.email}</strong>
              <span>{sender.name ?? 'Unknown sender'}</span>
              <small>
                {sender.trustStatus} · last imported {sender.lastImportedAt ?? 'never'}
              </small>
            </div>
            <button onClick={() => trust(sender.email, 'trusted')}>Trust</button>
            <button onClick={() => trust(sender.email, 'ignored')}>Ignore</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function CoverageView() {
  const [items, setItems] = useState<CoverageItem[]>([]);

  useEffect(() => {
    api<CoverageItem[]>('/api/coverage').then(setItems).catch(() => setItems([]));
  }, []);

  return (
    <section>
      <header className="sectionHeader">
        <div>
          <h2>Coverage</h2>
          <p>Audit trusted Gmail senders against imported articles and RSS/archive gap signals.</p>
        </div>
      </header>
      <div className="table">
        {items.map((item) => (
          <div className="tableRow coverageRow" key={item.sender.email}>
            <div>
              <strong>{item.publicationName ?? item.sender.name ?? item.sender.email}</strong>
              <span>{item.sender.email}</span>
              <small>{item.note}</small>
            </div>
            <span className={`pill ${item.status}`}>{item.status}</span>
            <span>{item.newestEmailArticleAt ?? 'no Gmail articles'}</span>
            <span>{item.newestRssOrArchiveAt ?? 'no RSS/archive gap'}</span>
          </div>
        ))}
        {!items.length && <p className="empty">Trust Gmail senders to start coverage auditing.</p>}
      </div>
    </section>
  );
}

function PublicationsView({
  publications,
  onChanged,
  setMessage
}: {
  publications: Publication[];
  onChanged: () => Promise<void>;
  setMessage: (message: string) => void;
}) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [isPremium, setIsPremium] = useState(false);

  async function add() {
    await api('/api/publications', {
      method: 'POST',
      body: JSON.stringify({ url, name: name || undefined, isPremium })
    });
    setUrl('');
    setName('');
    setIsPremium(false);
    await onChanged();
  }

  async function run(id: number, action: 'sync' | 'backfill') {
    setMessage(`${action} started`);
    await api(`/api/publications/${id}/${action}`, { method: 'POST' });
    setMessage(`${action} complete`);
    await onChanged();
  }

  return (
    <section>
      <header className="sectionHeader">
        <div>
          <h2>Publications</h2>
          <p>Add creator feeds, run RSS syncs, and backfill public archives.</p>
        </div>
      </header>
      <div className="formLine">
        <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://mvcinvesting.substack.com/" />
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Optional name" />
        <label>
          <input type="checkbox" checked={isPremium} onChange={(event) => setIsPremium(event.target.checked)} />
          Premium
        </label>
        <button onClick={add}>Add</button>
      </div>
      <div className="table">
        {publications.map((publication) => (
          <div className="tableRow" key={publication.id}>
            <div>
              <strong>{publication.name}</strong>
              <span>{publication.feedUrl}</span>
              <small>{publication.lastSyncStatus ?? 'not synced'}</small>
            </div>
            <button onClick={() => run(publication.id, 'sync')}>Sync RSS</button>
            <button onClick={() => run(publication.id, 'backfill')}>Backfill</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClaimsView({ claims, onChanged }: { claims: Claim[]; onChanged: () => Promise<void> }) {
  async function update(id: number, status: Claim['status']) {
    await api(`/api/claims/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    await onChanged();
  }

  return (
    <section>
      <header className="sectionHeader">
        <div>
          <h2>Claim Ledger</h2>
          <p>Review extracted predictions and resolve outcomes over time.</p>
        </div>
      </header>
      {claims.map((claim) => (
        <div className="claim ledger" key={claim.id}>
          <strong>{claim.ticker ?? claim.claimType}</strong>
          <p>{claim.claimText}</p>
          <select value={claim.status} onChange={(event) => update(claim.id, event.target.value as Claim['status'])}>
            <option value="unresolved">unresolved</option>
            <option value="verified_true">verified_true</option>
            <option value="verified_false">verified_false</option>
            <option value="mixed">mixed</option>
            <option value="expired_unresolved">expired_unresolved</option>
          </select>
        </div>
      ))}
      {!claims.length && <p className="empty">Extract claims from article detail pages to populate the ledger.</p>}
    </section>
  );
}

function SettingsView({ publications, onImported }: { publications: Publication[]; onImported: () => Promise<void> }) {
  const [publicationId, setPublicationId] = useState('');
  const [text, setText] = useState('');

  async function importText() {
    await api('/api/import/email', {
      method: 'POST',
      body: JSON.stringify({
        pastedText: text,
        publicationId: publicationId ? Number(publicationId) : undefined
      })
    });
    setText('');
    await onImported();
  }

  return (
    <section>
      <header className="sectionHeader">
        <div>
          <h2>Settings & Imports</h2>
          <p>Import premium email text without storing Substack credentials or cookies.</p>
        </div>
      </header>
      <div className="importBox">
        <select value={publicationId} onChange={(event) => setPublicationId(event.target.value)}>
          <option value="">No publication selected</option>
          {publications.map((publication) => (
            <option value={publication.id} key={publication.id}>
              {publication.name}
            </option>
          ))}
        </select>
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste premium newsletter email or article text" />
        <button onClick={importText}>Import Email Text</button>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />);
