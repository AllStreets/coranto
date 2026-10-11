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
  tooOld: 'older than 7 days',
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

const FIGURE_LABEL = {
  killed: 'killed',
  injured: 'injured',
  missing: 'missing',
  arrested: 'arrested',
  displaced: 'displaced',
  magnitude: 'magnitude',
};

/** "Europe 4", and "Africa: none of the outlets read" where that is known. */
function coverageRows(coverage) {
  return (coverage ?? []).map((row) => ({
    region: row.region,
    outlets: row.outlets,
    state: row.outlets > 0 ? 'covered' : row.listening ? 'quiet' : 'unread',
    text:
      row.outlets > 0
        ? `${row.region} ${row.outlets}`
        : row.listening
          ? `${row.region} 0`
          : `${row.region} –`,
    title:
      row.outlets > 0
        ? `${row.outlets} ${row.outlets === 1 ? 'outlet' : 'outlets'} based in ${row.region} carried this`
        : row.listening
          ? `None of the ${row.region} outlets Coranto reads has carried this in the last 7 days`
          : `No ${row.region} outlet is answering right now, so nothing can be said`,
  }));
}

/** "killed: 15 (France 24) · 20 (BBC, CNA)" */
function differingRows(differing) {
  return (differing ?? []).map((row) => ({
    what: FIGURE_LABEL[row.what] ?? row.what,
    text: row.values
      .map(
        (entry) =>
          `${entry.value.toLocaleString('en-GB')} (${entry.publishers.join(', ')})`,
      )
      .join(' · '),
  }));
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
      count: source.configured && source.ok ? source.count : null,
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
    categoryId: article.category ?? '',
    goodNews: article.progress
      ? `auto-tag: good news · ${article.progress}`
      : '',
    summary: article.summary,
    url: article.url,
    linkText: `Open at ${hostOf(article.url)}`,
    lang: article.lang && article.lang !== 'en' ? article.lang : '',
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
  const terms = String(filters.query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const haystack = (article) =>
    `${article.title} ${article.summary} ${article.publisher} ${article.place?.name ?? ''}`.toLowerCase();
  // A lens can ask for stories carrying any of a set of words.
  const anyOf = (filters.any ?? []).length
    ? new RegExp(
        `\\b(?:${filters.any.map((word) => word.replace(/[^a-z]/gi, '')).join('|')})\\b`,
        'i',
      )
    : null;
  const category = filters.category ?? null;
  const publisher = filters.publisher ?? null;

  const language = view?.language === undefined ? 'en' : view.language;
  const goodNewsOnly = Boolean(view?.goodNewsOnly);
  const goodNewsCount = all.filter((article) => article.progress).length;
  const matches = (article) =>
    (!goodNewsOnly || article.progress) &&
    (!language || (article.lang ?? 'en') === language) &&
    (!selectedPlace ||
      (article.place &&
        `${article.place.precision}:${article.place.name}` ===
          selectedPlace.key)) &&
    (!category || article.category === category) &&
    (!publisher || article.publisher === publisher) &&
    (!anyOf || anyOf.test(`${article.title} ${article.summary}`)) &&
    (!terms.length ||
      ((text) => terms.every((term) => text.includes(term)))(
        haystack(article),
      ));
  const matching = all.filter(matches);
  const grouped = filters.grouped !== false;
  let cards;
  if (!grouped) cards = matching.map((article) => card(article, now));
  else {
    // One card per story: its newest matching headline leads, and the other
    // outlets' own headlines are listed beneath it.
    const byId = new Map(matching.map((article) => [article.id, article]));
    const stories =
      snapshot?.stories ??
      matching.map((article) => ({
        id: `s-${article.id}`,
        articleIds: [article.id],
      }));
    cards = [];
    for (const story of stories) {
      const members = story.articleIds
        .map((id) => byId.get(id))
        .filter(Boolean)
        .sort((x, y) => Date.parse(y.publishedAt) - Date.parse(x.publishedAt));
      if (!members.length) continue;
      const [lead, ...rest] = members;
      const outlets = new Set(members.map((article) => article.publisher)).size;
      cards.push({
        ...card(lead, now),
        storyId: story.id,
        outlets,
        outletsText:
          outlets > 1 ? `${outlets} outlets` : rest.length ? '1 outlet' : '',
        // Shown only for the whole story, not a filtered slice of it.
        coverage:
          members.length === story.articleIds.length
            ? coverageRows(story.coverage)
            : [],
        differing:
          members.length === story.articleIds.length
            ? differingRows(story.differing)
            : [],
        others: rest.map((article) => ({
          id: article.id,
          publisher: article.publisher,
          title: article.title,
          url: article.url,
          published: relativeTime(Date.parse(article.publishedAt), now),
        })),
        newest: Date.parse(lead.publishedAt),
      });
    }
    cards.sort((x, y) => y.newest - x.newest);
  }

  const dropped = Object.entries(snapshot?.dropped ?? {})
    .filter(([reason, count]) => count > 0 && DROP_TEXT[reason])
    .map(([reason, count]) => ({ reason, count, text: DROP_TEXT[reason] }));
  const droppedTotal = dropped.reduce((sum, row) => sum + row.count, 0);

  let empty = '';
  if (!cards.length) {
    if (snapshot && goodNewsOnly && goodNewsCount === 0)
      empty =
        'No current headline is tagged as good news. The tag is automatic and cautious.';
    else if (snapshot) empty = 'No current stories match these filters.';
    else if (view?.unavailable)
      empty = `No news source is reachable. Nothing to show. Retrying in ${view.unavailable.retryAfter} s.`;
    else if (view?.error)
      empty = 'The news service did not answer. Nothing to show.';
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
      const value = key === 'lang' ? (article.lang ?? 'en') : article[key];
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
    filters: { category, publisher, query: terms.join(' ') },
    grouped,
    headlines: matching.length,
    language,
    languages: count('lang'),
    goodNewsOnly,
    goodNewsCount,
    cards,
    empty,
  };
}
