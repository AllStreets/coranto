import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isShowableGovernmentAircraft,
  parsePositions,
  parseRegistry,
  splitCsvLine,
} from '../sources/governmentAircraft/records.js';
import {
  GovernmentAircraftUnavailableError,
  createGovernmentAircraftService,
} from '../sources/governmentAircraft/service.js';
import {
  governmentFacts,
  governmentName,
  planeMarker,
} from './corantoPower.js';

const CSV = [
  '$ICAO,$Registration,$Operator,$Type,$ICAO Type,#CMPG,$Tag 1,$#Tag 2,$#Tag 3,Category,$#Link',
  'C07B3F,C-GQBT,Government of Quebec,DHC-8-315Q,DH8C,Gov,a,b,c,Governments,https://www.quebec.ca',
  '00AEC9,ZS-RSA,South African Air Force,Boeing 737-BBJ,B737,Mil,a,b,c,Governments,https://www.gov.za',
  '0082C0,ZS-BAL,United Nations,"BAe 125, series 800",H25B,Gov,a,b,c,Quango,https://www.un.org/en',
  'AE01CE,00-0001,United States Air Force,C-17,C17,Mil,a,b,c,USAF,https://w.wiki/x',
  'ZZZZZZ,X,Bad Address,Thing,T,Gov,a,b,c,Governments,https://example.org',
  'ABCDEF,Y,,No Operator,T,Gov,a,b,c,Governments,https://example.org',
].join('\n');
const NOW = Date.parse('2026-10-11T18:00:00Z');
const live = {
  now: NOW,
  ac: [
    {
      hex: 'c07b3f',
      flight: 'QUE40   ',
      lat: 47.1,
      lon: -71.2,
      alt_baro: 22000,
      gs: 251.4,
      track: 90,
      seen_pos: 4,
    },
    {
      hex: '00aec9',
      flight: '',
      lat: -25.9,
      lon: 28.2,
      alt_baro: 'ground',
      seen_pos: 30,
    },
    { hex: '0082c0', flight: 'UNO1' },
    { hex: 'ae01ce', flight: 'RCH1', lat: 1, lon: 1, alt_baro: 30000 },
  ],
};

test('the registry keeps government rows with an operator and a valid address', () => {
  assert.deepEqual(splitCsvLine('a,"b, c",d'), ['a', 'b, c', 'd']);
  const registry = parseRegistry(CSV);
  assert.deepEqual([...registry.keys()], ['c07b3f', '00aec9', '0082c0']);
  assert.equal(registry.get('0082c0').type, 'BAe 125, series 800');
  assert.equal(registry.get('0082c0').role, 'International body');
  assert.equal(registry.get('00aec9').militaryOperated, true);
  assert.equal(registry.get('c07b3f').reference, 'https://www.quebec.ca');
  assert.equal(parseRegistry('not a csv').size, 0);
});

test('only listed aircraft that broadcast a position are shown', () => {
  const rows = parsePositions(live, parseRegistry(CSV));
  // The UN jet gave no position; the C-17 is not in the government list.
  assert.deepEqual(
    rows.map((r) => r.icao24),
    ['c07b3f', '00aec9'],
  );
  const [quebec, saaf] = rows;
  assert.equal(quebec.callsign, 'QUE40');
  assert.equal(quebec.altitudeFt, 22000);
  assert.equal(quebec.seenAt, new Date(NOW - 4000).toISOString());
  assert.equal(quebec.trackerUrl, 'https://adsb.lol/?icao=c07b3f');
  assert.equal(saaf.onGround, true);
  assert.equal(saaf.altitudeFt, null);
  assert.ok(rows.every(isShowableGovernmentAircraft));
  assert.equal(governmentName(quebec), 'QUE40');
  assert.equal(governmentName(saaf), 'ZS-RSA');
  assert.equal(
    governmentFacts(quebec),
    'Government of Quebec · 22,000 ft · 251 kt',
  );
  assert.equal(
    governmentFacts(saaf),
    'South African Air Force · on the ground',
  );
  assert.match(planeMarker('#e8d5a3'), /^data:image\/svg\+xml,/);
});

const routes =
  (map, seen = []) =>
  async (url) => {
    seen.push(url);
    const host = new URL(url).hostname;
    return host in map
      ? new Response(
          typeof map[host] === 'string' ? map[host] : JSON.stringify(map[host]),
        )
      : new Response('', { status: 500 });
  };

test('one request covers the list; outages show nothing rather than a guess', async () => {
  const seen = [];
  const payload = await createGovernmentAircraftService({
    now: () => NOW,
    sleep: async () => {},
    fetchImpl: routes(
      { 'raw.githubusercontent.com': CSV, 'api.adsb.lol': live },
      seen,
    ),
  }).getPayload();
  assert.equal(seen.length, 2);
  assert.match(seen[1], /\/v2\/hex\/c07b3f,00aec9,0082c0$/);
  assert.deepEqual(
    [payload.listed, payload.complete, payload.aircraft.length],
    [3, true, 2],
  );
  await assert.rejects(
    createGovernmentAircraftService({
      now: () => NOW,
      sleep: async () => {},
      fetchImpl: routes({ 'api.adsb.lol': live }),
    }).getPayload(),
    (error) =>
      error instanceof GovernmentAircraftUnavailableError &&
      error.reason === 'registry',
  );
  await assert.rejects(
    createGovernmentAircraftService({
      now: () => NOW,
      sleep: async () => {},
      fetchImpl: routes({ 'raw.githubusercontent.com': CSV }),
    }).getPayload(),
    (error) =>
      error instanceof GovernmentAircraftUnavailableError &&
      error.reason === 'positions',
  );
});
