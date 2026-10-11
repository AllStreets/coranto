import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  BRIEF_INSTRUCTIONS,
  briefInput,
  briefSources,
  validateBrief,
} from '../../src/sources/news/brief.js';
import {
  NewsUnavailableError,
  createNewsService,
} from '../../src/sources/news/service.js';
import { readRequestBody } from './common/request.js';
import { sameSiteGated } from './common/same-site.js';
import { OPENAI_HUD_SUMMARY_MODEL_DEFAULT } from './openai/constants.js';
import { enforceRateLimit, openAiRateLimiter } from './openai/rate-limit.js';

const MAX_DISK_CACHE_BYTES = 8 * 1024 * 1024;
const BRIEF_CACHE_TTL_MS = 30 * 60 * 1000;
const BRIEF_CACHE_MAX = 200;

function openAiText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim())
    return data.output_text;
  if (!Array.isArray(data?.output)) return '';
  return data.output
    .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
    .map((part) => part?.text || part?.output_text || '')
    .join('');
}

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
 * @param {typeof fetch} [options.briefFetch] Fetch used for the model call.
 * @param {() => string} [options.briefKey] Returns the OpenAI key, or ''.
 * @param {boolean} [options.gateBrief] `false` skips the same-site and rate
 * gates (tests only).
 *
 * `/api/news/brief` (POST `{ storyId }`) asks a model to summarise one story
 * from the outlets' own headlines and summaries, then returns only the
 * sentences that pass `validateBrief`. See `src/sources/news/brief.js`.
 */
export function newsProxy({
  fetchImpl,
  now,
  timeoutMs,
  sleep,
  cachePath = path.join(process.cwd(), '.gev-cache', 'news-v1.json'),
  newsApiKey = process.env.NEWS_API_KEY ?? '',
  briefFetch = (...args) => fetch(...args),
  briefKey = () => process.env.OPENAI_API_KEY ?? '',
  gateBrief = true,
} = {}) {
  const briefCache = new Map();
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

  async function briefHandler(req, res) {
    const json = (status, value) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(value));
    };
    if (req.method !== 'POST')
      return json(405, { error: 'method_not_allowed' });
    const apiKey = briefKey();
    if (!apiKey)
      return json(200, { available: false, reason: 'not-configured' });
    if (gateBrief && !enforceRateLimit(openAiRateLimiter(), req, res)) return;
    let storyId;
    try {
      storyId = JSON.parse(
        (await readRequestBody(req, 4 * 1024)) || '{}',
      ).storyId;
    } catch {
      return json(400, { error: 'invalid_brief_request' });
    }
    if (typeof storyId !== 'string' || !storyId)
      return json(400, { error: 'invalid_brief_request' });
    let payload;
    try {
      payload = await (await service()).getPayload();
    } catch {
      return json(503, { error: 'news_unavailable' });
    }
    const story = payload.stories?.find((entry) => entry.id === storyId);
    if (!story) return json(404, { error: 'unknown_story' });
    const byId = new Map(
      payload.articles.map((article) => [article.id, article]),
    );
    const sources = briefSources(
      story.articleIds.map((id) => byId.get(id)).filter(Boolean),
    );
    const cacheKey = `${storyId}|${sources.map((source) => source.id).join(',')}`;
    const clock = now ? now() : Date.now();
    const cached = briefCache.get(cacheKey);
    if (cached && clock - cached.at < BRIEF_CACHE_TTL_MS)
      return json(200, cached.value);
    const model =
      process.env.CORANTO_BRIEF_MODEL ||
      process.env.OPENAI_HUD_SUMMARY_MODEL ||
      OPENAI_HUD_SUMMARY_MODEL_DEFAULT;
    let text = '';
    try {
      const response = await briefFetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          instructions: BRIEF_INSTRUCTIONS,
          input: briefInput(sources),
          reasoning: { effort: 'minimal' },
          max_output_tokens: 1200,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) {
        // Never relay the provider's own error text.
        console.warn(`[news] brief upstream HTTP ${response.status}`);
        return json(502, { error: 'brief_failed' });
      }
      text = openAiText(await response.json());
    } catch {
      console.warn('[news] brief request failed');
      return json(502, { error: 'brief_failed' });
    }
    const checked = validateBrief(text, sources);
    const value = {
      available: true,
      storyId,
      model,
      supported: Boolean(checked),
      sentences: checked?.sentences ?? [],
      claims: checked?.claims ?? [],
      removed: checked?.removed ?? 0,
      sources: sources.map(({ n, publisher, title, url }) => ({
        n,
        publisher,
        title,
        url,
      })),
    };
    if (briefCache.size >= BRIEF_CACHE_MAX)
      briefCache.delete(briefCache.keys().next().value);
    briefCache.set(cacheKey, { at: clock, value });
    json(200, value);
  }
  const brief = gateBrief ? sameSiteGated(briefHandler) : briefHandler;

  return {
    name: 'news',
    // The brief route is registered first: `/api/news` would otherwise
    // receive `/api/news/brief` as a sub-path.
    configureServer({ middlewares }) {
      middlewares.use('/api/news/brief', brief);
      middlewares.use('/api/news', handler);
    },
    configurePreviewServer({ middlewares }) {
      middlewares.use('/api/news/brief', brief);
      middlewares.use('/api/news', handler);
    },
  };
}
