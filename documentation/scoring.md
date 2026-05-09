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
- `read_value_score`
- `credibility_score`

## Credibility vs Read Value

The app separates two questions:

- Credibility analysis: Does this article make substantive, checkable claims that should affect the author's track record?
- Read value: Is this article important enough to read now for investment opportunity discovery?

An article can be:

- `both`: claimworthy and a high-value read.
- `read_value`: useful to read now, but not enough checkable claims for track-record scoring.
- `credibility`: worth tracking for author accuracy, even if it is not investment-relevant.
- `ignore`: low signal for both workflows.

## Claim Ledger

When `OPENAI_API_KEY` is configured, claims are extracted with OpenAI structured outputs. Otherwise the app falls back to a local heuristic extractor. Claims are extracted into reviewable records with:

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
