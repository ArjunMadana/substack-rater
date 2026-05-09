# Substack Research Rater

Local-first app for tracking investment-focused Substacks, importing articles, extracting claims, and ranking research quality.

## Quick Start

```bash
npm.cmd install
npm.cmd run dev
```

Open the Vite URL shown in the terminal, usually `http://127.0.0.1:5173`.

## Features

- Add Substack publication URLs.
- Connect Gmail with read-only OAuth for subscription-ground-truth article import.
- Sync creator-level RSS feeds.
- Backfill public archive articles missing from RSS.
- Import premium article/email text without storing Substack credentials.
- Extract prediction claims into a ledger.
- Rank articles for investment opportunity discovery.
- Separate article credibility analysis from high-value-read ranking.

## Documentation

See `/documentation` for architecture, ingestion, scoring, and schema notes.

## Environment

Copy `.env.example` to `.env` and fill in local credentials as needed. `.env` is ignored by git.
