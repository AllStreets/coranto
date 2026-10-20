/**
 * Optional capability probes: the app asks, and any answer that isn't a
 * usable body means "not here" (see src/keySetup.js and
 * src/maps/googleTokens.js). Where nothing offers them, answer 204 No Content
 * instead of 404, so a visit to the public site doesn't log errors for
 * features it was never meant to have. Only GET, only these exact paths.
 */
const OPTIONAL_PROBES = new Set(['/api/setup/status', '/api/google/tiles-token']);

/** Finish unmatched API requests before Vite's HTML fallback. Install last. */
export function apiNotFoundPlugin() {
  const install = (server) => {
    server.middlewares.use('/api', (req, res) => {
      const path = String(req.originalUrl || req.url || '').split('?')[0];
      if (req.method === 'GET' && OPTIONAL_PROBES.has(path)) {
        res.writeHead(204, { 'Cache-Control': 'no-store' });
        res.end();
        return;
      }
      res.writeHead(404, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify({ error: 'Unknown API route' }));
    });
  };
  return {
    name: 'api-not-found',
    configureServer: install,
    configurePreviewServer: install,
  };
}
