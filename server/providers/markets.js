import {
  MarketsUnavailableError,
  createMarketService,
} from '../../src/sources/markets/service.js';

/**
 * `/api/markets`: exchange rates (European Central Bank reference rates) and
 * crypto prices (CoinGecko), each with its source's own timestamp and link.
 * With neither reachable and nothing cached it returns 503 and no figures.
 */
export function marketsProxy(options = {}) {
  const service = createMarketService(options);
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
      return json(400, { error: 'invalid_markets_query' });
    try {
      json(200, await service.getPayload());
    } catch (error) {
      if (error instanceof MarketsUnavailableError)
        return json(503, {
          error: 'markets_unavailable',
          sources: error.sources,
        });
      console.warn('[markets] refresh failed');
      json(502, { error: 'markets_failed' });
    }
  }
  return {
    name: 'markets',
    configureServer({ middlewares }) {
      middlewares.use('/api/markets', handler);
    },
    configurePreviewServer({ middlewares }) {
      middlewares.use('/api/markets', handler);
    },
  };
}
