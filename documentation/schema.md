# Data Schema

## publications

Tracks Substack creators and their feed configuration.

Important fields:

- `base_url`
- `feed_url`
- `is_premium`
- `last_sync_at`
- `last_sync_status`

## email_senders

Tracks Gmail sender addresses used as subscription ground truth.

Important fields:

- `email`
- `name`
- `publication_id`
- `trust_status`
- `last_imported_at`
- `last_seen_at`

## articles

Stores RSS, archive, email, and manual article records.

Important fields:

- `publication_id`
- `title`
- `url`
- `guid`
- `published_at`
- `content_text`
- `source`
- `is_premium_preview`
- `needs_full_text`
- `access_level`
- `full_text_status`
- `detection_evidence`
- `gmail_message_id`
- `email_sender`
- `email_labels`
- `quality_score`
- `relevance_score`
- `importance_score`
- `read_value_score`
- `credibility_score`
- `analysis_mode`
- `ranking_reason`

## claims

Stores extracted predictions and research claims.

Important fields:

- `article_id`
- `publication_id`
- `claim_text`
- `claim_type`
- `ticker`
- `time_horizon`
- `due_date`
- `confidence`
- `evidence`
- `source_snippet`
- `verification_query`
- `verifiability_reason`
- `verification_sources`
- `verification_confidence`
- `verified_at`
- `status`
- `outcome_notes`

`verification_query` and `verifiability_reason` are generated during extraction so low-quality, non-falsifiable statements can be filtered out before they affect accuracy tracking. `verification_sources`, `verification_confidence`, and `verified_at` are populated by the claim verification flow.
