import assert from 'node:assert/strict';
import test from 'node:test';
import { aircraftFacts, aircraftName, sortAircraft } from './corantoPower.js';

test('aircraft facts state only what the aircraft broadcast', () => {
  assert.equal(
    aircraftFacts({ aircraftClass: 'tanker', altitudeM: 9144, speedMps: 230 }),
    'tanker · 30,000 ft · 447 kt',
  );
  assert.equal(aircraftFacts({ aircraftClass: 'helicopter', onGround: true, speedMps: 3 }), 'helicopter · on the ground');
  // Missing fields are left out, never filled in.
  assert.equal(aircraftFacts({ altitudeM: null, speedMps: null }), '');
});

test('aircraft without a position are not listed; named ones lead', () => {
  const sorted = sortAircraft([
    { id: 'a', icao24: 'a', callsign: null, lat: 1, lon: 1, altitudeM: 9000 },
    { id: 'b', icao24: 'b', callsign: 'RCH212', lat: 2, lon: 2, altitudeM: 3000 },
    { id: 'c', icao24: 'c', callsign: 'TEAL78', lat: 3, lon: 3, altitudeM: 8000 },
    { id: 'd', icao24: 'd', callsign: 'LOST1', lat: null, lon: null },
  ]);
  assert.deepEqual(sorted.map((r) => r.id), ['c', 'b', 'a']);
  assert.deepEqual(sortAircraft(null), []);
});

test('a blank or junk callsign falls back to the transponder address', () => {
  assert.equal(aircraftName({ callsign: 'RCH443 ', icao24: 'ae0687' }), 'RCH443');
  assert.equal(aircraftName({ callsign: '@@@@@@@@', icao24: 'ae0687' }), 'AE0687');
  assert.equal(aircraftName({ callsign: null, icao24: 'ae0687' }), 'AE0687');
});
