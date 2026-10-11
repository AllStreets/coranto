import assert from 'node:assert/strict';
import test from 'node:test';
import { layerFeedState } from '../../data/feedState.js';
import {
  HAZARD_WILDFIRE_CAP,
  isShowableHazard,
  mergeHazards,
  parseEonet,
  parseGdacs,
} from '../../sources/hazards/records.js';
import {
  HazardsUnavailableError,
  createHazardService,
} from '../../sources/hazards/service.js';
import { buildNewsPanelModel } from '../../ui/newsPanelModel.js';
import { hazardColor, hazardHasLabel, hazardStats } from './model.js';
import { createHazardSource } from './source.js';

const NOW = Date.parse('2026-10-10T12:00:00Z');
const gdacsItem = ({
  type = 'TC',
  id = '1001',
  level = 'Orange',
  lat = '18.2',
  lon = '-66.1',
  from = 'Tue, 06 Oct 2026 00:00:00 GMT',
} = {}) => `<item>
  <title>${level} notification for tropical cyclone ISAIAS-26</title>
  <link>https://www.gdacs.org/report.aspx?eventid=${id}</link>
  <gdacs:eventtype>${type}</gdacs:eventtype><gdacs:eventid>${id}</gdacs:eventid>
  <gdacs:alertlevel>${level}</gdacs:alertlevel><gdacs:fromdate>${from}</gdacs:fromdate>
  <geo:lat>${lat}</geo:lat><geo:long>${lon}</geo:long></item>`;
const gdacs = (...items) => `<rss><channel>${items.join('')}</channel></rss>`;
const eonet = {
  events: [
    {
      id: 'EONET_1',
      title: 'Taal Volcano, Philippines',
      categories: [{ id: 'volcanoes' }],
      sources: [
        {
          id: 'SIVolcano',
          url: 'https://volcano.si.edu/volcano.cfm?vn=273070',
        },
      ],
      geometry: [
        {
          date: '2026-10-08T00:00:00Z',
          type: 'Point',
          coordinates: [120.993, 14.002],
        },
      ],
    },
    {
      id: 'EONET_2',
      title: 'No geometry',
      categories: [{ id: 'floods' }],
      geometry: [],
    },
    {
      id: 'EONET_3',
      title: 'Polygon storm',
      categories: [{ id: 'severeStorms' }],
      sources: [{ url: 'https://example.org' }],
      geometry: [
        { date: '2026-10-08T00:00:00Z', type: 'Polygon', coordinates: [] },
      ],
    },
  ],
};

test('GDACS items keep the tracker’s own link, start time and alert level', () => {
  const [item] = parseGdacs(gdacs(gdacsItem()));
  assert.deepEqual(item, {
    id: 'gdacs:TC:1001',
    kind: 'cyclone',
    title: 'Orange notification for tropical cyclone ISAIAS-26',
    lat: 18.2,
    lon: -66.1,
    startedAt: '2026-10-06T00:00:00.000Z',
    url: 'https://www.gdacs.org/report.aspx?eventid=1001',
    source: 'GDACS',
    alert: 'Orange',
  });
  assert.ok(isShowableHazard(item));
});

test('items missing a position, a date, a link or an alert level are dropped', () => {
  assert.deepEqual(parseGdacs(gdacs(gdacsItem({ lat: '' }))), []);
  assert.deepEqual(parseGdacs(gdacs(gdacsItem({ from: 'sometime' }))), []);
  assert.deepEqual(parseGdacs(gdacs(gdacsItem({ level: '' }))), []);
  assert.deepEqual(parseGdacs(gdacs(gdacsItem({ type: 'ZZ' }))), []);
  assert.deepEqual(parseGdacs('<html>blocked</html>'), []);
});

test('EONET keeps point events with a source link and carries no alert level', () => {
  const items = parseEonet(eonet);
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'volcano');
  assert.equal(items[0].alert, null);
  assert.equal(items[0].url, 'https://volcano.si.edu/volcano.cfm?vn=273070');
  assert.deepEqual(parseEonet({}), []);
});

test('merging orders by alert level, drops old events and caps wildfires', () => {
  const fires = Array.from({ length: HAZARD_WILDFIRE_CAP + 5 }, (_, i) =>
    gdacsItem({ type: 'WF', id: String(2000 + i), level: 'Green' }),
  );
  const list = parseGdacs(
    gdacs(
      gdacsItem({ id: '1', level: 'Green' }),
      gdacsItem({ id: '2', level: 'Red' }),
      gdacsItem({
        id: '3',
        level: 'Orange',
        from: 'Mon, 01 Jun 2026 00:00:00 GMT',
      }),
      ...fires,
    ),
  );
  const merged = mergeHazards([list, parseEonet(eonet)], NOW);
  assert.equal(merged.events[0].alert, 'Red');
  assert.equal(
    merged.events.some((e) => e.id === 'gdacs:TC:3'),
    false,
  );
  assert.equal(
    merged.events.filter((e) => e.kind === 'wildfire').length,
    HAZARD_WILDFIRE_CAP,
  );
  assert.equal(merged.wildfiresLeftOut, 5);
});

test('red is used only for a Red alert; only Orange and Red are labelled', () => {
  const [orange] = parseGdacs(gdacs(gdacsItem()));
  const [green] = parseGdacs(gdacs(gdacsItem({ level: 'Green' })));
  const [red] = parseGdacs(gdacs(gdacsItem({ level: 'Red' })));
  const [untracked] = parseEonet(eonet);
  assert.equal(hazardColor(red), '#ff4d5e');
  for (const item of [orange, green, untracked])
    assert.notEqual(hazardColor(item), '#ff4d5e');
  assert.deepEqual([red, orange, green, untracked].map(hazardHasLabel), [
    true,
    true,
    false,
    false,
  ]);
});

const routes = (map) => async (url) => {
  const value = map[new URL(url).hostname];
  if (!value) return new Response('', { status: 500 });
  return new Response(
    typeof value === 'string' ? value : JSON.stringify(value),
  );
};

test('one tracker down is reported; both down with nothing cached is an error', async () => {
  const partial = await createHazardService({
    now: () => NOW,
    fetchImpl: routes({ 'www.gdacs.org': gdacs(gdacsItem()) }),
  }).getPayload();
  assert.equal(partial.events.length, 1);
  assert.deepEqual(
    partial.sources.map((s) => [s.name, s.ok, s.reason]),
    [
      ['GDACS', true, null],
      ['NASA EONET', false, 'http-error'],
    ],
  );
  await assert.rejects(
    createHazardService({ now: () => NOW, fetchImpl: routes({}) }).getPayload(),
    (error) => error instanceof HazardsUnavailableError && !('events' in error),
  );
});

test('the browser source validates the payload and maps stats to feed states', async () => {
  const payload = await createHazardService({
    now: () => NOW,
    fetchImpl: routes({
      'www.gdacs.org': gdacs(gdacsItem()),
      'eonet.gsfc.nasa.gov': eonet,
    }),
  }).getPayload();
  const snapshot = await createHazardSource({
    fetchImpl: async () =>
      Response.json({ ...payload, events: [...payload.events, { id: 'bad' }] }),
  }).getSnapshot();
  assert.equal(snapshot.events.length, 2);
  assert.equal(layerFeedState(hazardStats({ snapshot })), 'nominal');
  assert.equal(
    layerFeedState(hazardStats({ snapshot: null, error: 'down' })),
    'unavailable',
  );
  await assert.rejects(
    createHazardSource({
      fetchImpl: async () => Response.json({}, { status: 503 }),
    }).getSnapshot(),
    (error) => error.unavailable === true,
  );
  await assert.rejects(
    createHazardSource({
      fetchImpl: async () => Response.json({ nope: 1 }),
    }).getSnapshot(),
    /Malformed/,
  );
});

test('searching the feed keeps stories that contain every word', () => {
  const article = (id, title, publisher, place) => ({
    id,
    title,
    summary: '',
    url: `https://example.org/${id}`,
    publisher,
    sourceId: 'x',
    publishedAt: '2026-10-10T11:00:00.000Z',
    fetchedAt: '2026-10-10T11:58:00.000Z',
    place: place
      ? {
          name: place,
          lat: 1,
          lon: 1,
          precision: 'city',
          matched: place,
          field: 'title',
        }
      : null,
    category: null,
    progress: null,
  });
  const view = {
    enabled: true,
    snapshot: {
      fetchedAt: '2026-10-10T11:58:00.000Z',
      stale: false,
      sources: [],
      dropped: {},
      articles: [
        article('a', 'Port strike halts grain exports', 'BBC', 'Odesa'),
        article('b', 'Grain prices ease after harvest', 'DW', null),
        article('c', 'Election date set', 'BBC', 'Lagos'),
      ],
    },
  };
  const ids = (query) =>
    buildNewsPanelModel(view, { query }, NOW).cards.map((c) => c.id);
  assert.deepEqual(ids('grain'), ['a', 'b']);
  assert.deepEqual(ids('GRAIN  strike'), ['a']);
  assert.deepEqual(ids('lagos'), ['c']);
  assert.deepEqual(ids('bbc'), ['a', 'c']);
  assert.deepEqual(ids(''), ['a', 'b', 'c']);
  const none = buildNewsPanelModel(view, { query: 'zebra' }, NOW);
  assert.deepEqual(none.cards, []);
  assert.equal(none.empty, 'No current stories match these filters.');
});
