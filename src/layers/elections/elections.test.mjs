import assert from 'node:assert/strict';
import test from 'node:test';
import { layerFeedState } from '../../data/feedState.js';
import {
  daysUntil,
  electionQuery,
  groupElections,
  isShowableElectionGroup,
  parseElections,
} from '../../sources/elections/records.js';
import {
  ElectionsUnavailableError,
  createElectionService,
} from '../../sources/elections/service.js';
import { ELECTION_TERMS, electionCard } from '../../ui/corantoElections.js';
import { buildNewsPanelModel } from '../../ui/newsPanelModel.js';
import { electionCountdown, electionDay, electionStats } from './model.js';
import { createElectionSource } from './source.js';

const NOW = Date.parse('2026-10-11T09:00:00Z');
const row = (id, label, date, iso, article = null) => ({
  e: { value: `http://www.wikidata.org/entity/${id}` },
  ...(label ? { label: { value: label } } : {}),
  date: { value: `${date}T00:00:00Z` },
  ...(iso ? { iso: { value: iso } } : {}),
  ...(article ? { article: { value: article } } : {}),
});
const result = (...bindings) => ({ results: { bindings } });
const sample = result(
  row(
    'Q1',
    '2026 Brazilian general election',
    '2026-10-25',
    'BR',
    'https://en.wikipedia.org/wiki/2026_Brazilian_general_election',
  ),
  row(
    'Q2',
    "2026 Texas's 1st congressional district election",
    '2026-11-03',
    'US',
  ),
  row(
    'Q3',
    '2026 Iowa elections',
    '2026-11-03',
    'US',
    'https://en.wikipedia.org/wiki/2026_Iowa_elections',
  ),
  row(
    'Q3',
    '2026 Iowa elections',
    '2026-11-03',
    'US',
    'https://en.wikipedia.org/wiki/2026_Iowa_elections',
  ),
  row('Q4', null, '2026-10-18', 'CH'),
  row('Q5', '2027 Angolan general election', '2027-01-01', 'AO'),
  row('Q6', 'Next Fijian general election', '2026-12-31', 'FJ'),
  row('Q7', '2026 Somewhere election', '2026-11-09', null),
  row(
    'Q8',
    '2026 Bad link election',
    '2026-11-10',
    'FR',
    'https://evil.example/x',
  ),
  row('Q9', 'No date election', 'someday', 'DE'),
);

test('the query asks Wikidata for elections dated inside the window', () => {
  const query = electionQuery(NOW);
  assert.match(query, /wd:Q40231/);
  assert.match(query, /"2026-10-11T00:00:00Z"/);
  assert.match(query, /"2027-02-08T00:00:00Z"/);
});

test('entries keep their Wikidata link; unusable ones are dropped', () => {
  const elections = parseElections(sample);
  assert.deepEqual(
    elections.map((e) => e.id),
    ['Q1', 'Q2', 'Q3', 'Q8'],
  );
  assert.deepEqual(elections[0], {
    id: 'Q1',
    title: '2026 Brazilian general election',
    date: '2026-10-25',
    iso2: 'BR',
    wikidata: 'https://www.wikidata.org/wiki/Q1',
    wikipedia: 'https://en.wikipedia.org/wiki/2026_Brazilian_general_election',
  });
  // A link that is not to Wikipedia is not kept.
  assert.equal(elections[3].wikipedia, null);
  assert.deepEqual(parseElections({}), []);
});

test('placeholder dates and unscheduled contests are not polling days', () => {
  const titles = parseElections(sample).map((e) => e.title);
  assert.equal(
    titles.includes('2027 Angolan general election'),
    false,
    '1 January is a year-only date',
  );
  assert.equal(titles.includes('Next Fijian general election'), false);
});

test('contests are grouped by country and day, nearest first', () => {
  const groups = groupElections(parseElections(sample), NOW);
  assert.deepEqual(
    groups.map((g) => [g.country, g.date, g.daysUntil, g.count, g.lead.title]),
    [
      ['Brazil', '2026-10-25', 14, 1, '2026 Brazilian general election'],
      ['United States', '2026-11-03', 23, 2, '2026 Iowa elections'],
      ['France', '2026-11-10', 30, 1, '2026 Bad link election'],
    ],
  );
  assert.ok(groups.every(isShowableElectionGroup));
  assert.equal(daysUntil('2026-10-11', NOW), 0);
  // Past and beyond-window dates are left out.
  assert.deepEqual(
    groupElections(
      [
        {
          id: 'Q',
          title: 't',
          date: '2026-10-01',
          iso2: 'BR',
          wikidata: 'https://www.wikidata.org/wiki/Q',
          wikipedia: null,
        },
      ],
      NOW,
    ),
    [],
  );
});

test('wording for dates and countdowns', () => {
  assert.equal(electionDay('2026-10-25'), '25 Oct');
  assert.deepEqual([0, 1, 14].map(electionCountdown), [
    'today',
    'tomorrow',
    'in 14 days',
  ]);
});

test('the card names its source and links to it', () => {
  const [brazil, us] = groupElections(parseElections(sample), NOW);
  assert.deepEqual(electionCard(brazil), {
    kind: 'ELECTION · IN 14 DAYS',
    title: '2026 Brazilian general election',
    meta: 'Brazil · 25 Oct · as recorded by Wikidata',
    url: 'https://en.wikipedia.org/wiki/2026_Brazilian_general_election',
    linkText: 'Open at en.wikipedia.org',
  });
  assert.match(electionCard(us).meta, /1 more contest that day/);
});

test('the service serves a cached calendar when Wikidata fails, and nothing when it never answered', async () => {
  let ok = true;
  let clock = NOW;
  const service = createElectionService({
    now: () => clock,
    fetchImpl: async () =>
      ok
        ? Response.json(sample)
        : new Response('upstream request timeout', { status: 504 }),
  });
  const first = await service.getPayload();
  assert.equal(first.stale, false);
  assert.equal(first.groups.length, 3);
  ok = false;
  clock += 7 * 60 * 60 * 1000;
  const second = await service.getPayload();
  assert.equal(second.stale, true);
  assert.equal(second.fetchedAt, first.fetchedAt);
  await assert.rejects(
    createElectionService({
      now: () => NOW,
      fetchImpl: async () => new Response('', { status: 504 }),
    }).getPayload(),
    ElectionsUnavailableError,
  );
});

test('the browser source validates groups and maps to feed states', async () => {
  const groups = groupElections(parseElections(sample), NOW);
  const snapshot = await createElectionSource({
    fetchImpl: async () =>
      Response.json({
        fetchedAt: new Date(NOW).toISOString(),
        stale: false,
        groups: [...groups, { key: 'bad' }],
      }),
  }).getSnapshot();
  assert.equal(snapshot.groups.length, 3);
  assert.equal(layerFeedState(electionStats({ snapshot })), 'nominal');
  assert.equal(
    layerFeedState(electionStats({ snapshot: null, error: 'down' })),
    'unavailable',
  );
  await assert.rejects(
    createElectionSource({
      fetchImpl: async () => Response.json({}, { status: 503 }),
    }).getSnapshot(),
    (error) => error.unavailable === true,
  );
});

test('the lens narrows the feed to headlines carrying an election word', () => {
  const article = (id, title) => ({
    id,
    title,
    summary: '',
    url: `https://example.org/${id}`,
    publisher: 'BBC',
    sourceId: 'bbc',
    publishedAt: '2026-10-11T08:00:00.000Z',
    fetchedAt: '2026-10-11T08:58:00.000Z',
    place: null,
    category: null,
    progress: null,
    lang: 'en',
  });
  const view = {
    enabled: true,
    snapshot: {
      fetchedAt: '2026-10-11T08:58:00.000Z',
      stale: false,
      sources: [],
      dropped: {},
      articles: [
        article('a', 'Brazil votes in tight presidential runoff'),
        article('b', 'Candidates clash in final debate'),
        article('c', 'Air pollution worsens in Delhi'),
        article('d', 'Brazil signs trade pact'),
      ],
    },
  };
  const ids = (filters) =>
    buildNewsPanelModel(view, { grouped: false, ...filters }, NOW).cards.map(
      (c) => c.id,
    );
  // "polls" must not match "pollution".
  assert.deepEqual(ids({ any: ELECTION_TERMS }), ['a', 'b']);
  assert.deepEqual(ids({ any: ELECTION_TERMS, query: 'brazil' }), ['a']);
  assert.deepEqual(ids({ any: [] }), ['a', 'b', 'c', 'd']);
});

test('a saved calendar is served as stale when Wikidata fails, after one retry', async () => {
  let calls = 0;
  const first = createElectionService({
    now: () => NOW,
    fetchImpl: async () => Response.json(sample),
  });
  const good = await first.getPayload();
  const saved = JSON.parse(JSON.stringify(first.exportState()));
  // A day later, on a fresh start, Wikidata is down.
  const later = NOW + 24 * 60 * 60 * 1000;
  const restored = createElectionService({
    now: () => later,
    initialState: saved,
    fetchImpl: async () => {
      calls++;
      return new Response('upstream request timeout', { status: 504 });
    },
  });
  const payload = await restored.getPayload();
  assert.equal(calls, 2, 'one retry');
  assert.equal(payload.stale, true);
  assert.equal(payload.fetchedAt, good.fetchedAt);
  // Day counts are recomputed for the day it is shown on.
  assert.equal(payload.groups[0].daysUntil, good.groups[0].daysUntil - 1);
  assert.equal(createElectionService().exportState(), null);
});
