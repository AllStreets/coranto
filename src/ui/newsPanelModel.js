/**
 * Pure view-model for the News panel: what text to show for a given layer
 * view. It can only describe articles it is given. With none, it returns an
 * empty list and one sentence saying why.
 */

const REASON_TEXT = {
  timeout: 'timed out',
  'http-error': 'refused the request',
  'rate-limited': 'rate limited',
  'parse-error': 'sent an unreadable response',
  empty: 'returned no items',
  'not-configured': 'not configured (optional)',
};

const DROP_TEXT = {
  noTitle: 'no headline',
  badUrl: 'no valid link',
  noPublisher: 'no publisher',
  noDate: 'no publish date',
  future: 'dated in the future',
  tooOld: 'older than 48 hours',
  lowQualitySource: 'not a news outlet',
  junk: 'adverts, PR or entertainment',
  duplicate: 'duplicates',
};

const pad = (n) => String(n).padStart(2, '0');

/** `14:02` on the same day, otherwise `9 Oct 14:02`, in the viewer's time. */
export function clockTime(ms, now) {
  const date = new Date(ms);
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (new Date(now).toDateString() === date.toDateString()) return time;
  const month = date.toLocaleString('en-GB', { month: 'short' });
  return `${date.getDate()} ${month} ${time}`;
}

/** `3 min ago`, `2 h ago`, `1 d ago`. */
export function relativeTime(ms, now) {
  const minutes = Math.max(0, Math.floor((now - ms) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Why a story sits where it does, or that it has no location. */
export function placeLine(place) {
  if (!place) return 'No location';
  const where = place.field === 'summary' ? 'summary' : 'headline';
  return `${place.name} · ${place.precision} · matched “${place.matched}” in ${where}`;
}

function sourceRows(sources, now) {
  return sources.map((source) => {
    let detail;
    if (!source.configured) detail = REASON_TEXT['not-configured'];
    else if (source.ok)
      detail = `${source.count} ${source.count === 1 ? 'story' : 'stories'}`;
    else {
      const reason = REASON_TEXT[source.reason] ?? 'unavailable';
      const last = source.lastSuccessAt
        ? ` · last answered ${clockTime(Date.parse(source.lastSuccessAt), now)}`
        : ' · has not answered';
      detail = `${reason}${last}`;
    }
    return {
      id: source.id,
      name: source.name,
      state: !source.configured ? 'off' : source.ok ? 'ok' : 'down',
      detail,
    };
  });
}

function healthLine(snapshot, sources, now) {
  const configured = sources.filter((source) => source.configured);
  const live = configured.filter((source) => source.ok).length;
  const head = `${live} of ${configured.length} sources live`;
  if (!snapshot) return head;
  const fetched = Date.parse(snapshot.fetchedAt);
  return `${head} · fetched ${relativeTime(fetched, now)}`;
}

function card(article, now) {
  const published = Date.parse(article.publishedAt);
  return {
    id: article.id,
    title: article.title,
    publisher: article.publisher,
    published: `${relativeTime(published, now)} · ${clockTime(published, now)}`,
    publishedIso: article.publishedAt,
    place: placeLine(article.place),
    placeKey: article.place
      ? `${article.place.precision}:${article.place.name}`
      : null,
    category: article.category ? `auto-tag: ${article.category}` : '',
    summary: article.summary,
    url: article.url,
    linkText: `Open at ${hostOf(article.url)}`,
  };
}

/**
 * @param {object} view From `layer.getView()`.
 * @param {{category: string|null, publisher: string|null}} filters
 * @param {number} now
 */
export function buildNewsPanelModel(view, filters = {}, now = Date.now()) {
  const snapshot = view?.snapshot ?? null;
  const sources = snapshot?.sources ?? view?.unavailable?.sources ?? [];
  const all = snapshot?.articles ?? [];
  const selectedPlace =
    view?.places?.find((place) => place.key === view.selectedPlaceKey) ?? null;
  const category = filters.category ?? null;
  const publisher = filters.publisher ?? null;

  const matches = (article) =>
    (!selectedPlace ||
      (article.place &&
        `${article.place.precision}:${article.place.name}` ===
          selectedPlace.key)) &&
    (!category || article.category === category) &&
    (!publisher || article.publisher === publisher);
  const cards = all.filter(matches).map((article) => card(article, now));

  const dropped = Object.entries(snapshot?.dropped ?? {})
    .filter(([reason, count]) => count > 0 && DROP_TEXT[reason])
    .map(([reason, count]) => ({ reason, count, text: DROP_TEXT[reason] }));
  const droppedTotal = dropped.reduce((sum, row) => sum + row.count, 0);

  let empty = '';
  if (!cards.length) {
    if (snapshot) empty = 'No current stories match these filters.';
    else if (view?.unavailable)
      empty = `No news source is reachable. Nothing to show. Retrying in ${view.unavailable.retryAfter} s.`;
    else if (view?.error) empty = 'The news service did not answer. Nothing to show.';
    else {
      const configured = sources.filter((source) => source.configured).length;
      empty = configured
        ? `Fetching headlines from ${configured} sources.`
        : 'Fetching headlines.';
    }
  }

  const count = (key) => {
    const counts = new Map();
    for (const article of all) {
      const value = article[key];
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, n]) => ({ value, count: n }));
  };

  return {
    visible: Boolean(view?.enabled),
    total: all.length,
    shown: cards.length,
    health: sources.length ? healthLine(snapshot, sources, now) : '',
    healthState: !snapshot
      ? view?.unavailable || view?.error
        ? 'down'
        : 'loading'
      : snapshot.stale
        ? 'stale'
        : sources.some((source) => source.configured && !source.ok)
          ? 'partial'
          : 'ok',
    stale: snapshot?.stale
      ? `Showing saved results from ${clockTime(Date.parse(snapshot.fetchedAt), now)}. No source is reachable right now.`
      : '',
    sources: sourceRows(sources, now),
    droppedTotal,
    dropped,
    place: selectedPlace
      ? { key: selectedPlace.key, name: selectedPlace.name }
      : null,
    categories: count('category'),
    publishers: count('publisher'),
    filters: { category, publisher },
    cards,
    empty,
  };
}
