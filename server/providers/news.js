import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  BRIEF_INSTRUCTIONS,
  BRIEF_SCHEMA,
  briefInput,
  BRIEF_PLACE_INSTRUCTIONS,
  placeBriefArticles,
  briefSources,
  checkBrief,
} from '../../src/sources/news/brief.js';
import {
  TRANSLATE_SCHEMA,
  checkTranslation,
  translateInput,
  translateInstructions,
  translateLanguageName,
} from '../../src/sources/news/translate.js';
import {
  NewsUnavailableError,
  createNewsService,
} from '../../src/sources/news/service.js';
import { readRequestBody } from './common/request.js';
import { sameSiteGated } from './common/same-site.js';
import { OPENAI_HUD_SUMMARY_MODEL_DEFAULT } from './openai/constants.js';
import { enforceRateLimit, openAiRateLimiter } from './openai/rate-limit.js';

// A week of items from every source.
const MAX_DISK_CACHE_BYTES = 96 * 1024 * 1024;
const BRIEF_CACHE_TTL_MS = 30 * 60 * 1000;
const BRIEF_CACHE_MAX = 200;
// A brief with nothing to show is kept only briefly, so asking again soon
// gets a fresh attempt.
const BRIEF_EMPTY_TTL_MS = 60 * 1000;
const BRIEF_ATTEMPTS = 2;

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
    let placeKey;
    try {
      ({ storyId, placeKey } = JSON.parse(
        (await readRequestBody(req, 4 * 1024)) || '{}',
      ));
    } catch {
      return json(400, { error: 'invalid_brief_request' });
    }
    // A brief is of one story, or of one place: never both.
    const ofPlace = typeof placeKey === 'string' && placeKey.length > 0;
    const ofStory = typeof storyId === 'string' && storyId.length > 0;
    if (ofPlace === ofStory || (ofPlace && placeKey.length > 200))
      return json(400, { error: 'invalid_brief_request' });
    let payload;
    try {
      payload = await (await service()).getPayload();
    } catch {
      return json(503, { error: 'news_unavailable' });
    }
    let sources;
    if (ofPlace) {
      sources = briefSources(
        placeBriefArticles(payload.articles, payload.stories, placeKey),
      );
      if (!sources.length) return json(404, { error: 'unknown_place' });
    } else {
      const story = payload.stories?.find((entry) => entry.id === storyId);
      if (!story) return json(404, { error: 'unknown_story' });
      const byId = new Map(
        payload.articles.map((article) => [article.id, article]),
      );
      sources = briefSources(
        story.articleIds.map((id) => byId.get(id)).filter(Boolean),
      );
    }
    const cacheKey = `${ofPlace ? `place:${placeKey}` : storyId}|${sources.map((source) => source.id).join(',')}`;
    const clock = now ? now() : Date.now();
    const cached = briefCache.get(cacheKey);
    if (
      cached &&
      clock - cached.at <
        (cached.value.supported ? BRIEF_CACHE_TTL_MS : BRIEF_EMPTY_TTL_MS)
    )
      return json(200, cached.value);
    const model =
      process.env.CORANTO_BRIEF_MODEL ||
      process.env.OPENAI_HUD_SUMMARY_MODEL ||
      OPENAI_HUD_SUMMARY_MODEL_DEFAULT;
    // The model is asked again once when its reply cannot be read or nothing
    // in it passes the check; replies vary from one call to the next.
    let checked = { readable: false, sentences: [], claims: [], removed: 0 };
    for (let attempt = 0; attempt < BRIEF_ATTEMPTS; attempt++) {
      let text = '';
      try {
        const response = await briefFetch(
          'https://api.openai.com/v1/responses',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              instructions: ofPlace
                ? BRIEF_PLACE_INSTRUCTIONS
                : BRIEF_INSTRUCTIONS,
              input: briefInput(sources),
              reasoning: { effort: 'minimal' },
              max_output_tokens: 2000,
              text: {
                format: {
                  type: 'json_schema',
                  name: 'brief',
                  strict: true,
                  schema: BRIEF_SCHEMA,
                },
              },
            }),
            signal: AbortSignal.timeout(45_000),
          },
        );
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
      checked = checkBrief(text, sources);
      if (checked.sentences.length || checked.claims.length) break;
    }
    const supported = Boolean(
      checked.sentences.length || checked.claims.length,
    );
    const value = {
      available: true,
      ...(ofPlace ? { placeKey } : { storyId }),
      model,
      supported,
      // Why nothing is shown, when nothing is.
      reason: supported
        ? null
        : checked.readable
          ? 'unsupported'
          : 'unreadable',
      sentences: checked.sentences,
      claims: checked.claims,
      removed: checked.removed,
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
  /**
   * `/api/news/translate` (POST `{ articleId, language }`): a machine
   * translation of one headline and summary, returned only if every figure
   * in the original is in it and none was added.
   */
  const translateCache = new Map();
  async function translateHandler(req, res) {
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
    let articleId;
    let language;
    try {
      ({ articleId, language } = JSON.parse(
        (await readRequestBody(req, 4 * 1024)) || '{}',
      ));
    } catch {
      return json(400, { error: 'invalid_translate_request' });
    }
    const languageName = translateLanguageName(language);
    if (typeof articleId !== 'string' || !articleId || !languageName)
      return json(400, { error: 'invalid_translate_request' });
    let payload;
    try {
      payload = await (await service()).getPayload();
    } catch {
      return json(503, { error: 'news_unavailable' });
    }
    const article = payload.articles.find((entry) => entry.id === articleId);
    if (!article) return json(404, { error: 'unknown_article' });
    const cacheKey = `${articleId}|${language}`;
    const clock = now ? now() : Date.now();
    const cached = translateCache.get(cacheKey);
    if (
      cached &&
      clock - cached.at <
        (cached.value.supported ? BRIEF_CACHE_TTL_MS : BRIEF_EMPTY_TTL_MS)
    )
      return json(200, cached.value);
    const model =
      process.env.CORANTO_BRIEF_MODEL ||
      process.env.OPENAI_HUD_SUMMARY_MODEL ||
      OPENAI_HUD_SUMMARY_MODEL_DEFAULT;
    let checked = { ok: false, reason: 'unreadable' };
    for (let attempt = 0; attempt < BRIEF_ATTEMPTS && !checked.ok; attempt++) {
      try {
        const response = await briefFetch(
          'https://api.openai.com/v1/responses',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              instructions: translateInstructions(languageName),
              input: translateInput(article),
              reasoning: { effort: 'minimal' },
              max_output_tokens: 2000,
              text: {
                format: {
                  type: 'json_schema',
                  name: 'translation',
                  strict: true,
                  schema: TRANSLATE_SCHEMA,
                },
              },
            }),
            signal: AbortSignal.timeout(45_000),
          },
        );
        if (!response.ok) {
          console.warn(`[news] translate upstream HTTP ${response.status}`);
          return json(502, { error: 'translate_failed' });
        }
        checked = checkTranslation(openAiText(await response.json()), article);
      } catch {
        console.warn('[news] translate request failed');
        return json(502, { error: 'translate_failed' });
      }
    }
    const value = {
      available: true,
      articleId,
      language,
      languageName,
      model,
      supported: checked.ok,
      reason: checked.ok ? null : checked.reason,
      title: checked.ok ? checked.title : '',
      summary: checked.ok ? checked.summary : '',
    };
    if (translateCache.size >= BRIEF_CACHE_MAX)
      translateCache.delete(translateCache.keys().next().value);
    translateCache.set(cacheKey, { at: clock, value });
    json(200, value);
  }
  const translate = gateBrief
    ? sameSiteGated(translateHandler)
    : translateHandler;
  const brief = gateBrief ? sameSiteGated(briefHandler) : briefHandler;

  return {
    name: 'news',
    // The brief route is registered first: `/api/news` would otherwise
    // receive `/api/news/brief` as a sub-path.
    configureServer({ middlewares }) {
      middlewares.use('/api/news/brief', brief);
      middlewares.use('/api/news/translate', translate);
      middlewares.use('/api/news', handler);
    },
    configurePreviewServer({ middlewares }) {
      middlewares.use('/api/news/brief', brief);
      middlewares.use('/api/news/translate', translate);
      middlewares.use('/api/news', handler);
    },
  };
}
