# Ingestion Notes

## Gmail Ground Truth

Gmail is the primary source for subscribed Substack articles.

- The app uses Gmail OAuth with `gmail.readonly`.
- Gmail scanning walks the normal mailbox broadly and filters locally for Substack article signals instead of relying on a narrow Gmail search query.
- Gmail search is not restricted to the Primary inbox, but Promotions are excluded because Gmail's category filter is generally useful for removing low-value mail.
- Spam and Trash are always excluded.
- Unknown Substack senders are reviewed before trust is granted.
- Once a sender such as `publication@substack.com` is trusted, future messages from that sender are treated as subscribed article candidates.
- Individual Gmail messages can be ignored without ignoring the sender, which is useful for delivery tests, verification codes, or other non-article emails from trusted senders.
- Importing a Gmail candidate creates or updates the article, adds it to the ranked Feed, and immediately runs claim extraction so the Claims ledger starts filling without a separate manual step.
- The app stores the connected Gmail account email and the newest scanned message timestamp. Later scans default forward from that timestamp, while Full Rescan can rebuild the candidate list from the mailbox.

Gmail imports are preferred over RSS/archive duplicates because they represent the user's subscribed delivery and usually contain full text for readable articles.

## RSS

Substack publication feeds use:

```text
https://publication.substack.com/feed
```

RSS is treated as a secondary current sync and gap-detection source, not a complete historical archive. Feeds may omit older posts.

## Archive Backfill

The app fetches:

```text
https://publication.substack.com/archive
```

It discovers same-origin `/p/...` links and stores fetched public articles. The crawler is intentionally conservative and best-effort.

## Premium Content

The secure default for premium articles is email import. This avoids storing Substack credentials or cookies.

Supported import paths:

- Pasted newsletter/article text.
- Raw email text through the API.
- Gmail-imported subscription emails.

Deferred:

- Browser extension or local browser capture.
- Authenticated cookie-based fetching.
