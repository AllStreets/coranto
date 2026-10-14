import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { resolveAllowedHosts } from '../../build/allowedHosts.js';
import { publicOrigins } from '../../src/localRequestGate.mjs';
import { createBrowserViteConfig } from '../../build/vite.js';
import { corantoThemePlugin } from '../../build/corantoTheme.js';
import { localProviderPlugins } from '../providers/local.js';
import { localMcpPlugin } from '../mcp/plugin.js';
import { apiNotFoundPlugin } from './api-not-found.js';
import { standaloneVoiceTools } from './voiceTools.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

/** Load this checkout's configuration and attach its local provider middleware. */
export default defineConfig(({ command, mode }) => {
  const loaded = loadEnv(mode, root, '');
  for (const [key, value] of Object.entries(loaded)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return createBrowserViteConfig({
    plugins: [
      ...localProviderPlugins({ realtime: { tools: standaloneVoiceTools() } }),
      localMcpPlugin(),
      apiNotFoundPlugin(),
      corantoThemePlugin(),
    ],
    googleApiKey: process.env.GOOGLE_MAPS_API_KEY,
    cesiumToken: process.env.CESIUM_ION_TOKEN,
    mapillaryToken: process.env.MAPILLARY_CLIENT_TOKEN,
    host: process.env.HOST,
    port: process.env.PORT,
    // A public site answers on its own names, and on the name its host's
    // health check calls it by.
    allowedHosts: resolveAllowedHosts(
      [
        process.env.GEV_ALLOWED_HOSTS ?? '',
        ...publicOrigins(process.env).map((origin) => new URL(origin).host),
        ...(process.env.RAILWAY_ENVIRONMENT_NAME ||
        process.env.RAILWAY_ENVIRONMENT ||
        process.env.RAILWAY_PUBLIC_DOMAIN
          ? ['healthcheck.railway.app']
          : []),
      ].join(','),
    ),
    command,
  });
});
