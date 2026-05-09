# Ingestion Notes

## Gmail Ground Truth

Gmail is the primary source for subscribed Substack articles.

- The app uses Gmail OAuth with `gmail.readonly`.
- Gmail search is not restricted to the Primary inbox, so Promotions can be included.
- Spam and Trash are always excluded.
- Unknown Substack senders are reviewed before trust is granted.
- Once a sender such as `publication@substack.com` is trusted, future messages from that sender are treated as subscribed article candidates.

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
