import assert from 'node:assert/strict';
import test from 'node:test';

import { buildReliefModel, RELIEF_TERMS } from '../../ui/corantoRelief.js';
import { formatPeople, parseDisplacement, parseOutbreaks } from './records.js';
import { createReliefService, ReliefUnavailableError } from './service.js';

const UNHCR = {
  items: [
    {
      year: 2025,
      coo_name: 'Sudan',
      coo_iso: 'SDN',
      refugees: '2000000',
      asylum_seekers: 100000,
      idps: 9000000,
      oip: '-',
    },
    {
      year: 2025,
      coo_name: 'Nowhere',
      coo_iso: 'XXX',
      refugees: '-',
      idps: '-',
    },
  ],
};
const WHO = {
  value: [
    {
      DonId: '2026-DON600',
      Title: 'Cholera - Sudan',
      PublicationDate: '2026-10-01T00:00:00Z',
      UrlName: '2026-DON600',
    },
    {
      DonId: '2026-DON601',
      Title: '',
      PublicationDate: '2026-10-02T00:00:00Z',
    },
  ],
};

test('displacement keeps what UNHCR published and leaves blanks blank', () => {
  const rows = parseDisplacement(UNHCR, 2025);
  assert.equal(
    rows.length,
    1,
    'a country with no figures at all is not listed',
  );
  const [sudan] = rows;
  assert.equal(sudan.iso3, 'SDN');
  assert.equal(sudan.refugees, 2_000_000);
  assert.equal(sudan.displacedInside, 9_000_000);
  assert.equal(sudan.othersInNeed, null, 'a dash is not a zero');
  assert.equal(sudan.total, 11_100_000);
  assert.match(sudan.url, /^https:\/\/www\.unhcr\.org\//);
});

test('an outbreak notice needs a title and a link, and is placed only by name', () => {
  const notices = parseOutbreaks(WHO);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].disease, 'Cholera');
  assert.equal(notices[0].where, 'Sudan');
  assert.equal(
    notices[0].url,
    'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON600',
  );
  assert.equal(notices[0].place?.name, 'Sudan');
});

test('people counts are rounded for reading', () => {
  assert.equal(formatPeople(12_940_000), '12.9M');
  assert.equal(formatPeople(940_400), '940K');
  assert.equal(formatPeople(512), '512');
  assert.equal(formatPeople(null), '');
});

const reply = (body, ok = true) =>
  new Response(JSON.stringify(body), { status: ok ? 200 : 502 });

test('one source down still shows the other, and names the one that failed', async () => {
  const service = createReliefService({
    fetchImpl: async (url) =>
      String(url).includes('unhcr') ? reply(UNHCR) : reply({}, false),
    now: () => Date.parse('2026-10-11T00:00:00Z'),
  });
  const payload = await service.getPayload();
  assert.equal(payload.displacement.rows.length, 1);
  assert.deepEqual(payload.outbreaks, []);
  assert.deepEqual(payload.sources.filter((source) => !source.ok).length, 1);
  const model = buildReliefModel({ status: 'ready', payload });
  assert.equal(model.down.length, 1);
  assert.equal(model.displacement.rows[0].total, '11.1M');
  assert.equal(model.displacement.rows[0].share, 1);
});

test('with both sources down there is an error, never a stand-in', async () => {
  const service = createReliefService({
    fetchImpl: async () => reply({}, false),
    now: () => Date.parse('2026-10-11T00:00:00Z'),
  });
  await assert.rejects(service.getPayload(), ReliefUnavailableError);
  const model = buildReliefModel({ status: 'unavailable' });
  assert.equal(model.displacement, null);
  assert.deepEqual(model.outbreaks, []);
  assert.match(model.note, /Nothing to show/);
});

test('the humanitarian news filter is plain words', () => {
  assert.ok(RELIEF_TERMS.includes('refugees'));
  assert.ok(RELIEF_TERMS.every((term) => term === term.toLowerCase()));
});
