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
- Verification query.
- Verifiability reason.
- Outcome status.

Extraction is intentionally conservative. A claim must be concrete and falsifiable enough to support track-record scoring. The extractor should reject:

- Portfolio logistics, such as "positions will change with time."
- Disclaimers and personal process notes.
- Vague opinions without measurable outcomes.
- Commentary that cannot be checked against public evidence later.

Valid claims usually include a company, ticker, market, product, metric, time horizon, catalyst, or measurable predicted outcome.

Statuses:

- `unresolved`
- `verified_true`
- `verified_false`
- `mixed`
- `expired_unresolved`

Publication accuracy is computed only from resolved claims.

## Claim Verification

The Claim Ledger has a `Verify` action for each claim. With OpenAI configured, verification uses the Responses API with web search to look for public evidence and then proposes one of the existing statuses:

- `verified_true`: public evidence supports the claim.
- `verified_false`: public evidence contradicts the claim.
- `mixed`: the claim is partly supported and partly contradicted.
- `unresolved`: the claim is future-dated, too early, or evidence is insufficient.

Verification writes a summary, confidence, source list, and verified timestamp back to the claim. The status remains manually editable because investment claims often require human judgment about timing, source quality, and partial outcomes.
