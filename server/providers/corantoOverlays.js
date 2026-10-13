import {
  OutbreaksUnavailableError,
  createOutbreaksService,
} from '../../src/sources/outbreaks/service.js';
import {
  SilenceUnavailableError,
  createSilenceService,
} from '../../src/sources/silence/service.js';

/**
 * Two read-only routes behind Coranto's SILENCE and DISEASE layers.
 *
 * `/api/silence`: places where IODA measures the internet far below its
 * normal level right now. `/api/outbreaks`: the US CDC's travel health
 * notices. With a source unreachable and nothing cached, its route returns
 * 503 and no places; nothing stands in for it.
 */
export function corantoOverlaysProxy({ silence = {}, outbreaks = {} } = {}) {
  const route = (service, Unavailable, name) =>
    async function handler(req, res) {
      const json = (status, value) => {
        res.writeHead(status, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        res.end(JSON.stringify(value));
      };
      if (req.method !== 'GET')
        return json(405, { error: 'method_not_allowed' });
      if (req.url !== '/' && req.url !== '')
        return json(400, { error: `invalid_${name}_query` });
      try {
        json(200, await service.getPayload());
      } catch (error) {
        if (error instanceof Unavailable)
          return json(503, { error: `${name}_unavailable` });
        console.warn(`[${name}] refresh failed`);
        json(502, { error: `${name}_failed` });
      }
    };
  const silenceRoute = route(
    createSilenceService(silence),
    SilenceUnavailableError,
    'silence',
  );
  const outbreaksRoute = route(
    createOutbreaksService(outbreaks),
    OutbreaksUnavailableError,
    'outbreaks',
  );
  const mount = ({ middlewares }) => {
    middlewares.use('/api/silence', silenceRoute);
    middlewares.use('/api/outbreaks', outbreaksRoute);
  };
  return {
    name: 'coranto-overlays',
    configureServer: mount,
    configurePreviewServer: mount,
  };
}
