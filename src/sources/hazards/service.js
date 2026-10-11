import { readResponseTextCapped } from '../httpBody.js';
import { mergeHazards, parseEonet, parseGdacs } from './records.js';

export const HAZARD_CACHE_TTL_MS = 15 * 60 * 1000;
export const HAZARD_RETRY_AFTER_MS = 60 * 1000;
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const USER_AGENT =
  'Coranto/0.1 (+https://github.com/AllStreets/coranto; hazard reader)';

export const HAZARD_SOURCES = Object.freeze([
  {
    id: 'gdacs',
    name: 'GDACS',
    url: 'https://www.gdacs.org/xml/rss.xml',
    homepage: 'https://www.gdacs.org',
    parse: (text) => parseGdacs(text),
  },
  {
    id: 'eonet',
    name: 'NASA EONET',
    url: 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&limit=300',
    homepage: 'https://eonet.gsfc.nasa.gov',
    parse: (text) => parseEonet(JSON.parse(text)),
  },
]);

/** Thrown when no tracker answers and nothing is cached. */
export class HazardsUnavailableError extends Error {
  constructor(sources) {
    super('hazards_unavailable');
    this.name = 'HazardsUnavailableError';
    this.sources = sources;
  }
}

/**
 * Reads each hazard tracker and reports which answered. A tracker that fails
 * keeps its earlier events; with none reachable and nothing cached there are
 * no events at all.
 */
export function createHazardService({
  fetchImpl = fetch,
  now = () => Date.now(),
  timeoutMs = 12_000,
  sources = HAZARD_SOURCES,
} = {}) {
  const state = new Map(
    sources.map((source) => [
      source.id,
      { events: [], fetchedAt: null, ok: false, reason: null },
    ]),
  );
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
          headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
          redirect: 'follow',
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
      let text;
      try {
        text = await readResponseTextCapped(
          response,
          MAX_BODY_BYTES,
          controller.signal,
        );
      } catch {
        throw new Error(controller.signal.aborted ? 'timeout' : 'http-error');
      }
      let events;
      try {
        events = source.parse(text);
      } catch {
        throw new Error('parse-error');
      }
      if (!events.length) throw new Error('empty');
      return events;
    } finally {
      clearTimeout(timer);
    }
  }

  function assemble(fetchedAt, stale) {
    const merged = mergeHazards(
      sources.map((source) => state.get(source.id).events),
      now(),
    );
    return {
      schemaVersion: 1,
      fetchedAt: new Date(fetchedAt).toISOString(),
      stale,
      events: merged.events,
      wildfiresLeftOut: merged.wildfiresLeftOut,
      sources: sources.map((source) => {
        const entry = state.get(source.id);
        return {
          id: source.id,
          name: source.name,
          homepage: source.homepage,
          ok: entry.ok,
          count: merged.events.filter((item) => item.source === source.name)
            .length,
          lastSuccessAt:
            entry.fetchedAt === null
              ? null
              : new Date(entry.fetchedAt).toISOString(),
          reason: entry.ok ? null : entry.reason,
        };
      }),
    };
  }

  async function refresh() {
    attemptedAt = now();
    const results = await Promise.all(
      sources.map((source) =>
        read(source).then(
          (events) => ({ source, events }),
          (error) => ({ source, reason: error.message }),
        ),
      ),
    );
    const at = now();
    let anyOk = false;
    for (const { source, events, reason } of results) {
      const entry = state.get(source.id);
      if (events) {
        anyOk = true;
        Object.assign(entry, { events, fetchedAt: at, ok: true, reason: null });
      } else Object.assign(entry, { ok: false, reason });
    }
    if (anyOk) {
      payload = assemble(at, false);
      refreshedAt = at;
      return payload;
    }
    if (payload) {
      payload = assemble(Date.parse(payload.fetchedAt), true);
      if (payload.events.length) return payload;
      payload = null;
    }
    throw new HazardsUnavailableError(assemble(at, true).sources);
  }

  return {
    async getPayload() {
      const at = now();
      if (payload && !payload.stale && at - refreshedAt < HAZARD_CACHE_TTL_MS)
        return payload;
      if (!inFlight) {
        if (at - attemptedAt < HAZARD_RETRY_AFTER_MS) {
          if (payload) return payload;
          throw new HazardsUnavailableError(assemble(at, true).sources);
        }
        inFlight = refresh().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
  };
}
