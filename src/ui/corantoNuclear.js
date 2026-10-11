import * as Cesium from 'cesium';
import { markerImage } from '../data/corantoIcons.js';
import { NEWS_COUNTRIES } from '../sources/news/countries.js';

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
export function createNuclearMarks({ getViewer, showCard }) {
  let entities = [];
  let handler = null;
  return {
    get shown() {
      return entities.length > 0;
    },
    show() {
      const viewer = getViewer();
      if (!viewer || entities.length) return;
      const image = markerImage({ icon: 'nuclear', colour: NUCLEAR_COLOUR });
      entities = NUCLEAR_STATES.map((state) =>
        viewer.entities.add({
          id: PREFIX + state.code,
          position: Cesium.Cartesian3.fromDegrees(state.lon, state.lat),
          billboard: {
            image,
            width: 22,
            height: 22,
            // Beside the country's story marker, which shares this point.
            pixelOffset: new Cesium.Cartesian2(19, -19),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: 50_000,
          },
        }),
      );
      handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click) => {
        const picked = viewer.scene.pick(click.position);
        const id = picked?.id?.id ?? picked?.id;
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
      for (const entity of entities) viewer?.entities?.remove(entity);
      entities = [];
      handler?.destroy();
      handler = null;
      viewer?.scene?.requestRender?.();
    },
  };
}
