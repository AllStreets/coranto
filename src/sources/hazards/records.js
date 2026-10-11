/**
 * Natural-hazard events from two public trackers, ported from AUSPEX's
 * senses: GDACS (the UN and European Commission's global disaster alert
 * system) and NASA EONET. Every event keeps its tracker's own link, start
 * time and, for GDACS, the tracker's own alert level. Nothing is scored or
 * ranked by Coranto.
 */

const GDACS_KINDS = {
  EQ: 'earthquake',
  TC: 'cyclone',
  FL: 'flood',
  VO: 'volcano',
  DR: 'drought',
  WF: 'wildfire',
};

const EONET_KINDS = {
  wildfires: 'wildfire',
  severeStorms: 'storm',
  volcanoes: 'volcano',
  seaLakeIce: 'ice',
  floods: 'flood',
  drought: 'drought',
  dustHaze: 'dust',
  earthquakes: 'earthquake',
  landslides: 'landslide',
  snow: 'snow',
  tempExtremes: 'extreme temperature',
};

export const HAZARD_ALERTS = Object.freeze(['Red', 'Orange', 'Green']);
export const HAZARD_WILDFIRE_CAP = 30;
export const HAZARD_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function decode(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block, name) {
  const match = block.match(
    new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`),
  );
  return match ? decode(match[1]) : '';
}

function httpUrl(value) {
  try {
    const url = new URL(String(value ?? '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function event(fields) {
  const { id, kind, title, lat, lon, startedAt, url, source, alert } = fields;
  const started = Date.parse(startedAt);
  const link = httpUrl(url);
  if (!id || !kind || !title || !link) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  if (!Number.isFinite(started)) return null;
  return {
    id,
    kind,
    title,
    lat,
    lon,
    startedAt: new Date(started).toISOString(),
    url: link,
    source,
    alert: HAZARD_ALERTS.includes(alert) ? alert : null,
  };
}

/** Parse the GDACS GeoRSS feed. Items without an alert level are skipped. */
export function parseGdacs(xml) {
  const out = [];
  for (const match of String(xml ?? '').matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = match[1];
    const type = tag(block, 'gdacs:eventtype');
    const parsed = event({
      id: `gdacs:${type}:${tag(block, 'gdacs:eventid')}`,
      kind: GDACS_KINDS[type],
      title: tag(block, 'title'),
      lat: Number(tag(block, 'geo:lat') || NaN),
      lon: Number(tag(block, 'geo:long') || NaN),
      startedAt: tag(block, 'gdacs:fromdate') || tag(block, 'pubDate'),
      url: tag(block, 'link'),
      source: 'GDACS',
      alert: tag(block, 'gdacs:alertlevel'),
    });
    if (parsed?.alert) out.push(parsed);
  }
  return out;
}

/** Parse a NASA EONET v3 events response. Point geometries only. */
export function parseEonet(data) {
  const out = [];
  for (const item of Array.isArray(data?.events) ? data.events : []) {
    const geometry = Array.isArray(item?.geometry)
      ? item.geometry.at(-1)
      : null;
    if (geometry?.type !== 'Point') continue;
    const [lon, lat] = geometry.coordinates ?? [];
    const parsed = event({
      id: `eonet:${item.id}`,
      kind: EONET_KINDS[item?.categories?.[0]?.id],
      title: typeof item.title === 'string' ? item.title.trim() : '',
      lat,
      lon,
      startedAt: geometry.date,
      url: item?.sources?.[0]?.url ?? item.link,
      source: 'NASA EONET',
      alert: null,
    });
    if (parsed) out.push(parsed);
  }
  return out;
}

const ALERT_RANK = { Red: 0, Orange: 1, Green: 2 };

/**
 * Merge events from every tracker: drop events older than 30 days, keep the
 * most recent wildfires up to a cap (they would otherwise crowd out every
 * other hazard), and order by alert level then recency.
 * @returns {{events: object[], wildfiresLeftOut: number}}
 */
export function mergeHazards(lists, now) {
  const all = lists
    .flat()
    .filter((item) => now - Date.parse(item.startedAt) <= HAZARD_MAX_AGE_MS);
  const recent = (a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt);
  const order = (a, b) =>
    (ALERT_RANK[a.alert] ?? 3) - (ALERT_RANK[b.alert] ?? 3) ||
    recent(a, b) ||
    a.id.localeCompare(b.id);
  const fires = all.filter((item) => item.kind === 'wildfire').sort(order);
  const others = all.filter((item) => item.kind !== 'wildfire');
  return {
    events: [...others, ...fires.slice(0, HAZARD_WILDFIRE_CAP)].sort(order),
    wildfiresLeftOut: Math.max(0, fires.length - HAZARD_WILDFIRE_CAP),
  };
}

const KINDS = new Set([
  ...Object.values(GDACS_KINDS),
  ...Object.values(EONET_KINDS),
]);

/** True when a value has every field a hazard must carry to be shown. */
export function isShowableHazard(item) {
  return Boolean(
    item &&
    typeof item.id === 'string' &&
    item.id &&
    KINDS.has(item.kind) &&
    typeof item.title === 'string' &&
    item.title &&
    typeof item.source === 'string' &&
    item.source &&
    httpUrl(item.url) &&
    Number.isFinite(Date.parse(item.startedAt)) &&
    Number.isFinite(item.lat) &&
    Number.isFinite(item.lon) &&
    Math.abs(item.lat) <= 90 &&
    Math.abs(item.lon) <= 180 &&
    (item.alert === null || HAZARD_ALERTS.includes(item.alert)),
  );
}
