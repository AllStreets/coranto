import assert from 'node:assert/strict';
import test from 'node:test';

import {
  launchCard,
  launchPayloads,
  launchSites,
  payloadCard,
} from './corantoLaunchIcons.js';

const row = (id, hoursUntil, extra = {}) => ({
  id,
  name: `Rocket ${id}`,
  provider: 'Agency',
  status: 'Go for Launch',
  launchSite: 'Pad 1',
  lat: 28.5618,
  lon: -80.577,
  launchTimeMs: Date.parse('2026-10-12T12:00:00Z'),
  hoursUntil,
  ...extra,
});

test('a site leads with its next launch, or its most recent when none is to come', () => {
  const [site] = launchSites([row('a', -30), row('b', 50), row('c', 6)]);
  assert.equal(site.lead.id, 'c');
  assert.equal(site.others, 2);
  assert.equal(site.upcoming, true);
  const [flown] = launchSites([row('a', -30), row('b', -2)]);
  assert.equal(flown.lead.id, 'b');
  assert.equal(flown.upcoming, false);
});

test('launches at different sites stay apart, and one without a position is left out', () => {
  const sites = launchSites([
    row('a', 5),
    row('b', 5, { lat: 5.2, lon: -52.8 }),
    row('c', 5, { lat: null }),
  ]);
  assert.equal(sites.length, 2);
});

test("a launch card is the list's own record and names its source", () => {
  const [site] = launchSites([row('a', 6), row('b', -40)]);
  const card = launchCard(site);
  assert.equal(card.kind, 'LAUNCH · PLANNED IN 6 H');
  assert.equal(card.title, 'Rocket a');
  assert.equal(
    card.meta,
    'Agency · Pad 1 · status: Go for Launch · 2026-10-12 12:00 UTC · 1 other launch from this site in the list · Launch Library 2',
  );
  assert.equal(
    launchCard(launchSites([row('z', -72)])[0]).kind,
    'LAUNCH · FLOWN 3 DAYS AGO',
  );
  assert.equal(launchCard(null), null);
});

test('only a flown launch from the last week with a catalogued satellite has a payload', () => {
  const payload = { noradId: 65432, name: ' CREW DRAGON 13 ' };
  const rows = [
    row('flown', -30, { payload }),
    row('old', -24 * 9, { payload }),
    row('ahead', 12, { payload }),
    row('unmatched', -5, { payload: null }),
  ];
  const found = launchPayloads(rows);
  assert.deepEqual(
    found.map((entry) => [entry.launchId, entry.noradId, entry.name]),
    [['flown', '65432', 'CREW DRAGON 13']],
  );
  const card = payloadCard(found[0]);
  assert.equal(card.kind, 'SATELLITE · LAUNCHED 30 H AGO');
  assert.match(card.meta, /carried by Rocket flown · catalogue number 65432/);
  assert.match(card.url, /^https:\/\/celestrak\.org\/.*CATNR=65432/);
  assert.equal(payloadCard(null), null);
});
