import { isShowableElectionGroup } from '../../sources/elections/records.js';

/** Read the local elections route and validate it before display. */
export function createElectionSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
  url = '/api/elections',
} = {}) {
  return {
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      const response = await fetchImpl(url, {
        signal,
        headers: { Accept: 'application/json' },
      });
      if (response.status === 503) {
        const error = new Error('The election calendar is not reachable');
        error.unavailable = true;
        throw error;
      }
      if (!response.ok) throw new Error(`Elections HTTP ${response.status}`);
      const payload = await response.json();
      signal?.throwIfAborted();
      if (
        !Array.isArray(payload?.groups) ||
        !Number.isFinite(Date.parse(payload?.fetchedAt))
      )
        throw new Error('Malformed elections response');
      return {
        fetchedAt: payload.fetchedAt,
        stale: payload.stale === true,
        groups: payload.groups.filter(isShowableElectionGroup),
      };
    },
  };
}
