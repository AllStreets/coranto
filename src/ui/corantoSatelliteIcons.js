import * as Cesium from 'cesium';
import { satelliteImage } from '../data/corantoIcons.js';
import { satelliteClassColor } from '../data/satelliteClass.js';

/**
 * Satellite icons. The engine draws every satellite as a dot and moves about
 * 28,000 of them each frame; an icon on each would cost too much. So the
 * icons go on the named catalogue only (stations, navigation, weather,
 * science and the like: under a thousand), drawn over their dots and moved
 * with them. The Starlink shell stays as dots.
 *
 * Positions are the engine's own, read each frame; nothing is recomputed.
 */
export const SATELLITE_ICON_LIMIT = 1000;
const ISS_NORAD = 25544;

/**
 * An icon takes the colour the engine gives that satellite's dot, by class:
 * stations warm white, navigation cyan, the geostationary belt violet. So
 * the belt still reads as one violet band around the equator, and the ISS
 * keeps its red.
 */
export function satelliteIconColour(row) {
  return row?.id === ISS_NORAD ? '#ff4444' : satelliteClassColor(row?.group);
}
const PREFIX = 'satellite-icon:';

/**
 * @param {object} options
 * @param {() => object|null} options.getManager The layer manager.
 */
export function createSatelliteIcons({ getManager }) {
  let icons = null;
  let byId = new Map();
  let stop = null;
  let clicks = null;
  let lastSync = 0;

  // One image per class colour, not one per satellite.
  const images = new Map();
  const imageFor = (colour) => {
    if (!images.has(colour)) images.set(colour, satelliteImage(colour));
    return images.get(colour);
  };

  const layer = () => getManager()?.layers?.get('satellites')?.module ?? null;

  function sync(viewer) {
    const module = layer();
    if (!module || !icons) return;
    const now = Date.now();
    // Which satellites exist changes rarely; where they are changes always.
    const rebuild = now - lastSync > 5000;
    const rows = module.getAllPositions?.(SATELLITE_ICON_LIMIT) ?? [];
    if (rebuild) {
      lastSync = now;
      const seen = new Set();
      for (const row of rows) {
        seen.add(row.id);
        if (byId.has(row.id)) continue;
        byId.set(
          row.id,
          icons.add({
            id: PREFIX + row.id,
            position: row.position,
            image: imageFor(satelliteIconColour(row)),
            width: 22,
            height: 22,
            // Larger when near, never vanishing when far.
            scaleByDistance: new Cesium.NearFarScalar(2e6, 1.5, 6e7, 0.75),
          }),
        );
      }
      for (const [id, billboard] of byId)
        if (!seen.has(id)) {
          icons.remove(billboard);
          byId.delete(id);
        }
    }
    const occluder = new Cesium.EllipsoidalOccluder(
      viewer.scene.globe?.ellipsoid ?? Cesium.Ellipsoid.WGS84,
      viewer.camera.positionWC,
    );
    for (const row of rows) {
      const billboard = byId.get(row.id);
      if (!billboard) continue;
      billboard.position = row.position;
      const visible = occluder.isPointVisible(row.position);
      if (billboard.show !== visible) billboard.show = visible;
    }
  }

  return {
    get shown() {
      return icons !== null;
    },
    count: () => byId.size,
    start() {
      const viewer = getManager()?.viewer;
      if (!viewer || icons) return;
      icons = new Cesium.BillboardCollection({ scene: viewer.scene });
      viewer.scene.primitives.add(icons);
      lastSync = 0;
      stop = viewer.scene.preRender.addEventListener(() => sync(viewer));
      // An icon sits over its dot, so a click on it tracks that satellite
      // just as a click on the dot would.
      clicks = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      clicks.setInputAction((click) => {
        const id = viewer.scene.pick(click.position)?.id;
        if (typeof id !== 'string' || !id.startsWith(PREFIX)) return;
        layer()?.trackById?.(Number(id.slice(PREFIX.length)), {
          origin: 'user',
        });
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    },
    stop() {
      const viewer = getManager()?.viewer;
      stop?.();
      stop = null;
      clicks?.destroy();
      clicks = null;
      if (icons) viewer?.scene?.primitives?.remove(icons);
      icons = null;
      byId = new Map();
    },
  };
}
