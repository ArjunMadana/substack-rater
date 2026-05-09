# Ingestion Notes

## RSS

Substack publication feeds use:

```text
https://publication.substack.com/feed
```

RSS is treated as a current sync source, not a complete historical archive. Feeds may omit older posts.

## Archive Backfill

The app fetches:

```text
https://publication.substack.com/archive
```

It discovers same-origin `/p/...` links and stores fetched public articles. The crawler is intentionally conservative and best-effort.

## Premium Content

The secure default for premium articles is email import. This avoids storing Substack credentials or cookies.

Supported V1 import paths:

- Pasted newsletter/article text.
- Raw email text through the API.

Deferred:

- Gmail/IMAP connector.
- Browser extension or local browser capture.
- Authenticated cookie-based fetching.
