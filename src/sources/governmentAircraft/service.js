import { readResponseTextCapped } from '../httpBody.js';
import { REGISTRY_URL, parsePositions, parseRegistry } from './records.js';

export const REGISTRY_TTL_MS = 24 * 60 * 60 * 1000;
export const POSITIONS_TTL_MS = 90 * 1000;
export const RETRY_AFTER_MS = 60 * 1000;
// adsb.lol allows only a few requests a minute, so the whole list goes in
// one request; a second batch is only needed if the list grows a lot.
const BATCH = 900;
const BATCH_GAP_MS = 5000;
const USER_AGENT =
  'Coranto/0.1 (+https://github.com/AllStreets/coranto; government aircraft)';

/** Thrown when there is nothing truthful to show. */
export class GovernmentAircraftUnavailableError extends Error {
  constructor(reason) {
    super('government_aircraft_unavailable');
    this.name = 'GovernmentAircraftUnavailableError';
    this.reason = reason;
  }
}

/**
 * Reads the public registry once a day and the listed aircraft's broadcast
 * positions on demand.
 *
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {() => number} [options.now]
 * @param {number} [options.timeoutMs]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 */
export function createGovernmentAircraftService({
  fetchImpl = fetch,
  now = () => Date.now(),
  timeoutMs = 15_000,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  let registry = null;
  let registryAt = -Infinity;
  let payload = null;
  let refreshedAt = -Infinity;
  let attemptedAt = -Infinity;
  let inFlight = null;

  async function getText(url, maxBytes) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        signal: controller.signal,
        headers: { Accept: '*/*', 'User-Agent': USER_AGENT },
        redirect: 'error',
      });
      if (response.status !== 200) {
        await response.body?.cancel().catch(() => {});
        throw new Error(
          response.status === 429 ? 'rate-limited' : 'http-error',
        );
      }
      return await readResponseTextCapped(
        response,
        maxBytes,
        controller.signal,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadRegistry(at) {
    if (registry && at - registryAt < REGISTRY_TTL_MS) return;
    try {
      const parsed = parseRegistry(
        await getText(REGISTRY_URL, 8 * 1024 * 1024),
      );
      if (parsed.size) {
        registry = parsed;
        registryAt = at;
      }
    } catch {
      // Keep yesterday's list if there is one; it changes slowly.
    }
    if (!registry) throw new GovernmentAircraftUnavailableError('registry');
  }

  async function refresh() {
    attemptedAt = now();
    await loadRegistry(attemptedAt);
    const hexes = [...registry.keys()];
    const aircraft = [];
    let answered = 0;
    let batches = 0;
    for (let i = 0; i < hexes.length; i += BATCH) {
      // adsb.lol is a volunteer service: ask in turn, not all at once.
      if (batches) await sleep(BATCH_GAP_MS);
      batches++;
      try {
        const text = await getText(
          `https://api.adsb.lol/v2/hex/${hexes.slice(i, i + BATCH).join(',')}`,
          2 * 1024 * 1024,
        );
        for (const record of parsePositions(JSON.parse(text), registry))
          aircraft.push(record);
        answered++;
      } catch {
        // A batch that fails leaves its aircraft out; the count below says so.
      }
    }
    if (!answered) {
      if (payload) {
        payload = { ...payload, stale: true };
        return payload;
      }
      throw new GovernmentAircraftUnavailableError('positions');
    }
    const at = now();
    aircraft.sort(
      (a, b) =>
        (b.altitudeFt ?? -1) - (a.altitudeFt ?? -1) ||
        a.icao24.localeCompare(b.icao24),
    );
    payload = {
      schemaVersion: 1,
      fetchedAt: new Date(at).toISOString(),
      stale: false,
      listed: registry.size,
      registryFetchedAt: new Date(registryAt).toISOString(),
      // False when part of the list could not be checked this time.
      complete: answered === batches,
      aircraft,
    };
    refreshedAt = at;
    return payload;
  }

  return {
    async getPayload() {
      const at = now();
      if (payload && !payload.stale && at - refreshedAt < POSITIONS_TTL_MS)
        return payload;
      if (!inFlight) {
        if (at - attemptedAt < RETRY_AFTER_MS && payload) return payload;
        if (at - attemptedAt < RETRY_AFTER_MS && attemptedAt > refreshedAt)
          throw new GovernmentAircraftUnavailableError('retry-later');
        inFlight = refresh().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
  };
}
