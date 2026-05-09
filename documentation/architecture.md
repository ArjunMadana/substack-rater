# Architecture

Substack Research Rater is a local-first TypeScript web app.

## Runtime

- React/Vite frontend for the browser UI.
- Express API server for ingestion, analysis, and persistence.
- SQLite database stored in `data/substack-rater.sqlite`.
- Node's built-in SQLite driver is used to avoid native package setup friction.

## Main Flows

1. Add a Substack publication URL.
2. Normalize it to a creator-level RSS feed.
3. Sync RSS for current posts.
4. Backfill public archive pages for older posts missing from RSS.
5. Import premium email text when RSS/web content is partial.
6. Extract claims into a reviewable ledger.
7. Rank articles by investment relevance, research quality, and available publication accuracy.

## Security Boundary

V1 does not store Substack credentials, passwords, or browser session cookies. Premium content is imported through user-provided email/article text.
