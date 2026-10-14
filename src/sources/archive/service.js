/**
 * Coranto's archive: headlines kept past the week the feed holds, in a
 * Postgres database (Supabase) reached over its REST interface. Only the
 * server talks to it, with the secret key; the browser never does.
 *
 * Without `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` the archive is
 * simply off: nothing is stored, searches return nothing, and the app says
 * the archive is not connected. Nothing stands in for it.
 */
export const ARCHIVE_DAYS = 90;
const BATCH = 400;
const COLUMNS =
  'id,title,summary,publisher,url,published_at,category,lang,place_name,place_lat,place_lon,place_precision';

/** A feed article as an archive row, or null if it lacks what a row needs. */
export function toRow(article) {
  const published = Date.parse(article?.publishedAt ?? '');
  if (
    !article?.id ||
    !article.title ||
    !article.publisher ||
    !/^https?:\/\//.test(article.url ?? '') ||
    !Number.isFinite(published)
  )
    return null;
  return {
    id: String(article.id),
    title: String(article.title).slice(0, 500),
    summary: String(article.summary ?? '').slice(0, 2000),
    publisher: String(article.publisher).slice(0, 200),
    url: String(article.url).slice(0, 2000),
    published_at: new Date(published).toISOString(),
    category: String(article.category ?? ''),
    lang: String(article.lang ?? ''),
    place_name: String(article.place?.name ?? ''),
    place_lat: Number.isFinite(article.place?.lat) ? article.place.lat : null,
    place_lon: Number.isFinite(article.place?.lon) ? article.place.lon : null,
    place_precision: String(article.place?.precision ?? ''),
  };
}

/** An archive row in the shape the feed's articles have. */
export function fromRow(row) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary ?? '',
    publisher: row.publisher,
    url: row.url,
    publishedAt: row.published_at,
    category: row.category ?? '',
    lang: row.lang ?? '',
    place: row.place_name
      ? {
          name: row.place_name,
          lat: row.place_lat,
          lon: row.place_lon,
          precision: row.place_precision,
        }
      : null,
    archived: true,
  };
}

/** Words safe to hand to the database's text search: letters and digits. */
export function searchTerms(query) {
  return String(query ?? '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 1)
    .slice(0, 8);
}

/**
 * @param {object} [options]
 * @param {string} [options.url]
 * @param {string} [options.key] the secret (service role) key
 * @param {typeof fetch} [options.fetchImpl]
 * @param {() => number} [options.now]
 */
export function createArchive({
  url = '',
  key = '',
  fetchImpl = fetch,
  now = () => Date.now(),
  timeoutMs = 12_000,
} = {}) {
  const base = String(url).replace(/\/+$/, '');
  const configured = /^https:\/\/[\w.-]+$/.test(base) && key.length > 20;
  const stored = new Set();
  let lastPrune = 0;
  let lastError = '';
  let lastStoredAt = null;

  async function call(path, init = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${base}/rest/v1/${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw new Error(`archive_http_${response.status}`);
      }
      return response.status === 204 ? null : await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    configured,
    /** What Settings shows: connected or not, and the last write. */
    status: () => ({ configured, lastStoredAt, lastError }),

    /** Keep what the feed holds. Rows already kept this run are skipped. */
    async store(articles) {
      if (!configured) return 0;
      // One row per id: the database refuses a batch that names a row twice.
      const byId = new Map();
      for (const article of articles ?? []) {
        if (stored.has(article?.id)) continue;
        const row = toRow(article);
        if (row) byId.set(row.id, row);
      }
      const rows = [...byId.values()];
      let kept = 0;
      lastError = '';
      // A batch that fails is tried again next time; the rest still go.
      for (let at = 0; at < rows.length; at += BATCH) {
        const batch = rows.slice(at, at + BATCH);
        try {
          await call('articles?on_conflict=id', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(batch),
          });
          for (const row of batch) stored.add(row.id);
          kept += batch.length;
        } catch (error) {
          lastError = String(error?.message ?? 'archive_failed');
        }
      }
      try {
        if (kept) lastStoredAt = new Date(now()).toISOString();
        // Once a day, let go of what is older than the archive keeps.
        if (now() - lastPrune > 24 * 3_600_000) {
          lastPrune = now();
          await call('rpc/coranto_prune', { method: 'POST', body: '{}' });
        }
      } catch (error) {
        lastError = String(error?.message ?? 'archive_failed');
      }
      // The memory of what was sent is bounded.
      if (stored.size > 60_000) stored.clear();
      return kept;
    },

    /** Headlines matching every word, newest first, within `days`. */
    async search({
      query = '',
      category = '',
      days = ARCHIVE_DAYS,
      limit = 20,
    }) {
      if (!configured) return [];
      const terms = searchTerms(query);
      if (!terms.length && !category) return [];
      const since = new Date(
        now() - Math.min(ARCHIVE_DAYS, Math.max(1, days)) * 86_400_000,
      ).toISOString();
      const parts = [
        `select=${COLUMNS}`,
        `published_at=gte.${encodeURIComponent(since)}`,
        'order=published_at.desc',
        `limit=${Math.min(50, Math.max(1, limit))}`,
      ];
      if (terms.length)
        parts.push(`fts=plfts(simple).${encodeURIComponent(terms.join(' '))}`);
      if (/^[a-z]{2,20}$/.test(category)) parts.push(`category=eq.${category}`);
      return (await call(`articles?${parts.join('&')}`)).map(fromRow);
    },

    /** Headlines in these topics from before the feed's own week. */
    async related({
      categories = [],
      olderThanDays = 7,
      days = 30,
      limit = 8,
    }) {
      if (!configured) return [];
      const topics = categories.filter((c) => /^[a-z]{2,20}$/.test(c));
      if (!topics.length) return [];
      const from = new Date(now() - days * 86_400_000).toISOString();
      const to = new Date(now() - olderThanDays * 86_400_000).toISOString();
      return (
        await call(
          `articles?select=${COLUMNS}&category=in.(${topics.join(',')})` +
            `&published_at=gte.${encodeURIComponent(from)}&published_at=lt.${encodeURIComponent(to)}` +
            `&order=published_at.desc&limit=${Math.min(20, limit)}`,
        )
      ).map(fromRow);
    },

    /** Add to a visitor's model-token count for today; returns the total. */
    async usageAdd(visitor, tokens) {
      if (!configured) return 0;
      const total = await call('rpc/ai_usage_add', {
        method: 'POST',
        body: JSON.stringify({
          p_visitor: String(visitor).slice(0, 64),
          p_tokens: Math.max(0, Math.round(Number(tokens) || 0)),
        }),
      });
      return Number(total) || 0;
    },
  };
}
