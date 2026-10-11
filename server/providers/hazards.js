import {
  HazardsUnavailableError,
  createHazardService,
} from '../../src/sources/hazards/service.js';

/**
 * `/api/hazards`: natural-hazard events from GDACS and NASA EONET, each with
 * its tracker's link and start time, plus a report of which tracker answered.
 * With neither reachable and nothing cached it returns 503 and no events.
 */
export function hazardsProxy(options = {}) {
  const service = createHazardService(options);
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
      return json(400, { error: 'invalid_hazards_query' });
    try {
      json(200, await service.getPayload());
    } catch (error) {
      if (error instanceof HazardsUnavailableError)
        return json(503, {
          error: 'hazards_unavailable',
          sources: error.sources,
        });
      console.warn('[hazards] refresh failed');
      json(502, { error: 'hazards_failed' });
    }
  }
  return {
    name: 'hazards',
    configureServer({ middlewares }) {
      middlewares.use('/api/hazards', handler);
    },
    configurePreviewServer({ middlewares }) {
      middlewares.use('/api/hazards', handler);
    },
  };
}
