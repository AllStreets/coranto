import {
  ReliefUnavailableError,
  createReliefService,
} from '../../src/sources/relief/service.js';

/**
 * `/api/relief`: official humanitarian figures for the Relief lens: forced
 * displacement by country of origin from UNHCR, and disease outbreak notices
 * from the World Health Organization. With both unreachable and nothing
 * cached it returns 503 and no figures.
 */
export function reliefProxy(options = {}) {
  const service = createReliefService(options);
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
      return json(400, { error: 'invalid_relief_query' });
    try {
      json(200, await service.getPayload());
    } catch (error) {
      if (error instanceof ReliefUnavailableError)
        return json(503, { error: 'relief_unavailable' });
      console.warn('[relief] refresh failed');
      json(502, { error: 'relief_failed' });
    }
  }
  return {
    name: 'relief',
    configureServer({ middlewares }) {
      middlewares.use('/api/relief', handler);
    },
    configurePreviewServer({ middlewares }) {
      middlewares.use('/api/relief', handler);
    },
  };
}
