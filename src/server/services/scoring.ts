import type { Article } from '../../shared/types.js';

const tickerPattern = /\$[A-Z]{1,5}\b/g;
const investmentTerms = [
  'valuation',
  'revenue',
  'margin',
  'cash flow',
  'guidance',
  'earnings',
  'multiple',
  'moat',
  'catalyst',
  'risk',
  'thesis',
  'upside',
  'downside',
  'position'
];

export function scoreArticle(article: Pick<Article, 'title' | 'contentText' | 'isPremiumPreview'>) {
  const text = `${article.title} ${article.contentText ?? ''}`;
  const lower = text.toLowerCase();
  const tickerCount = new Set(text.match(tickerPattern) ?? []).size;
  const termCount = investmentTerms.filter((term) => lower.includes(term)).length;
  const lengthScore = Math.min((article.contentText?.length ?? 0) / 6000, 1);

  const relevanceScore = Math.min(100, tickerCount * 14 + termCount * 7 + lengthScore * 20);
  const qualityScore = Math.min(
    100,
    lengthScore * 35 + termCount * 5 + (lower.includes('source') || lower.includes('sec') ? 15 : 0)
  );
  const previewPenalty = article.isPremiumPreview ? 18 : 0;
  const importanceScore = Math.max(0, Math.round(relevanceScore * 0.55 + qualityScore * 0.45 - previewPenalty));

  const reasonParts = [];
  if (tickerCount) {
    reasonParts.push(`mentions ${tickerCount} ticker${tickerCount === 1 ? '' : 's'}`);
  }
  if (termCount) {
    reasonParts.push(`contains ${termCount} investment research signal${termCount === 1 ? '' : 's'}`);
  }
  if (article.isPremiumPreview) {
    reasonParts.push('needs full-text import');
  }

  return {
    qualityScore: Math.round(qualityScore),
    relevanceScore: Math.round(relevanceScore),
    importanceScore,
    rankingReason: reasonParts.length ? reasonParts.join('; ') : 'limited investment signal detected'
  };
}

export function publicationAccuracy(resolvedTrue: number, resolvedTotal: number) {
  if (resolvedTotal === 0) {
    return null;
  }

  return Math.round((resolvedTrue / resolvedTotal) * 100);
}
