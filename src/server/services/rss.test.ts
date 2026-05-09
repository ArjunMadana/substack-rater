import { describe, expect, it } from 'vitest';
import { parseRss } from './rss.js';

describe('parseRss', () => {
  it('parses feed items and detects short premium previews', () => {
    const items = parseRss(`
      <rss>
        <channel>
          <item>
            <title>Deep Dive</title>
            <link>https://mvcinvesting.substack.com/p/deep-dive?utm_source=email</link>
            <guid>abc</guid>
            <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
            <description><![CDATA[<p>Upgrade to paid to read the rest.</p>]]></description>
          </item>
        </channel>
      </rss>
    `);

    expect(items).toHaveLength(1);
    expect(items[0].url).toBe('https://mvcinvesting.substack.com/p/deep-dive');
    expect(items[0].isPremiumPreview).toBe(true);
    expect(items[0].needsFullText).toBe(true);
  });
});
