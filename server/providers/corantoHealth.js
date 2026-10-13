import { readFileSync } from 'node:fs';

/**
 * `/api/coranto/health`: whether the server is up, its version, and which
 * optional keys it has been given. It says only whether each key is set. It
 * never returns a key, part of a key, or its length.
 */
const KEYS = Object.freeze({
  openai: ['OPENAI_API_KEY'],
  newsapi: ['NEWS_API_KEY'],
  fec: ['FEC_API_KEY'],
  aisstream: ['AISSTREAM_API_KEY'],
  opensky: ['OPENSKY_CLIENT_ID', 'OPENSKY_CLIENT_SECRET'],
  mapillary: ['MAPILLARY_CLIENT_TOKEN'],
  tomtom: ['TOMTOM_API_KEY'],
  googleMaps: ['GOOGLE_MAPS_API_KEY'],
  cesiumIon: ['CESIUM_ION_TOKEN'],
});

let version = '';
try {
  version = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  ).version;
} catch {
  version = '';
}

export function corantoHealthProxy({
  env = process.env,
  now = () => Date.now(),
} = {}) {
  function handler(req, res) {
    const json = (status, value) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(value));
    };
    if (req.method !== 'GET') return json(405, { error: 'method_not_allowed' });
    json(200, {
      status: 'ok',
      version,
      checkedAt: new Date(now()).toISOString(),
      keys: Object.fromEntries(
        Object.entries(KEYS).map(([name, vars]) => [
          name,
          vars.every((variable) => Boolean(String(env[variable] ?? '').trim())),
        ]),
      ),
    });
  }
  return {
    name: 'coranto-health',
    configureServer({ middlewares }) {
      middlewares.use('/api/coranto/health', handler);
    },
    configurePreviewServer({ middlewares }) {
      middlewares.use('/api/coranto/health', handler);
    },
  };
}
