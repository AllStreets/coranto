import { readResponseTextCapped } from '../httpBody.js';
import { clusterArticles } from './cluster.js';
import { differingFigures } from './figures.js';
import { parseFeed, parseGdelt, parseNewsApi } from './feeds.js';
import {
  NEWS_DROP_REASONS,
  NEWS_MAX_AGE_MS,
  normalizeArticles,
} from './records.js';
import { NEWS_COVERAGE_REGIONS, NEWS_SOURCES } from './registry.js';

export const NEWS_CACHE_TTL_MS = 10 * 60 * 1000;
export const NEWS_RETRY_AFTER_MS = 60 * 1000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
// Items kept per source. A feed lists only its latest few dozen, so earlier
// reads are kept and merged; this cap bounds a week of a busy source.
const MAX_RAW_ITEMS = 2500;
const USER_AGENT =
  'Coranto/0.1 (+https://github.com/AllStreets/coranto; news reader)';

/**
 * Merge a source's new items with the ones read earlier. A feed lists only
 * its latest stories, so without this a story disappears from Coranto the
 * moment it scrolls out of the publisher's feed. The newest read of an item
 * wins; items the publisher dated more than a week ago are let go.
 */
export function mergeRaws(fresh, kept, now) {
  const seen = new Set();
  const out = [];
  for (const raw of [...(fresh ?? []), ...(kept ?? [])]) {
    const key = String(raw?.url || raw?.title || '').trim();
    if (!key || seen.has(key)) continue;
    const published = Date.parse(raw.publishedAt);
    if (Number.isFinite(published) && now - published > NEWS_MAX_AGE_MS)
      continue;
    seen.add(key);
    out.push(raw);
    if (out.length >= MAX_RAW_ITEMS) break;
  }
  return out;
}

const failure = (reason) => Object.assign(new Error(reason), { reason });

/** Thrown by `getPayload` when no source answers and nothing is cached. */
export class NewsUnavailableError extends Error {
  constructor(sources) {
    super('news_unavailable');
    this.name = 'NewsUnavailableError';
    this.sources = sources;
  }
}

/**
 * Reads every configured source, keeps a record of which ones answered, and
 * assembles one payload. A source that fails is reported as failed; its
 * earlier articles stay until they age out. Nothing is ever substituted for
 * a source that did not answer.
 *
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {() => number} [options.now]
 * @param {number} [options.timeoutMs] Deadline per source, covering the body.
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {string} [options.newsApiKey]
 * @param {ReadonlyArray<object>} [options.sources]
 * @param {object|null} [options.initialState] From `exportState()`.
 */
export function createNewsService({
  fetchImpl = fetch,
  now = () => Date.now(),
  timeoutMs = 8000,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  newsApiKey = '',
  sources = NEWS_SOURCES,
  initialState = null,
} = {}) {
  /** @type {Map<string, {raws: object[], fetchedAt: number|null, ok: boolean, reason: string|null}>} */
  const state = new Map(
    sources.map((source) => [
      source.id,
      { raws: [], fetchedAt: null, ok: false, reason: null },
    ]),
  );
  let payload = null;
  let refreshedAt = -Infinity;
  let attemptedAt = -Infinity;
  let inFlight = null;

  const configured = (source) => !source.requiresKey || Boolean(newsApiKey);

  if (initialState && typeof initialState === 'object') {
    for (const source of sources) {
      const saved = initialState.sources?.[source.id];
      if (
        saved &&
        Array.isArray(saved.raws) &&
        Number.isFinite(saved.fetchedAt)
      ) {
        const entry = state.get(source.id);
        entry.raws = saved.raws.slice(0, MAX_RAW_ITEMS);
        entry.fetchedAt = saved.fetchedAt;
      }
    }
    if (Number.isFinite(initialState.fetchedAt)) {
      // Saved results are shown only as stale, with their real fetch time.
      payload = assemble(initialState.fetchedAt, true);
      if (!payload.articles.length) payload = null;
    }
  }

  async function read(source, signal) {
    const headers = { 'User-Agent': USER_AGENT, Accept: '*/*' };
    if (source.kind === 'newsapi') headers['X-Api-Key'] = newsApiKey;
    let response;
    try {
      response = await fetchImpl(source.url, {
        signal,
        headers,
        redirect: 'follow',
      });
    } catch {
      throw failure(signal.aborted ? 'timeout' : 'http-error');
    }
    if (response.url && !response.url.startsWith('https://')) {
      await response.body?.cancel().catch(() => {});
      throw failure('http-error');
    }
    if (response.status === 429) {
      await response.body?.cancel().catch(() => {});
      throw failure('rate-limited');
    }
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => {});
      throw failure('http-error');
    }
    let text;
    try {
      text = await readResponseTextCapped(response, MAX_BODY_BYTES, signal);
    } catch {
      throw failure(signal.aborted ? 'timeout' : 'http-error');
    }
    return text;
  }

  function parse(source, text) {
    if (source.kind === 'feed') return parseFeed(text, source.name);
    const trimmed = text.trimStart();
    if (!trimmed.startsWith('{')) {
      // GDELT answers a throttled request with HTTP 200 and a plain sentence.
      throw failure(source.kind === 'gdelt' ? 'rate-limited' : 'parse-error');
    }
    let data;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw failure('parse-error');
    }
    return source.kind === 'gdelt' ? parseGdelt(data) : parseNewsApi(data);
  }

  async function fetchSource(source) {
    if (!configured(source)) throw failure('not-configured');
    const attempts = source.kind === 'gdelt' ? 2 : 1;
    let last;
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt) await sleep(3000);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const raws = parse(source, await read(source, controller.signal));
        if (!raws.length) throw failure('empty');
        return raws.slice(0, MAX_RAW_ITEMS);
      } catch (error) {
        last = error.reason ? error : failure('parse-error');
        if (last.reason !== 'rate-limited') break;
      } finally {
        clearTimeout(timer);
      }
    }
    throw last;
  }

  function assemble(fetchedAt, stale) {
    const at = now();
    const seen = new Set();
    const articles = [];
    const dropped = Object.fromEntries(NEWS_DROP_REASONS.map((r) => [r, 0]));
    const report = [];
    for (const source of sources) {
      const entry = state.get(source.id);
      let count = 0;
      if (entry.fetchedAt !== null && at - entry.fetchedAt <= NEWS_MAX_AGE_MS) {
        const result = normalizeArticles(
          entry.raws,
          {
            sourceId: source.id,
            region: source.region,
            lang: source.lang,
            fetchedAt: entry.fetchedAt,
            now: at,
          },
          seen,
        );
        count = result.articles.length;
        articles.push(...result.articles);
        for (const [reason, n] of Object.entries(result.dropped))
          dropped[reason] += n;
      }
      report.push({
        id: source.id,
        name: source.name,
        homepage: source.homepage,
        configured: configured(source),
        ok: entry.ok,
        count,
        lastSuccessAt:
          entry.fetchedAt === null
            ? null
            : new Date(entry.fetchedAt).toISOString(),
        reason: entry.ok ? null : entry.reason,
      });
    }
    articles.sort(
      (a, b) =>
        Date.parse(b.publishedAt) - Date.parse(a.publishedAt) ||
        a.id.localeCompare(b.id),
    );
    return {
      schemaVersion: 1,
      fetchedAt: new Date(fetchedAt).toISOString(),
      stale,
      articles,
      stories: describeStories(articles, report),
      sources: report,
      dropped,
    };
  }

  /**
   * Group the articles into stories and, for each, record which regions'
   * outlets carried it and where their headline figures differ.
   */
  function describeStories(articles, report) {
    const byId = new Map(articles.map((article) => [article.id, article]));
    // A region can only be called quiet on a story if we are reading it now.
    const listening = new Set(
      sources
        .filter((source) => report.find((row) => row.id === source.id)?.ok)
        .map((source) => source.region),
    );
    return clusterArticles(articles).map((story) => {
      const members = story.articleIds.map((id) => byId.get(id));
      if (story.outlets < 2) return story;
      const coverage = NEWS_COVERAGE_REGIONS.map((region) => ({
        region,
        outlets: new Set(
          members
            .filter((article) => article.region === region)
            .map((article) => article.publisher),
        ).size,
        listening: listening.has(region),
      }));
      return {
        ...story,
        coverage,
        differing: differingFigures(members),
      };
    });
  }

  async function refresh() {
    attemptedAt = now();
    const results = await Promise.all(
      sources.map((source) =>
        fetchSource(source).then(
          (raws) => ({ source, raws }),
          (error) => ({ source, reason: error.reason ?? 'http-error' }),
        ),
      ),
    );
    const at = now();
    let anyOk = false;
    for (const { source, raws, reason } of results) {
      const entry = state.get(source.id);
      if (raws) {
        anyOk = true;
        entry.raws = mergeRaws(raws, entry.raws, at);
        entry.fetchedAt = at;
        entry.ok = true;
        entry.reason = null;
      } else {
        entry.ok = false;
        entry.reason = reason;
      }
    }
    if (anyOk) {
      payload = assemble(at, false);
      refreshedAt = at;
      return payload;
    }
    if (payload) {
      // No source answered: keep the last real results, marked stale, with
      // the time they were actually fetched.
      payload = assemble(Date.parse(payload.fetchedAt), true);
      if (payload.articles.length) return payload;
      payload = null;
    }
    throw new NewsUnavailableError(assemble(at, true).sources);
  }

  return {
    /**
     * The current payload. Refreshes when the cache is older than the TTL;
     * concurrent callers share one refresh.
     */
    async getPayload() {
      const at = now();
      if (payload && !payload.stale && at - refreshedAt < NEWS_CACHE_TTL_MS)
        return payload;
      if (!inFlight) {
        if (at - attemptedAt < NEWS_RETRY_AFTER_MS) {
          if (payload) return payload;
          throw new NewsUnavailableError(assemble(at, true).sources);
        }
        inFlight = refresh().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
    /** Seconds until a failed refresh may be retried. */
    retryAfterSeconds() {
      return Math.max(
        1,
        Math.ceil((NEWS_RETRY_AFTER_MS - (now() - attemptedAt)) / 1000),
      );
    },
    /** What the last successful reads returned, for a disk cache. */
    exportState() {
      const saved = {};
      for (const [id, entry] of state)
        if (entry.fetchedAt !== null)
          saved[id] = { raws: entry.raws, fetchedAt: entry.fetchedAt };
      return {
        version: 1,
        fetchedAt: payload ? Date.parse(payload.fetchedAt) : null,
        sources: saved,
      };
    },
  };
}
