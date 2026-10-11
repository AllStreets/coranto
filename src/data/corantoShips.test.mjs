import assert from 'node:assert/strict';
import test from 'node:test';
import { SHIP_CLASS_LABELS, shipClass, shipSvg } from './corantoShips.js';

test('a vessel’s hull follows its own AIS type code', () => {
  const cases = {
    70: 'cargo',
    79: 'cargo',
    80: 'tanker',
    60: 'passenger',
    69: 'passenger',
    35: 'military',
    55: 'military',
    30: 'small',
    52: 'small',
    37: 'small',
    40: 'small',
    0: 'other',
    99: 'other',
    '': 'other',
    Cargo: 'cargo',
  };
  for (const [type, cls] of Object.entries(cases))
    assert.equal(shipClass(type), cls, `type ${type}`);
  // Ferries and cruise ships share one class: the code does not tell them apart.
  assert.match(SHIP_CLASS_LABELS.passenger, /ferry or cruise/);
});

test('every class has its own outline, drawn larger than it is shown', () => {
  const outlines = new Set();
  for (const cls of Object.keys(SHIP_CLASS_LABELS)) {
    const svg = shipSvg(cls, '#39d5ff');
    assert.match(
      svg,
      /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="64" height="64" viewBox="-16 -16 32 32">/,
    );
    assert.match(svg, /fill="#39d5ff"/);
    assert.doesNotMatch(svg, /[^\x00-\x7f]/);
    outlines.add(svg.match(/<path d="([^"]+)"/)[1]);
  }
  assert.equal(outlines.size, 6);
  assert.equal(shipSvg('unknown', '#fff'), shipSvg('other', '#fff'));
});
