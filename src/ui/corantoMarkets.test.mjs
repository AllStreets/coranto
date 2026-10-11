import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatQuoteChange,
  formatQuoteValue,
  isShowableQuote,
  parseCrypto,
  parseFredSeries,
  parseFx,
} from '../sources/markets/records.js';
import {
  MarketsUnavailableError,
  createMarketService,
} from '../sources/markets/service.js';
import {
  BROADCASTERS,
  broadcastEmbedUrl,
  broadcastUrl,
  broadcasterPin,
  isPlayerError,
  nearestBroadcaster,
} from './corantoBroadcasts.js';
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
  assert.deepEqual(
    quotes.map((q) => q.id),
    ['fx:EUR', 'fx:GBP', 'fx:JPY'],
  );
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
  const [eur] = parseFx({
    base: 'USD',
    rates: { '2026-10-09': { EUR: 0.891 } },
  });
  assert.equal(eur.change, null);
  assert.equal(eur.changeBasis, null);
  assert.deepEqual(parseFx({ base: 'EUR', rates: fx.rates }), []);
  assert.deepEqual(parseFx({}), []);
});

test('crypto prices keep the source’s update time; a bad figure is dropped', () => {
  const quotes = parseCrypto(crypto);
  assert.deepEqual(
    quotes.map((q) => q.id),
    ['crypto:BTC', 'crypto:ETH'],
  );
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
  assert.deepEqual([0.256, -1.1, 0, null].map(formatQuoteChange), [
    '+0.26%',
    '−1.10%',
    '0.00%',
    '',
  ]);
});

test('a daily close keeps its day; a yield moves in points; gaps are skipped', () => {
  const [spx] = parseFredSeries(
    'observation_date,SP500\n2026-10-07,7700.00\n2026-10-08,.\n2026-10-09,7777.00\n',
    'SP500',
  );
  assert.equal(spx.value, 7777);
  assert.equal(spx.asOfText, 'close of 2026-10-09');
  // The day with no value is not treated as the previous close.
  assert.equal(spx.changeBasis, 'since 2026-10-07');
  assert.ok(Math.abs(spx.change - 1) < 1e-9);
  assert.match(spx.url, /fred\.stlouisfed\.org\/series\/SP500$/);
  const [yld] = parseFredSeries(
    'observation_date,DGS10\n2026-10-08,4.10\n2026-10-09,4.16\n',
    'DGS10',
  );
  assert.equal(yld.changeUnit, 'points');
  assert.equal(formatQuoteChange(yld.change, yld.changeUnit), '+0.06 pt');
  assert.ok([spx, yld].every(isShowableQuote));
  assert.deepEqual(parseFredSeries('<html>busy</html>', 'SP500'), []);
  assert.deepEqual(
    parseFredSeries('observation_date,X\n2026-10-09,1\n', 'X'),
    [],
  );
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
      ['FRED (St. Louis Fed)', false],
      ['ECB reference rates', true],
      ['CoinGecko', false],
    ],
  );
  const model = buildMarketsModel({ status: 'ready', payload: partial });
  assert.deepEqual(model.down, ['FRED (St. Louis Fed)', 'CoinGecko']);
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
  const bad = buildMarketsModel({
    status: 'ready',
    payload: { quotes: [{ id: 'x' }], sources: [] },
  });
  assert.deepEqual(bad.groups, []);
});

test('live TV links go to each channel’s own live page', () => {
  assert.equal(BROADCASTERS.length, 12);
  for (const [name, , , channelId] of BROADCASTERS) {
    assert.ok(name);
    assert.match(
      broadcastUrl(channelId),
      /^https:\/\/www\.youtube\.com\/channel\/UC[\w-]{22}\/live$/,
    );
  }
  assert.equal(new Set(BROADCASTERS.map((row) => row[3])).size, 12);
});

test('the in-app player uses the no-cookie address and reports a blocked stream', () => {
  const url = new URL(
    broadcastEmbedUrl('UCNye-wNBqNL5ZzHSJj3l8Bg', 'http://localhost:4173'),
  );
  assert.equal(url.origin, 'https://www.youtube-nocookie.com');
  assert.equal(url.pathname, '/embed/live_stream');
  assert.equal(url.searchParams.get('channel'), 'UCNye-wNBqNL5ZzHSJj3l8Bg');
  assert.equal(url.searchParams.get('origin'), 'http://localhost:4173');
  // Every newsroom has a position on the globe and a colour.
  for (const [name, , , , lat, lon, colour] of BROADCASTERS) {
    assert.ok(Math.abs(lat) <= 90 && Math.abs(lon) <= 180, name);
    assert.match(colour, /^#[0-9a-f]{6}$/i, name);
  }
  assert.equal(isPlayerError('{"event":"onError","info":150}'), true);
  assert.equal(
    isPlayerError({ event: 'infoDelivery', info: { error: 101 } }),
    true,
  );
  assert.equal(
    isPlayerError({ event: 'infoDelivery', info: { playerState: 1 } }),
    false,
  );
  assert.equal(isPlayerError('not json'), false);
  assert.match(
    decodeURIComponent(
      broadcasterPin('DW News', 'Berlin', '#ff5a5a', true).image,
    ),
    />DW NEWS<\/text>/,
  );
});

test('the nearest newsroom is found by distance, and nothing is offered without a place', () => {
  const paris = nearestBroadcaster({ lat: 48.85, lon: 2.35 });
  assert.equal(paris.name, 'France 24 English');
  assert.equal(paris.city, 'Paris');
  assert.ok(paris.km < 10);
  assert.equal(nearestBroadcaster({ lat: 25.3, lon: 51.5 }).city, 'Doha');
  // Every inhabited continent has a newsroom of its own.
  assert.equal(
    nearestBroadcaster({ lat: -22.9, lon: -43.2 }).city,
    'São Paulo',
  );
  assert.equal(
    nearestBroadcaster({ lat: -33.45, lon: -70.67 }).city,
    'Buenos Aires',
  );
  assert.equal(nearestBroadcaster(null), null);
  assert.equal(nearestBroadcaster({ lat: Number.NaN, lon: 0 }), null);
});
