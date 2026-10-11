import { isShowableArticle } from '../../sources/news/article.js';

const text = (value) => (typeof value === 'string' ? value : '');

function normalizeSource(source) {
  if (!source || typeof source !== 'object') return null;
  const id = text(source.id);
  const name = text(source.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    homepage: text(source.homepage),
    configured: source.configured !== false,
    ok: source.ok === true,
    count: Number.isFinite(source.count) ? source.count : 0,
    lastSuccessAt: text(source.lastSuccessAt) || null,
    reason: text(source.reason) || null,
  };
}

/** Validate the source report that accompanies both success and failure. */
export function normalizeNewsSources(sources) {
  if (!Array.isArray(sources)) return null;
  const out = sources.map(normalizeSource);
  return out.every(Boolean) ? out : null;
}

/**
 * Validate an `/api/news` payload. Returns null when the payload is not what
 * the server documents, so a bad response never replaces a good snapshot.
 * Individual articles that lack a source, link or time are left out.
 */
export function normalizeNewsSnapshot(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (!Array.isArray(payload.articles)) return null;
  if (!Number.isFinite(Date.parse(payload.fetchedAt))) return null;
  const sources = normalizeNewsSources(payload.sources);
  if (!sources) return null;
  const dropped = {};
  for (const [reason, count] of Object.entries(payload.dropped ?? {}))
    if (Number.isFinite(count) && count > 0) dropped[reason] = count;
  return {
    fetchedAt: new Date(Date.parse(payload.fetchedAt)).toISOString(),
    stale: payload.stale === true,
    articles: payload.articles.filter(isShowableArticle),
    sources,
    dropped,
  };
}
