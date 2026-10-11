import { readResponseTextCapped } from '../httpBody.js';
import {
  FEC_OFFICES,
  FEC_ROWS_PER_OFFICE,
  fecCycle,
  parseFecTotals,
} from './records.js';

// Candidates file quarterly, so the totals move rarely.
export const FEC_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
export const FEC_RETRY_AFTER_MS = 5 * 60 * 1000;
const USER_AGENT =
  'Coranto/0.1 (+https://github.com/AllStreets/coranto; campaign finance)';

/** Thrown when the FEC does not answer and nothing is saved. */
export class CampaignFinanceUnavailableError extends Error {
  constructor(reason) {
    super('campaign_finance_unavailable');
    this.name = 'CampaignFinanceUnavailableError';
    this.reason = reason;
  }
}

/**
 * Reads the biggest fundraisers for each office in the current cycle.
 *
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {() => number} [options.now]
 * @param {number} [options.timeoutMs]
 * @param {string} [options.apiKey] An api.data.gov key. Without one the
 * FEC's shared `DEMO_KEY` is used, which allows only a few requests an hour.
 * @param {object|null} [options.initialState] From `exportState()`.
 */
export function createCampaignFinanceService({
  fetchImpl = fetch,
  now = () => Date.now(),
  timeoutMs = 15_000,
  apiKey = '',
  initialState = null,
} = {}) {
  let payload = null;
  let refreshedAt = -Infinity;
  let attemptedAt = -Infinity;
  let inFlight = null;

  if (
    initialState?.version === 1 &&
    Number.isFinite(Date.parse(initialState.payload?.fetchedAt)) &&
    Array.isArray(initialState.payload?.offices)
  ) {
    // A saved read keeps its real fetch time and is reused until it is old.
    payload = { ...initialState.payload, stale: false };
    refreshedAt = Date.parse(payload.fetchedAt);
  }

  async function read(office, cycle) {
    const url =
      'https://api.open.fec.gov/v1/candidates/totals/' +
      `?cycle=${cycle}&election_full=true&office=${office}` +
      `&is_active_candidate=true&sort=-receipts&per_page=${FEC_ROWS_PER_OFFICE}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let response;
      try {
        response = await fetchImpl(url, {
          signal: controller.signal,
          // The key travels in a header so it never appears in a URL or log.
          headers: {
            Accept: 'application/json',
            'User-Agent': USER_AGENT,
            'X-Api-Key': apiKey || 'DEMO_KEY',
          },
          redirect: 'error',
        });
      } catch {
        throw new Error(controller.signal.aborted ? 'timeout' : 'http-error');
      }
      if (response.status !== 200) {
        await response.body?.cancel().catch(() => {});
        throw new Error(
          response.status === 429 ? 'rate-limited' : 'http-error',
        );
      }
      let rows;
      try {
        rows = parseFecTotals(
          JSON.parse(
            await readResponseTextCapped(
              response,
              1024 * 1024,
              controller.signal,
            ),
          ),
          office,
        );
      } catch {
        throw new Error(controller.signal.aborted ? 'timeout' : 'parse-error');
      }
      if (!rows.length) throw new Error('empty');
      return rows;
    } finally {
      clearTimeout(timer);
    }
  }

  async function refresh() {
    attemptedAt = now();
    const cycle = fecCycle(attemptedAt);
    const results = await Promise.all(
      FEC_OFFICES.map(([office, name]) =>
        read(office, cycle).then(
          (candidates) => ({ office, name, ok: true, candidates }),
          (error) => ({ office, name, ok: false, reason: error.message }),
        ),
      ),
    );
    if (results.some((result) => result.ok)) {
      const at = now();
      payload = {
        schemaVersion: 1,
        fetchedAt: new Date(at).toISOString(),
        stale: false,
        cycle,
        sharedKey: !apiKey,
        offices: results.map((result) => ({
          office: result.office,
          name: result.name,
          ok: result.ok,
          reason: result.ok ? null : result.reason,
          candidates: result.ok ? result.candidates : [],
        })),
      };
      refreshedAt = at;
      return payload;
    }
    if (payload) {
      payload = { ...payload, stale: true };
      return payload;
    }
    throw new CampaignFinanceUnavailableError(results[0]?.reason ?? null);
  }

  return {
    async getPayload() {
      const at = now();
      if (payload && !payload.stale && at - refreshedAt < FEC_CACHE_TTL_MS)
        return payload;
      if (!inFlight) {
        if (at - attemptedAt < FEC_RETRY_AFTER_MS) {
          if (payload) return payload;
          throw new CampaignFinanceUnavailableError('rate-limited');
        }
        inFlight = refresh().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
    exportState() {
      return { version: 1, payload };
    },
  };
}
