# Architecture

Substack Research Rater is a local-first TypeScript web app.

## Runtime

- React/Vite frontend for the browser UI.
- Express API server for ingestion, analysis, and persistence.
- SQLite database stored in `data/substack-rater.sqlite`.
- Node's built-in SQLite driver is used to avoid native package setup friction.

## Main Flows

1. Connect Gmail with read-only OAuth.
2. Search Gmail for subscribed Substack article emails across normal mailbox categories, including Promotions.
3. Review and trust publication sender addresses.
4. Import selected Gmail messages as subscription-ground-truth articles.
5. Use RSS and archive backfill as secondary historical/gap-detection sources.
6. Extract claims into a reviewable ledger.
7. Rank articles by investment relevance, research quality, and available publication accuracy.

## Security Boundary

V1 does not store Substack credentials, passwords, or browser session cookies. Gmail OAuth uses `gmail.readonly`; local OAuth tokens are stored under `data/`, which is ignored by git.
