import assert from 'node:assert/strict';
import test from 'node:test';
import { focusLongitudeShift } from './index.js';

const base = { lat: 0, height: 3_200_000, viewportHeightPx: 900, fovy: 1 };

test('no offset, no shift', () => {
  assert.equal(focusLongitudeShift({ ...base, offsetPx: 0 }), 0);
  assert.equal(
    focusLongitudeShift({ ...base, offsetPx: 200, viewportHeightPx: 0 }),
    0,
  );
});

test('a place pushed right moves the camera west, symmetric, and wider at high latitude', () => {
  const east = focusLongitudeShift({ ...base, offsetPx: 200 });
  const west = focusLongitudeShift({ ...base, offsetPx: -200 });
  assert.ok(east > 0, 'camera goes west of the place');
  assert.equal(west, -east);
  // At 3,200 km with a 1 rad view, 200 of 450 half-height px is a few degrees.
  assert.ok(east > 3 && east < 12, `shift ${east}`);
  const north = focusLongitudeShift({ ...base, lat: 60, offsetPx: 200 });
  assert.ok(Math.abs(north - east * 2) < 1e-9);
});

test('a ray past the horizon stops at the horizon', () => {
  const far = focusLongitudeShift({
    ...base,
    height: 40_000_000,
    offsetPx: 5000,
  });
  assert.ok(Number.isFinite(far) && far > 0 && far <= 90);
});
