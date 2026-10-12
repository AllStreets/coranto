import assert from 'node:assert/strict';
import test from 'node:test';

import { quakeCard, quakeStyle } from './corantoQuakeIcons.js';

test('quake icons step up with magnitude', () => {
  assert.equal(quakeStyle(3.1).tier, 'minor');
  assert.equal(quakeStyle(4.5).tier, 'moderate');
  assert.equal(quakeStyle(6).tier, 'major');
  assert.ok(quakeStyle(7).size > quakeStyle(5).size);
  assert.ok(quakeStyle(5).size > quakeStyle(3).size);
});

test('a quake card is the USGS record and links to its event page', () => {
  const now = Date.parse('2026-10-12T02:00:00Z');
  const card = quakeCard(
    {
      id: 'us7000abcd',
      magnitude: 7.7,
      depthKm: 12.4,
      timeMs: now - 3 * 3_600_000,
      place: '40 km S of David, Panama',
    },
    now,
  );
  assert.equal(card.title, 'M7.7 · 40 km S of David, Panama');
  assert.equal(
    card.meta,
    '12 km deep · 3 h ago · 2026-10-11 23:00 UTC · US Geological Survey',
  );
  assert.equal(
    card.url,
    'https://earthquake.usgs.gov/earthquakes/eventpage/us7000abcd',
  );
  // A stand-in id is not a USGS id, so no link is made up from it.
  assert.equal(quakeCard({ id: 'QUAKE-0003', magnitude: 5 }, now).url, '');
  assert.equal(quakeCard(null, now), null);
});
