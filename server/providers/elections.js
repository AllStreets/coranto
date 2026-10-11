import {
  ElectionsUnavailableError,
  createElectionService,
} from '../../src/sources/elections/service.js';

/**
 * `/api/elections`: elections dated in the next 120 days as Wikidata records
 * them, grouped by country and day, each contest linked to its Wikidata item.
 * With Wikidata unreachable and nothing cached it returns 503 and no entries.
 */
export function electionsProxy(options = {}) {
  const service = createElectionService(options);
  async function handler(req, res) {
    const json = (status, value) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(value));
    };
    if (req.method !== 'GET') return json(405, { error: 'method_not_allowed' });
    if (req.url !== '/' && req.url !== '')
      return json(400, { error: 'invalid_elections_query' });
    try {
      json(200, await service.getPayload());
    } catch (error) {
      if (error instanceof ElectionsUnavailableError)
        return json(503, { error: 'elections_unavailable' });
      console.warn('[elections] refresh failed');
      json(502, { error: 'elections_failed' });
    }
  }
  return {
    name: 'elections',
    configureServer({ middlewares }) {
      middlewares.use('/api/elections', handler);
    },
    configurePreviewServer({ middlewares }) {
      middlewares.use('/api/elections', handler);
    },
  };
}
