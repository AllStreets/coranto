import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  NewsUnavailableError,
  createNewsService,
} from '../../src/sources/news/service.js';

const MAX_DISK_CACHE_BYTES = 8 * 1024 * 1024;

/**
 * `/api/news`: headlines from the fixed publisher list in
 * `src/sources/news/registry.js`, each with its publisher, link and the
 * feed's own publish time, plus a report of which sources answered.
 *
 * When no source answers and nothing is saved, the route returns 503 with
 * that report and no articles. It has no built-in stories.
 *
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {() => number} [options.now]
 * @param {number} [options.timeoutMs]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {string|null} [options.cachePath] `null` disables the disk cache.
 * @param {string} [options.newsApiKey]
 */
export function newsProxy({
  fetchImpl,
  now,
  timeoutMs,
  sleep,
  cachePath = path.join(process.cwd(), '.gev-cache', 'news-v1.json'),
  newsApiKey = process.env.NEWS_API_KEY ?? '',
} = {}) {
  let servicePromise = null;
  let savedFetchedAt = null;

  async function loadState() {
    if (!cachePath) return null;
    try {
      const stat = await fsp.stat(cachePath);
      if (stat.size > MAX_DISK_CACHE_BYTES) return null;
      const parsed = JSON.parse(await fsp.readFile(cachePath, 'utf8'));
      return parsed?.version === 1 ? parsed : null;
    } catch {
      return null;
    }
  }

  async function saveState(service, payload) {
    if (!cachePath || payload.stale || payload.fetchedAt === savedFetchedAt)
      return;
    savedFetchedAt = payload.fetchedAt;
    try {
      await fsp.mkdir(path.dirname(cachePath), { recursive: true });
      await fsp.writeFile(cachePath, JSON.stringify(service.exportState()));
    } catch {
      console.warn('[news] cache write failed');
    }
  }

  function service() {
    servicePromise ??= loadState().then((initialState) =>
      createNewsService({
        ...(fetchImpl ? { fetchImpl } : {}),
        ...(now ? { now } : {}),
        ...(timeoutMs ? { timeoutMs } : {}),
        ...(sleep ? { sleep } : {}),
        newsApiKey,
        initialState,
      }),
    );
    return servicePromise;
  }

  async function handler(req, res) {
    const json = (status, value, headers = {}) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        ...headers,
      });
      res.end(JSON.stringify(value));
    };
    if (req.method !== 'GET') return json(405, { error: 'method_not_allowed' });
    if (req.url !== '/' && req.url !== '')
      return json(400, { error: 'invalid_news_query' });
    const news = await service();
    try {
      const payload = await news.getPayload();
      void saveState(news, payload);
      json(200, payload);
    } catch (error) {
      if (!(error instanceof NewsUnavailableError)) {
        console.warn('[news] refresh failed');
        return json(502, { error: 'news_failed' });
      }
      const retryAfter = news.retryAfterSeconds();
      json(
        503,
        { error: 'news_unavailable', retryAfter, sources: error.sources },
        { 'Retry-After': String(retryAfter) },
      );
    }
  }

  return {
    name: 'news',
    configureServer({ middlewares }) {
      middlewares.use('/api/news', handler);
    },
    configurePreviewServer({ middlewares }) {
      middlewares.use('/api/news', handler);
    },
  };
}
