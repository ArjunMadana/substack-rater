import { XMLParser } from 'fast-xml-parser';
import type { ArticleSource } from '../../shared/types.js';
import { canonicalizeArticleUrl } from './url.js';
import { detectPartialArticleHtml, stripHtml, summarizeText } from './text.js';

export interface ParsedFeedItem {
  title: string;
  url: string;
  guid: string | null;
  author: string | null;
  publishedAt: string | null;
  summary: string | null;
  contentText: string | null;
  source: ArticleSource;
  isPremiumPreview: boolean;
  needsFullText: boolean;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: 'text',
  cdataPropName: 'cdata',
  parseTagValue: false
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function textValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    if (typeof objectValue.cdata === 'string') {
      return objectValue.cdata;
    }
    if (typeof objectValue.text === 'string') {
      return objectValue.text;
    }
  }

  return null;
}

export function parseRss(xml: string): ParsedFeedItem[] {
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const channel = (parsed.rss as Record<string, unknown> | undefined)?.channel as
    | Record<string, unknown>
    | undefined;
  const items = asArray(channel?.item as Record<string, unknown> | Record<string, unknown>[] | undefined);

  return items.flatMap((item) => {
    const title = textValue(item.title) ?? 'Untitled';
    const rawUrl = textValue(item.link);
    if (!rawUrl) {
      return [];
    }

    const rawContent =
      textValue(item['content:encoded']) ?? textValue(item.description) ?? textValue(item.summary) ?? '';
    const contentText = stripHtml(rawContent);
    const partial = detectPartialArticleHtml({ html: rawContent, articleUrl: rawUrl });
    const isPremiumPreview = partial.isPartial;

    return [
      {
        title: stripHtml(title),
        url: canonicalizeArticleUrl(rawUrl),
        guid: textValue(item.guid),
        author: textValue(item['dc:creator']) ?? textValue(item.author),
        publishedAt: textValue(item.pubDate) ? new Date(String(textValue(item.pubDate))).toISOString() : null,
        summary: summarizeText(stripHtml(textValue(item.description) ?? rawContent)),
        contentText,
        source: 'rss',
        isPremiumPreview,
        needsFullText: isPremiumPreview
      }
    ];
  });
}
