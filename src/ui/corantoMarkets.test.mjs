import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatQuoteChange,
  formatQuoteValue,
  isShowableQuote,
  parseCrypto,
  parseFx,
} from '../sources/markets/records.js';
import {
  MarketsUnavailableError,
  createMarketService,
} from '../sources/markets/service.js';
import { BROADCASTERS, broadcastUrl } from './corantoBroadcasts.js';
import { buildMarketsModel } from './corantoMarkets.js';

const NOW = Date.parse('2026-10-11T08:00:00Z');
const fx = {
  base: 'USD',
  rates: {
    '2026-10-08': { EUR: 0.9, GBP: 0.757, JPY: 158.28 },
    '2026-10-09': { EUR: 0.891, GBP: 0.757, JPY: 158.25 },
  },
};
const crypto = {
  bitcoin: { usd: 82948, usd_24h_change: 0.26, last_updated_at: 1791705626 },
  ethereum: { usd: 2499.4, last_updated_at: 1791705615 },
  solana: { usd: 'n/a', last_updated_at: 1791705615 },
};

test('exchange rates keep the source’s day and compare with its previous day', () => {
  const quotes = parseFx(fx);
  assert.deepEqual(quotes.map((q) => q.id), ['fx:EUR', 'fx:GBP', 'fx:JPY']);
  const eur = quotes[0];
  assert.equal(eur.value, 0.891);
  assert.equal(eur.asOfText, '2026-10-09');
  assert.equal(eur.changeBasis, 'since 2026-10-08');
  assert.ok(Math.abs(eur.change - -1) < 1e-9);
  assert.equal(quotes[1].change, 0);
  assert.match(eur.source, /European Central Bank/);
  assert.ok(quotes.every(isShowableQuote));
});

test('with one day of rates there is a figure and no invented change', () => {
  const [eur] = parseFx({ base: 'USD', rates: { '2026-10-09': { EUR: 0.891 } } });
  assert.equal(eur.change, null);
  assert.equal(eur.changeBasis, null);
  assert.deepEqual(parseFx({ base: 'EUR', rates: fx.rates }), []);
  assert.deepEqual(parseFx({}), []);
});

test('crypto prices keep the source’s update time; a bad figure is dropped', () => {
  const quotes = parseCrypto(crypto);
  assert.deepEqual(quotes.map((q) => q.id), ['crypto:BTC', 'crypto:ETH']);
  assert.equal(quotes[0].asOf, new Date(1791705626 * 1000).toISOString());
  assert.equal(quotes[0].changeBasis, 'in 24 hours');
  // No 24-hour figure from the source means no change shown.
  assert.equal(quotes[1].change, null);
  assert.ok(quotes.every(isShowableQuote));
});

test('figures are formatted without adding precision they do not have', () => {
  assert.equal(formatQuoteValue(0.8924), '0.8924');
  assert.equal(formatQuoteValue(158.25), '158.25');
  assert.equal(formatQuoteValue(82948), '82,948');
  assert.deepEqual([0.256, -1.1, 0, null].map(formatQuoteChange), ['+0.26%', '−1.10%', '0.00%', '']);
});

const routes = (map) => async (url) => {
  const value = map[new URL(url).hostname];
  return value ? Response.json(value) : new Response('', { status: 500 });
};

test('one source down is named; both down with nothing cached is an error', async () => {
  const partial = await createMarketService({
    now: () => NOW,
    fetchImpl: routes({ 'api.frankfurter.dev': fx }),
  }).getPayload();
  assert.equal(partial.quotes.length, 3);
  assert.deepEqual(
    partial.sources.map((s) => [s.name, s.ok]),
    [
      ['ECB reference rates', true],
      ['CoinGecko', false],
    ],
  );
  const model = buildMarketsModel({ status: 'ready', payload: partial });
  assert.deepEqual(model.down, ['CoinGecko']);
  assert.equal(model.groups.length, 1);
  assert.deepEqual(
    model.groups[0].rows.map((r) => [r.label, r.value, r.change, r.direction]),
    [
      ['USD/EUR', '0.8910', '−1.00%', 'down'],
      ['USD/GBP', '0.7570', '0.00%', 'flat'],
      ['USD/JPY', '158.25', '−0.02%', 'down'],
    ],
  );
  await assert.rejects(
    createMarketService({ now: () => NOW, fetchImpl: routes({}) }).getPayload(),
    (error) => error instanceof MarketsUnavailableError && !('quotes' in error),
  );
});

test('an outage shows one sentence and no figures', () => {
  assert.deepEqual(buildMarketsModel({ status: 'unavailable' }), {
    groups: [],
    note: 'No market source is reachable. Nothing to show.',
    down: [],
  });
  assert.equal(buildMarketsModel({ status: 'loading' }).groups.length, 0);
  const stale = buildMarketsModel({
    status: 'ready',
    payload: { stale: true, quotes: parseFx(fx), sources: [] },
  });
  assert.match(stale.note, /^Showing saved figures/);
  // A malformed quote is never rendered.
  const bad = buildMarketsModel({ status: 'ready', payload: { quotes: [{ id: 'x' }], sources: [] } });
  assert.deepEqual(bad.groups, []);
});

test('live TV links go to each channel’s own live page', () => {
  assert.equal(BROADCASTERS.length, 10);
  for (const [name, , , channelId] of BROADCASTERS) {
    assert.ok(name);
    assert.match(broadcastUrl(channelId), /^https:\/\/www\.youtube\.com\/channel\/UC[\w-]{22}\/live$/);
  }
  assert.equal(new Set(BROADCASTERS.map((row) => row[3])).size, 10);
});
