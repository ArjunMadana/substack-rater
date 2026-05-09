import { describe, expect, it } from 'vitest';
import { archiveUrlForPublication, canonicalizeArticleUrl, normalizePublicationUrl } from './url.js';

describe('url services', () => {
  it('normalizes a Substack publication URL to a feed URL', () => {
    expect(normalizePublicationUrl('https://mvcinvesting.substack.com/')).toEqual({
      baseUrl: 'https://mvcinvesting.substack.com',
      feedUrl: 'https://mvcinvesting.substack.com/feed',
      hostname: 'mvcinvesting.substack.com'
    });
  });

  it('keeps feed URLs as feeds', () => {
    expect(normalizePublicationUrl('mvcinvesting.substack.com/feed').feedUrl).toBe(
      'https://mvcinvesting.substack.com/feed'
    );
  });

  it('canonicalizes article URLs', () => {
    expect(canonicalizeArticleUrl('https://x.substack.com/p/post?r=abc&utm_source=email#comments')).toBe(
      'https://x.substack.com/p/post'
    );
  });

  it('builds archive URLs', () => {
    expect(archiveUrlForPublication('https://x.substack.com')).toBe('https://x.substack.com/archive');
  });
});
