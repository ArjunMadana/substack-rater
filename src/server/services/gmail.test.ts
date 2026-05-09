import { describe, expect, it } from 'vitest';
import { buildGmailArticleQuery } from './gmail.js';

describe('buildGmailArticleQuery', () => {
  it('searches broadly without limiting to primary inbox', () => {
    const query = buildGmailArticleQuery({ after: '2026-01-01', before: '2026-02-01' });

    expect(query).toContain('substack.com/p/');
    expect(query).toContain('after:2026/01/01');
    expect(query).toContain('before:2026/02/01');
    expect(query).not.toContain('in:inbox');
    expect(query).not.toContain('category:primary');
  });

  it('always excludes spam and trash', () => {
    expect(buildGmailArticleQuery()).toContain('-in:spam');
    expect(buildGmailArticleQuery()).toContain('-in:trash');
  });
});
