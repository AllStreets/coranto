import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hazardNotices,
  outbreakNotices,
  unseen,
  watchAlerts,
} from './corantoAlerts.js';

test('a watch is announced only when its count of new stories goes up', () => {
  const before = new Map([
    ['w1', 2],
    ['w2', 5],
  ]);
  const now = [
    { id: 'w1', name: '"ukraine"', fresh: 5 },
    { id: 'w2', name: 'climate', fresh: 5 },
    { id: 'w3', name: 'just saved', fresh: 9 },
  ];
  const alerts = watchAlerts(before, now);
  assert.deepEqual(
    alerts.map((alert) => [alert.title, alert.detail, alert.watchId]),
    [['Your watch "ukraine"', '3 more new stories, 5 in all', 'w1']],
  );
  assert.deepEqual(watchAlerts(null, now), [], 'nothing on the first read');
  assert.deepEqual(
    watchAlerts(new Map([['w1', 6]]), now),
    [],
    'a count that fell (the reader looked) is not an arrival',
  );
});

test('what is already there when the page opens is recorded, not announced', () => {
  const items = [{ id: 'a' }, { id: 'b' }];
  const first = unseen(null, items);
  assert.deepEqual(first.fresh, []);
  assert.deepEqual([...first.seen], ['a', 'b']);
  const second = unseen(first.seen, [...items, { id: 'c' }]);
  assert.deepEqual(
    second.fresh.map((item) => item.id),
    ['c'],
  );
  assert.deepEqual(unseen(second.seen, items).fresh, [], 'never twice');
});

test('only Orange and Red alerts and WHO notices become notices, with their source', () => {
  const hazards = hazardNotices([
    {
      id: 'g1',
      alert: 'Red',
      title: 'Hurricane Simon',
      source: 'GDACS',
      lat: 20,
      lon: -106,
    },
    { id: 'g2', alert: 'Green', title: 'Small flood', source: 'GDACS' },
    { id: 'n1', alert: null, title: 'Wildfire', source: 'NASA EONET' },
  ]);
  assert.deepEqual(
    hazards.map((notice) => [notice.id, notice.title, notice.detail]),
    [['hazard:g1', 'Red alert: Hurricane Simon', 'GDACS']],
  );
  const who = outbreakNotices([
    {
      id: '2026-DON620',
      disease: 'Cholera',
      where: 'Sudan',
      url: 'https://www.who.int/x',
    },
  ]);
  assert.deepEqual(who[0], {
    id: 'who:2026-DON620',
    kind: 'outbreak',
    icon: 'outbreak',
    title: 'WHO outbreak notice: Cholera',
    detail: 'Sudan',
    url: 'https://www.who.int/x',
  });
});
