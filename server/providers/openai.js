import { defaultSourceRoot } from './common/source-root.js';
import { handleHudSummary } from './openai/hud-summary.js';
import { createDebugLogHandler } from './openai/debug-log.js';
import {
  createRealtimeOAuthLoginHandler,
  createRealtimeOAuthStatusHandler,
  createRealtimeTokenHandler,
} from './openai/realtime.js';
import { sameSiteGated } from './common/same-site.js';
import { isPublicSite } from '../../src/localRequestGate.mjs';
import { keylessHudSummaryResponse } from '../../src/hudSummaryResponse.js';
import { createCodexOAuthLogin } from './openai/codex-auth.js';

/**
 * Vite plugin: OpenAI Realtime ephemeral client secret.
 *
 * Keeps the selected cloud credential server-side while the browser connects
 * to the Realtime API over WebRTC with a short-lived secret.
 */
function openAiRealtimeProxy({
  sourceRoot = defaultSourceRoot,
  annotationGuidance,
  realtime = {},
} = {}) {
  const oauthLogin = createCodexOAuthLogin(realtime);
  /** Answer for a route a public site does not offer. */
  function notOffered(_req, res) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: 'Not offered on the public site' }));
  }
  function install(middlewares) {
    // A public site (see `publicOrigins`) has no voice: a Realtime session
    // bills by the minute to the site's key and no daily allowance can count
    // it. The HUD summary and the voice debug log go with it. Nothing below
    // is installed there.
    if (isPublicSite(process.env)) {
      // The HUD asks for a summary on every tick. Answer with the same
      // "not configured" shape a keyless boot gets, so the HUD settles on its
      // plain fallback line instead of logging a failure and retrying.
      middlewares.use('/api/openai/hud-summary', (_req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(keylessHudSummaryResponse('').payload));
      });
      // Voice diagnostics are posted by the client; with no voice here there
      // is nothing to keep, so accept and discard rather than 404.
      middlewares.use('/api/realtime/debug-log', (_req, res) => {
        res.statusCode = 204;
        res.setHeader('Cache-Control', 'no-store');
        res.end();
      });
      middlewares.use('/api/realtime', notOffered);
      return;
    }
    // Cost-bearing and log endpoints refuse cross-site browser requests
    // (see server/providers/common/same-site.js and SECURITY.md).
    middlewares.use('/api/openai/hud-summary', sameSiteGated(handleHudSummary));

    middlewares.use(
      '/api/realtime/debug-log',
      sameSiteGated(createDebugLogHandler({ sourceRoot })),
    );

    middlewares.use(
      '/api/realtime/token',
      sameSiteGated(
        createRealtimeTokenHandler({ ...realtime, annotationGuidance }),
      ),
    );

    middlewares.use(
      '/api/realtime/oauth-status',
      sameSiteGated(createRealtimeOAuthStatusHandler({ oauthLogin })),
    );

    middlewares.use(
      '/api/realtime/oauth-login',
      sameSiteGated(createRealtimeOAuthLoginHandler({ oauthLogin })),
    );
  }

  return {
    name: 'openai-realtime-proxy',
    configureServer(server) {
      install(server.middlewares);
      server.httpServer?.once('close', oauthLogin.dispose);
    },
    configurePreviewServer(server) {
      install(server.middlewares);
      server.httpServer?.once('close', oauthLogin.dispose);
    },
    closeBundle: oauthLogin.dispose,
  };
}

export { openAiRealtimeProxy };
