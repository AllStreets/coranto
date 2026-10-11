import assert from 'node:assert/strict';
import test from 'node:test';

import { SATELLITE_CLASSES } from '../data/satelliteClass.js';
import { satelliteIconColour } from './corantoSatelliteIcons.js';

test('a satellite icon takes its class colour, so the geostationary belt stays violet', () => {
  assert.equal(
    satelliteIconColour({ id: 1, group: 'geo' }),
    SATELLITE_CLASSES.geo.color,
  );
  assert.equal(
    satelliteIconColour({ id: 2, group: 'gps-ops' }),
    SATELLITE_CLASSES.nav.color,
  );
  assert.equal(
    satelliteIconColour({ id: 25544, group: 'stations' }),
    '#ff4444',
  );
  // An unknown group falls back to the engine's catch-all class.
  assert.equal(
    satelliteIconColour({ id: 3, group: null }),
    SATELLITE_CLASSES.visual.color,
  );
});
