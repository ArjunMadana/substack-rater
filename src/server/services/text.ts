const premiumMarkers = [
  'upgrade to paid',
  'subscribe to read',
  'paid subscribers',
  'this post is for paid subscribers',
  'become a paid subscriber',
  'unlock this post'
];

export function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectPremiumPreview(text: string | null | undefined) {
  if (!text) {
    return true;
  }

  const normalized = text.toLowerCase();
  const hasMarker = hasPremiumMarker(normalized);
  return hasMarker || text.length < 900;
}

export function detectPartialArticleHtml(input: { html: string; articleUrl: string }) {
  const canonicalArticleUrl = canonicalizeForDetection(input.articleUrl);
  const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(input.html))) {
    const href = canonicalizeForDetection(match[1], input.articleUrl);
    const linkText = stripHtml(match[2]).toLowerCase();
    if (href === canonicalArticleUrl && /\bread\s*more\b|\bcontinue\s*reading\b/.test(linkText)) {
      return {
        isPartial: true,
        evidence: `Same-article continuation link found: "${linkText}"`
      };
    }
  }

  const text = stripHtml(input.html);
  const markerBased = hasPremiumMarker(text.toLowerCase());
  return {
    isPartial: markerBased,
    evidence: markerBased ? 'Paywall-like language detected.' : null
  };
}

function hasPremiumMarker(normalizedText: string) {
  return premiumMarkers.some((marker) => normalizedText.includes(marker));
}

function canonicalizeForDetection(input: string, base?: string) {
  try {
    const parsed = new URL(input, base);
    parsed.hash = '';
    parsed.searchParams.delete('utm_source');
    parsed.searchParams.delete('utm_medium');
    parsed.searchParams.delete('utm_campaign');
    parsed.searchParams.delete('r');
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return input;
  }
}

export function summarizeText(text: string | null | undefined, maxLength = 320) {
  if (!text) {
    return null;
  }

  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}
