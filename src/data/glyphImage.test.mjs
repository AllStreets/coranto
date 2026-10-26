import test from 'node:test';
import assert from 'node:assert/strict';
import { ALERT_RING_COLOURS, glyphImage, markerImage } from './corantoIcons.js';

const svg = (uri) =>
  decodeURIComponent(uri.replace(/^data:image\/svg\+xml,/, ''));

test('a glyph marker has no disc edge and no ring, only a fading halo', () => {
  const s = svg(glyphImage({ icon: 'earthquake', colour: '#f2c14e' }));
  assert.match(s, /<radialGradient id="h">/);
  assert.match(s, /stop-opacity="0"/); // fades to nothing
  assert.doesNotMatch(s, /stroke="#f2c14e"/); // no coloured ring
  assert.doesNotMatch(s, /stroke-dasharray/);
  assert.doesNotMatch(s, /fill-opacity="0\.9"/); // no solid disc
});

test('the whole marker stays clickable', () => {
  // Cesium skips billboard pixels under about 2/255 alpha when picking.
  const s = svg(glyphImage({ icon: 'nuclear', colour: '#ff9f0a' }));
  const hit = s.match(/r="31" fill="#050912" fill-opacity="([\d.]+)"/);
  assert.ok(hit, 'an invisible hit disc is drawn');
  assert.ok(Number(hit[1]) * 255 > 2, 'above the pick threshold');
  assert.ok(Number(hit[1]) <= 0.03, 'and still invisible');
});

test('the glyph is drawn larger than inside a disc', () => {
  const g = svg(glyphImage({ icon: 'launch', colour: '#4fd8ff' }));
  const m = svg(markerImage({ icon: 'launch', colour: '#4fd8ff' }));
  const scale = (s) => Number(s.match(/scale\(([\d.]+)\)/)[1]);
  assert.ok(scale(g) / scale(m) > 1.4);
});

test('an alert is a dot, not a ring', () => {
  for (const alert of ['Red', 'Orange']) {
    const s = svg(glyphImage({ icon: 'hazard', colour: '#ffffff', alert }));
    assert.match(
      s,
      new RegExp(
        `<circle cx="52" cy="12" r="6" fill="${ALERT_RING_COLOURS[alert]}"`,
      ),
    );
    assert.doesNotMatch(s, /r="29\.2"/);
  }
  assert.doesNotMatch(
    svg(glyphImage({ icon: 'hazard', colour: '#ffffff', alert: 'Green' })),
    /cx="52" cy="12"/,
  );
});

test('selection is a thin white ring', () => {
  const s = svg(
    glyphImage({ icon: 'hazard', colour: '#ffffff', selected: true }),
  );
  assert.match(s, /stroke="#ffffff" stroke-width="1\.5"/);
});

test('stories keep their solid or dashed ring', () => {
  const solid = svg(markerImage({ icon: 'news', colour: '#8ab4ff' }));
  const dashed = svg(
    markerImage({ icon: 'news', colour: '#8ab4ff', approximate: true }),
  );
  assert.match(solid, /stroke="#8ab4ff"/);
  assert.doesNotMatch(solid, /stroke-dasharray/);
  assert.match(dashed, /stroke-dasharray="5 4"/);
});

test('an election is the ballot glyph on a halo, never under 24 px', async () => {
  const { electionMarkerSize } = await import('../layers/elections/model.js');
  const s = svg(glyphImage({ icon: 'election', colour: '#6e8aff' }));
  assert.match(s, /<radialGradient id="h">/);
  assert.doesNotMatch(s, /stroke="#6e8aff"/);
  for (const daysUntil of [3, 30, 100])
    assert.ok(electionMarkerSize({ daysUntil }) >= 24);
  assert.ok(
    electionMarkerSize({ daysUntil: 3 }) >
      electionMarkerSize({ daysUntil: 100 }),
  );
});
