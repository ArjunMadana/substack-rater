import { describe, expect, it } from 'vitest';
import { findCanonicalSubstackArticleUrl, isLikelySubstackPublicationSender, parseEmailAddress } from './email.js';

describe('email helpers', () => {
  it('parses sender addresses', () => {
    expect(parseEmailAddress('"Vik" <viksnewsletter@substack.com>')).toEqual({
      email: 'viksnewsletter@substack.com',
      name: 'Vik'
    });
  });

  it('recognizes publication senders but not generic Substack senders', () => {
    expect(isLikelySubstackPublicationSender('viksnewsletter@substack.com')).toBe(true);
    expect(isLikelySubstackPublicationSender('substack@substack.com')).toBe(false);
  });

  it('extracts canonical article URLs', () => {
    expect(
      findCanonicalSubstackArticleUrl(
        'Read https://mvcinvesting.substack.com/p/portfolio-update-03292026-important?utm_source=email&r=abc'
      )
    ).toBe('https://mvcinvesting.substack.com/p/portfolio-update-03292026-important');
  });
});
