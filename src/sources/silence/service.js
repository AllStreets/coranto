import { readResponseTextCapped } from '../httpBody.js';
import { latestAlerts, silencePlaces } from './records.js';

export const SILENCE_CACHE_TTL_MS = 10 * 60 * 1000;
export const SILENCE_RETRY_AFTER_MS = 2 * 60 * 1000;
/** How far back alerts are read: an outage older than this is not shown. */
export const SILENCE_WINDOW_S = 14 * 24 * 60 * 60;
const API = 'https://api.ioda.inetintel.cc.gatech.edu/v2/outages/alerts';
const USER_AGENT =
  'Coranto/0.2 (+https://github.com/AllStreets/coranto; internet outages)';

/** Thrown when IODA does not answer and nothing is cached. */
export class SilenceUnavailableError extends Error {
  constructor() {
    super('silence_unavailable');
    this.name = 'SilenceUnavailableError';
  }
}

/**
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {() => number} [options.now]
 * @param {number} [options.timeoutMs]
 */
export function createSilenceService({
  fetchImpl = fetch,
  now = () => Date.now(),
  timeoutMs = 30_000,
} = {}) {
  let payload = null;
  let refreshedAt = -Infinity;
  let attemptedAt = -Infinity;
  let inFlight = null;

  async function alerts(type, at) {
    const until = Math.floor(at / 1000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(
        `${API}?from=${until - SILENCE_WINDOW_S}&until=${until}&entityType=${type}&limit=100000`,
        {
          signal: controller.signal,
          headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
          redirect: 'follow',
        },
      );
      if (response.status !== 200) {
        await response.body?.cancel().catch(() => {});
        throw new Error('http-error');
      }
      return latestAlerts(
        JSON.parse(
          await readResponseTextCapped(
            response,
            24 * 1024 * 1024,
            controller.signal,
          ),
        ),
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async function refresh() {
    attemptedAt = now();
    try {
      const [countries, regions] = await Promise.all([
        alerts('country', attemptedAt),
        alerts('region', attemptedAt),
      ]);
      const at = now();
      payload = {
        schemaVersion: 1,
        fetchedAt: new Date(at).toISOString(),
        stale: false,
        windowDays: SILENCE_WINDOW_S / 86_400,
        places: silencePlaces([...countries, ...regions]),
        sources: [{ name: 'IODA (Georgia Tech)', ok: true }],
      };
      refreshedAt = at;
      return payload;
    } catch {
      if (payload) {
        payload = {
          ...payload,
          stale: true,
          sources: [{ name: 'IODA (Georgia Tech)', ok: false }],
        };
        return payload;
      }
      throw new SilenceUnavailableError();
    }
  }

  return {
    async getPayload() {
      const at = now();
      if (payload && !payload.stale && at - refreshedAt < SILENCE_CACHE_TTL_MS)
        return payload;
      if (!inFlight) {
        if (at - attemptedAt < SILENCE_RETRY_AFTER_MS) {
          if (payload) return payload;
          throw new SilenceUnavailableError();
        }
        inFlight = refresh().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
  };
}
