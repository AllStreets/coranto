// Browser gate for Coranto's news view. Needs the dev or preview server:
//   npm run dev            (in another terminal)
//   npm run qa:news
//
// The news route is answered inside the test browser, so the three cases
// below are exact. The app itself has no fixture mode.
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const urlFlag = process.argv.indexOf('--url');
const BASE = urlFlag > 0 ? process.argv[urlFlag + 1] : 'http://localhost:4173';

const now = Date.now();
const iso = (minutesAgo) => new Date(now - minutesAgo * 60_000).toISOString();
const article = (id, publisher, title, place, extra = {}) => ({
  id,
  title,
  summary: '',
  url: `https://example.org/${id}`,
  publisher,
  sourceId: publisher.toLowerCase(),
  region: 'Europe',
  lang: 'en',
  publishedAt: iso(30),
  fetchedAt: iso(1),
  place,
  category: null,
  progress: null,
  ...extra,
});
const doha = {
  name: 'Doha',
  lat: 25.2854,
  lon: 51.531,
  precision: 'city',
  matched: 'Doha',
  field: 'title',
};
const source = (id, name, ok, extra = {}) => ({
  id,
  name,
  homepage: `https://${id}.example`,
  configured: true,
  ok,
  count: ok ? 1 : 0,
  lastSuccessAt: ok ? iso(1) : null,
  reason: ok ? null : 'timeout',
  ...extra,
});
const healthy = {
  schemaVersion: 1,
  fetchedAt: iso(1),
  stale: false,
  articles: [
    article('qa1', 'Alpha', 'Talks open in Doha as envoys arrive', doha),
    article('qa2', 'Beta', 'Envoys arrive in Doha as talks open', doha),
    article('qa3', 'Gamma', 'Researchers publish long-awaited findings', null),
  ],
  stories: [
    { id: 's-qa1', articleIds: ['qa1', 'qa2'], outlets: 2 },
    { id: 's-qa3', articleIds: ['qa3'], outlets: 1 },
  ],
  sources: [
    source('alpha', 'Alpha', true),
    source('beta', 'Beta', true),
    source('gamma', 'Gamma', true),
  ],
  dropped: { junk: 2 },
};
const partial = {
  ...healthy,
  sources: [
    source('alpha', 'Alpha', true),
    source('beta', 'Beta', true),
    source('gamma', 'Gamma Wire', false),
  ],
};
const unavailable = {
  error: 'news_unavailable',
  retryAfter: 60,
  sources: [source('alpha', 'Alpha', false), source('beta', 'Beta', false)],
};

async function openWith(browser, status, body) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('coranto.mode.v1', 'news');
    localStorage.setItem('coranto.welcomed.v1', '1');
  });
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pathname === '/api/news')
      request.respond({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    else if (pathname === '/api/hazards')
      request.respond({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'hazards_unavailable', sources: [] }),
      });
    else request.continue();
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => window.__godsEyeView?.dataManager?.layers?.has('news'),
    { timeout: 90_000 },
  );
  // The shell switches the layer on for a fresh visit; make it certain.
  await page.evaluate(async () => {
    const manager = window.__godsEyeView.dataManager;
    if (!manager.isEnabled('news')) await manager.setEnabled('news', true);
  });
  return { page, errors };
}

const read = (page) =>
  page.evaluate(() => ({
    mode: document.body.dataset.corantoMode,
    live: document.getElementById('coranto-live')?.textContent ?? '',
    cards: [...document.querySelectorAll('.news-card')].map((card) => ({
      title: card.querySelector('.news-card-title')?.textContent ?? '',
      href: card.querySelector('.news-card-title')?.getAttribute('href') ?? '',
      publisher: card.querySelector('.news-card-publisher')?.textContent ?? '',
      time: card.querySelector('.news-card-time')?.getAttribute('datetime'),
      outlets: card.querySelector('.news-card-outlets')?.textContent ?? '',
      place: card.querySelector('.news-card-place')?.textContent ?? '',
    })),
    empty: document.querySelector('.news-empty')?.textContent ?? '',
    emptyHidden: document.querySelector('.news-empty')?.hidden ?? true,
    markers: window.__godsEyeView.dataManager.layers
      .get('news')
      .module.getView().places.length,
  }));

let passed = 0;
async function step(name, run) {
  await run();
  passed++;
  console.log(`ok ${passed} ${name}`);
}

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
});
try {
  await step(
    'healthy feed: grouped stories, real links, one marker per place',
    async () => {
      const { page, errors } = await openWith(browser, 200, healthy);
      await page.waitForFunction(
        () => document.querySelectorAll('.news-card').length === 2,
        { timeout: 60_000 },
      );
      const state = await read(page);
      assert.equal(state.mode, 'news');
      assert.match(state.live, /LIVE · 3\/3/);
      const urls = new Set(healthy.articles.map((item) => item.url));
      for (const card of state.cards) {
        assert.ok(
          urls.has(card.href),
          `card links to its article: ${card.href}`,
        );
        assert.ok(card.publisher, 'card names its publisher');
        assert.ok(Number.isFinite(Date.parse(card.time)), 'card has a time');
      }
      const story = state.cards.find((card) => card.outlets);
      assert.match(story.outlets, /^2 outlets · 2 headlines$/);
      assert.match(story.place, /^Doha · city · matched “Doha” in headline$/);
      assert.equal(
        state.cards.find((card) => !card.outlets).place,
        'No location',
      );
      assert.equal(state.markers, 1, 'two Doha stories share one marker');
      assert.deepEqual(errors, []);
      await page.close();
    },
  );

  await step('partial feed: the source that is down is named', async () => {
    const { page } = await openWith(browser, 200, partial);
    await page.waitForFunction(
      () => document.querySelectorAll('.news-card').length === 2,
      { timeout: 60_000 },
    );
    assert.match((await read(page)).live, /LIVE · 2\/3/);
    await page.click('#coranto-live');
    const down = await page.$$eval('.news-source[data-state="down"]', (rows) =>
      rows.map((row) => row.textContent),
    );
    assert.equal(down.length, 1);
    assert.match(down[0], /Gamma Wire/);
    assert.match(down[0], /timed out/);
    await page.close();
  });

  await step(
    'no source reachable: one sentence, no cards, no markers',
    async () => {
      const { page } = await openWith(browser, 503, unavailable);
      await page.waitForFunction(
        () =>
          /No news source is reachable/.test(
            document.querySelector('.news-empty')?.textContent ?? '',
          ),
        { timeout: 60_000 },
      );
      const state = await read(page);
      assert.equal(state.cards.length, 0);
      assert.equal(state.markers, 0);
      assert.equal(state.emptyHidden, false);
      assert.match(
        state.empty,
        /^No news source is reachable\. Nothing to show\./,
      );
      assert.match(state.live, /NO SOURCE REACHABLE/);
      await page.close();
    },
  );
  console.log(`${passed} steps ok`);
} finally {
  await browser.close();
}
