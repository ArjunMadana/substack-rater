import { describe, expect, it } from 'vitest';
import { detectPartialArticleHtml } from './text.js';

describe('detectPartialArticleHtml', () => {
  it('flags same-article read-more links as partial', () => {
    const result = detectPartialArticleHtml({
      articleUrl: 'https://mvcinvesting.substack.com/p/portfolio-update-03292026-important',
      html: '<p>Intro</p><a href="https://mvcinvesting.substack.com/p/portfolio-update-03292026-important">Read more</a>'
    });

    expect(result.isPartial).toBe(true);
    expect(result.evidence).toContain('Same-article');
  });

  it('does not flag read-more links to different articles', () => {
    const result = detectPartialArticleHtml({
      articleUrl: 'https://mvcinvesting.substack.com/p/current',
      html: '<p>Long enough article content with a link.</p><a href="https://mvcinvesting.substack.com/p/other">Read more</a>'
    });

    expect(result.isPartial).toBe(false);
  });
});
