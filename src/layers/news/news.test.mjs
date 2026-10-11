import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { layerFeedState } from '../../data/feedState.js';
import { buildNewsPanelModel, placeLine } from '../../ui/newsPanelModel.js';
import { newsProxy } from '../../../server/providers/news.js';
import {
  groupNewsByPlace,
  dominantTopic,
  newsMarkerSize,
  newsPlaceLabel,
  newsStats,
} from './model.js';
import { normalizeNewsSnapshot } from './records.js';
import { NewsFeedUnavailableError, createNewsSource } from './source.js';

const NOW = Date.parse('2026-10-10T12:00:00Z');
const article = (overrides = {}) => ({
  id: 'a1',
  title: 'Talks open in Doha',
  summary: 'Negotiators met.',
  url: 'https://www.bbc.co.uk/news/1',
  publisher: 'BBC',
  sourceId: 'bbc',
  publishedAt: '2026-10-10T11:00:00.000Z',
  fetchedAt: '2026-10-10T11:58:00.000Z',
  place: {
    name: 'Doha',
    lat: 25.2854,
    lon: 51.531,
    precision: 'city',
    matched: 'Doha',
    field: 'title',
  },
  category: 'geopolitics',
  ...overrides,
});
const source = (overrides = {}) => ({
  id: 'bbc',
  name: 'BBC',
  homepage: 'https://www.bbc.co.uk/news',
  configured: true,
  ok: true,
  count: 1,
  lastSuccessAt: '2026-10-10T11:58:00.000Z',
  reason: null,
  ...overrides,
});
const payload = (overrides = {}) => ({
  schemaVersion: 1,
  fetchedAt: '2026-10-10T11:58:00.000Z',
  stale: false,
  articles: [article()],
  sources: [source()],
  dropped: { junk: 2, tooOld: 5, noDate: 0 },
  ...overrides,
});

test('a valid payload is accepted; a malformed one is refused whole', () => {
  const snapshot = normalizeNewsSnapshot(payload());
  assert.equal(snapshot.articles.length, 1);
  assert.deepEqual(snapshot.dropped, { junk: 2, tooOld: 5 });
  for (const bad of [
    null,
    {},
    payload({ articles: 'no' }),
    payload({ fetchedAt: 'never' }),
    payload({ sources: [{ name: 'x' }] }),
  ])
    assert.equal(normalizeNewsSnapshot(bad), null);
});

test('an article without a source, link or time is never passed on', () => {
  const snapshot = normalizeNewsSnapshot(
    payload({
      articles: [
        article(),
        article({ id: 'b', url: 'javascript:void(0)' }),
        article({ id: 'c', publisher: '' }),
        article({ id: 'd', publishedAt: '' }),
        article({
          id: 'e',
          place: { name: 'X', lat: 999, lon: 0, precision: 'city' },
        }),
      ],
    }),
  );
  assert.deepEqual(
    snapshot.articles.map((a) => a.id),
    ['a1'],
  );
});

test('the source reads the route, and reports 503 as unavailable with the source list', async () => {
  const ok = createNewsSource({
    fetchImpl: async () => Response.json(payload()),
  });
  assert.equal((await ok.getSnapshot()).articles.length, 1);
  const down = createNewsSource({
    fetchImpl: async () =>
      Response.json(
        {
          error: 'news_unavailable',
          retryAfter: 42,
          sources: [source({ ok: false, reason: 'timeout', count: 0 })],
        },
        { status: 503 },
      ),
  });
  await assert.rejects(down.getSnapshot(), (error) => {
    assert.ok(error instanceof NewsFeedUnavailableError);
    assert.equal(error.retryAfter, 42);
    assert.equal(error.sources[0].reason, 'timeout');
    return true;
  });
  const garbage = createNewsSource({
    fetchImpl: async () => Response.json({ hello: 'world' }),
  });
  await assert.rejects(garbage.getSnapshot(), /Malformed/);
});

test('stories at one place share one marker at the exact table coordinate', () => {
  const groups = groupNewsByPlace([
    article(),
    article({ id: 'a2', title: 'Second Doha story' }),
    article({ id: 'a3', place: null }),
    article({
      id: 'a4',
      place: {
        name: 'France',
        lat: 46.2,
        lon: 2.2,
        precision: 'country',
        matched: 'French',
        field: 'title',
      },
    }),
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(
    [groups[0].key, groups[0].lat, groups[0].lon, groups[0].articles.length],
    ['city:Doha', 25.2854, 51.531, 2],
  );
  assert.equal(newsPlaceLabel(groups[0]), 'Doha · 2');
  assert.equal(newsPlaceLabel(groups[1]), 'France');
  assert.deepEqual([1, 2, 5, 10].map(newsMarkerSize), [24, 29, 34, 40]);
  // The marker shows the topic most stories at the place carry; a tie goes
  // to the newest story, and a story with no topic counts as general news.
  const topics = (...list) => list.map((category) => ({ category }));
  assert.equal(
    dominantTopic(topics('military', 'finance', 'finance')),
    'finance',
  );
  assert.equal(dominantTopic(topics('military', 'finance')), 'military');
  assert.equal(dominantTopic(topics(null, undefined, 'climate')), 'news');
  assert.equal(dominantTopic([]), 'news');
});

test('layer stats map onto the standard feed states', () => {
  const snapshot = normalizeNewsSnapshot(payload());
  const partial = normalizeNewsSnapshot(
    payload({
      sources: [
        source(),
        source({ id: 'dw', name: 'DW', ok: false, reason: 'timeout' }),
      ],
    }),
  );
  const stale = normalizeNewsSnapshot(payload({ stale: true }));
  const off = normalizeNewsSnapshot(
    payload({
      sources: [
        source(),
        source({
          id: 'newsapi',
          name: 'NewsAPI',
          configured: false,
          ok: false,
        }),
      ],
    }),
  );
  assert.equal(layerFeedState(newsStats({ snapshot })), 'nominal');
  assert.equal(newsStats({ snapshot }).source, '1 of 1 sources');
  assert.equal(layerFeedState(newsStats({ snapshot: partial })), 'partial');
  assert.equal(layerFeedState(newsStats({ snapshot: stale })), 'stale');
  // An optional source that is not configured is not a failure.
  assert.equal(layerFeedState(newsStats({ snapshot: off })), 'nominal');
  assert.equal(
    layerFeedState(
      newsStats({ snapshot: null, error: 'No news source is reachable' }),
    ),
    'unavailable',
  );
  assert.equal(
    layerFeedState(newsStats({ snapshot, error: 'News HTTP 502' })),
    'degraded',
  );
});

test('every card carries the article’s own link, publisher and time', () => {
  const view = {
    enabled: true,
    snapshot: normalizeNewsSnapshot(payload()),
    places: groupNewsByPlace([article()]),
    selectedPlaceKey: null,
  };
  const model = buildNewsPanelModel(view, {}, NOW);
  assert.equal(model.cards.length, 1);
  const [card] = model.cards;
  assert.equal(card.url, 'https://www.bbc.co.uk/news/1');
  assert.equal(card.publisher, 'BBC');
  assert.equal(card.title, 'Talks open in Doha');
  assert.equal(card.publishedIso, '2026-10-10T11:00:00.000Z');
  assert.match(card.published, /^1 h ago · /);
  assert.equal(card.linkText, 'Open at bbc.co.uk');
  assert.equal(card.place, 'Doha · city · matched “Doha” in headline');
  assert.equal(card.category, 'auto-tag: geopolitics');
  assert.equal(model.health, '1 of 1 sources live · fetched 2 min ago');
  assert.equal(model.healthState, 'ok');
  assert.equal(model.empty, '');
  assert.equal(placeLine(null), 'No location');
});

test('with no articles the panel shows one sentence and no cards', () => {
  const loading = buildNewsPanelModel({ enabled: true }, {}, NOW);
  assert.deepEqual(loading.cards, []);
  assert.equal(loading.empty, 'Fetching headlines.');
  const down = buildNewsPanelModel(
    {
      enabled: true,
      error: 'No news source is reachable',
      unavailable: {
        retryAfter: 60,
        sources: [
          source({
            ok: false,
            reason: 'timeout',
            count: 0,
            lastSuccessAt: null,
          }),
        ],
      },
    },
    {},
    NOW,
  );
  assert.deepEqual(down.cards, []);
  assert.equal(
    down.empty,
    'No news source is reachable. Nothing to show. Retrying in 60 s.',
  );
  assert.equal(down.healthState, 'down');
  assert.equal(down.sources[0].detail, 'timed out · has not answered');
  const failed = buildNewsPanelModel(
    { enabled: true, error: 'News HTTP 502' },
    {},
    NOW,
  );
  assert.deepEqual(failed.cards, []);
  assert.equal(
    failed.empty,
    'The news service did not answer. Nothing to show.',
  );
});

test('stale and partial states are stated, and a down source is named', () => {
  const stale = buildNewsPanelModel(
    {
      enabled: true,
      snapshot: normalizeNewsSnapshot(payload({ stale: true })),
    },
    {},
    NOW,
  );
  assert.match(
    stale.stale,
    /^Showing saved results from .+\. No source is reachable right now\.$/,
  );
  assert.equal(stale.healthState, 'stale');
  const partial = buildNewsPanelModel(
    {
      enabled: true,
      snapshot: normalizeNewsSnapshot(
        payload({
          sources: [
            source(),
            source({
              id: 'gdelt',
              name: 'GDELT',
              ok: false,
              count: 0,
              reason: 'rate-limited',
              lastSuccessAt: null,
            }),
            source({
              id: 'newsapi',
              name: 'NewsAPI',
              configured: false,
              ok: false,
              count: 0,
              lastSuccessAt: null,
            }),
          ],
        }),
      ),
    },
    {},
    NOW,
  );
  assert.equal(partial.healthState, 'partial');
  assert.match(partial.health, /^1 of 2 sources live/);
  assert.deepEqual(
    partial.sources.map((row) => [row.name, row.state, row.detail]),
    [
      ['BBC', 'ok', '1 story'],
      ['GDELT', 'down', 'rate limited · has not answered'],
      ['NewsAPI', 'off', 'not configured (optional)'],
    ],
  );
});

test('filters narrow the list and say so when nothing matches', () => {
  const articles = [
    article(),
    article({
      id: 'a2',
      publisher: 'DW',
      category: 'climate',
      place: null,
      url: 'https://www.dw.com/x',
    }),
  ];
  const view = {
    enabled: true,
    snapshot: normalizeNewsSnapshot(payload({ articles })),
    places: groupNewsByPlace(articles),
    selectedPlaceKey: 'city:Doha',
  };
  assert.deepEqual(
    buildNewsPanelModel(view, {}, NOW).cards.map((c) => c.id),
    ['a1'],
  );
  assert.equal(buildNewsPanelModel(view, {}, NOW).place.name, 'Doha');
  const none = buildNewsPanelModel(view, { publisher: 'DW' }, NOW);
  assert.deepEqual(none.cards, []);
  assert.equal(none.empty, 'No current stories match these filters.');
  const all = buildNewsPanelModel(
    { ...view, selectedPlaceKey: null },
    { category: 'climate' },
    NOW,
  );
  assert.deepEqual(
    all.cards.map((c) => c.id),
    ['a2'],
  );
  assert.equal(all.cards[0].place, 'No location');
});

// ── The server route ────────────────────────────────────────────────

function callRoute(plugin, { method = 'GET', url = '/' } = {}) {
  let handler;
  plugin.configureServer({
    middlewares: { use: (_path, fn) => (handler = fn) },
  });
  return new Promise((resolve) => {
    const res = {
      writeHead(status, headers) {
        this.status = status;
        this.headers = headers;
      },
      end(body) {
        resolve({
          status: this.status,
          headers: this.headers,
          body: JSON.parse(body),
        });
      },
    };
    handler({ method, url }, res);
  });
}

const feed = `<rss><channel><item><title>Talks open in Doha</title>
  <link>https://example.org/1</link><pubDate>Sat, 10 Oct 2026 11:00:00 GMT</pubDate></item></channel></rss>`;

test('the route serves articles with the source report', async () => {
  const plugin = newsProxy({
    cachePath: null,
    now: () => NOW,
    sleep: async () => {},
    fetchImpl: async (url) =>
      url.includes('bbci')
        ? new Response(feed)
        : new Response('', { status: 500 }),
  });
  const { status, headers, body } = await callRoute(plugin);
  assert.equal(status, 200);
  assert.equal(headers['Cache-Control'], 'no-store');
  assert.equal(body.articles.length, 1);
  assert.equal(body.articles[0].publisher, 'BBC');
  assert.equal(body.sources.find((s) => s.id === 'bbc').ok, true);
  assert.equal(
    body.sources.find((s) => s.id === 'guardian').reason,
    'http-error',
  );
});

test('with every source down and nothing saved the route returns 503 and no articles', async () => {
  const plugin = newsProxy({
    cachePath: null,
    now: () => NOW,
    sleep: async () => {},
    fetchImpl: async () => new Response('', { status: 500 }),
  });
  const { status, headers, body } = await callRoute(plugin);
  assert.equal(status, 503);
  assert.equal(body.error, 'news_unavailable');
  assert.equal('articles' in body, false);
  assert.ok(body.sources.length > 5);
  assert.ok(Number(headers['Retry-After']) >= 1);
});

test('the route refuses other methods and any query', async () => {
  const plugin = newsProxy({
    cachePath: null,
    fetchImpl: async () => new Response(''),
  });
  assert.equal((await callRoute(plugin, { method: 'POST' })).status, 405);
  assert.equal(
    (await callRoute(plugin, { url: '/?url=https://evil.example' })).status,
    400,
  );
});

// ── The brief route ─────────────────────────────────────────────────

const twoOutlets = (url) =>
  url.includes('bbci')
    ? new Response(
        `<rss><channel><item><title>Twelve killed and 300 injured in attack on airport in Saudi capital Riyadh</title>
         <link>https://example.org/bbc</link><pubDate>Sat, 10 Oct 2026 11:00:00 GMT</pubDate></item></channel></rss>`,
      )
    : url.includes('theguardian')
      ? new Response(
          `<rss><channel><item><title>Twelve killed and hundreds injured in attack at Riyadh airport</title>
           <link>https://example.org/guardian</link><pubDate>Sat, 10 Oct 2026 11:05:00 GMT</pubDate></item></channel></rss>`,
        )
      : new Response('', { status: 500 });

function briefPlugin(modelReply, options = {}) {
  const calls = [];
  const plugin = newsProxy({
    cachePath: null,
    now: () => NOW,
    sleep: async () => {},
    fetchImpl: async (url) => twoOutlets(url),
    gateBrief: false,
    briefKey: () => 'test-key',
    briefFetch: async (url, init) => {
      calls.push({ url, init });
      return typeof modelReply === 'function'
        ? modelReply()
        : Response.json({ output_text: JSON.stringify(modelReply) });
    },
    ...options,
  });
  const routes = new Map();
  plugin.configureServer({
    middlewares: { use: (route, fn) => routes.set(route, fn) },
  });
  const call = (route, { method = 'GET', body } = {}) =>
    new Promise((resolve) => {
      const res = {
        writeHead(status) {
          this.status = status;
        },
        end(text) {
          resolve({ status: this.status, body: JSON.parse(text) });
        },
        setHeader() {},
      };
      const req = {
        method,
        url: '/',
        headers: {},
        on(event, listener) {
          if (event === 'data' && body)
            listener(Buffer.from(JSON.stringify(body)));
          if (event === 'end') listener();
          return req;
        },
      };
      routes.get(route)(req, res);
    });
  return { call, calls };
}

test('a brief returns only cited, supported sentences, with the outlet count', async () => {
  const { call, calls } = briefPlugin({
    sentences: [
      {
        text: 'An attack on Riyadh airport killed twelve people.',
        cites: [1, 2],
      },
      { text: 'The attackers were led by General Hassan.', cites: [1] },
      { text: 'Oil prices rose 9% in response.', cites: [] },
    ],
    // Source 2 (BBC) gives the figure 300; source 1 says only "hundreds".
    claims: [
      { text: 'About 300 people were injured.', cites: [2] },
      { text: 'About 300 people were injured.', cites: [1] },
    ],
  });
  const news = await call('/api/news');
  const story = news.body.stories.find((entry) => entry.outlets === 2);
  assert.ok(story, 'the two outlets are grouped as one story');
  const { status, body } = await call('/api/news/brief', {
    method: 'POST',
    body: { storyId: story.id },
  });
  assert.equal(status, 200);
  assert.deepEqual(
    body.sentences.map((s) => [s.text, s.cites, s.outlets]),
    [['An attack on Riyadh airport killed twelve people.', [1, 2], 2]],
  );
  assert.deepEqual(
    body.claims.map((c) => [c.cites, c.outlets]),
    [[[2], 1]],
  );
  assert.equal(body.removed, 3);
  assert.equal(body.sources.length, 2);
  // The model is sent the outlets' words and nothing else; the key is a header.
  const sent = JSON.parse(calls[0].init.body);
  assert.match(sent.input, /^\[1\] /);
  assert.doesNotMatch(sent.input, /https?:|test-key/);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-key');
  // A second request for the same story is served from memory.
  await call('/api/news/brief', {
    method: 'POST',
    body: { storyId: story.id },
  });
  assert.equal(calls.length, 1);
});

test('a brief the checker rejects whole shows nothing', async () => {
  const { call } = briefPlugin({
    sentences: [
      { text: 'The death toll reached 4,000 in Tehran.', cites: [1] },
    ],
  });
  const news = await call('/api/news');
  const story = news.body.stories.find((entry) => entry.outlets === 2);
  const { body } = await call('/api/news/brief', {
    method: 'POST',
    body: { storyId: story.id },
  });
  assert.equal(body.supported, false);
  assert.deepEqual(body.sentences, []);
  assert.deepEqual(body.claims, []);
});

test('brief failures say so and never relay provider text', async () => {
  const failing = briefPlugin(() =>
    Response.json(
      { error: { message: 'org-123 quota exceeded' } },
      { status: 429 },
    ),
  );
  const news = await failing.call('/api/news');
  const story = news.body.stories[0];
  const failed = await failing.call('/api/news/brief', {
    method: 'POST',
    body: { storyId: story.id },
  });
  assert.equal(failed.status, 502);
  assert.deepEqual(failed.body, { error: 'brief_failed' });

  const keyless = briefPlugin({}, { briefKey: () => '' });
  const off = await keyless.call('/api/news/brief', {
    method: 'POST',
    body: { storyId: 'x' },
  });
  assert.deepEqual(off.body, { available: false, reason: 'not-configured' });
  assert.equal(keyless.calls.length, 0);

  const { call } = briefPlugin({});
  assert.equal((await call('/api/news/brief')).status, 405);
  assert.equal(
    (
      await call('/api/news/brief', {
        method: 'POST',
        body: { storyId: 'nope' },
      })
    ).status,
    404,
  );
  assert.equal(
    (await call('/api/news/brief', { method: 'POST', body: {} })).status,
    400,
  );
});

// ── Honesty gates: these fail the build if the rules are broken later ──

const root = fileURLToPath(new URL('../../../', import.meta.url));
const NEWS_RUNTIME = [
  'server/providers/news.js',
  'src/sources/news',
  'src/layers/news',
  'src/app/layers/news.js',
  'src/ui/newsPanel.js',
  'src/ui/newsPanelModel.js',
  'src/ui/corantoShell.js',
  'server/providers/hazards.js',
  'src/sources/hazards',
  'src/layers/hazards',
  'src/app/layers/hazards.js',
  'server/providers/elections.js',
  'src/sources/elections',
  'src/layers/elections',
  'src/app/layers/elections.js',
  'src/ui/corantoElections.js',
  'src/ui/corantoPower.js',
  'src/ui/watches.js',
  'server/providers/markets.js',
  'src/sources/markets',
  'src/ui/corantoMarkets.js',
  'server/providers/campaignFinance.js',
  'src/sources/campaignFinance',
  'src/ui/corantoCampaignMoney.js',
  'server/providers/governmentAircraft.js',
  'src/sources/governmentAircraft',
  'src/ui/corantoContact.js',
  'src/ui/corantoLink.js',
];
function runtimeFiles() {
  const files = [];
  const visit = (relative) => {
    const absolute = path.join(root, relative);
    if (fs.statSync(absolute).isDirectory()) {
      for (const name of fs.readdirSync(absolute))
        visit(path.join(relative, name));
    } else if (relative.endsWith('.js')) files.push(relative);
  };
  NEWS_RUNTIME.forEach(visit);
  return files;
}

test('no randomness anywhere in the news code', () => {
  const files = runtimeFiles();
  assert.ok(
    files.length >= 14,
    'the scan must actually cover the news modules',
  );
  for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(
      text,
      /Math\.random|crypto\.getRandomValues|randomUUID/,
      file,
    );
  }
});

test('no story is written into the code', () => {
  // An object literal carrying both a headline and a link is a seeded story.
  const seeded =
    /\{[^{}]*\btitle\s*:\s*['"`][^'"`]{12,}['"`][^{}]*\burl\s*:\s*['"`]https?:/s;
  for (const file of runtimeFiles()) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(text, seeded, file);
    // `DEMO_KEY` is api.data.gov's shared public key. It returns the same
    // real FEC records as a personal key, so it is not sample content.
    assert.doesNotMatch(
      text,
      /FALLBACK_NEWS|SAMPLE_|DEMO_(?!KEY\b)|PLACEHOLDER_STOR/i,
      file,
    );
  }
});

test('a missing date is never replaced with the clock', () => {
  for (const file of [
    'src/sources/news/feeds.js',
    'src/sources/news/records.js',
    'src/sources/news/article.js',
  ]) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(text, /new Date\(\)|Date\.now\(\)/, file);
  }
});
