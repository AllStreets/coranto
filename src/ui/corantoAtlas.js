import * as Cesium from 'cesium';
import {
  BORDER_COLOURS,
  CITY_COLOURS,
  CITY_ICONS,
  CITY_LABELS,
  COUNTRY_MARKS,
  COUNTRY_NAME_COLOUR,
  LINE_COLOURS,
} from '../data/corantoAtlasStyle.js';
import { ICONS } from '../data/corantoIcons.js';
import {
  ACTIVITY_COLOURS,
  headlineActivity,
  liveConflictCodes,
} from './corantoCountrySignals.js';
import { cullBeyondHorizon } from './corantoHorizon.js';
import { geoOf } from './corantoAnalystModel.js';
import { labelPoint } from './corantoOverlayModel.js';

/** Dead reckoning tiers, as the analyst board colours them. */
const MOMENTUM_COLOURS = Object.freeze({
  escalating: '#FF2D55',
  active: '#FF9F0A',
  stable: '#30D158',
});

/**
 * The atlas overlays brought over from AUSPEX as they were:
 *
 *   - BORDERS: every country's outline, red where the country is on AUSPEX's
 *     conflict list, blue elsewhere, plus seventeen front lines and disputed
 *     lines drawn dashed.
 *   - COUNTRIES: each country's name with its status marks.
 *   - CITIES: a thousand cities with an icon for what each is known as.
 *
 * The country list, its status flags, the conflict list and the lines are
 * AUSPEX's own hand-kept tables, not a live feed. The card for each item
 * says so. Border shapes are Natural Earth's (world-atlas 110m).
 */

export const ATLAS_OVERLAYS = Object.freeze([
  ['borders', 'Borders and front lines', 'borders'],
  ['countries', 'Countries', 'flag'],
  ['cities', 'Cities', 'skyline'],
]);

const dataUri = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
const MONO = "Menlo, 'SF Mono', Consolas, 'DejaVu Sans Mono', monospace";
// Drawn at three times the on-screen size so text and icons stay sharp.
const SCALE = 3;
// Country marks are drawn larger: they are scaled up to double on approach.
const MARK_SCALE = 5;
/** Country names: the page's own mono face, drawn large and scaled down. */
const NAME_FONT = "600 28px 'IBM Plex Mono', Menlo, Consolas, monospace";
const NAME_SCALE = 7.4 / 28;

const escapeXml = (text) =>
  String(text).replace(
    /[<>&"]/g,
    (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[char],
  );

/** A line of upper-case mono text as an image, with a dark edge. */
export function textImage(text, { size = 7, colour = '#ffffff' } = {}) {
  const label = String(text).toUpperCase();
  const advance = size * 0.6 + size * 0.09;
  const width = Math.ceil(label.length * advance + 6);
  const height = Math.ceil(size + 5);
  return {
    width,
    height,
    image: dataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * SCALE}" height="${height * SCALE}">` +
        `<text x="${width / 2}" y="${size + 1}" text-anchor="middle" font-family="${MONO}" font-size="${size}" font-weight="600" letter-spacing="${size * 0.09}" fill="${colour}" stroke="#04050a" stroke-width="2.2" stroke-linejoin="round" paint-order="stroke">${escapeXml(label)}</text></svg>`,
    ),
  };
}

/** A country's marker: its status marks in a row above its name. */
export function countryImage(
  country,
  { nameColour = COUNTRY_NAME_COLOUR } = {},
) {
  const marks = COUNTRY_MARKS.filter(([flag]) => country[flag]);
  const name = textImage(country.name, { size: 7, colour: nameColour });
  const mark = 13;
  const gap = 4;
  const row = marks.length * mark + Math.max(0, marks.length - 1) * gap;
  const width = Math.max(name.width, row + 4);
  const top = marks.length ? mark + 3 : 0;
  const height = top + name.height;
  let x = (width - row) / 2;
  const glyphs = marks
    .map(([, icon, colour]) => {
      const [attrs, body] = ICONS[icon];
      const out =
        `<g transform="translate(${x} 0) scale(${mark / 24})" ` +
        `${attrs.replaceAll('currentColor', colour)}>` +
        `<g stroke="#04050a" stroke-width="3.5" stroke-linejoin="round" fill="#04050a">${body.replaceAll('currentColor', '#04050a')}</g>` +
        `${body.replaceAll('currentColor', colour)}</g>`;
      x += mark + gap;
      return out;
    })
    .join('');
  const size = 7;
  const label = country.name.toUpperCase();
  return {
    width,
    height,
    image: dataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * SCALE}" height="${height * SCALE}">${glyphs}` +
        `<text x="${width / 2}" y="${top + size + 1}" text-anchor="middle" font-family="${MONO}" font-size="${size}" font-weight="600" letter-spacing="${size * 0.09}" fill="${nameColour}" stroke="#04050a" stroke-width="2.2" stroke-linejoin="round" paint-order="stroke">${escapeXml(label)}</text></svg>`,
    ),
  };
}

/**
 * The status marks that sit above a country's name (nuclear-armed, in
 * conflict and so on) as one image, or null for a country with none. The
 * name itself is drawn as text by the engine, which stays sharp at any zoom.
 */
export function countryMarksImage(country) {
  const marks = COUNTRY_MARKS.filter(([flag]) => country[flag]);
  if (!marks.length) return null;
  const mark = 13;
  const gap = 4;
  const width = marks.length * mark + (marks.length - 1) * gap + 4;
  const height = mark + 2;
  let x = 2;
  const glyphs = marks
    .map(([, icon, colour]) => {
      const [attrs, body] = ICONS[icon];
      const out =
        `<g transform="translate(${x} 1) scale(${mark / 24})" ` +
        `${attrs.replaceAll('currentColor', colour)}>` +
        `<g stroke="#04050a" stroke-width="3.5" stroke-linejoin="round" fill="#04050a">${body.replaceAll('currentColor', '#04050a')}</g>` +
        `${body.replaceAll('currentColor', colour)}</g>`;
      x += mark + gap;
      return out;
    })
    .join('');
  return {
    width,
    height,
    image: dataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * MARK_SCALE}" height="${height * MARK_SCALE}">${glyphs}</svg>`,
    ),
  };
}

/**
 * A city icon as an image: the glyph on a soft halo that fades to nothing,
 * with no disc edge, like the other non-story markers. The 2% disc keeps the
 * whole icon clickable, since Cesium skips fully transparent pixels.
 */
export function cityImage(type) {
  const body = CITY_ICONS[type] ?? CITY_ICONS.city;
  const colour = CITY_COLOURS[type] ?? CITY_COLOURS.city;
  return dataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.5 -1.5 15 15" width="${15 * SCALE * 2}" height="${15 * SCALE * 2}">` +
      `<defs><radialGradient id="h"><stop offset="0" stop-color="#04050a" stop-opacity="0.62"/><stop offset="0.75" stop-color="#04050a" stop-opacity="0"/></radialGradient></defs>` +
      `<circle cx="6" cy="6" r="7.4" fill="#04050a" fill-opacity="0.02"/>` +
      `<circle cx="6" cy="6" r="7.5" fill="url(#h)"/>` +
      `${body.replaceAll('currentColor', colour)}</svg>`,
  );
}

/** What a country's card says. */
export function countryCard(country, storyCount, signals = {}) {
  const status = COUNTRY_MARKS.filter(([flag]) => country[flag]).map(
    ([flag, , , label]) =>
      flag === 'conflict_active' ? conflictLabel(country) : label,
  );
  if (country.nato_member) status.push('NATO member');
  const activity = signals.activity;
  return {
    kind: country.strategic_tier
      ? `COUNTRY · TIER ${country.strategic_tier}`
      : 'COUNTRY',
    title: country.name,
    meta: [
      status.length
        ? `Status: ${status.join(' · ')}`
        : 'No special strategic designations on record',
      activity
        ? `Named in ${activity.count} current ${activity.count === 1 ? 'headline' : 'headlines'} (${activity.level} activity)`
        : '',
      storyCount
        ? `${storyCount} current ${storyCount === 1 ? 'story names' : 'stories name'} it; the feed now shows ${storyCount === 1 ? 'it' : 'them'}`
        : 'No current story names it',
      'Designations are AUSPEX’s own table, not a live feed',
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

/** Says where an active-conflict mark comes from. */
function conflictLabel(country) {
  if (country.conflict_listed && country.conflict_live)
    return 'Active conflict (AUSPEX’s list, and current military headlines)';
  return country.conflict_live
    ? 'Active conflict (three or more current military headlines name it)'
    : 'Active conflict';
}

/** What a city's card says. */
export function cityCard(city, storyCount) {
  return {
    kind: `CITY · ${(CITY_LABELS[city.type] ?? CITY_LABELS.city).toUpperCase()}`,
    title: city.name,
    meta: [
      city.iso2,
      Number.isFinite(city.population)
        ? `population ${city.population.toLocaleString('en-GB')}`
        : '',
      city.tier ? `tier ${city.tier}` : '',
      storyCount
        ? `${storyCount} current ${storyCount === 1 ? 'story names' : 'stories name'} it; the feed now shows ${storyCount === 1 ? 'it' : 'them'}`
        : 'No current story names it',
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

const rgba = ([r, g, b, a]) =>
  Cesium.Color.fromBytes(r, g, b, Math.round(a * 255));
const LIFT_M = 2500;

/**
 * @param {object} options
 * @param {() => object|null} options.getViewer
 * @param {(detail: object|null) => void} options.showCard
 * @param {(kind: 'country'|'city', name: string) => number} options.selectPlace
 * Narrows the feed to that place and returns how many stories name it.
 * @param {typeof fetch} [options.fetchImpl]
 */
export function createAtlas({
  getViewer,
  showCard,
  selectPlace,
  fetchImpl = (...args) => globalThis.fetch(...args),
}) {
  const state = {
    borders: false,
    countries: false,
    cities: false,
    // Country names are always coloured by how often current headlines name
    // the country; it is part of the Countries overlay, not a switch.
    activity: true,
  };
  // What the current headlines say about countries; see corantoCountrySignals.
  let signals = { conflict: new Set(), activity: new Map(), key: '' };
  const drawn = { borders: null, countries: null, cities: null };
  const stopCulling = { countries: null, cities: null };
  const data = {};
  const records = new Map();
  let handler = null;

  async function load(name) {
    if (!data[name]) {
      const response = await fetchImpl(`/coranto-atlas/${name}.json`);
      if (!response.ok) throw new Error(`atlas ${name}`);
      data[name] = await response.json();
    }
    return data[name];
  }

  function ensureHandler(viewer) {
    if (handler) return;
    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click) => {
      const id = viewer.scene.pick(click.position)?.id;
      const record = typeof id === 'string' ? records.get(id) : null;
      if (!record) return;
      const count = selectPlace(record.kind, record.item.name);
      showCard({
        ...(record.kind === 'country'
          ? countryCard(record.item, count, {
              activity: signals.activity.get(record.item.iso2),
            })
          : cityCard(record.item, count)),
        // What the analyst board keeps if this is pinned.
        pin: {
          key: `${record.kind}:${record.item.name}`,
          kind: record.kind,
          iso2: record.kind === 'country' ? record.item.iso2 : undefined,
          title: record.item.name,
          lat: record.item.lat,
          lon: record.item.lng,
          // The facts the analyst board's tools read about the place.
          geo: geoOf(
            record.kind,
            record.item,
            record.kind === 'city'
              ? (data.countries?.find(
                  (country) => country.iso2 === record.item.iso2,
                )?.name ?? '')
              : '',
          ),
        },
      });
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  let momentum = null;
  /** Horizon culling for a collection, or for each part of a group. */
  function cullParts(viewer, drawing) {
    const stops = (drawing.corantoParts ?? [drawing]).map((part) =>
      cullBeyondHorizon(viewer, part),
    );
    return () => stops.forEach((stop) => stop());
  }
  // Where each country's name is drawn, worked out once from its outline.
  const namePoints = new Map();
  async function loadNamePoints() {
    if (namePoints.size) return;
    try {
      const response = await fetchImpl('/coranto-atlas/shapes-countries.json');
      if (!response.ok) return;
      const { shapes } = await response.json();
      for (const [iso2, shape] of Object.entries(shapes)) {
        const point = labelPoint(shape.rings);
        if (point) namePoints.set(iso2, point);
      }
    } catch {
      // Without outlines the names use the listed points.
    }
  }
  function drawBorders(viewer, borders) {
    const lines = new Cesium.PolylineCollection();
    const positions = (points) =>
      Cesium.Cartesian3.fromDegreesArrayHeights(
        points.flatMap(([lon, lat]) => [lon, lat, LIFT_M]),
      );
    for (const [group, colour] of Object.entries(BORDER_COLOURS)) {
      // One material per line: a shared one is destroyed once per line when
      // the borders are switched off, and the second time is an error that
      // left them on the globe.
      for (const points of borders[group] ?? [])
        lines.add({
          positions: positions(points),
          width: 1,
          material: Cesium.Material.fromType('Color', {
            color: rgba(colour),
          }),
        });
    }
    for (const line of borders.lines ?? []) {
      const [colour, gap] = LINE_COLOURS[line.kind] ?? LINE_COLOURS.disputed;
      lines.add({
        positions: positions(line.points),
        width: 3,
        material: Cesium.Material.fromType('PolylineDash', {
          color: Cesium.Color.fromCssColorString(colour),
          gapColor: Cesium.Color.fromCssColorString(gap).withAlpha(0.9),
          dashLength: 14,
        }),
      });
    }
    return viewer.scene.primitives.add(lines);
  }

  function drawCountries(viewer, countries) {
    // Names are text the engine draws from distance fields, so they are
    // sharp at every zoom and screen density; an image of the text was not.
    const group = new Cesium.PrimitiveCollection();
    const names = group.add(
      new Cesium.LabelCollection({ scene: viewer.scene }),
    );
    const marks = group.add(
      new Cesium.BillboardCollection({ scene: viewer.scene }),
    );
    group.corantoParts = [names, marks];
    // Just under a story marker when close; on the spot from afar.
    const offsetByDistance = new Cesium.NearFarScalar(1.5e6, 1.6, 1.4e7, 0);
    // Grows as you come closer, like AUSPEX's zoom scale.
    const sizeByDistance = new Cesium.NearFarScalar(1.5e6, 2.1, 2.2e7, 0.9);
    for (const base of countries) {
      const live = signals.conflict.has(base.iso2);
      // The mark is AUSPEX's list or a live signal; the card says which.
      const country = {
        ...base,
        conflict_listed: Boolean(base.conflict_active),
        conflict_live: live,
        conflict_active: Boolean(base.conflict_active) || live,
      };
      const level = state.activity
        ? signals.activity.get(base.iso2)?.level
        : null;
      // Dead reckoning, when the analyst board has it on, colours the name
      // by how often the country is in the headlines.
      const colour =
        MOMENTUM_COLOURS[momentum?.[base.iso2]] ??
        ACTIVITY_COLOURS[level] ??
        COUNTRY_NAME_COLOUR;
      const id = `atlas:country:${country.iso2}`;
      records.set(id, { kind: 'country', item: country });
      // On the country itself: the point of its outline farthest from its
      // edge, or the listed point where there is no outline.
      const position = Cesium.Cartesian3.fromDegrees(
        namePoints.get(country.iso2)?.lon ?? country.lng,
        namePoints.get(country.iso2)?.lat ?? country.lat,
        LIFT_M,
      );
      names.add({
        id,
        position,
        text: country.name.toUpperCase(),
        font: NAME_FONT,
        scale: NAME_SCALE,
        fillColor: Cesium.Color.fromCssColorString(colour),
        outlineColor: Cesium.Color.fromCssColorString('#04050a'),
        outlineWidth: 5,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.TOP,
        pixelOffset: new Cesium.Cartesian2(0, 14),
        pixelOffsetScaleByDistance: offsetByDistance,
        scaleByDistance: sizeByDistance,
        disableDepthTestDistance: 50_000,
      });
      const badge = countryMarksImage(country);
      if (badge)
        marks.add({
          id,
          position,
          image: badge.image,
          width: badge.width,
          height: badge.height,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, 13),
          pixelOffsetScaleByDistance: offsetByDistance,
          scaleByDistance: sizeByDistance,
          disableDepthTestDistance: 50_000,
        });
    }
    return viewer.scene.primitives.add(group);
  }

  function drawCities(viewer, cities) {
    const marks = new Cesium.BillboardCollection({ scene: viewer.scene });
    const icons = new Map();
    for (const city of cities) {
      const type = CITY_ICONS[city.type] ? city.type : 'city';
      if (!icons.has(type)) icons.set(type, cityImage(type));
      const size = city.tier === 1 ? 18 : city.tier === 2 ? 15 : 13;
      const position = Cesium.Cartesian3.fromDegrees(
        city.lng,
        city.lat,
        LIFT_M,
      );
      const id = `atlas:city:${city.name}:${city.iso2}`;
      records.set(id, { kind: 'city', item: city });
      // Smaller cities come into view as you come closer.
      const within = city.tier === 1 ? 4.5e7 : city.tier === 2 ? 1.4e7 : 6e6;
      marks.add({
        id,
        position,
        image: icons.get(type),
        width: size,
        height: size,
        scaleByDistance: new Cesium.NearFarScalar(8e5, 1.7, 2e7, 0.8),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
          0,
          within,
        ),
        disableDepthTestDistance: 50_000,
      });
      const label = textImage(city.name, {
        size: city.tier === 1 ? 6.5 : 5.5,
        colour: CITY_COLOURS[type],
      });
      marks.add({
        id,
        position,
        image: label.image,
        width: label.width,
        height: label.height,
        pixelOffset: new Cesium.Cartesian2(0, size / 2 + 7),
        pixelOffsetScaleByDistance: new Cesium.NearFarScalar(
          8e5,
          1.7,
          2e7,
          0.8,
        ),
        scaleByDistance: new Cesium.NearFarScalar(8e5, 1.9, 2e7, 0.85),
        // Names appear nearer than their icons, so the whole Earth is not text.
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
          0,
          city.tier === 1 ? 9e6 : city.tier === 2 ? 4.5e6 : 2.2e6,
        ),
        disableDepthTestDistance: 50_000,
      });
    }
    return viewer.scene.primitives.add(marks);
  }

  const draw = {
    borders: drawBorders,
    countries: drawCountries,
    cities: drawCities,
  };

  async function redrawCountries() {
    const viewer = getViewer();
    if (!viewer || !drawn.countries || !data.countries) return;
    stopCulling.countries?.();
    viewer.scene.primitives.remove(drawn.countries);
    drawn.countries = drawCountries(viewer, data.countries);
    stopCulling.countries = cullParts(viewer, drawn.countries);
    viewer.scene.requestRender?.();
  }

  return {
    isOn: (name) => Boolean(state[name]),
    /** What current headlines say: conflict marks and activity levels. */
    signals: () => signals,
    /** City types on the map, most common first, for the key. */
    cityTypes() {
      if (!state.cities || !data.cities) return [];
      const counts = new Map();
      for (const city of data.cities)
        counts.set(city.type, (counts.get(city.type) ?? 0) + 1);
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([type]) => type)
        .filter((type) => CITY_ICONS[type]);
    },
    /** Switch an overlay on or off. Resolves to whether it is now on. */
    /** Dead reckoning tiers by country code, or null to clear them. */
    async setMomentum(tiers) {
      momentum = tiers;
      if (state.countries) await redrawCountries();
    },
    /** Recompute the country signals from the current headlines. */
    async setArticles(articles) {
      if (!data.countries) return;
      const conflict = liveConflictCodes(data.countries, articles);
      const activity = headlineActivity(data.countries, articles);
      const key = `${[...conflict].sort().join()}|${[...activity]
        .map(([code, entry]) => code + entry.level)
        .sort()
        .join()}`;
      if (key === signals.key) return;
      signals = { conflict, activity, key };
      if (state.countries) await redrawCountries();
    },
    async set(name, on) {
      if (!(name in state)) return false;
      const viewer = getViewer();
      if (!viewer) return false;
      if (name === 'activity') {
        // Activity colours the country names; it needs them drawn.
        state.activity = Boolean(on);
        if (state.countries) await redrawCountries();
        return state.activity;
      }
      state[name] = Boolean(on);
      if (!on) {
        stopCulling[name]?.();
        stopCulling[name] = null;
        if (drawn[name]) viewer.scene.primitives.remove(drawn[name]);
        drawn[name] = null;
        viewer.scene.requestRender?.();
        return false;
      }
      if (drawn[name]) return true;
      try {
        const loaded = await load(name);
        if (name === 'countries') await loadNamePoints();
        // It may have been switched off again while the data was loading.
        if (!state[name] || drawn[name]) return state[name];
        if (name !== 'borders') ensureHandler(viewer);
        drawn[name] = draw[name](viewer, loaded);
        if (name !== 'borders')
          stopCulling[name] = cullParts(viewer, drawn[name]);
        viewer.scene.requestRender?.();
        return true;
      } catch {
        state[name] = false;
        return false;
      }
    },
    destroy() {
      const viewer = getViewer();
      for (const name of Object.keys(drawn)) {
        stopCulling[name]?.();
        stopCulling[name] = null;
        if (drawn[name]) viewer?.scene?.primitives?.remove(drawn[name]);
        drawn[name] = null;
        state[name] = false;
      }
      handler?.destroy();
      handler = null;
      records.clear();
    },
  };
}
