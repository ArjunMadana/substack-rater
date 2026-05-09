import { describe, expect, it } from 'vitest';
import { scoreArticle } from './scoring.js';

describe('scoreArticle', () => {
  it('scores investment-specific articles higher than generic text', () => {
    const strong = scoreArticle({
      title: '$HROW investment thesis',
      contentText: 'Revenue growth, valuation, margin, cash flow, catalyst, upside, downside, SEC source.',
      isPremiumPreview: false
    });
    const weak = scoreArticle({
      title: 'Weekly note',
      contentText: 'A short personal update.',
      isPremiumPreview: false
    });

    expect(strong.importanceScore).toBeGreaterThan(weak.importanceScore);
  });
});
