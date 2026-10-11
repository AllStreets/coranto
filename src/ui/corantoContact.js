/**
 * Turns whatever the engine currently has selected (an aircraft, a ship, a
 * mapped site) into Coranto's event card, so tracking detail is visible in
 * the news view. It reports the record's own fields and links to a public
 * tracker for the same identifier; it adds nothing.
 */

const SKIP_KEYS = new Set([
  'id',
  'key',
  'name',
  'entity',
  'position',
  'lat',
  'lon',
]);
const KEY_LABEL = {
  altitudeFt: 'altitude ft',
  speedKt: 'speed kt',
  speedKts: 'speed kt',
  icao24: 'transponder',
  mmsi: 'MMSI',
  frp: 'FRP MW',
};

const words = (key) =>
  KEY_LABEL[key] ??
  key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase();

function fact(key, value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return `${words(key)} ${Math.round(value * 10) / 10}`;
  }
  if (typeof value === 'boolean') return value ? words(key) : '';
  if (typeof value !== 'string') return '';
  const text = value.trim();
  return text && text.length <= 60 ? `${words(key)} ${text}` : '';
}

/** A public page for the same aircraft or vessel, or null. */
export function contactLink(record) {
  const id = String(record?.id ?? '');
  if (
    (record?.layerId === 'flights' || record?.layerId === 'military') &&
    /^[0-9a-f]{6}$/i.test(id)
  )
    return {
      url: `https://adsb.lol/?icao=${id.toLowerCase()}`,
      linkText: 'Open its live track at adsb.lol',
    };
  const mmsi = String(record?.properties?.mmsi ?? '');
  if (record?.layerId === 'ais-live-vessels' && /^\d{9}$/.test(mmsi))
    return {
      url: `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${mmsi}`,
      linkText: 'Look it up at marinetraffic.com',
    };
  return null;
}

/**
 * @param {object|null} record A context-store record.
 * @returns {object|null} Card detail, or null when there is nothing to show.
 */
export function contactCard(record) {
  const title = typeof record?.label === 'string' ? record.label.trim() : '';
  if (!record || !title) return null;
  const facts = Object.entries(record.properties ?? {})
    .filter(([key]) => !SKIP_KEYS.has(key))
    .map(([key, value]) => fact(key, value))
    .filter(Boolean)
    .slice(0, 6);
  if (typeof record.source === 'string' && record.source.trim())
    facts.push(`source ${record.source.trim()}`);
  return {
    kind: String(
      record.layerName ?? record.layerId ?? 'Selected',
    ).toUpperCase(),
    title,
    meta: facts.join(' · '),
    ...(contactLink(record) ?? { url: '', linkText: '' }),
  };
}

/**
 * What the board keeps for an aircraft, ship or site: its name, the layer it
 * was on, and what its card said and where it was at the moment of pinning.
 * A moving thing keeps moving; the pin does not follow it, and says so.
 *
 * @param {object} record The engine's selected record.
 * @param {{lat: number, lon: number}|null} at Where it is now.
 * @param {number} now Milliseconds.
 */
export function contactPin(record, at, now) {
  return cardPin(contactCard(record), record?.id, at, now);
}

/**
 * The same, from a card that is already built (Watch Power's aircraft).
 * @param {{kind: string, title: string, meta: string, url?: string}|null} detail
 * @param {string} id What identifies the thing, such as a transponder code.
 */
export function cardPin(detail, id, at, now) {
  if (!detail?.title || typeof id !== 'string' || !id) return null;
  const when = new Date(now).toISOString();
  const located = Number.isFinite(at?.lat) && Number.isFinite(at?.lon);
  return {
    key: `contact:${id}`,
    kind: 'contact',
    title: detail.title,
    publisher: detail.kind,
    summary: [
      `When pinned, ${when.slice(0, 16).replace('T', ' ')} UTC`,
      located
        ? `at ${Math.abs(at.lat).toFixed(2)}°${at.lat >= 0 ? 'N' : 'S'} ${Math.abs(at.lon).toFixed(2)}°${at.lon >= 0 ? 'E' : 'W'}`
        : '',
      detail.meta,
    ]
      .filter(Boolean)
      .join(' · '),
    url: detail.url || '',
    publishedAt: when,
    lat: located ? at.lat : null,
    lon: located ? at.lon : null,
  };
}

/** Where a selected aircraft, ship or site is, if its record says. */
export function contactPosition(record) {
  const lat = [
    record?.lat,
    record?.latitude,
    record?.properties?.lat,
    record?.properties?.latitude,
  ].find(Number.isFinite);
  const lon = [
    record?.lon,
    record?.longitude,
    record?.properties?.lon,
    record?.properties?.longitude,
  ].find(Number.isFinite);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

const toRad = (degrees) => (degrees * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export function distanceKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const NEARBY_KM = 300;

/**
 * Places with current stories within `km` of a point, nearest first. Only
 * places pinned to a city count: a country's marker is one point standing for
 * the whole country, so its distance means nothing.
 */
export function nearbyStoryPlaces(places, at, km = NEARBY_KM) {
  return (places ?? [])
    .filter((place) => place.precision === 'city')
    .map((place) => ({ place, km: distanceKm(at, place) }))
    .filter((entry) => entry.km <= km)
    .sort((a, b) => a.km - b.km);
}
