import { canonicalizeArticleUrl } from './url.js';

export function discoverArchiveLinks(html: string, baseUrl: string) {
  const links = new Set<string>();
  const origin = new URL(baseUrl).origin;
  const hrefPattern = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefPattern.exec(html))) {
    const rawHref = match[1];
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:')) {
      continue;
    }

    const url = new URL(rawHref, origin);
    if (url.origin !== origin) {
      continue;
    }

    if (!url.pathname.startsWith('/p/')) {
      continue;
    }

    links.add(canonicalizeArticleUrl(url.toString()));
  }

  return [...links];
}

export function extractArticleText(html: string) {
  const articleMatch = html.match(/<article[\s\S]*?<\/article>/i);
  const source = articleMatch?.[0] ?? html;

  return source
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
