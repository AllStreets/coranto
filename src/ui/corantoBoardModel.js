/**
 * The analyst board, from AUSPEX: pin stories, countries and cities, see how
 * they connect, and read a brief built from them.
 *
 * Everything on the board is computed from the pinned items and the current
 * headlines by the rules in this file. No model writes any of it, and each
 * rule is simple enough to state on the page. AUSPEX's model-written tools
 * (consensus, adversary playbook, red team) are not here: their output could
 * not be checked against sources.
 */

/** AUSPEX's list of terms that link two items when both mention one. */
export const SHARED_ENTITIES = Object.freeze([
  'US',
  'China',
  'Russia',
  'NATO',
  'EU',
  'Iran',
  'Ukraine',
  'Israel',
  'Taiwan',
  'India',
  'Saudi',
  'Japan',
  'Korea',
  'UK',
  'France',
  'Germany',
  'Turkey',
  'Pakistan',
  'Fed',
  'ECB',
  'OPEC',
  'IMF',
  'UN',
  'WTO',
  'Oil',
  'Dollar',
  'Bitcoin',
  'Gold',
  'Rate',
  'Inflation',
  'AI',
  'Chip',
  'Semiconductor',
  'Nuclear',
  'Climate',
  'Election',
]);

export const BOARD_LIMIT = 40;
export const SAVED_BOARDS_LIMIT = 50;
export const BOARD_KEY = 'coranto.board.v1';
export const SAVED_BOARDS_KEY = 'coranto.boards.v1';

const text = (asset) => `${asset.title ?? ''} ${asset.summary ?? ''}`;

/**
 * Entities an item mentions. Short upper-case names (US, EU, AI) must match
 * as whole words in that case, so "us" and "said" never count; longer ones
 * match as whole words in any case.
 */
export function entitiesOf(asset) {
  const body = text(asset);
  return SHARED_ENTITIES.filter((term) =>
    new RegExp(
      `(?<![\\p{L}\\p{N}])${term}(?:s|'s|’s)?(?![\\p{L}\\p{N}])`,
      term === term.toUpperCase() || term.length <= 3 ? 'u' : 'iu',
    ).test(body),
  );
}

/** Pairs of items that mention the same entity. */
export function boardLinks(assets) {
  const tagged = assets.map((asset) => ({ asset, terms: entitiesOf(asset) }));
  const links = [];
  for (let i = 0; i < tagged.length; i++)
    for (let j = i + 1; j < tagged.length; j++) {
      const shared = tagged[i].terms.filter((term) =>
        tagged[j].terms.includes(term),
      );
      if (shared.length)
        links.push({
          a: tagged[i].asset.key,
          b: tagged[j].asset.key,
          terms: shared,
          sameTopic:
            Boolean(tagged[i].asset.category) &&
            tagged[i].asset.category === tagged[j].asset.category,
        });
    }
  return links;
}

const words = (value, min) =>
  [
    ...new Set(
      String(value ?? '')
        .toLowerCase()
        .match(/[\p{L}\p{N}]+/gu) ?? [],
    ),
  ].filter((word) => word.length >= min);

/**
 * How many other current headlines share at least three long words with an
 * item, and the level AUSPEX gave that count: four or more is high, two or
 * three medium, fewer low. It measures how much is being written about the
 * same thing, not whether the item is true.
 */
export function corroboration(asset, articles) {
  const mine = words(text(asset), 6);
  let count = 0;
  for (const article of articles ?? []) {
    if (article.url && article.url === asset.url) continue;
    const theirs = `${article.title} ${article.summary ?? ''}`.toLowerCase();
    let hits = 0;
    for (const word of mine) if (theirs.includes(word)) hits++;
    if (hits >= 3) count++;
  }
  return { count, level: count >= 4 ? 'high' : count >= 2 ? 'medium' : 'low' };
}

/** The headlines that mention a place or name a pinned item is about. */
export function buildTimeline(assets, articles) {
  const keys = new Set();
  for (const asset of assets)
    for (const word of words(`${asset.title} ${asset.place ?? ''}`, 5))
      keys.add(word);
  const matched = [];
  for (const article of articles ?? []) {
    const body = `${article.title} ${article.summary ?? ''}`.toLowerCase();
    let hits = 0;
    for (const key of keys) if (body.includes(key)) hits++;
    if (hits >= 2) matched.push(article);
  }
  matched.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const days = new Map();
  for (const article of matched.slice(0, 60)) {
    const day = String(article.publishedAt).slice(0, 10);
    if (!days.has(day)) days.set(day, []);
    days.get(day).push({
      title: article.title,
      publisher: article.publisher,
      url: article.url,
      publishedAt: article.publishedAt,
      category: article.category ?? '',
    });
  }
  return [...days.entries()].map(([day, items]) => ({ day, items }));
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The brief built from the pinned items. */
export function buildSynthesis(assets, articles) {
  const stories = assets.filter((asset) => asset.kind === 'story');
  const places = assets.filter((asset) => asset.kind !== 'story');
  const topics = [
    ...new Set(assets.map((asset) => asset.category).filter(Boolean)),
  ];
  const where = [
    ...new Set(
      assets
        .map(
          (asset) => asset.place || (asset.kind !== 'story' ? asset.title : ''),
        )
        .filter(Boolean),
    ),
  ];
  const entities = SHARED_ENTITIES.filter((term) =>
    assets.some((asset) => entitiesOf(asset).includes(term)),
  );
  const links = boardLinks(assets);
  return {
    summary: assets.length
      ? `${plural(assets.length, 'pinned item')}: ${plural(stories.length, 'story', 'stories')} and ${plural(places.length, 'place')}, across ${plural(topics.length, 'topic')} and ${plural(where.length, 'location')}. ${plural(links.length, 'link')} between them.`
      : '',
    entities,
    places: where,
    topics,
    links: links.length,
    items: assets.map((asset) => ({
      asset,
      ...corroboration(asset, articles),
    })),
  };
}

/** A name for a board, from where and what it is about. */
export function boardTitle(assets) {
  const where = [
    ...new Set(
      assets
        .map(
          (asset) => asset.place || (asset.kind !== 'story' ? asset.title : ''),
        )
        .filter(Boolean),
    ),
  ].slice(0, 3);
  if (where.length) return where.join(', ');
  const topics = [
    ...new Set(assets.map((asset) => asset.category).filter(Boolean)),
  ].slice(0, 3);
  return topics.length ? topics.join(', ') : 'Untitled board';
}

/** The board as plain text, for copying out. */
export function boardText(assets, articles, now) {
  const brief = buildSynthesis(assets, articles);
  const lines = [
    `Coranto analyst board · ${new Date(now).toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    brief.summary,
    '',
  ];
  if (brief.entities.length)
    lines.push(`Entities: ${brief.entities.join(', ')}`, '');
  for (const { asset, count, level } of brief.items) {
    lines.push(`- ${asset.title}`);
    lines.push(
      `  ${[asset.kind === 'story' ? asset.publisher : asset.kind, asset.place, `${count} related headlines (${level})`].filter(Boolean).join(' · ')}`,
    );
    if (asset.url) lines.push(`  ${asset.url}`);
  }
  lines.push(
    '',
    'Computed from the pinned items and current headlines. Not written by a model.',
  );
  return lines.join('\n');
}

const clean = (value, max) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

function validAsset(value) {
  if (!value || typeof value !== 'object') return null;
  const key = clean(value.key, 200);
  const title = clean(value.title, 300);
  const kind = ['story', 'country', 'city'].includes(value.kind)
    ? value.kind
    : null;
  if (!key || !title || !kind) return null;
  const url = clean(value.url, 2000);
  return {
    key,
    kind,
    title,
    summary: clean(value.summary, 600),
    publisher: clean(value.publisher, 120),
    url: /^https:\/\//.test(url) ? url : '',
    publishedAt: Number.isFinite(Date.parse(value.publishedAt))
      ? value.publishedAt
      : '',
    category: clean(value.category, 40),
    place: clean(value.place, 120),
    lat: Number.isFinite(value.lat) ? value.lat : null,
    lon: Number.isFinite(value.lon) ? value.lon : null,
    pinnedAt: Number.isFinite(value.pinnedAt) ? value.pinnedAt : 0,
  };
}

/**
 * The board's memory. It is kept in this browser so a reload does not lose
 * it; saved boards are snapshots of it.
 */
export function createBoardStore({
  storage = null,
  now = () => Date.now(),
} = {}) {
  const read = (key) => {
    try {
      const parsed = JSON.parse(storage?.getItem(key) ?? 'null');
      return parsed;
    } catch {
      return null;
    }
  };
  const write = (key, value) => {
    try {
      storage?.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: the board lasts for this page only */
    }
  };
  let assets = (Array.isArray(read(BOARD_KEY)) ? read(BOARD_KEY) : [])
    .map(validAsset)
    .filter(Boolean)
    .slice(0, BOARD_LIMIT);
  let saved = (
    Array.isArray(read(SAVED_BOARDS_KEY)) ? read(SAVED_BOARDS_KEY) : []
  )
    .map((board) =>
      board && typeof board === 'object' && Array.isArray(board.assets)
        ? {
            id: clean(String(board.id ?? ''), 40),
            title: clean(board.title, 120) || 'Untitled board',
            savedAt: Number.isFinite(board.savedAt) ? board.savedAt : 0,
            assets: board.assets.map(validAsset).filter(Boolean),
          }
        : null,
    )
    .filter((board) => board && board.id && board.assets.length)
    .slice(0, SAVED_BOARDS_LIMIT);
  const listeners = new Set();
  const changed = () => {
    write(BOARD_KEY, assets);
    for (const listener of [...listeners]) listener();
  };
  return {
    list: () => assets.map((asset) => ({ ...asset })),
    has: (key) => assets.some((asset) => asset.key === key),
    get full() {
      return assets.length >= BOARD_LIMIT;
    },
    /** Pin or unpin. Returns 'pinned', 'removed', or 'full'. */
    toggle(value) {
      const asset = validAsset({ ...value, pinnedAt: now() });
      if (!asset) return 'invalid';
      if (assets.some((entry) => entry.key === asset.key)) {
        assets = assets.filter((entry) => entry.key !== asset.key);
        changed();
        return 'removed';
      }
      if (assets.length >= BOARD_LIMIT) return 'full';
      assets = [...assets, asset];
      changed();
      return 'pinned';
    },
    remove(key) {
      assets = assets.filter((asset) => asset.key !== key);
      changed();
    },
    clear() {
      assets = [];
      changed();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    saved: () =>
      saved.map((board) => ({ ...board, assets: [...board.assets] })),
    /** Save the board as it is now. Returns it, or null when it is empty. */
    save() {
      if (!assets.length) return null;
      const at = now();
      const board = {
        id: `b${at.toString(36)}`,
        title: boardTitle(assets),
        savedAt: at,
        assets: assets.map((asset) => ({ ...asset })),
      };
      saved = [board, ...saved].slice(0, SAVED_BOARDS_LIMIT);
      write(SAVED_BOARDS_KEY, saved);
      return board;
    },
    load(id) {
      const board = saved.find((entry) => entry.id === id);
      if (!board) return false;
      assets = board.assets
        .map((asset) => ({ ...asset }))
        .slice(0, BOARD_LIMIT);
      changed();
      return true;
    },
    deleteSaved(id) {
      saved = saved.filter((board) => board.id !== id);
      write(SAVED_BOARDS_KEY, saved);
    },
  };
}
