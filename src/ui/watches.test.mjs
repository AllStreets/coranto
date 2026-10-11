import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WATCH_LIMIT,
  WATCH_STORAGE_KEY,
  articleMatches,
  buildBriefing,
  createWatchStore,
  describeCriteria,
  hasCriteria,
  watchStories,
} from './watches.js';

const memory = () => {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
};
const article = (id, title, extra = {}) => ({
  id,
  title,
  summary: '',
  publisher: 'BBC',
  url: `https://example.org/${id}`,
  publishedAt: '2026-10-10T10:00:00.000Z',
  lang: 'en',
  place: null,
  category: null,
  progress: null,
  ...extra,
});
const lagos = { name: 'Lagos', precision: 'city' };

test('a watch filters on words, place, topic, publisher, language and good news', () => {
  const a = article('1', 'Election date set in Lagos', {
    place: lagos,
    category: 'geopolitics',
  });
  assert.equal(articleMatches(a, { query: 'ELECTION lagos' }), true);
  assert.equal(articleMatches(a, { query: 'election paris' }), false);
  assert.equal(articleMatches(a, { placeKey: 'city:Lagos' }), true);
  assert.equal(articleMatches(a, { placeKey: 'city:Abuja' }), false);
  assert.equal(articleMatches(a, { category: 'finance' }), false);
  assert.equal(articleMatches(a, { publisher: 'BBC' }), true);
  assert.equal(articleMatches(a, { goodNews: true }), false);
  // English unless the watch says otherwise; null means every language.
  const fr = article('2', 'Élection à Lagos', { lang: 'fr' });
  assert.equal(articleMatches(fr, { query: 'lagos' }), false);
  assert.equal(articleMatches(fr, { query: 'lagos', language: null }), true);
  assert.equal(articleMatches(fr, { query: 'lagos', language: 'fr' }), true);
});

test('an empty view cannot be saved, and names describe the filter', () => {
  assert.equal(hasCriteria({}), false);
  assert.equal(hasCriteria({ language: 'fr' }), false);
  assert.equal(hasCriteria({ query: '  grain ' }), true);
  assert.equal(
    describeCriteria({ query: 'Grain  Exports', placeKey: 'city:Odesa', category: 'finance' }),
    '“grain exports” · Odesa · finance',
  );
});

test('watches are saved, survive a reload, and refuse duplicates', () => {
  const storage = memory();
  let clock = 1000;
  const store = createWatchStore({ storage, now: () => clock });
  assert.equal(store.add({}), null);
  const watch = store.add({ query: 'grain' });
  assert.equal(watch.name, '“grain”');
  assert.equal(watch.seenAt, 1000);
  assert.equal(store.add({ query: ' GRAIN ' }), null, 'same filter twice');
  clock = 2000;
  store.add({ category: 'climate' }, 'Climate desk');
  const reloaded = createWatchStore({ storage });
  assert.deepEqual(reloaded.list().map((w) => w.name), ['“grain”', 'Climate desk']);
  reloaded.remove(watch.id);
  assert.equal(createWatchStore({ storage }).list().length, 1);
});

test('damaged storage and the limit are handled', () => {
  const storage = memory();
  storage.setItem(WATCH_STORAGE_KEY, '{not json');
  assert.deepEqual(createWatchStore({ storage }).list(), []);
  storage.setItem(WATCH_STORAGE_KEY, JSON.stringify([{ nope: 1 }, { id: 'w1', criteria: { query: 'x' } }]));
  assert.equal(createWatchStore({ storage }).list().length, 1);
  let clock = 0;
  const store = createWatchStore({ storage: memory(), now: () => ++clock });
  for (let i = 0; i < WATCH_LIMIT + 3; i++) store.add({ query: `term${i}` });
  assert.equal(store.list().length, WATCH_LIMIT);
  // No storage at all still works for the page.
  assert.ok(createWatchStore().add({ query: 'x' }));
});

test('a watch lists stories newest first and counts what is new since it was seen', () => {
  const snapshot = {
    articles: [
      article('1', 'Grain ships leave Odesa', { publishedAt: '2026-10-10T09:00:00.000Z' }),
      article('2', 'Grain vessels sail from Odesa port', { publisher: 'DW', publishedAt: '2026-10-10T09:30:00.000Z' }),
      article('3', 'Grain prices ease', { publishedAt: '2026-10-10T12:00:00.000Z' }),
      article('4', 'Football results', { publishedAt: '2026-10-10T13:00:00.000Z' }),
    ],
    stories: [
      { id: 's-1', articleIds: ['1', '2'], differing: [{ what: 'killed', values: [] }] },
      { id: 's-3', articleIds: ['3'] },
      { id: 's-4', articleIds: ['4'] },
    ],
  };
  const watch = { id: 'w', name: 'Grain', criteria: { query: 'grain' }, seenAt: Date.parse('2026-10-10T10:00:00Z') };
  const result = watchStories(snapshot, watch);
  assert.deepEqual(result.stories.map((s) => [s.id, s.outlets, s.headlines, s.fresh]), [
    ['s-3', 1, 1, true],
    ['s-1', 2, 2, false],
  ]);
  assert.equal(result.total, 2);
  assert.equal(result.fresh, 1);
  // The lead is the newest matching headline, in the publisher's own words.
  assert.equal(result.stories[1].title, 'Grain vessels sail from Odesa port');
  assert.equal(result.stories[1].url, 'https://example.org/2');
  const [section] = buildBriefing(snapshot, [watch]);
  assert.equal(section.watch.name, 'Grain');
  assert.equal(section.total, 2);
  assert.deepEqual(buildBriefing(null, [watch])[0].stories, []);
});

test('marking seen moves the line for what counts as new', () => {
  let clock = 100;
  const store = createWatchStore({ storage: memory(), now: () => clock });
  const a = store.add({ query: 'a' });
  const b = store.add({ query: 'b' });
  clock = 500;
  store.markSeen([a.id]);
  assert.deepEqual(store.list().map((w) => w.seenAt), [500, 100]);
  clock = 900;
  store.markSeen();
  assert.deepEqual(store.list().map((w) => w.seenAt), [900, 900]);
  assert.ok(b);
});
