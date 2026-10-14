import { createArchive } from '../../src/sources/archive/service.js';
import { sameSiteGated } from './common/same-site.js';

let shared = null;
/** The one archive the server's routes share, from the environment. */
export function sharedArchive(env = process.env) {
  shared ??= createArchive({
    url: env.SUPABASE_URL ?? '',
    key: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  });
  return shared;
}

/**
 * `/api/archive`: search the headlines kept past the feed's week.
 *
 *   ?q=words&cat=topic&days=90      matching headlines, newest first
 *   ?related=topic,topic            headlines 7 to 30 days old in those topics
 *
 * With no database connected it answers `{ connected: false, articles: [] }`.
 */
export function archiveProxy({ archive = null, gate = true } = {}) {
  async function handler(req, res) {
    const json = (status, value) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(value));
    };
    if (req.method !== 'GET') return json(405, { error: 'method_not_allowed' });
    const store = archive ?? sharedArchive();
    if (!store.configured) return json(200, { connected: false, articles: [] });
    const params = new URL(req.url ?? '/', 'http://localhost').searchParams;
    try {
      const related = params.get('related');
      const articles = related
        ? await store.related({ categories: related.split(',').slice(0, 6) })
        : await store.search({
            query: (params.get('q') ?? '').slice(0, 120),
            category: params.get('cat') ?? '',
            days: Number(params.get('days')) || 90,
            limit: 20,
          });
      json(200, { connected: true, articles });
    } catch {
      console.warn('[archive] query failed');
      json(502, { error: 'archive_failed' });
    }
  }
  const route = gate ? sameSiteGated(handler) : handler;
  return {
    name: 'coranto-archive',
    configureServer({ middlewares }) {
      middlewares.use('/api/archive', route);
    },
    configurePreviewServer({ middlewares }) {
      middlewares.use('/api/archive', route);
    },
  };
}
