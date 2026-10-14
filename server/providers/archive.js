import { createHash } from 'node:crypto';
import { createArchive } from '../../src/sources/archive/service.js';
import { clientKey, makeCostRateLimiter } from './common/rate-limit.js';
import { sameSiteGated } from './common/same-site.js';

/** Model tokens one visitor may use in a UTC day, when a database counts. */
export const AI_DAILY_TOKENS_DEFAULT = 250_000;

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
 * The daily allowance every route that asks a model shares: the analyst
 * board's tools, story briefs and translations. A visitor is a salted hash of
 * their address; the address itself is not kept. With no database connected
 * nothing is counted and every request is allowed (the per-minute limits still
 * apply). If the count cannot be read the request is allowed for the same
 * reason.
 *
 * @param {object} [options]
 * @param {() => {configured: boolean, usageAdd: Function}} [options.usage]
 * @param {() => number} [options.dailyTokens]
 * @param {() => string} [options.salt]
 */
export function createAiBudget({
  usage = () => sharedArchive(),
  dailyTokens = () =>
    Number(process.env.CORANTO_AI_DAILY_TOKENS) || AI_DAILY_TOKENS_DEFAULT,
  salt = () => process.env.CORANTO_VISITOR_SALT || 'coranto',
} = {}) {
  const visitorOf = (req) =>
    createHash('sha256')
      .update(`${clientKey(req)}:${salt()}`)
      .digest('hex')
      .slice(0, 40);
  return {
    /** Whether this visitor has used up today's allowance. */
    async spent(req) {
      const counter = usage();
      if (!counter.configured) return false;
      try {
        return (await counter.usageAdd(visitorOf(req), 0)) >= dailyTokens();
      } catch {
        console.warn('[ai] usage read failed');
        return false;
      }
    },
    /** Count tokens a reply used. Never throws and is not waited for. */
    spend(req, tokens) {
      const counter = usage();
      const amount = Math.max(0, Math.round(Number(tokens) || 0));
      if (!counter.configured || !amount) return;
      Promise.resolve()
        .then(() => counter.usageAdd(visitorOf(req), amount))
        .catch(() => console.warn('[ai] usage write failed'));
    },
  };
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
  const allow = gate ? makeCostRateLimiter(undefined, 60) : null;
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
    if (allow && !allow(clientKey(req)))
      return json(429, { error: 'rate_limited' });
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
