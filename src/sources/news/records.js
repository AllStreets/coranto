import { detectCategory } from './categories.js';
import { matchPlace } from './gazetteer.js';
import { canonicalNewsUrl, parsePublishedAt } from './article.js';
import { isJunk, isLowQualitySource } from './junk.js';
import { detectProgress } from './progress.js';

export {
  canonicalNewsUrl,
  isShowableArticle,
  parsePublishedAt,
} from './article.js';

export const NEWS_MAX_AGE_MS = 48 * 60 * 60 * 1000;
export const NEWS_FUTURE_TOLERANCE_MS = 10 * 60 * 1000;
export const NEWS_SUMMARY_MAX = 400;
export const NEWS_TITLE_MAX = 300;

/** Every reason an item can be dropped. The payload counts each one. */
export const NEWS_DROP_REASONS = Object.freeze([
  'noTitle',
  'badUrl',
  'noPublisher',
  'noDate',
  'future',
  'tooOld',
  'lowQualitySource',
  'junk',
  'duplicate',
]);

/** Stable 16-hex-character id from a string (two FNV-1a passes). */
export function newsId(text) {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ code, 0x85ebca6b) + a;
  }
  const hex = (value) => (value >>> 0).toString(16).padStart(8, '0');
  return hex(a) + hex(b);
}

const clean = (value) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

/**
 * Validate one raw feed item. Returns `{ article }` or `{ dropped }` with a
 * reason from NEWS_DROP_REASONS. A missing field is never filled in.
 *
 * @param {{title?: string, summary?: string, url?: string, publisher?: string, publishedAt?: string}} raw
 * @param {{sourceId: string, fetchedAt: number, now: number}} context
 */
export function normalizeArticle(
  raw,
  { sourceId, region, lang, fetchedAt, now },
) {
  const title = clean(raw?.title).slice(0, NEWS_TITLE_MAX);
  if (!title || title === '[Removed]') return { dropped: 'noTitle' };
  const url = canonicalNewsUrl(raw?.url);
  if (!url) return { dropped: 'badUrl' };
  const publisher = clean(raw?.publisher);
  if (!publisher) return { dropped: 'noPublisher' };
  const publishedMs = parsePublishedAt(raw?.publishedAt);
  if (publishedMs === null) return { dropped: 'noDate' };
  if (publishedMs - now > NEWS_FUTURE_TOLERANCE_MS)
    return { dropped: 'future' };
  if (now - publishedMs > NEWS_MAX_AGE_MS) return { dropped: 'tooOld' };
  if (isLowQualitySource(url, publisher))
    return { dropped: 'lowQualitySource' };
  const summary = clean(raw?.summary).slice(0, NEWS_SUMMARY_MAX);
  if (isJunk(`${title} ${summary} ${publisher}`)) return { dropped: 'junk' };
  const place = matchPlace(title, summary);
  return {
    article: {
      id: newsId(url),
      title,
      summary,
      url,
      publisher,
      sourceId,
      region: region ?? null,
      lang: lang ?? 'en',
      publishedAt: new Date(publishedMs).toISOString(),
      fetchedAt: new Date(fetchedAt).toISOString(),
      place,
      category: detectCategory(`${title} ${summary}`),
      progress: detectProgress(title),
    },
  };
}

const titleKey = (title) => title.toLowerCase().slice(0, 80);

/**
 * Normalise raw items from one source and count what was dropped.
 * `seen` carries URL and title keys across sources so the first source to
 * carry a story keeps it.
 */
export function normalizeArticles(raws, context, seen = new Set()) {
  const articles = [];
  const dropped = {};
  const count = (reason) => {
    dropped[reason] = (dropped[reason] ?? 0) + 1;
  };
  for (const raw of raws ?? []) {
    const result = normalizeArticle(raw, context);
    if (result.dropped) {
      count(result.dropped);
      continue;
    }
    const { article } = result;
    const keys = [`u:${article.url}`, `t:${titleKey(article.title)}`];
    if (keys.some((key) => seen.has(key))) {
      count('duplicate');
      continue;
    }
    for (const key of keys) seen.add(key);
    articles.push(article);
  }
  return { articles, dropped };
}
