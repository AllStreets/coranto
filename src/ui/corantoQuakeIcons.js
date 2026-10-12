import * as Cesium from 'cesium';
import { markerImage } from '../data/corantoIcons.js';
import { cullBeyondHorizon } from './corantoHorizon.js';

/**
 * Earthquake icons. The engine draws each quake as a circle on the ground
 * whose true radius grows with magnitude, which is right up close and nearly
 * invisible from orbit. These icons sit over the same quakes so they can be
 * found at any zoom; the circles stay underneath.
 *
 * Every row is the engine's own, read from the USGS feed it already holds.
 */
const PREFIX = 'quake-icon:';
const REFRESH_MS = 20_000;

/** Icon size and colour by magnitude. Three steps, as the map key lists them. */
export function quakeStyle(magnitude) {
  if (magnitude >= 6) return { size: 32, colour: '#ff4d5e', tier: 'major' };
  if (magnitude >= 4.5)
    return { size: 26, colour: '#fb923c', tier: 'moderate' };
  return { size: 20, colour: '#f2c14e', tier: 'minor' };
}

/** The card for one quake. The link is to USGS's own page for the event. */
export function quakeCard(record, now) {
  if (!record) return null;
  const magnitude = Number.isFinite(record.magnitude)
    ? `M${record.magnitude.toFixed(1)}`
    : 'Magnitude not given';
  const hours = Number.isFinite(record.timeMs)
    ? Math.max(0, (now - record.timeMs) / 3_600_000)
    : null;
  // Only ids USGS issued make a link; the engine's stand-in ids do not.
  const linked = /^[a-z]{2}[a-z0-9]+$/i.test(record.id ?? '');
  return {
    kind: 'EARTHQUAKE · USGS',
    title: `${magnitude}${record.place ? ` · ${record.place}` : ''}`,
    meta: [
      Number.isFinite(record.depthKm)
        ? `${record.depthKm.toFixed(0)} km deep`
        : '',
      hours === null
        ? ''
        : hours < 1
          ? `${Math.round(hours * 60)} min ago`
          : `${hours.toFixed(0)} h ago`,
      Number.isFinite(record.timeMs)
        ? `${new Date(record.timeMs).toISOString().slice(0, 16).replace('T', ' ')} UTC`
        : '',
      'US Geological Survey',
    ]
      .filter(Boolean)
      .join(' · '),
    url: linked
      ? `https://earthquake.usgs.gov/earthquakes/eventpage/${record.id}`
      : '',
    linkText: 'Open the event at usgs.gov',
  };
}

/**
 * @param {object} options
 * @param {() => object|null} options.getManager The layer manager.
 * @param {(detail: object|null) => void} options.showCard
 */
export function createQuakeIcons({ getManager, showCard }) {
  let icons = null;
  let stopCulling = null;
  let clicks = null;
  let timer = null;
  let records = new Map();
  let signature = '';

  const layer = () => getManager()?.layers?.get('earthquakes')?.module ?? null;

  function draw(viewer) {
    if (!icons) return;
    const rows = (layer()?.getAnalystRecords?.(600) ?? []).filter(
      (row) => Number.isFinite(row.lat) && Number.isFinite(row.lon),
    );
    const next = rows.map((row) => `${row.id}:${row.magnitude}`).join('|');
    if (next === signature) return;
    signature = next;
    records = new Map(rows.map((row) => [row.id, row]));
    icons.removeAll();
    // Strongest last, so it is drawn on top where quakes cluster.
    for (const row of [...rows].sort(
      (a, b) => (a.magnitude ?? 0) - (b.magnitude ?? 0),
    )) {
      const style = quakeStyle(row.magnitude ?? 0);
      icons.add({
        id: PREFIX + row.id,
        position: Cesium.Cartesian3.fromDegrees(row.lon, row.lat, 1500),
        image: markerImage({ icon: 'earthquake', colour: style.colour }),
        width: style.size,
        height: style.size,
        disableDepthTestDistance: 50_000,
      });
    }
    viewer.scene.requestRender?.();
  }

  return {
    get shown() {
      return icons !== null;
    },
    count: () => records.size,
    start() {
      const viewer = getManager()?.viewer;
      if (!viewer || icons) return;
      icons = new Cesium.BillboardCollection({ scene: viewer.scene });
      viewer.scene.primitives.add(icons);
      stopCulling = cullBeyondHorizon(viewer, icons);
      signature = '';
      draw(viewer);
      // The layer fills in after it is switched on; look again shortly.
      timer = setInterval(() => draw(viewer), REFRESH_MS);
      setTimeout(() => draw(viewer), 2500);
      clicks = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      clicks.setInputAction((click) => {
        const id = viewer.scene.pick(click.position)?.id;
        if (typeof id !== 'string' || !id.startsWith(PREFIX)) return;
        const detail = quakeCard(
          records.get(id.slice(PREFIX.length)),
          Date.now(),
        );
        if (detail) showCard(detail);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    },
    stop() {
      const viewer = getManager()?.viewer;
      clearInterval(timer);
      timer = null;
      stopCulling?.();
      stopCulling = null;
      clicks?.destroy();
      clicks = null;
      if (icons) viewer?.scene?.primitives?.remove(icons);
      icons = null;
      records = new Map();
      viewer?.scene?.requestRender?.();
    },
  };
}
