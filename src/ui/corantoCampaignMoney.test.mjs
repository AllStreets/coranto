import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fecCycle,
  formatMoney,
  isShowableCandidate,
  parseFecTotals,
  seatLabel,
} from '../sources/campaignFinance/records.js';
import {
  CampaignFinanceUnavailableError,
  createCampaignFinanceService,
} from '../sources/campaignFinance/service.js';
import { buildMoneyModel } from './corantoCampaignMoney.js';

const NOW = Date.parse('2026-10-11T08:00:00Z');
const row = (over = {}) => ({
  candidate_id: 'S8GA00180',
  name: 'OSSOFF, T. JONATHAN',
  party: 'DEM',
  party_full: 'DEMOCRATIC PARTY',
  state: 'GA',
  district: '00',
  office: 'S',
  receipts: 97986263.04,
  disbursements: 59730545.53,
  cash_on_hand_end_period: '42587451.00',
  coverage_end_date: '2026-06-30',
  incumbent_challenge_full: 'Incumbent',
  ...over,
});
const senate = {
  results: [
    row({
      candidate_id: 'S6TX00479',
      name: 'TALARICO, JAMES',
      state: 'TX',
      receipts: 68560930.42,
    }),
    row(),
    row({ candidate_id: 'S0XX00001', name: 'NO FIGURE', receipts: null }),
    row({
      candidate_id: 'S0XX00002',
      name: 'NO DATE',
      coverage_end_date: null,
    }),
    row({ candidate_id: 'H0XX00003', name: 'WRONG OFFICE', office: 'H' }),
    row({ name: 'DUPLICATE' }),
  ],
};
const house = {
  results: [
    row({
      candidate_id: 'H8NY15148',
      name: 'OCASIO-CORTEZ, ALEXANDRIA',
      office: 'H',
      state: 'NY',
      district: '14',
      receipts: 32600000,
    }),
  ],
};

test('FEC rows keep the filed figures; incomplete rows are dropped', () => {
  const rows = parseFecTotals(senate, 'S');
  assert.deepEqual(
    rows.map((r) => r.id),
    ['S8GA00180', 'S6TX00479'],
  );
  const [first] = rows;
  assert.equal(first.receipts, 97986263.04);
  assert.equal(first.spent, 59730545.53);
  assert.equal(first.cash, 42587451);
  assert.equal(first.through, '2026-06-30');
  assert.equal(first.url, 'https://www.fec.gov/data/candidate/S8GA00180/');
  assert.equal(seatLabel(first), 'GA');
  assert.equal(seatLabel(parseFecTotals(house, 'H')[0]), 'NY-14');
  assert.ok(rows.every(isShowableCandidate));
  assert.deepEqual(parseFecTotals(senate, 'P'), []);
  assert.deepEqual(parseFecTotals({ message: 'over rate limit' }, 'S'), []);
});

test('cycles end in even years; money is rounded for reading only', () => {
  assert.equal(fecCycle(NOW), 2026);
  assert.equal(fecCycle(Date.parse('2027-03-01T00:00:00Z')), 2028);
  assert.deepEqual([97986263.04, 412300, 950, 1.25e9, NaN].map(formatMoney), [
    '$98.0M',
    '$412K',
    '$950',
    '$1.25B',
    '',
  ]);
});

const routes =
  (map, seen = []) =>
  async (url, init) => {
    seen.push({ url, key: init.headers['X-Api-Key'] });
    const value = map[new URL(url).searchParams.get('office')];
    return value ? Response.json(value) : new Response('', { status: 500 });
  };

test('the key travels in a header, never in the address', async () => {
  const seen = [];
  await createCampaignFinanceService({
    now: () => NOW,
    apiKey: 'secret-key',
    fetchImpl: routes({ S: senate, H: house }, seen),
  }).getPayload();
  assert.equal(seen.length, 2);
  assert.ok(seen.every((call) => call.key === 'secret-key'));
  assert.ok(seen.every((call) => !call.url.includes('secret-key')));
  const shared = [];
  const payload = await createCampaignFinanceService({
    now: () => NOW,
    fetchImpl: routes({ S: senate, H: house }, shared),
  }).getPayload();
  assert.equal(shared[0].key, 'DEMO_KEY');
  assert.equal(payload.sharedKey, true);
  // The payload sent to the browser carries no key.
  assert.ok(!JSON.stringify(payload).includes('DEMO_KEY'));
});

test('one office down is reported; all down with nothing saved is an error', async () => {
  const partial = await createCampaignFinanceService({
    now: () => NOW,
    fetchImpl: routes({ S: senate }),
  }).getPayload();
  assert.deepEqual(
    partial.offices.map((o) => [o.office, o.ok, o.candidates.length]),
    [
      ['S', true, 2],
      ['H', false, 0],
    ],
  );
  const model = buildMoneyModel({ status: 'ready', payload: partial }, 'H');
  assert.deepEqual(model.rows, []);
  assert.equal(model.note, 'The FEC did not return US House totals.');
  await assert.rejects(
    createCampaignFinanceService({
      now: () => NOW,
      fetchImpl: routes({}),
    }).getPayload(),
    (error) => error instanceof CampaignFinanceUnavailableError,
  );
});

test('a saved read is reused with its real fetch time, then marked stale', async () => {
  let clock = NOW;
  const first = createCampaignFinanceService({
    now: () => clock,
    fetchImpl: routes({ S: senate, H: house }),
  });
  const fresh = await first.getPayload();
  let calls = 0;
  const later = createCampaignFinanceService({
    now: () => clock,
    initialState: JSON.parse(JSON.stringify(first.exportState())),
    fetchImpl: async () => {
      calls += 1;
      return new Response('', { status: 500 });
    },
  });
  clock = NOW + 60 * 60 * 1000;
  assert.equal((await later.getPayload()).fetchedAt, fresh.fetchedAt);
  assert.equal(calls, 0);
  clock = NOW + 13 * 60 * 60 * 1000;
  const stale = await later.getPayload();
  assert.equal(stale.stale, true);
  assert.equal(stale.fetchedAt, fresh.fetchedAt);
  assert.match(
    buildMoneyModel({ status: 'ready', payload: stale }, 'S').note,
    /^Showing figures saved 2026-10-11/,
  );
});

test('the section ranks by money raised and says where the figures stop', () => {
  const payload = {
    cycle: 2026,
    stale: false,
    offices: [
      {
        office: 'S',
        name: 'US Senate',
        candidates: [...parseFecTotals(senate, 'S'), { id: 'bad' }],
      },
      { office: 'H', name: 'US House', candidates: parseFecTotals(house, 'H') },
    ],
  };
  const model = buildMoneyModel({ status: 'ready', payload }, 'S');
  assert.deepEqual(
    model.rows.map((r) => [r.rank, r.name, r.detail, r.raised]),
    [
      ['1', 'OSSOFF, T. JONATHAN', 'DEM · GA', '$98.0M'],
      ['2', 'TALARICO, JAMES', 'DEM · TX', '$68.6M'],
    ],
  );
  assert.equal(model.rows[0].share, 1);
  assert.equal(model.source, 'FEC · 2026 cycle · filings through 2026-06-30');
  assert.equal(model.note, '');
  assert.deepEqual(buildMoneyModel({ status: 'unavailable' }).rows, []);
  assert.match(buildMoneyModel({ status: 'loading' }).note, /^Reading/);
});
