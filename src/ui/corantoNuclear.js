import * as Cesium from 'cesium';
import { glyphImage } from '../data/corantoIcons.js';
import { cullBeyondHorizon } from './corantoHorizon.js';
import { NEWS_COUNTRIES } from '../sources/news/countries.js';
import { labelPoint } from './corantoOverlayModel.js';

/**
 * Nuclear-armed states, marked on the globe as in AUSPEX.
 *
 * The nine states are those the Federation of American Scientists and SIPRI
 * list as holding nuclear weapons. The list has not changed since 2006. Israel
 * neither confirms nor denies its arsenal, and the card says so. No warhead
 * counts are shown: those are estimates that change every year, and the
 * linked page has the current ones.
 */
export const NUCLEAR_SOURCE = Object.freeze({
  name: 'Federation of American Scientists, Status of World Nuclear Forces',
  url: 'https://fas.org/initiative/status-world-nuclear-forces/',
});
export const NUCLEAR_COLOUR = '#ff9f0a';

/** ISO codes, in the order the five treaty states then the others joined. */
const CODES = ['US', 'RU', 'GB', 'FR', 'CN', 'IN', 'PK', 'KP', 'IL'];
const NOTES = {
  IL: 'Israel neither confirms nor denies holding nuclear weapons.',
};

export const NUCLEAR_STATES = Object.freeze(
  CODES.map((code) => {
    const row = NEWS_COUNTRIES.find(([iso]) => iso === code);
    return row
      ? {
          code,
          name: row[1],
          lat: row[2],
          lon: row[3],
          note: NOTES[code] ?? '',
        }
      : null;
  }).filter(Boolean),
);

/** The card shown for one state. */
export function nuclearCard(state) {
  return {
    kind: 'NUCLEAR-ARMED STATE',
    title: state.name,
    meta: [
      'One of nine states listed as holding nuclear weapons',
      state.note,
      `Source: ${NUCLEAR_SOURCE.name}`,
    ]
      .filter(Boolean)
      .join(' · '),
    url: NUCLEAR_SOURCE.url,
    linkText: 'Open the current estimates at fas.org',
  };
}

const PREFIX = 'nuclear:';

/**
 * @param {object} options
 * @param {() => object|null} options.getViewer
 * @param {(detail: object|null) => void} options.showCard
 */
export function createNuclearMarks({
  getViewer,
  showCard,
  fetchImpl = (...args) => globalThis.fetch(...args),
}) {
  let marks = null;
  /** Each state's point inside its own outline, once the outlines load. */
  const inside = new Map();
  async function loadInsidePoints() {
    if (inside.size) return;
    try {
      const response = await fetchImpl('/coranto-atlas/shapes-countries.json');
      if (!response.ok) return;
      const { shapes } = await response.json();
      for (const code of CODES) {
        const point = shapes?.[code] ? labelPoint(shapes[code].rings) : null;
        if (point) inside.set(code, point);
      }
    } catch {
      // Without outlines the marks stay on the listed points.
    }
  }
  const positionOf = (state) => {
    const at = inside.get(state.code);
    return Cesium.Cartesian3.fromDegrees(
      at?.lon ?? state.lon,
      at?.lat ?? state.lat,
      2500,
    );
  };
  let handler = null;
  let stopCulling = null;
  return {
    get shown() {
      return marks !== null;
    },
    show() {
      const viewer = getViewer();
      if (!viewer || marks) return;
      const image = glyphImage({ icon: 'nuclear', colour: NUCLEAR_COLOUR });
      marks = new Cesium.BillboardCollection({ scene: viewer.scene });
      for (const state of NUCLEAR_STATES)
        marks.add({
          id: PREFIX + state.code,
          // On the country itself, at the same inside point its name uses.
          position: positionOf(state),
          image,
          width: 22,
          height: 22,
          disableDepthTestDistance: 50_000,
        });
      // The outlines arrive after the first draw; the marks then move onto
      // them.
      loadInsidePoints().then(() => {
        if (!marks) return;
        for (let i = 0; i < marks.length; i++) {
          const mark = marks.get(i);
          const state = NUCLEAR_STATES.find(
            (entry) => PREFIX + entry.code === mark.id,
          );
          if (state) mark.position = positionOf(state);
        }
        viewer.scene.requestRender?.();
      });
      viewer.scene.primitives.add(marks);
      stopCulling = cullBeyondHorizon(viewer, marks);
      handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click) => {
        const id = viewer.scene.pick(click.position)?.id;
        if (typeof id !== 'string' || !id.startsWith(PREFIX)) return;
        const state = NUCLEAR_STATES.find(
          (entry) => entry.code === id.slice(PREFIX.length),
        );
        if (state) showCard(nuclearCard(state));
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      viewer.scene.requestRender?.();
    },
    hide() {
      const viewer = getViewer();
      stopCulling?.();
      stopCulling = null;
      if (marks) viewer?.scene?.primitives?.remove(marks);
      marks = null;
      handler?.destroy();
      handler = null;
      viewer?.scene?.requestRender?.();
    },
  };
}
