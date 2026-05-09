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
  const hasMarker = premiumMarkers.some((marker) => normalized.includes(marker));
  return hasMarker || text.length < 900;
}

export function summarizeText(text: string | null | undefined, maxLength = 320) {
  if (!text) {
    return null;
  }

  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}
