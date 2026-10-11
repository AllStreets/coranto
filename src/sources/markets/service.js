import { readResponseTextCapped } from '../httpBody.js';
import {
  CRYPTO_COINS,
  FX_BASE,
  FX_CURRENCIES,
  parseCrypto,
  parseFx,
} from './records.js';

export const MARKET_CACHE_TTL_MS = 5 * 60 * 1000;
export const MARKET_RETRY_AFTER_MS = 60 * 1000;
const USER_AGENT =
  'Coranto/0.1 (+https://github.com/AllStreets/coranto; market figures)';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Thrown when neither source answers and nothing is cached. */
export class MarketsUnavailableError extends Error {
  constructor(sources) {
    super('markets_unavailable');
    this.name = 'MarketsUnavailableError';
    this.sources = sources;
  }
}

function sourcesFor(now) {
  // Ten days back is enough to hold two working days across a holiday.
  const from = new Date(now - 10 * DAY_MS).toISOString().slice(0, 10);
  return [
    {
      id: 'ecb',
      name: 'ECB reference rates',
      url: `https://api.frankfurter.dev/v1/${from}..?from=${FX_BASE}&to=${FX_CURRENCIES.map(([code]) => code).join(',')}`,
      parse: parseFx,
    },
    {
      id: 'coingecko',
      name: 'CoinGecko',
      url: `https://api.coingecko.com/api/v3/simple/price?ids=${CRYPTO_COINS.map(([id]) => id).join(',')}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`,
      parse: parseCrypto,
    },
  ];
}

/** Reads exchange rates and crypto prices and reports which source answered. */
export function createMarketService({
  fetchImpl = fetch,
  now = () => Date.now(),
  timeoutMs = 10_000,
} = {}) {
  const state = new Map();
  let payload = null;
  let refreshedAt = -Infinity;
  let attemptedAt = -Infinity;
  let inFlight = null;

  async function read(source) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let response;
      try {
        response = await fetchImpl(source.url, {
          signal: controller.signal,
          headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
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
      let quotes;
      try {
        quotes = source.parse(
          JSON.parse(
            await readResponseTextCapped(
              response,
              512 * 1024,
              controller.signal,
            ),
          ),
        );
      } catch {
        throw new Error(controller.signal.aborted ? 'timeout' : 'parse-error');
      }
      if (!quotes.length) throw new Error('empty');
      return quotes;
    } finally {
      clearTimeout(timer);
    }
  }

  function assemble(sources, fetchedAt, stale) {
    return {
      schemaVersion: 1,
      fetchedAt: new Date(fetchedAt).toISOString(),
      stale,
      quotes: sources.flatMap((source) => state.get(source.id)?.quotes ?? []),
      sources: sources.map((source) => {
        const entry = state.get(source.id);
        return {
          id: source.id,
          name: source.name,
          ok: entry?.ok === true,
          reason: entry?.ok ? null : (entry?.reason ?? null),
        };
      }),
    };
  }

  async function refresh() {
    attemptedAt = now();
    const sources = sourcesFor(attemptedAt);
    const results = await Promise.all(
      sources.map((source) =>
        read(source).then(
          (quotes) => ({ source, quotes }),
          (error) => ({ source, reason: error.message }),
        ),
      ),
    );
    let anyOk = false;
    for (const { source, quotes, reason } of results) {
      const entry = state.get(source.id) ?? { quotes: [] };
      if (quotes) {
        anyOk = true;
        state.set(source.id, { quotes, ok: true, reason: null });
      } else state.set(source.id, { ...entry, ok: false, reason });
    }
    const at = now();
    if (anyOk) {
      payload = assemble(sources, at, false);
      refreshedAt = at;
      return payload;
    }
    if (payload) {
      payload = assemble(sources, Date.parse(payload.fetchedAt), true);
      return payload;
    }
    throw new MarketsUnavailableError(assemble(sources, at, true).sources);
  }

  return {
    async getPayload() {
      const at = now();
      if (payload && !payload.stale && at - refreshedAt < MARKET_CACHE_TTL_MS)
        return payload;
      if (!inFlight) {
        if (at - attemptedAt < MARKET_RETRY_AFTER_MS) {
          if (payload) return payload;
          throw new MarketsUnavailableError([]);
        }
        inFlight = refresh().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
  };
}
