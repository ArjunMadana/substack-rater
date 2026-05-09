# Scoring Model

## Article Ranking

V1 uses deterministic heuristic scoring so the product is usable before a paid AI provider is configured.

Signals:

- Ticker mentions.
- Investment terms such as valuation, revenue, margin, cash flow, catalyst, risk, thesis, upside, and downside.
- Article length as a proxy for depth.
- Whether a post is only a premium preview.

Scores:

- `quality_score`
- `relevance_score`
- `importance_score`

## Claim Ledger

Claims are extracted into reviewable records with:

- Claim text.
- Claim type.
- Ticker.
- Time horizon.
- Due date.
- Confidence.
- Evidence.
- Source snippet.
- Outcome status.

Statuses:

- `unresolved`
- `verified_true`
- `verified_false`
- `mixed`
- `expired_unresolved`

Publication accuracy is computed only from resolved claims.
