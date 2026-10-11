import { normalizeNewsSnapshot, normalizeNewsSources } from './records.js';

/** No news source answered and the server has nothing saved. */
export class NewsFeedUnavailableError extends Error {
  constructor({ sources = [], retryAfter = 60 } = {}) {
    super('No news source is reachable');
    this.name = 'NewsFeedUnavailableError';
    this.unavailable = true;
    this.sources = sources;
    this.retryAfter = retryAfter;
  }
}

/** Read the local news route and validate it before it can be displayed. */
export function createNewsSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
  url = '/api/news',
} = {}) {
  return {
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      const response = await fetchImpl(url, {
        signal,
        headers: { Accept: 'application/json' },
      });
      if (response.status === 503) {
        const body = await response.json().catch(() => null);
        signal?.throwIfAborted();
        throw new NewsFeedUnavailableError({
          sources: normalizeNewsSources(body?.sources) ?? [],
          retryAfter: Number.isFinite(body?.retryAfter) ? body.retryAfter : 60,
        });
      }
      if (!response.ok) throw new Error(`News HTTP ${response.status}`);
      const payload = await response.json();
      signal?.throwIfAborted();
      const snapshot = normalizeNewsSnapshot(payload);
      if (!snapshot) throw new Error('Malformed news response');
      return snapshot;
    },
  };
}
