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

function normalizeCoverage(coverage) {
  if (!Array.isArray(coverage)) return [];
  return coverage
    .filter(
      (row) => typeof row?.region === 'string' && Number.isFinite(row.outlets),
    )
    .map((row) => ({
      region: row.region,
      outlets: row.outlets,
      listening: row.listening === true,
    }));
}

function normalizeDiffering(differing) {
  if (!Array.isArray(differing)) return [];
  const out = [];
  for (const row of differing) {
    if (typeof row?.what !== 'string' || !Array.isArray(row.values)) continue;
    const values = row.values
      .filter(
        (entry) =>
          Number.isFinite(entry?.value) && Array.isArray(entry.publishers),
      )
      .map((entry) => ({
        value: entry.value,
        publishers: entry.publishers.filter((p) => typeof p === 'string'),
      }));
    if (values.length >= 2) out.push({ what: row.what, values });
  }
  return out;
}

/**
 * Story groups from the server, limited to articles that passed validation.
 * When the server sent none, every article is its own story.
 */
function normalizeStories(stories, articles) {
  const known = new Map(articles.map((article) => [article.id, article]));
  const used = new Set();
  const out = [];
  for (const story of Array.isArray(stories) ? stories : []) {
    if (typeof story?.id !== 'string' || !Array.isArray(story.articleIds))
      continue;
    const ids = story.articleIds.filter((id) => known.has(id) && !used.has(id));
    if (!ids.length) continue;
    for (const id of ids) used.add(id);
    out.push({
      id: story.id,
      articleIds: ids,
      outlets: new Set(ids.map((id) => known.get(id).publisher)).size,
      coverage: normalizeCoverage(story.coverage),
      differing: normalizeDiffering(story.differing),
    });
  }
  for (const article of articles)
    if (!used.has(article.id))
      out.push({ id: `s-${article.id}`, articleIds: [article.id], outlets: 1 });
  return out;
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
  const articles = payload.articles.filter(isShowableArticle);
  return {
    fetchedAt: new Date(Date.parse(payload.fetchedAt)).toISOString(),
    stale: payload.stale === true,
    articles,
    stories: normalizeStories(payload.stories, articles),
    sources,
    dropped,
  };
}
