import {
  GovernmentAircraftUnavailableError,
  createGovernmentAircraftService,
} from '../../src/sources/governmentAircraft/service.js';

/**
 * `/api/government-aircraft`: government, head-of-state and international-body
 * aircraft that are broadcasting a position now. The list of which aircraft
 * these are is the public plane-alert database (ODbL); positions are the
 * aircraft's own ADS-B broadcasts via adsb.lol. With either source
 * unreachable and nothing cached it returns 503 and no aircraft.
 */
export function governmentAircraftProxy(options = {}) {
  const service = createGovernmentAircraftService(options);
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
      return json(400, { error: 'invalid_government_aircraft_query' });
    try {
      json(200, await service.getPayload());
    } catch (error) {
      if (error instanceof GovernmentAircraftUnavailableError)
        return json(503, { error: 'government_aircraft_unavailable' });
      console.warn('[government-aircraft] refresh failed');
      json(502, { error: 'government_aircraft_failed' });
    }
  }
  return {
    name: 'government-aircraft',
    configureServer({ middlewares }) {
      middlewares.use('/api/government-aircraft', handler);
    },
    configurePreviewServer({ middlewares }) {
      middlewares.use('/api/government-aircraft', handler);
    },
  };
}
