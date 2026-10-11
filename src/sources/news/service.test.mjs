import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mergeRaws,
  NEWS_CACHE_TTL_MS,
  NewsUnavailableError,
  createNewsService,
} from './service.js';

const T0 = Date.parse('2026-10-10T12:00:00Z');
const SOURCES = [
  {
    id: 'a',
    name: 'Alpha',
    kind: 'feed',
    url: 'https://a.example/rss',
    homepage: 'https://a.example',
  },
  {
    id: 'b',
    name: 'Beta',
    kind: 'feed',
    url: 'https://b.example/rss',
    homepage: 'https://b.example',
  },
  {
    id: 'g',
    name: 'GDELT',
    kind: 'gdelt',
    url: 'https://g.example/api',
    homepage: 'https://g.example',
  },
  {
    id: 'n',
    name: 'NewsAPI',
    kind: 'newsapi',
    url: 'https://n.example/api',
    homepage: 'https://n.example',
    requiresKey: 'NEWS_API_KEY',
  },
];

const rss = (...items) =>
  `<rss><channel>${items
    .map(
      ([title, path, date]) =>
        `<item><title>${title}</title><link>https://x.example/${path}</link><pubDate>${date}</pubDate></item>`,
    )
    .join('')}</channel></rss>`;

const respond = (body, { status = 200, url } = {}) => {
  const response = new Response(body, { status });
  if (url) Object.defineProperty(response, 'url', { value: url });
  return response;
};

function harness(routes, options = {}) {
  const clock = { at: T0 };
  const calls = [];
  const service = createNewsService({
    sources: SOURCES,
    now: () => clock.at,
    sleep: async () => {},
    timeoutMs: 50,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      const route = routes[url];
      const value = typeof route === 'function' ? await route(init) : route;
      if (value instanceof Error) throw value;
      return value ?? respond('', { status: 404 });
    },
    ...options,
  });
  return { service, clock, calls };
}

const healthy = () => ({
  'https://a.example/rss': () =>
    respond(rss(['Talks open in Doha', 'a1', 'Sat, 10 Oct 2026 11:00:00 GMT'])),
  'https://b.example/rss': () =>
    respond(
      rss(['Flooding hits Lagos', 'b1', 'Sat, 10 Oct 2026 10:00:00 GMT']),
    ),
  'https://g.example/api': () =>
    respond(
      JSON.stringify({
        articles: [
          {
            title: 'Summit ends in Geneva',
            url: 'https://w.example/g1',
            domain: 'w.example',
            seendate: '20261010T093000Z',
          },
        ],
      }),
    ),
});

test('all configured sources answer', async () => {
  const { service } = harness(healthy());
  const payload = await service.getPayload();
  assert.equal(payload.stale, false);
  assert.equal(payload.fetchedAt, '2026-10-10T12:00:00.000Z');
  assert.deepEqual(
    payload.articles.map((a) => [a.title, a.publisher, a.sourceId]),
    [
      ['Talks open in Doha', 'Alpha', 'a'],
      ['Flooding hits Lagos', 'Beta', 'b'],
      ['Summit ends in Geneva', 'w.example', 'g'],
    ],
  );
  const byId = Object.fromEntries(payload.sources.map((s) => [s.id, s]));
  assert.deepEqual(
    [byId.a.ok, byId.b.ok, byId.g.ok, byId.n.ok],
    [true, true, true, false],
  );
  assert.equal(byId.n.configured, false);
  assert.equal(byId.n.reason, 'not-configured');
  assert.equal(byId.a.lastSuccessAt, '2026-10-10T12:00:00.000Z');
});

test('one failed source is named with a fixed reason; the rest still show', async () => {
  const routes = healthy();
  routes['https://b.example/rss'] = () => respond('nope', { status: 500 });
  routes['https://g.example/api'] = () =>
    respond('Please limit requests to one every 5 seconds');
  const { service, calls } = harness(routes);
  const payload = await service.getPayload();
  assert.equal(payload.stale, false);
  assert.deepEqual(
    payload.articles.map((a) => a.sourceId),
    ['a'],
  );
  const byId = Object.fromEntries(payload.sources.map((s) => [s.id, s]));
  assert.equal(byId.b.reason, 'http-error');
  assert.equal(byId.g.reason, 'rate-limited');
  assert.equal(byId.b.lastSuccessAt, null);
  // GDELT is tried twice when throttled; nothing else is retried.
  assert.equal(
    calls.filter((c) => c.url === 'https://g.example/api').length,
    2,
  );
  assert.equal(
    calls.filter((c) => c.url === 'https://b.example/rss').length,
    1,
  );
});

test('failure reasons: timeout, empty, parse error, 429, insecure redirect', async () => {
  const { service } = harness(
    {
      'https://a.example/rss': (init) =>
        new Promise((_, reject) =>
          init.signal.addEventListener('abort', () =>
            reject(new Error('aborted')),
          ),
        ),
      'https://b.example/rss': () => respond('<rss><channel></channel></rss>'),
      'https://g.example/api': () => respond('{"articles": [', {}),
      'https://n.example/api': () => respond('', { status: 429 }),
    },
    { newsApiKey: 'k' },
  );
  await assert.rejects(service.getPayload(), (error) => {
    assert.ok(error instanceof NewsUnavailableError);
    const reasons = Object.fromEntries(
      error.sources.map((s) => [s.id, s.reason]),
    );
    assert.deepEqual(reasons, {
      a: 'timeout',
      b: 'empty',
      g: 'parse-error',
      n: 'rate-limited',
    });
    return true;
  });
  const redirected = harness({
    'https://a.example/rss': () =>
      respond(rss(['x', 'y', 'Sat, 10 Oct 2026 11:00:00 GMT']), {
        url: 'http://a.example/rss',
      }),
  });
  await assert.rejects(redirected.service.getPayload(), (error) => {
    assert.equal(error.sources.find((s) => s.id === 'a').reason, 'http-error');
    return true;
  });
});

test('every source down with nothing saved: an error and no articles', async () => {
  const { service } = harness({});
  await assert.rejects(service.getPayload(), (error) => {
    assert.ok(error instanceof NewsUnavailableError);
    assert.equal(error.sources.length, 4);
    assert.ok(error.sources.every((s) => !s.ok));
    assert.equal('articles' in error, false);
    return true;
  });
});

test('every source down after a good read: the saved results, marked stale', async () => {
  const routes = healthy();
  const { service, clock } = harness(routes);
  const first = await service.getPayload();
  for (const url of Object.keys(routes))
    routes[url] = () => respond('', { status: 503 });
  clock.at = T0 + NEWS_CACHE_TTL_MS + 1000;
  const second = await service.getPayload();
  assert.equal(second.stale, true);
  assert.equal(second.fetchedAt, first.fetchedAt);
  assert.deepEqual(
    second.articles.map((a) => a.id),
    first.articles.map((a) => a.id),
  );
  assert.ok(second.sources.filter((s) => s.configured).every((s) => !s.ok));
  assert.equal(
    second.sources.find((s) => s.id === 'a').lastSuccessAt,
    first.fetchedAt,
  );
});

test('a failed source keeps its earlier articles until they age out', async () => {
  const routes = healthy();
  const { service, clock } = harness(routes);
  await service.getPayload();
  routes['https://b.example/rss'] = () => respond('', { status: 500 });
  clock.at = T0 + NEWS_CACHE_TTL_MS + 1000;
  const second = await service.getPayload();
  assert.equal(second.stale, false);
  const beta = second.sources.find((s) => s.id === 'b');
  assert.equal(beta.ok, false);
  assert.equal(beta.count, 1);
  assert.equal(beta.lastSuccessAt, '2026-10-10T12:00:00.000Z');
  const kept = second.articles.find((a) => a.sourceId === 'b');
  assert.equal(kept.fetchedAt, '2026-10-10T12:00:00.000Z');
  clock.at = T0 + (7 * 24 + 1) * 60 * 60 * 1000;
  routes['https://a.example/rss'] = () =>
    respond(
      rss(['Fresh report from Nairobi', 'a2', 'Mon, 12 Oct 2026 12:30:00 GMT']),
    );
  const third = await service.getPayload();
  assert.deepEqual(
    third.articles.map((a) => a.sourceId),
    ['a'],
  );
});

test('fresh results are served from memory; concurrent callers share one read', async () => {
  const { service, calls, clock } = harness(healthy());
  const [a, b] = await Promise.all([
    service.getPayload(),
    service.getPayload(),
  ]);
  assert.equal(a, b);
  assert.equal(calls.length, 3);
  clock.at = T0 + NEWS_CACHE_TTL_MS - 1;
  await service.getPayload();
  assert.equal(calls.length, 3);
  clock.at = T0 + NEWS_CACHE_TTL_MS + 1;
  await service.getPayload();
  assert.equal(calls.length, 6);
});

test('after a total failure the upstreams are not hammered', async () => {
  const { service, calls, clock } = harness({});
  await assert.rejects(service.getPayload());
  const after = calls.length;
  clock.at = T0 + 30_000;
  await assert.rejects(service.getPayload(), NewsUnavailableError);
  assert.equal(calls.length, after);
  assert.equal(service.retryAfterSeconds(), 30);
});

test('the API key travels in a header, never in the URL', async () => {
  const { service, calls } = harness(
    {
      ...healthy(),
      'https://n.example/api': () => respond(JSON.stringify({ articles: [] })),
    },
    { newsApiKey: 'secret-key' },
  );
  await service.getPayload();
  const call = calls.find((c) => c.url === 'https://n.example/api');
  assert.equal(call.init.headers['X-Api-Key'], 'secret-key');
  assert.ok(calls.every((c) => !c.url.includes('secret-key')));
});

test('saved state restores as stale with its real fetch time', async () => {
  const first = harness(healthy());
  const payload = await first.service.getPayload();
  const saved = JSON.parse(JSON.stringify(first.service.exportState()));
  const restored = harness({}, { initialState: saved });
  restored.clock.at = T0 + 60 * 60 * 1000;
  const later = await restored.service.getPayload();
  assert.equal(later.stale, true);
  assert.equal(later.fetchedAt, payload.fetchedAt);
  assert.equal(later.articles.length, 3);
});

test('a story that scrolls out of a feed is kept for the week', () => {
  const now = Date.parse('2026-10-11T12:00:00Z');
  const item = (url, publishedAt, title = url) => ({ url, title, publishedAt });
  const merged = mergeRaws(
    [
      item('https://a/2', '2026-10-11T11:00:00Z'),
      item('https://a/1', '2026-10-10T09:00:00Z', 'updated'),
    ],
    [
      item('https://a/1', '2026-10-10T09:00:00Z', 'first read'),
      item('https://a/0', '2026-10-06T09:00:00Z'),
      item('https://a/old', '2026-10-01T09:00:00Z'),
      item('https://a/undated', 'not a date'),
    ],
    now,
  );
  // The newest read wins, the earlier story stays, the nine-day-old one goes.
  assert.deepEqual(
    merged.map((raw) => [raw.url, raw.title]),
    [
      ['https://a/2', 'https://a/2'],
      ['https://a/1', 'updated'],
      ['https://a/0', 'https://a/0'],
      ['https://a/undated', 'https://a/undated'],
    ],
  );
});
