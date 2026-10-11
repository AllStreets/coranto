export const NEWS_OVERLAY_SOURCE_ID = 'news';
export const NEWS_OVERLAY_COHORT_LIMIT = 96;
export const NEWS_OVERLAY_COLLISION_CAPACITY = 40;
export const NEWS_ACCENT = '#f2c14e';
/** Good-news lime: a different green from the climate topic's emerald. */
export const NEWS_GOOD_ACCENT = '#a8e05f';

/** Camera height above a place, by how precisely the story was placed. */
export const NEWS_FOCUS_HEIGHT_M = Object.freeze({
  city: 450_000,
  region: 1_400_000,
  country: 3_200_000,
});

export const newsPlaceKey = (place) => `${place.precision}:${place.name}`;

/**
 * Group articles by the place they were matched to. Every story at a place
 * shares that place's one coordinate; no position is ever adjusted to make
 * room. Unplaced articles are not in any group.
 * @returns {Array<{key: string, name: string, lat: number, lon: number, precision: string, articles: object[]}>}
 */
export function groupNewsByPlace(articles) {
  const groups = new Map();
  for (const article of articles ?? []) {
    const place = article?.place;
    if (!place) continue;
    const key = newsPlaceKey(place);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        name: place.name,
        lat: place.lat,
        lon: place.lon,
        precision: place.precision,
        articles: [],
      };
      groups.set(key, group);
    }
    group.articles.push(article);
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.articles.length - a.articles.length || a.key.localeCompare(b.key),
  );
}

/** Marker diameter in pixels: four steps by story count. */
export function newsMarkerSize(count) {
  if (count >= 10) return 40;
  if (count >= 5) return 34;
  if (count >= 2) return 29;
  return 24;
}

/**
 * The topic a place's marker shows: the one most of its stories carry. A tie
 * goes to the topic of the newest story. Stories with no topic count as
 * general news.
 */
export function dominantTopic(articles) {
  const counts = new Map();
  let best = 'news';
  let bestCount = 0;
  // Articles arrive newest first, so the first to reach a count wins a tie.
  for (const article of articles ?? []) {
    const topic = article?.category || 'news';
    const count = (counts.get(topic) ?? 0) + 1;
    counts.set(topic, count);
    if (count > bestCount) {
      best = topic;
      bestCount = count;
    }
  }
  return best;
}

/** The label drawn beside a place marker. */
export function newsPlaceLabel(group) {
  const count = group.articles.length;
  return count > 1 ? `${group.name} · ${count}` : group.name;
}

/** World-overlay entry for one place label. */
export function createNewsOverlayEntry({
  group,
  position,
  selected = false,
  accent = NEWS_ACCENT,
}) {
  return {
    id: group.key,
    position,
    variant: 'label',
    title: newsPlaceLabel(group),
    accent,
    priority:
      (selected ? 1_000_000 : 0) +
      group.articles.length * 1000 +
      (group.precision === 'city' ? 1 : 0),
    collisionGroup: 'ambient-label',
    paintLane: 'ambient-label',
    interactive: false,
    edgeFade: 'keyhole',
    horizonCull: true,
    terrainOcclusion: false,
    gapPx: 14,
    verticalOnly: true,
    placement: 'above',
  };
}

/**
 * Map a snapshot (or its absence) to the stats the feed-state classifier
 * reads, so the layer row shows the standard chips.
 */
export function newsStats({ snapshot, error, unavailableSources }) {
  const sources = snapshot?.sources ?? unavailableSources ?? [];
  const configured = sources.filter((source) => source.configured);
  const live = configured.filter((source) => source.ok).length;
  const source = configured.length
    ? `${live} of ${configured.length} sources`
    : 'News sources';
  if (!snapshot)
    return { count: 0, lastUpdate: null, error: error ?? null, source };
  const stats = {
    count: snapshot.articles.length,
    lastUpdate: Date.parse(snapshot.fetchedAt),
    error: error ?? null,
    source,
  };
  if (snapshot.stale) stats.stale = true;
  else if (live < configured.length) stats.partial = true;
  return stats;
}
