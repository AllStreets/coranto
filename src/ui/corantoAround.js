import { distanceKm } from './corantoContact.js';

/**
 * Around a story: what the live layers hold near the place a story was
 * pinned to, and which layer the story itself is about.
 *
 * Only layers that are switched on are read; a layer that is off has loaded
 * nothing, so it is listed as not checked rather than counted as empty. A
 * story placed at a country or region has no point to measure from, and the
 * sheet says so.
 */
export const AROUND_KM = 300;
const ROWS_EACH = 4;

const text = (value) =>
  typeof value === 'string' && value.trim() ? value.trim() : '';

/** Names match the LAYERS list. [layer id, name, icon, how a row is described, words that mean the story is about it]. */
export const AROUND_LAYERS = Object.freeze([
  [
    'hazards',
    'Hazards',
    'hazard',
    (row) => text(row.title) || text(row.kind) || 'Hazard',
    /\b(volcano|volcanic|eruption|floods?|flooding|tsunami|landslide)\b/i,
    'a natural hazard',
  ],
  [
    'earthquakes',
    'Quakes',
    'earthquake',
    (row) =>
      [
        Number.isFinite(row.magnitude) ? `M${row.magnitude.toFixed(1)}` : '',
        text(row.place),
      ]
        .filter(Boolean)
        .join(' · ') || 'Earthquake',
    /\b(earthquakes?|quakes?|aftershocks?|tremors?)\b/i,
    'an earthquake',
  ],
  [
    'local-firms',
    'Fires',
    'wildfire',
    () => 'Fire seen by satellite',
    /\b(wildfires?|bushfires?|forest fires?)\b/i,
    'a wildfire',
  ],
  [
    'weather-cyclones',
    'Storms',
    'cyclone',
    (row) =>
      [text(row.name), Number.isFinite(row.windKt) ? `${row.windKt} kt` : '']
        .filter(Boolean)
        .join(' · ') || 'Tropical cyclone',
    /\b(hurricanes?|typhoons?|cyclones?|tropical storms?)\b/i,
    'a tropical storm',
  ],
  [
    'military',
    'Military',
    'military',
    (row) => text(row.callsign) || text(row.id) || 'Military aircraft',
    /\b(warplanes?|fighter jets?|air force|bombers?|military aircraft|airspace)\b/i,
    'military aircraft',
  ],
  [
    'flights',
    'Flights',
    'aircraft',
    (row) => text(row.callsign) || text(row.id) || 'Aircraft',
    /\b(airports?|airlines?|flights?|aviation|plane crash)\b/i,
    'aviation',
  ],
  [
    'ais-live-vessels',
    'Ships',
    'ship',
    (row) => text(row.name) || text(row.mmsi) || 'Vessel',
    /\b(ships?|vessels?|tankers?|strait|shipping|navy|naval|blockade|cargo ship)\b/i,
    'shipping',
  ],
  [
    'rocket-launches',
    'Launches',
    'launch',
    (row) => text(row.name) || text(row.missionName) || 'Launch',
    /\b(rockets? launch|spacex|liftoff|lift-off|space station|nasa)\b/i,
    'a space launch',
  ],
]);

/**
 * @param {object} input
 * @param {{name: string, lat: number, lon: number, precision: string}|null} input.place
 * @param {string} input.storyText The story's headline and summary.
 * @param {(id: string) => {on: boolean, rows: object[]}} input.readLayer
 * @param {number} [input.km]
 */
export function aroundStory({ place, storyText, readLayer, km = AROUND_KM }) {
  const measurable =
    place?.precision === 'city' &&
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lon);
  const groups = [];
  const unchecked = [];
  const suggestions = [];
  for (const [id, label, icon, describe, about, noun] of AROUND_LAYERS) {
    const { on, rows } = readLayer(id) ?? { on: false, rows: [] };
    if (!on) {
      unchecked.push(label);
      if (about.test(storyText ?? ''))
        suggestions.push({
          id,
          label,
          icon,
          why: `This story mentions ${noun}.`,
        });
      continue;
    }
    if (!measurable) continue;
    const near = [];
    for (const row of rows ?? []) {
      const lat = row.lat ?? row.latitude;
      const lon = row.lon ?? row.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const away = distanceKm(place, { lat, lon });
      if (away <= km) near.push({ label: describe(row), km: away, lat, lon });
    }
    near.sort((a, b) => a.km - b.km);
    groups.push({
      id,
      label,
      icon,
      count: near.length,
      rows: near
        .slice(0, ROWS_EACH)
        .map((row) => ({ ...row, km: Math.round(row.km) })),
    });
  }
  return {
    measurable,
    km,
    where: place?.name ?? '',
    groups,
    found: groups.reduce((sum, group) => sum + group.count, 0),
    suggestions,
    unchecked,
  };
}
