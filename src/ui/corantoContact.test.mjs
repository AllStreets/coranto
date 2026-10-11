import assert from 'node:assert/strict';
import test from 'node:test';
import { contactCard, contactLink } from './corantoContact.js';

test('an aircraft becomes a card of its own fields with a public track link', () => {
  const card = contactCard({
    id: 'AE0687',
    layerId: 'military',
    layerName: 'Military Flights',
    source: 'adsb.lol',
    label: 'RCH443',
    properties: {
      altitudeFt: 39000,
      speedKt: 514.26,
      operator: '',
      route: null,
      onGround: false,
    },
  });
  assert.deepEqual(card, {
    kind: 'MILITARY FLIGHTS',
    title: 'RCH443',
    meta: 'altitude ft 39000 · speed kt 514.3 · source adsb.lol',
    url: 'https://adsb.lol/?icao=ae0687',
    linkText: 'Open its live track at adsb.lol',
  });
});

test('a vessel links by its MMSI', () => {
  const record = {
    id: 'ais-211474440',
    layerId: 'ais-live-vessels',
    layerName: 'Live AIS Vessels',
    label: 'SEAEAGLE II',
    properties: {
      mmsi: '211474440',
      type: 'Cargo',
      speedKt: 11.2,
      destination: 'HAMBURG',
    },
  };
  assert.equal(
    contactLink(record).url,
    'https://www.marinetraffic.com/en/ais/details/ships/mmsi:211474440',
  );
  assert.equal(
    contactCard(record).meta,
    'MMSI 211474440 · type Cargo · speed kt 11.2 · destination HAMBURG',
  );
});

test('anything else gets a card without a link, and nothing gets no card', () => {
  const site = contactCard({
    id: 'osm-1',
    layerId: 'military-installations',
    layerName: 'Military Sites',
    label: 'Camp Darby',
    properties: {},
  });
  assert.equal(site.url, '');
  assert.equal(site.kind, 'MILITARY SITES');
  assert.equal(contactCard(null), null);
  assert.equal(contactCard({ id: 'x', label: '  ' }), null);
  // An identifier that is not a transponder address is never turned into a link.
  assert.equal(contactLink({ id: 'not-hex', layerId: 'flights' }), null);
  assert.equal(
    contactLink({ layerId: 'ais-live-vessels', properties: { mmsi: '12' } }),
    null,
  );
});

test('stories near a selected aircraft are found by distance to city-pinned places only', async () => {
  const { contactPosition, distanceKm, nearbyStoryPlaces } =
    await import('./corantoContact.js');
  assert.deepEqual(contactPosition({ properties: { lat: 51.5, lon: -0.1 } }), {
    lat: 51.5,
    lon: -0.1,
  });
  assert.equal(contactPosition({ label: 'x' }), null);
  // London to Paris is about 344 km.
  const km = distanceKm(
    { lat: 51.5074, lon: -0.1278 },
    { lat: 48.8566, lon: 2.3522 },
  );
  assert.ok(km > 335 && km < 350, String(km));
  const places = [
    {
      key: 'city:Paris',
      name: 'Paris',
      precision: 'city',
      lat: 48.8566,
      lon: 2.3522,
      articles: [1, 2],
    },
    {
      key: 'city:Reims',
      name: 'Reims',
      precision: 'city',
      lat: 49.2583,
      lon: 4.0317,
      articles: [1],
    },
    {
      key: 'country:France',
      name: 'France',
      precision: 'country',
      lat: 46.2,
      lon: 2.2,
      articles: [1, 2, 3],
    },
    {
      key: 'city:Doha',
      name: 'Doha',
      precision: 'city',
      lat: 25.2854,
      lon: 51.531,
      articles: [1],
    },
  ];
  const near = nearbyStoryPlaces(places, { lat: 49.0, lon: 3.0 });
  assert.deepEqual(
    near.map((entry) => entry.place.name),
    ['Paris', 'Reims'],
  );
});
