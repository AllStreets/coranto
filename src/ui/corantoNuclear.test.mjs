import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTROL_ICONS,
  ICONS,
  LAYER_ICONS,
  TOPIC_COLOURS,
  hazardIcon,
  layerIconCss,
  liftColour,
  markerImage,
} from '../data/corantoIcons.js';
import { buildMapKeyModel } from './corantoMapKey.js';
import {
  NUCLEAR_SOURCE,
  NUCLEAR_STATES,
  nuclearCard,
} from './corantoNuclear.js';

test('nine nuclear-armed states are marked, each with a source and no warhead count', () => {
  assert.deepEqual(
    NUCLEAR_STATES.map((s) => s.code),
    ['US', 'RU', 'GB', 'FR', 'CN', 'IN', 'PK', 'KP', 'IL'],
  );
  for (const state of NUCLEAR_STATES) {
    assert.ok(
      Number.isFinite(state.lat) && Number.isFinite(state.lon),
      state.code,
    );
    const card = nuclearCard(state);
    assert.equal(card.url, NUCLEAR_SOURCE.url);
    assert.match(card.meta, /Federation of American Scientists/);
    assert.doesNotMatch(card.meta, /\d{2,}/);
  }
  assert.match(
    nuclearCard(NUCLEAR_STATES.at(-1)).meta,
    /neither confirms nor denies/,
  );
});

test('markers are vector images drawn larger than they are shown', () => {
  const image = decodeURIComponent(
    markerImage({ icon: 'military', colour: TOPIC_COLOURS.military }),
  );
  assert.match(image, /^data:image\/svg\+xml,<svg /);
  assert.match(image, /width="128" height="128"/);
  assert.doesNotMatch(image, /currentColor/);
  assert.match(
    decodeURIComponent(
      markerImage({ icon: 'news', colour: '#ffffff', approximate: true }),
    ),
    /stroke-dasharray/,
  );
  assert.equal(liftColour('#000000', 0.5), '#808080');
  assert.equal(hazardIcon('storm'), 'cyclone');
  assert.equal(hazardIcon('landslide'), 'hazard');
  // No emoji or text glyph anywhere in the icon set.
  for (const [name, [, body]] of Object.entries(ICONS))
    assert.doesNotMatch(body, /[^\x00-\x7f]/, name);
  // Good news and the climate topic are different greens.
  assert.notEqual(TOPIC_COLOURS.good, TOPIC_COLOURS.climate);
});

test('the map key describes only what is switched on', () => {
  const none = buildMapKeyModel({});
  assert.deepEqual(
    none.map((s) => s.heading),
    ['NOTHING TO EXPLAIN'],
  );
  const full = buildMapKeyModel({
    news: true,
    hazardKinds: ['storm', 'cyclone', 'flood'],
    elections: true,
    fires: true,
    governmentAircraft: true,
    nuclear: true,
    otherLayers: ['FLIGHTS'],
  });
  assert.deepEqual(
    full.map((s) => s.heading),
    [
      'STORIES BY TOPIC',
      'HOW A STORY IS PLACED',
      'NATURAL HAZARDS',
      'HAZARD ALERT LEVEL',
      'ALSO ON THE MAP',
      'OTHER LAYERS ON',
    ],
  );
  // Storm and cyclone share one icon, so they share one row.
  assert.deepEqual(
    full[2].rows.map((r) => r.label),
    ['Cyclone, Storm', 'Flood'],
  );
  assert.equal(full[4].rows.length, 5);
  assert.deepEqual(
    buildMapKeyModel({ news: true, goodNewsOnly: true })[0].rows.map(
      (r) => r.label,
    ),
    ['Good news'],
  );
});

test('every engine layer and control has an icon, applied only under a scope', () => {
  for (const [id, icon] of Object.entries(LAYER_ICONS))
    assert.ok(ICONS[icon], id);
  for (const [selector, icon] of Object.entries(CONTROL_ICONS))
    assert.ok(ICONS[icon], selector);
  assert.equal(Object.keys(LAYER_ICONS).length, 30);
  const css = layerIconCss("body[data-coranto-frame='one']");
  // Every rule sits under the scope, so automated browsers are unaffected.
  for (const rule of css.split('}').filter(Boolean))
    assert.ok(
      rule.startsWith("body[data-coranto-frame='one'] "),
      rule.slice(0, 60),
    );
  assert.match(css, /data-layer-id='ais-live-vessels'/);
});
