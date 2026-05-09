# Data Schema

## publications

Tracks Substack creators and their feed configuration.

Important fields:

- `base_url`
- `feed_url`
- `is_premium`
- `last_sync_at`
- `last_sync_status`

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
- `quality_score`
- `relevance_score`
- `importance_score`
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
- `status`
- `outcome_notes`
