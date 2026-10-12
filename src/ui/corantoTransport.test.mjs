import assert from 'node:assert/strict';
import test from 'node:test';

import { windowSnapshot } from '../layers/news/model.js';
import { replayLabel, replaySteps, tourStops } from './corantoTransport.js';

const H = 3_600_000;
const now = Date.parse('2026-10-12T12:00:00Z');

test('a tour visits the most-reported places first, with their newest headline', () => {
  const place = (name, titles) => ({
    key: `city:${name}`,
    name,
    articles: titles.map((title) => ({ title, publisher: 'BBC' })),
  });
  const stops = tourStops(
    [
      place('Lima', ['a']),
      place('Paris', ['newest', 'older', 'oldest']),
      place('Empty', []),
      place('Cairo', ['x', 'y']),
    ],
    2,
  );
  assert.deepEqual(
    stops.map((stop) => [stop.name, stop.count, stop.headline]),
    [
      ['Paris', 3, 'newest'],
      ['Cairo', 2, 'x'],
    ],
  );
});

test('a replay steps from the oldest headline held to now, never past a week', () => {
  const short = replaySteps(now - 9 * H, now, 3);
  assert.deepEqual(
    short.map((at) => (at - now) / H),
    [-6, -3, 0],
  );
  const long = replaySteps(now - 30 * 24 * H, now, 3);
  assert.equal(
    (now - long[0]) / H,
    7 * 24 - 3,
    'starts one step into the week',
  );
  assert.equal(long.at(-1), now);
  assert.deepEqual(replaySteps(Infinity, now), [now], 'nothing held: only now');
  assert.equal(
    replayLabel(Date.parse('2026-10-10T15:20:00Z')),
    'Sat 10 Oct 15:00 UTC',
  );
});

test('a replayed moment shows only what had been published by then', () => {
  const article = (id, hoursAgo) => ({
    id,
    publisher: 'BBC',
    publishedAt: new Date(now - hoursAgo * H).toISOString(),
  });
  const snapshot = {
    fetchedAt: new Date(now).toISOString(),
    articles: [article('new', 1), article('mid', 30), article('old', 60)],
    stories: [
      { id: 's1', articleIds: ['new', 'mid'], outlets: 1 },
      { id: 's2', articleIds: ['old'], outlets: 1 },
    ],
  };
  const then = windowSnapshot(snapshot, 24, now - 28 * H);
  assert.deepEqual(
    then.articles.map((entry) => entry.id),
    ['mid'],
    'the newer headline had not been published; the older one was out of range',
  );
  assert.deepEqual(
    then.stories.map((story) => story.id),
    ['s1'],
  );
  // Without a moment, the range still ends at the fetch time, as before.
  assert.deepEqual(
    windowSnapshot(snapshot, 24).articles.map((entry) => entry.id),
    ['new'],
  );
});
