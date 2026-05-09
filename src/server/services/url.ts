export function normalizePublicationUrl(input: string) {
  const raw = input.trim();
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const parsed = new URL(withProtocol);
  parsed.hash = '';
  parsed.search = '';

  const hostname = parsed.hostname.toLowerCase();
  const isFeed = parsed.pathname.replace(/\/+$/, '').endsWith('/feed');
  const basePath = isFeed ? parsed.pathname.replace(/\/feed\/?$/, '/') : parsed.pathname;
  const baseUrl = `${parsed.protocol}//${hostname}${basePath === '/' ? '' : basePath.replace(/\/+$/, '')}`;
  const feedUrl = isFeed ? parsed.toString() : `${baseUrl}/feed`;

  return {
    baseUrl,
    feedUrl,
    hostname
  };
}

export function canonicalizeArticleUrl(input: string) {
  if (!/^https?:\/\//i.test(input)) {
    return input;
  }

  const parsed = new URL(input);
  parsed.hash = '';
  parsed.searchParams.delete('utm_source');
  parsed.searchParams.delete('utm_medium');
  parsed.searchParams.delete('utm_campaign');
  parsed.searchParams.delete('r');
  return parsed.toString().replace(/\/$/, '');
}

export function archiveUrlForPublication(baseUrl: string) {
  return `${baseUrl.replace(/\/$/, '')}/archive`;
}
