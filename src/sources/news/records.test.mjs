import assert from 'node:assert/strict';
import test from 'node:test';
import { detectCategory } from './categories.js';
import { isJunk, isLowQualitySource } from './junk.js';
import {
  NEWS_DROP_REASONS,
  canonicalNewsUrl,
  isShowableArticle,
  newsId,
  normalizeArticle,
  normalizeArticles,
} from './records.js';

const NOW = Date.parse('2026-10-10T12:00:00Z');
const context = { sourceId: 'bbc', fetchedAt: NOW, now: NOW };
const raw = (overrides = {}) => ({
  title: 'Ceasefire talks resume in Doha',
  summary: 'Negotiators returned to the table on Saturday.',
  url: 'https://www.bbc.co.uk/news/world-1?utm_source=rss#top',
  publisher: 'BBC',
  publishedAt: 'Sat, 10 Oct 2026 10:00:00 GMT',
  ...overrides,
});

test('a complete item passes with the feed’s own values', () => {
  const { article } = normalizeArticle(raw(), context);
  assert.equal(article.title, 'Ceasefire talks resume in Doha');
  assert.equal(article.publisher, 'BBC');
  assert.equal(article.url, 'https://www.bbc.co.uk/news/world-1');
  assert.equal(article.publishedAt, '2026-10-10T10:00:00.000Z');
  assert.equal(article.fetchedAt, '2026-10-10T12:00:00.000Z');
  assert.equal(article.place.name, 'Doha');
  assert.equal(article.category, 'geopolitics');
  assert.equal(article.id, newsId(article.url));
  assert.ok(isShowableArticle(article));
});

test('a missing or unparseable date drops the item; the clock is never used', () => {
  for (const publishedAt of [undefined, '', 'yesterday-ish', null]) {
    const result = normalizeArticle(raw({ publishedAt }), context);
    assert.deepEqual(result, { dropped: 'noDate' });
  }
});

test('each drop rule reports its reason', () => {
  const cases = [
    [{ title: '' }, 'noTitle'],
    [{ title: '[Removed]' }, 'noTitle'],
    [{ url: 'javascript:alert(1)' }, 'badUrl'],
    [{ url: 'not a url' }, 'badUrl'],
    [{ publisher: '  ' }, 'noPublisher'],
    [{ publishedAt: '2026-10-10T12:30:00Z' }, 'future'],
    [{ publishedAt: '2026-10-08T11:00:00Z' }, 'tooOld'],
    [{ url: 'https://www.prnewswire.com/x' }, 'lowQualitySource'],
    [{ title: 'Best deals of the week: 40% off headphones', summary: '' }, 'junk'],
  ];
  for (const [overrides, reason] of cases) {
    assert.deepEqual(normalizeArticle(raw(overrides), context), {
      dropped: reason,
    });
    assert.ok(NEWS_DROP_REASONS.includes(reason));
  }
});

test('a small clock skew into the future is tolerated', () => {
  const result = normalizeArticle(
    raw({ publishedAt: '2026-10-10T12:05:00Z' }),
    context,
  );
  assert.ok(result.article);
});

test('duplicates by URL or by headline are counted, first one kept', () => {
  const seen = new Set();
  const first = normalizeArticles([raw()], context, seen);
  const second = normalizeArticles(
    [
      raw({ publisher: 'NPR' }),
      raw({ url: 'https://example.org/other', publisher: 'DW' }),
      raw({ title: 'Different story from Lagos', url: 'https://example.org/2' }),
    ],
    { ...context, sourceId: 'npr' },
    seen,
  );
  assert.equal(first.articles.length, 1);
  assert.equal(second.articles.length, 1);
  assert.equal(second.dropped.duplicate, 2);
});

test('an unplaced, untagged story is still a valid article', () => {
  const { article } = normalizeArticle(
    raw({ title: 'Researchers publish long-awaited findings', summary: '' }),
    context,
  );
  assert.equal(article.place, null);
  assert.equal(article.category, null);
  assert.ok(isShowableArticle(article));
});

test('isShowableArticle rejects anything missing source, link or time', () => {
  const { article } = normalizeArticle(raw(), context);
  for (const key of ['title', 'url', 'publisher', 'publishedAt', 'fetchedAt', 'id'])
    assert.equal(isShowableArticle({ ...article, [key]: '' }), false, key);
  assert.equal(
    isShowableArticle({ ...article, place: { ...article.place, lat: 123 } }),
    false,
  );
  assert.equal(isShowableArticle(null), false);
});

test('canonicalNewsUrl strips tracking and refuses non-http schemes', () => {
  assert.equal(
    canonicalNewsUrl('https://a.example/x?id=4&utm_medium=rss&fbclid=1#frag'),
    'https://a.example/x?id=4',
  );
  assert.equal(canonicalNewsUrl('ftp://a.example/x'), null);
  assert.equal(canonicalNewsUrl(''), null);
});

test('categories use whole words and have no default', () => {
  assert.equal(detectCategory('Missile and airstrike hit the army base'), 'military');
  assert.equal(detectCategory('Central bank holds rates as inflation cools'), 'finance');
  assert.equal(detectCategory('Wildfire spreads as drought deepens'), 'climate');
  assert.equal(detectCategory('New semiconductor plant for AI chips'), 'technology');
  // "ai" inside another word is not a technology story.
  assert.equal(detectCategory('Rain in Spain stays mainly on the plain'), null);
  assert.equal(detectCategory('A quiet day'), null);
  assert.equal(detectCategory(''), null);
});

test('the junk filter keeps hard news and drops shopping and PR copy', () => {
  assert.equal(isJunk('Black Friday deals: save up to 50% on laptops'), true);
  assert.equal(isJunk('Peace deal signed after ceasefire talks'), false);
  assert.equal(isJunk('Missile launch detected over the peninsula'), false);
  assert.equal(isLowQualitySource('https://www.dailymail.co.uk/a', 'Daily Mail'), true);
  assert.equal(isLowQualitySource('https://www.bbc.co.uk/news/1', 'BBC'), false);
});
