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
  ['borders', 'Borders and front lines'],
  ['countries', 'Countries'],
  ['cities', 'Cities'],
]);

const dataUri = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
const MONO = "Menlo, 'SF Mono', Consolas, 'DejaVu Sans Mono', monospace";
// Drawn at three times the on-screen size so text and icons stay sharp.
const SCALE = 3;

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
export function countryImage(country) {
  const marks = COUNTRY_MARKS.filter(([flag]) => country[flag]);
  const name = textImage(country.name, {
    size: 7,
    colour: COUNTRY_NAME_COLOUR,
  });
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
        `<text x="${width / 2}" y="${top + size + 1}" text-anchor="middle" font-family="${MONO}" font-size="${size}" font-weight="600" letter-spacing="${size * 0.09}" fill="${COUNTRY_NAME_COLOUR}" stroke="#04050a" stroke-width="2.2" stroke-linejoin="round" paint-order="stroke">${escapeXml(label)}</text></svg>`,
    ),
  };
}

/** A city icon as an image, with a dark edge behind it. */
export function cityImage(type) {
  const body = CITY_ICONS[type] ?? CITY_ICONS.city;
  const colour = CITY_COLOURS[type] ?? CITY_COLOURS.city;
  return dataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.5 -1.5 15 15" width="${15 * SCALE * 2}" height="${15 * SCALE * 2}">` +
      `<circle cx="6" cy="6" r="7" fill="#04050a" fill-opacity="0.55"/>` +
      `${body.replaceAll('currentColor', colour)}</svg>`,
  );
}

/** What a country's card says. */
export function countryCard(country, storyCount) {
  const status = COUNTRY_MARKS.filter(([flag]) => country[flag]).map(
    ([, , , label]) => label,
  );
  if (country.nato_member) status.push('NATO member');
  return {
    kind: country.strategic_tier
      ? `COUNTRY · TIER ${country.strategic_tier}`
      : 'COUNTRY',
    title: country.name,
    meta: [
      status.length
        ? `Status: ${status.join(' · ')}`
        : 'No special strategic designations on record',
      storyCount
        ? `${storyCount} current ${storyCount === 1 ? 'story names' : 'stories name'} it; the feed now shows ${storyCount === 1 ? 'it' : 'them'}`
        : 'No current story names it',
      'Designations are AUSPEX’s own table, not a live feed',
    ].join(' · '),
  };
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
  const state = { borders: false, countries: false, cities: false };
  const drawn = { borders: null, countries: null, cities: null };
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
          ? countryCard(record.item, count)
          : cityCard(record.item, count)),
        // What the analyst board keeps if this is pinned.
        pin: {
          key: `${record.kind}:${record.item.name}`,
          kind: record.kind,
          title: record.item.name,
          lat: record.item.lat,
          lon: record.item.lng,
        },
      });
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  function drawBorders(viewer, borders) {
    const lines = new Cesium.PolylineCollection();
    const positions = (points) =>
      Cesium.Cartesian3.fromDegreesArrayHeights(
        points.flatMap(([lon, lat]) => [lon, lat, LIFT_M]),
      );
    for (const [group, colour] of Object.entries(BORDER_COLOURS)) {
      const material = Cesium.Material.fromType('Color', {
        color: rgba(colour),
      });
      for (const points of borders[group] ?? [])
        lines.add({ positions: positions(points), width: 1, material });
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
    const marks = new Cesium.BillboardCollection({ scene: viewer.scene });
    for (const country of countries) {
      const { image, width, height } = countryImage(country);
      const id = `atlas:country:${country.iso2}`;
      records.set(id, { kind: 'country', item: country });
      marks.add({
        id,
        position: Cesium.Cartesian3.fromDegrees(
          country.lng,
          country.lat,
          LIFT_M,
        ),
        image,
        width,
        height,
        // Below the story marker that shares the country's point.
        pixelOffset: new Cesium.Cartesian2(0, 26),
        // Grows as you come closer, like AUSPEX's zoom scale.
        scaleByDistance: new Cesium.NearFarScalar(1.5e6, 2.1, 2.2e7, 0.9),
        disableDepthTestDistance: 50_000,
      });
    }
    return viewer.scene.primitives.add(marks);
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

  return {
    isOn: (name) => Boolean(state[name]),
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
    async set(name, on) {
      if (!(name in state)) return false;
      const viewer = getViewer();
      if (!viewer) return false;
      state[name] = Boolean(on);
      if (!on) {
        if (drawn[name]) viewer.scene.primitives.remove(drawn[name]);
        drawn[name] = null;
        viewer.scene.requestRender?.();
        return false;
      }
      if (drawn[name]) return true;
      try {
        const loaded = await load(name);
        // It may have been switched off again while the data was loading.
        if (!state[name] || drawn[name]) return state[name];
        if (name !== 'borders') ensureHandler(viewer);
        drawn[name] = draw[name](viewer, loaded);
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
