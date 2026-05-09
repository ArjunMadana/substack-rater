import { describe, expect, it } from 'vitest';
import { discoverArchiveLinks } from './archive.js';

describe('discoverArchiveLinks', () => {
  it('returns same-origin post links only', () => {
    const links = discoverArchiveLinks(
      `
        <a href="/p/one">One</a>
        <a href="https://example.com/p/two">Two</a>
        <a href="/about">About</a>
        <a href="https://mvcinvesting.substack.com/p/three?utm_source=email">Three</a>
      `,
      'https://mvcinvesting.substack.com'
    );

    expect(links).toEqual([
      'https://mvcinvesting.substack.com/p/one',
      'https://mvcinvesting.substack.com/p/three'
    ]);
  });
});
