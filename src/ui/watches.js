/**
 * Watches: searches a reader saves so the feed can be cut down to what they
 * follow, and a briefing built from them. A watch is only a filter. It
 * selects publisher headlines; it never rewrites or ranks them. Watches live
 * in this browser's storage and nowhere else.
 */

export const WATCH_STORAGE_KEY = 'coranto.watches.v1';
export const WATCH_LIMIT = 20;
export const BRIEFING_STORIES_PER_WATCH = 6;

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/** The parts of the current view that a watch remembers. */
export function normalizeCriteria(criteria) {
  return {
    query: text(criteria?.query)
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .join(' '),
    category: text(criteria?.category) || null,
    publisher: text(criteria?.publisher) || null,
    placeKey: text(criteria?.placeKey) || null,
    language:
      criteria?.language === null ? null : text(criteria?.language) || 'en',
    goodNews: criteria?.goodNews === true,
  };
}

/** True when the criteria narrow the feed at all. */
export function hasCriteria(criteria) {
  const c = normalizeCriteria(criteria);
  return Boolean(
    c.query || c.category || c.publisher || c.placeKey || c.goodNews,
  );
}

/** A short name from what the watch filters on. */
export function describeCriteria(criteria) {
  const c = normalizeCriteria(criteria);
  const parts = [];
  if (c.query) parts.push(`“${c.query}”`);
  if (c.placeKey) parts.push(c.placeKey.split(':').slice(1).join(':'));
  if (c.goodNews) parts.push('good news');
  if (c.category) parts.push(c.category);
  if (c.publisher) parts.push(c.publisher);
  return parts.join(' · ') || 'All coverage';
}

/** Does one article satisfy a watch's criteria? */
export function articleMatches(article, criteria) {
  const c = normalizeCriteria(criteria);
  if (c.language && (article.lang ?? 'en') !== c.language) return false;
  if (c.goodNews && !article.progress) return false;
  if (c.category && article.category !== c.category) return false;
  if (c.publisher && article.publisher !== c.publisher) return false;
  if (c.placeKey) {
    const key = article.place
      ? `${article.place.precision}:${article.place.name}`
      : null;
    if (key !== c.placeKey) return false;
  }
  if (c.query) {
    const haystack =
      `${article.title} ${article.summary ?? ''} ${article.publisher} ${article.place?.name ?? ''}`.toLowerCase();
    for (const term of c.query.split(' '))
      if (!haystack.includes(term)) return false;
  }
  return true;
}

function sameCriteria(a, b) {
  return (
    JSON.stringify(normalizeCriteria(a)) ===
    JSON.stringify(normalizeCriteria(b))
  );
}

function validWatch(value) {
  if (!value || typeof value !== 'object') return null;
  const id = text(value.id);
  if (!id) return null;
  const criteria = normalizeCriteria(value.criteria);
  return {
    id,
    name: text(value.name).slice(0, 60) || describeCriteria(criteria),
    criteria,
    createdAt: Number.isFinite(value.createdAt) ? value.createdAt : 0,
    seenAt: Number.isFinite(value.seenAt) ? value.seenAt : 0,
  };
}

/**
 * @param {{storage?: Storage|null, now?: () => number}} [options]
 */
export function createWatchStore({
  storage = null,
  now = () => Date.now(),
} = {}) {
  let watches = [];
  try {
    const parsed = JSON.parse(storage?.getItem(WATCH_STORAGE_KEY) ?? '[]');
    if (Array.isArray(parsed))
      watches = parsed.map(validWatch).filter(Boolean).slice(0, WATCH_LIMIT);
  } catch {
    watches = [];
  }
  const save = () => {
    try {
      storage?.setItem(WATCH_STORAGE_KEY, JSON.stringify(watches));
    } catch {
      /* storage unavailable: watches last for this page only */
    }
  };
  return {
    list: () => watches.map((watch) => ({ ...watch })),
    /** Save criteria as a watch. Returns it, or null if empty, duplicate or full. */
    add(criteria, name = '') {
      if (!hasCriteria(criteria) || watches.length >= WATCH_LIMIT) return null;
      if (watches.some((watch) => sameCriteria(watch.criteria, criteria)))
        return null;
      const at = now();
      const watch = validWatch({
        id: `w${at.toString(36)}${watches.length}`,
        name,
        criteria,
        createdAt: at,
        // Everything already published counts as seen when a watch is made.
        seenAt: at,
      });
      watches = [...watches, watch];
      save();
      return { ...watch };
    },
    remove(id) {
      watches = watches.filter((watch) => watch.id !== id);
      save();
    },
    /** Record that the reader has looked, so later stories count as new. */
    markSeen(ids = null) {
      const at = now();
      watches = watches.map((watch) =>
        !ids || ids.includes(watch.id) ? { ...watch, seenAt: at } : watch,
      );
      save();
    },
  };
}

/**
 * One watch's stories from a snapshot, newest first.
 * @returns {{stories: object[], total: number, fresh: number}}
 */
export function watchStories(snapshot, watch, limit = Infinity) {
  const articles = (snapshot?.articles ?? []).filter((article) =>
    articleMatches(article, watch.criteria),
  );
  const byId = new Map(articles.map((article) => [article.id, article]));
  const stories = [];
  const groups =
    snapshot?.stories ??
    articles.map((article) => ({
      id: `s-${article.id}`,
      articleIds: [article.id],
    }));
  for (const story of groups) {
    const members = story.articleIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
    if (!members.length) continue;
    const [lead] = members;
    const newest = Date.parse(lead.publishedAt);
    stories.push({
      id: story.id,
      title: lead.title,
      publisher: lead.publisher,
      url: lead.url,
      publishedAt: lead.publishedAt,
      newest,
      outlets: new Set(members.map((article) => article.publisher)).size,
      headlines: members.length,
      fresh: newest > watch.seenAt,
      differing:
        members.length === story.articleIds.length
          ? (story.differing ?? [])
          : [],
    });
  }
  stories.sort((a, b) => b.newest - a.newest);
  return {
    stories: stories.slice(0, limit),
    total: stories.length,
    fresh: stories.filter((story) => story.fresh).length,
  };
}

/** The briefing: every watch with its current stories. */
export function buildBriefing(snapshot, watches) {
  return watches.map((watch) => ({
    watch,
    ...watchStories(snapshot, watch, BRIEFING_STORIES_PER_WATCH),
  }));
}
