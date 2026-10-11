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
