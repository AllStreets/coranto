import { readResponseTextCapped } from '../httpBody.js';
import { parseTravelNotices } from './records.js';

export const OUTBREAKS_CACHE_TTL_MS = 3 * 60 * 60 * 1000;
export const OUTBREAKS_RETRY_AFTER_MS = 5 * 60 * 1000;
const FEED = 'https://wwwnc.cdc.gov/travel/rss/notices.xml';
const USER_AGENT =
  'Coranto/0.2 (+https://github.com/AllStreets/coranto; travel health notices)';

/** Thrown when the CDC feed does not answer and nothing is cached. */
export class OutbreaksUnavailableError extends Error {
  constructor() {
    super('outbreaks_unavailable');
    this.name = 'OutbreaksUnavailableError';
  }
}

/**
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {() => number} [options.now]
 * @param {number} [options.timeoutMs]
 */
export function createOutbreaksService({
  fetchImpl = fetch,
  now = () => Date.now(),
  timeoutMs = 25_000,
} = {}) {
  let payload = null;
  let refreshedAt = -Infinity;
  let attemptedAt = -Infinity;
  let inFlight = null;

  async function refresh() {
    attemptedAt = now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(FEED, {
        signal: controller.signal,
        headers: { Accept: 'application/rss+xml', 'User-Agent': USER_AGENT },
        redirect: 'follow',
      });
      if (response.status !== 200) {
        await response.body?.cancel().catch(() => {});
        throw new Error('http-error');
      }
      const notices = parseTravelNotices(
        await readResponseTextCapped(
          response,
          2 * 1024 * 1024,
          controller.signal,
        ),
      );
      if (!notices.length) throw new Error('empty');
      const at = now();
      payload = {
        schemaVersion: 1,
        fetchedAt: new Date(at).toISOString(),
        stale: false,
        notices,
        sources: [{ name: 'CDC Travel Health Notices', ok: true }],
      };
      refreshedAt = at;
      return payload;
    } catch {
      if (payload) {
        payload = {
          ...payload,
          stale: true,
          sources: [{ name: 'CDC Travel Health Notices', ok: false }],
        };
        return payload;
      }
      throw new OutbreaksUnavailableError();
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async getPayload() {
      const at = now();
      if (
        payload &&
        !payload.stale &&
        at - refreshedAt < OUTBREAKS_CACHE_TTL_MS
      )
        return payload;
      if (!inFlight) {
        if (at - attemptedAt < OUTBREAKS_RETRY_AFTER_MS) {
          if (payload) return payload;
          throw new OutbreaksUnavailableError();
        }
        inFlight = refresh().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
  };
}
