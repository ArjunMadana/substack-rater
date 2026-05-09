import type { Article, ArticleAnalysisMode } from '../../shared/types.js';

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
  const claimSignalCount = [
    'will',
    'expect',
    'forecast',
    'target',
    'should',
    'likely',
    'because',
    'evidence',
    'data',
    'study',
    'source'
  ].filter((term) => lower.includes(term)).length;
  const lengthScore = Math.min((article.contentText?.length ?? 0) / 6000, 1);

  const relevanceScore = Math.min(100, tickerCount * 14 + termCount * 7 + lengthScore * 20);
  const qualityScore = Math.min(
    100,
    lengthScore * 35 + termCount * 5 + (lower.includes('source') || lower.includes('sec') ? 15 : 0)
  );
  const previewPenalty = article.isPremiumPreview ? 18 : 0;
  const readValueScore = Math.max(0, Math.round(relevanceScore * 0.6 + qualityScore * 0.4 - previewPenalty));
  const credibilityScore = Math.max(0, Math.round(Math.min(100, claimSignalCount * 8 + lengthScore * 25 + termCount * 3)));
  const analysisMode = classifyAnalysisMode({ readValueScore, credibilityScore, tickerCount, claimSignalCount });
  const importanceScore = analysisMode === 'credibility' ? Math.round(credibilityScore * 0.75) : readValueScore;

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
    credibilityScore,
    readValueScore,
    importanceScore,
    analysisMode,
    rankingReason: reasonParts.length ? reasonParts.join('; ') : 'limited investment signal detected'
  };
}

function classifyAnalysisMode(input: {
  readValueScore: number;
  credibilityScore: number;
  tickerCount: number;
  claimSignalCount: number;
}): ArticleAnalysisMode {
  const highReadValue = input.readValueScore >= 45 || input.tickerCount > 0;
  const credibilityWorthy = input.credibilityScore >= 35 || input.claimSignalCount >= 3;

  if (highReadValue && credibilityWorthy) {
    return 'both';
  }
  if (highReadValue) {
    return 'read_value';
  }
  if (credibilityWorthy) {
    return 'credibility';
  }
  return 'ignore';
}

export function publicationAccuracy(resolvedTrue: number, resolvedTotal: number) {
  if (resolvedTotal === 0) {
    return null;
  }

  return Math.round((resolvedTrue / resolvedTotal) * 100);
}
