import { readResponseTextCapped } from '../httpBody.js';
import { electionQuery, groupElections, parseElections } from './records.js';

export const ELECTION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const ELECTION_RETRY_AFTER_MS = 5 * 60 * 1000;
const ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT =
  'Coranto/0.1 (+https://github.com/AllStreets/coranto; election calendar)';

/** Thrown when Wikidata does not answer and nothing is cached. */
export class ElectionsUnavailableError extends Error {
  constructor() {
    super('elections_unavailable');
    this.name = 'ElectionsUnavailableError';
  }
}

/** Reads the election calendar from Wikidata, at most once every six hours. */
export function createElectionService({
  fetchImpl = fetch,
  now = () => Date.now(),
  timeoutMs = 40_000,
} = {}) {
  let elections = null;
  let fetchedAt = null;
  let attemptedAt = -Infinity;
  let inFlight = null;

  const payload = (stale) => ({
    schemaVersion: 1,
    source: 'Wikidata',
    fetchedAt: new Date(fetchedAt).toISOString(),
    stale,
    groups: groupElections(elections, now()),
  });

  async function refresh() {
    attemptedAt = now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = `${ENDPOINT}?query=${encodeURIComponent(electionQuery(now()))}`;
      const response = await fetchImpl(url, {
        signal: controller.signal,
        redirect: 'error',
        headers: {
          Accept: 'application/sparql-results+json',
          'User-Agent': USER_AGENT,
        },
      });
      if (response.status !== 200) {
        await response.body?.cancel().catch(() => {});
        throw new Error('http-error');
      }
      const text = await readResponseTextCapped(
        response,
        6 * 1024 * 1024,
        controller.signal,
      );
      const parsed = parseElections(JSON.parse(text));
      if (!parsed.length) throw new Error('empty');
      elections = parsed;
      fetchedAt = now();
      return payload(false);
    } catch {
      if (elections) return payload(true);
      throw new ElectionsUnavailableError();
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async getPayload() {
      const at = now();
      if (elections && at - fetchedAt < ELECTION_CACHE_TTL_MS)
        return payload(false);
      if (!inFlight) {
        if (at - attemptedAt < ELECTION_RETRY_AFTER_MS) {
          if (elections) return payload(true);
          throw new ElectionsUnavailableError();
        }
        inFlight = refresh().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
  };
}
