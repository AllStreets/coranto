import { isShowableHazard } from '../../sources/hazards/records.js';

/** Read the local hazards route and validate it before display. */
export function createHazardSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
  url = '/api/hazards',
} = {}) {
  return {
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      const response = await fetchImpl(url, {
        signal,
        headers: { Accept: 'application/json' },
      });
      if (response.status === 503) {
        const error = new Error('No hazard tracker is reachable');
        error.unavailable = true;
        throw error;
      }
      if (!response.ok) throw new Error(`Hazards HTTP ${response.status}`);
      const payload = await response.json();
      signal?.throwIfAborted();
      if (
        !Array.isArray(payload?.events) ||
        !Array.isArray(payload?.sources) ||
        !Number.isFinite(Date.parse(payload?.fetchedAt))
      )
        throw new Error('Malformed hazards response');
      return {
        fetchedAt: payload.fetchedAt,
        stale: payload.stale === true,
        events: payload.events.filter(isShowableHazard),
        sources: payload.sources.map((source) => ({
          name: String(source?.name ?? ''),
          ok: source?.ok === true,
        })),
        wildfiresLeftOut: Number.isFinite(payload.wildfiresLeftOut)
          ? payload.wildfiresLeftOut
          : 0,
      };
    },
  };
}
