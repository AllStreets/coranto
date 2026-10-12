import assert from 'node:assert/strict';
import test from 'node:test';

import { aroundStory } from './corantoAround.js';

const panama = { name: 'David', lat: 8.43, lon: -82.43, precision: 'city' };
const layers = {
  earthquakes: {
    on: true,
    rows: [
      {
        magnitude: 4.8,
        place: '25 km W of Río Grande, Panama',
        lat: 7.72,
        lon: -81.57,
      },
      { magnitude: 6.1, place: 'Fiji', lat: -17.7, lon: 178 },
    ],
  },
  military: { on: true, rows: [{ callsign: 'RCH440', lat: 9.0, lon: -82.0 }] },
  'ais-live-vessels': { on: false, rows: [] },
};
const readLayer = (id) => layers[id] ?? { on: false, rows: [] };

test('only what is within range of the story is listed, nearest first', () => {
  const model = aroundStory({
    place: panama,
    storyText: 'Panama suffers aftershocks after earthquake',
    readLayer,
  });
  assert.equal(model.measurable, true);
  const quakes = model.groups.find((group) => group.id === 'earthquakes');
  assert.equal(quakes.count, 1, 'Fiji is not near Panama');
  assert.match(quakes.rows[0].label, /^M4\.8 · 25 km W/);
  assert.ok(quakes.rows[0].km > 50 && quakes.rows[0].km < 200);
  assert.equal(model.groups.find((group) => group.id === 'military').count, 1);
  assert.equal(model.found, 2);
});

test('a layer that is off is not counted as empty, and is offered when the story is about it', () => {
  const model = aroundStory({
    place: panama,
    storyText: 'Tanker seized in the strait as navy closes in',
    readLayer,
  });
  assert.ok(model.unchecked.includes('Ships'));
  assert.equal(
    model.groups.some((group) => group.id === 'ais-live-vessels'),
    false,
  );
  assert.deepEqual(
    model.suggestions.map((entry) => [entry.id, entry.why]),
    [['ais-live-vessels', 'This story mentions shipping.']],
  );
});

test('a story placed at a country has no point to measure from', () => {
  const model = aroundStory({
    place: { name: 'Panama', lat: 8.4, lon: -80.1, precision: 'country' },
    storyText: 'Panama earthquake',
    readLayer,
  });
  assert.equal(model.measurable, false);
  assert.deepEqual(model.groups, []);
});

test('"fires missiles" is not a wildfire', () => {
  const model = aroundStory({
    place: panama,
    storyText: 'North Korea fires missiles after test',
    readLayer: () => ({ on: false, rows: [] }),
  });
  assert.deepEqual(model.suggestions, []);
});
