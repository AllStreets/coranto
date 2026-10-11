import { readResponseTextCapped } from '../httpBody.js';
import { parseDisplacement, parseOutbreaks } from './records.js';

export const RELIEF_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const RELIEF_RETRY_AFTER_MS = 5 * 60 * 1000;
const USER_AGENT =
  'Coranto/0.1 (+https://github.com/AllStreets/coranto; humanitarian figures)';

/** Thrown when neither source answers and nothing is cached. */
export class ReliefUnavailableError extends Error {
  constructor() {
    super('relief_unavailable');
    this.name = 'ReliefUnavailableError';
  }
}

/**
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {() => number} [options.now]
 * @param {number} [options.timeoutMs]
 */
export function createReliefService({
  fetchImpl = fetch,
  now = () => Date.now(),
  timeoutMs = 25_000,
} = {}) {
  let payload = null;
  let refreshedAt = -Infinity;
  let attemptedAt = -Infinity;
  let inFlight = null;

  async function getJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        redirect: 'follow',
      });
      if (response.status !== 200) {
        await response.body?.cancel().catch(() => {});
        throw new Error('http-error');
      }
      return JSON.parse(
        await readResponseTextCapped(
          response,
          4 * 1024 * 1024,
          controller.signal,
        ),
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async function displacement(at) {
    // UNHCR publishes a year once it has figures; ask for this year, then last.
    const thisYear = new Date(at).getUTCFullYear();
    for (const year of [thisYear, thisYear - 1]) {
      const rows = parseDisplacement(
        await getJson(
          `https://api.unhcr.org/population/v1/population/?limit=400&year=${year}&coo_all=true`,
        ),
        year,
      );
      if (rows.length) return { year, rows };
    }
    throw new Error('empty');
  }

  async function outbreaks() {
    const rows = parseOutbreaks(
      await getJson(
        'https://www.who.int/api/news/diseaseoutbreaknews?$top=30&$orderby=PublicationDate%20desc&$select=Title,PublicationDate,UrlName,DonId',
      ),
    );
    if (!rows.length) throw new Error('empty');
    return rows;
  }

  async function refresh() {
    attemptedAt = now();
    const [people, notices] = await Promise.all([
      displacement(attemptedAt).then(
        (value) => ({ ok: true, value }),
        () => ({ ok: false }),
      ),
      outbreaks().then(
        (value) => ({ ok: true, value }),
        () => ({ ok: false }),
      ),
    ]);
    if (!people.ok && !notices.ok) {
      if (payload) {
        payload = { ...payload, stale: true };
        return payload;
      }
      throw new ReliefUnavailableError();
    }
    const at = now();
    payload = {
      schemaVersion: 1,
      fetchedAt: new Date(at).toISOString(),
      stale: false,
      // A source that failed keeps what it gave last time, marked as not live.
      displacement: people.ok ? people.value : (payload?.displacement ?? null),
      outbreaks: notices.ok ? notices.value : (payload?.outbreaks ?? []),
      sources: [
        { name: 'UNHCR Refugee Data Finder', ok: people.ok },
        { name: 'WHO Disease Outbreak News', ok: notices.ok },
      ],
    };
    refreshedAt = at;
    return payload;
  }

  return {
    async getPayload() {
      const at = now();
      if (payload && !payload.stale && at - refreshedAt < RELIEF_CACHE_TTL_MS)
        return payload;
      if (!inFlight) {
        if (at - attemptedAt < RELIEF_RETRY_AFTER_MS) {
          if (payload) return payload;
          throw new ReliefUnavailableError();
        }
        inFlight = refresh().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
  };
}
