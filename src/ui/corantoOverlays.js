import * as Cesium from 'cesium';
import {
  clearOverlaySource,
  setOverlayEntries,
  setOverlaySourceVisible,
} from '../overlays/worldOverlay.js';
import {
  DISEASE_LEVEL_ALPHA,
  SILENCE_STYLE,
  diseaseCallout,
  diseaseCard,
  diseaseDrawing,
  outbreakAreas,
  silenceCard,
} from './corantoOverlayModel.js';

const REFRESH_MS = 10 * 60 * 1000;
/** Disease squares, in degrees: large enough to read from orbit. */
const SQUARE_DEG = 2;
/** Below this camera height the grid gives way to points and cards. */
const DISEASE_NEAR_M = 3_200_000;
/** A point's glow, in pixels, by level. */
const DISEASE_GLOW_PX = Object.freeze({ 1: 46, 2: 64, 3: 86 });
const DISEASE_CARDS_ID = 'coranto-disease';

/**
 * Coranto's SILENCE and DISEASE layers. Both are drawn on the ground itself,
 * under every name, icon and marker, so nothing on the globe is hidden by
 * them; a click that lands on bare ground inside one opens its card.
 *
 * SILENCE fills, in AUSPEX's black with a red line, the countries and
 * regions where IODA measures the internet far below its normal level now.
 * DISEASE covers countries under an official outbreak notice with squares,
 * coloured by how the disease spreads and darker for a higher level.
 *
 * @param {object} options
 * @param {Window} options.win
 * @param {() => object|null} options.getViewer
 * @param {() => object[]} options.getArticles current headlines
 * @param {(detail: object|null) => void} options.showCard
 * @param {() => void} [options.onChange] a layer switched or its data changed
 */
export function createOverlays({
  win,
  getViewer,
  getArticles,
  showCard,
  onChange = () => {},
}) {
  const on = { silence: false, disease: false };
  const status = { silence: null, disease: null };
  const sources = { silence: null, disease: null, diseasePoints: null };
  const picked = new Map();
  let shapes = { countries: null, regions: null };
  let diseaseAreas = [];
  let clicks = null;
  let timer = 0;

  async function read(path) {
    const response = await win.fetch(path, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  }
  async function loadShapes(kind) {
    shapes[kind] ??= read(`/coranto-atlas/shapes-${kind}.json`).then(
      (file) => file.shapes,
      () => {
        shapes[kind] = null;
        return {};
      },
    );
    return shapes[kind];
  }
  function sourceFor(name) {
    const viewer = getViewer();
    if (!viewer) return null;
    if (!sources[name]) {
      sources[name] = new Cesium.CustomDataSource(`coranto-${name}`);
      viewer.dataSources.add(sources[name]);
    }
    return sources[name];
  }
  function clear(name) {
    sources[name]?.entities.removeAll();
    for (const key of [...picked.keys()])
      if (key.startsWith(`${name}:`)) picked.delete(key);
  }
  const positions = (ring) => Cesium.Cartesian3.fromDegreesArray(ring.flat());

  async function drawSilence() {
    const source = sourceFor('silence');
    if (!source) return;
    let payload;
    try {
      payload = await read('/api/silence');
    } catch {
      status.silence = { ok: false, count: 0 };
      clear('silence');
      return;
    }
    const places = payload.places ?? [];
    const needsRegions = places.some((place) => place.type === 'region');
    const [countries, regions] = await Promise.all([
      loadShapes('countries'),
      needsRegions ? loadShapes('regions') : {},
    ]);
    if (!on.silence) return;
    clear('silence');
    let drawn = 0;
    for (const place of places) {
      const shape = (place.type === 'country' ? countries : regions)[
        place.code
      ];
      if (!shape) continue;
      const style = SILENCE_STYLE[place.tier] ?? SILENCE_STYLE.major;
      const id = `silence:${place.type}/${place.code}`;
      picked.set(id, () => silenceCard(place));
      shape.rings.forEach((ring, index) => {
        source.entities.add({
          id: index ? `${id}#${index}` : id,
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(positions(ring)),
            material: Cesium.Color.fromCssColorString(style.fill),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            classificationType: Cesium.ClassificationType.BOTH,
            zIndex: 2,
          },
          polyline: {
            positions: positions(ring),
            width: 2,
            material: Cesium.Color.fromCssColorString(style.line),
            clampToGround: true,
            zIndex: 3,
          },
        });
      });
      drawn += 1;
    }
    status.silence = {
      ok: !payload.stale,
      count: drawn,
      blackouts: places.filter((place) => place.tier === 'blackout').length,
    };
  }

  // DISEASE draws as FIRES does: a grid of heat from afar, and from close
  // up a glowing point on each place with a card beside it.
  let diseaseSpots = [];
  let diseaseNear = null;
  let stopWatchingZoom = null;
  const glowCache = new Map();
  /** A soft radial glow in the disease family's colour, as fires have. */
  function glowImage(colour, size) {
    const key = `${colour}:${size}`;
    if (glowCache.has(key)) return glowCache.get(key);
    const canvas = win.document.createElement('canvas');
    canvas.width = size * 2;
    canvas.height = size * 2;
    const context = canvas.getContext('2d');
    if (!context) return '';
    const { red, green, blue } = Cesium.Color.fromCssColorString(colour);
    const rgb = [red, green, blue].map((v) => Math.round(v * 255)).join(',');
    const gradient = context.createRadialGradient(
      size,
      size,
      0,
      size,
      size,
      size,
    );
    gradient.addColorStop(0, 'rgba(255,255,245,0.95)');
    gradient.addColorStop(0.22, `rgba(${rgb},0.92)`);
    gradient.addColorStop(0.55, `rgba(${rgb},0.38)`);
    gradient.addColorStop(1, `rgba(${rgb},0)`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, size * 2, size * 2);
    const image = canvas.toDataURL('image/png');
    glowCache.set(key, image);
    return image;
  }
  /** Far: the grid. Near: the points and their cards. */
  function applyDiseaseZoom(force = false) {
    const viewer = getViewer();
    if (!viewer || !sources.disease) return;
    const near =
      on.disease && viewer.camera.positionCartographic.height < DISEASE_NEAR_M;
    if (!force && near === diseaseNear) return;
    diseaseNear = near;
    if (sources.disease) sources.disease.show = on.disease && !near;
    if (sources.diseasePoints) sources.diseasePoints.show = on.disease && near;
    setOverlaySourceVisible(DISEASE_CARDS_ID, on.disease && near);
    if (on.disease && near)
      setOverlayEntries(
        DISEASE_CARDS_ID,
        diseaseSpots.map((spot) => {
          const callout = diseaseCallout(spot);
          return {
            id: spot.id,
            position: Cesium.Cartesian3.fromDegrees(spot.lon, spot.lat),
            title: callout.title,
            details: [callout.detail],
            accent: spot.family.colour,
            priority: spot.level * 1000 + spot.areas.length,
            selected: false,
            variant: 'card',
            cardStyle: 'tactical',
            collisionGroup: 'ambient-card',
            gapPx: 12 + DISEASE_GLOW_PX[spot.level] / 2,
            leaderOffsetPx: 6,
            verticalOnly: true,
            viewportMargin: 4,
            edgeFade: 'keyhole',
            horizonCull: true,
            terrainOcclusion: false,
            interactive: true,
            accessibilityLabel: `Open ${callout.title}, ${callout.detail}`,
            activate: () => {
              const detail = picked.get(spot.id)?.();
              if (detail) showCard(detail);
              return true;
            },
          };
        }),
        { cohortLimit: 24, collisionCapacity: 24, moving: false },
      );
    else clearOverlaySource(DISEASE_CARDS_ID);
    viewer.scene.requestRender?.();
  }

  async function drawDisease() {
    const source = sourceFor('disease');
    const points = sourceFor('diseasePoints');
    if (!source || !points) return;
    const [relief, cdc, countries] = await Promise.all([
      read('/api/relief').catch(() => null),
      read('/api/outbreaks').catch(() => null),
      loadShapes('countries'),
    ]);
    if (!on.disease) return;
    if (!relief && !cdc) {
      clear('disease');
      points.entities.removeAll();
      status.disease = { ok: false, count: 0, families: [] };
      diseaseAreas = [];
      diseaseSpots = [];
      applyDiseaseZoom(true);
      return;
    }
    diseaseAreas = outbreakAreas({
      who: relief?.outbreaks ?? [],
      notices: cdc?.notices ?? [],
      articles: getArticles() ?? [],
      countries: Object.entries(countries).map(([iso2, shape]) => ({
        iso2,
        name: shape.name,
      })),
    });
    // Province outlines are read only when a notice names a province.
    const wantsRegions = diseaseAreas.some((area) =>
      (area.places ?? []).some((place) =>
        /provinc|state|region|district|department|governorate|count|prefecture|oblast|territor/i.test(
          place.text,
        ),
      ),
    );
    const regions = wantsRegions ? await loadShapes('regions') : {};
    if (!on.disease) return;
    const drawing = diseaseDrawing(
      diseaseAreas,
      countries,
      regions,
      SQUARE_DEG,
    );
    clear('disease');
    points.entities.removeAll();
    diseaseSpots = drawing.spots;
    for (const spot of diseaseSpots) {
      picked.set(spot.id, () =>
        diseaseCard(
          spot.name === spot.country
            ? spot.country
            : `${spot.name}, ${spot.country}`,
          [...spot.areas].sort((a, b) => b.level - a.level),
        ),
      );
      const size = DISEASE_GLOW_PX[spot.level];
      points.entities.add({
        id: `${spot.id}#glow`,
        position: Cesium.Cartesian3.fromDegrees(spot.lon, spot.lat),
        billboard: {
          image: glowImage(spot.family.colour, size),
          width: size,
          height: size,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: 50_000,
        },
      });
    }
    // A country with no point of its own (one that spans the date line)
    // still answers a click on its squares.
    for (const cell of drawing.cells)
      if (!picked.has(cell.owner)) {
        const iso2 = cell.owner.slice('disease:'.length, 'disease:'.length + 2);
        const areas = diseaseAreas.filter((area) => area.iso2 === iso2);
        if (areas.length)
          picked.set(cell.owner, () => diseaseCard(areas[0].country, areas));
      }
    // The grid: squares that meet edge to edge, as the fire grid's do, in
    // the colour of how the disease spreads and deeper for a higher level.
    drawing.cells.forEach((cell, index) => {
      source.entities.add({
        id: `${cell.owner}#${index}`,
        rectangle: {
          coordinates: Cesium.Rectangle.fromDegrees(
            cell.lon,
            cell.lat,
            cell.lon + SQUARE_DEG,
            cell.lat + SQUARE_DEG,
          ),
          material: Cesium.Color.fromCssColorString(
            cell.family.colour,
          ).withAlpha(DISEASE_LEVEL_ALPHA[cell.level]),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          zIndex: 1,
        },
      });
    });
    status.disease = {
      ok: Boolean(relief) && Boolean(cdc) && !relief.stale && !cdc.stale,
      count: new Set(diseaseSpots.map((spot) => spot.iso2)).size,
      families: [
        ...new Map(
          diseaseAreas.map((area) => [area.family.id, area.family]),
        ).values(),
      ],
    };
    stopWatchingZoom ??= getViewer()?.scene.preRender.addEventListener(() =>
      applyDiseaseZoom(),
    );
    applyDiseaseZoom(true);
  }

  const DRAW = { silence: drawSilence, disease: drawDisease };

  function watchClicks() {
    const viewer = getViewer();
    if (clicks || !viewer) return;
    clicks = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    clicks.setInputAction((click) => {
      // Only bare ground answers: a marker, name or icon on top keeps the
      // click. Where both layers cover the spot, the blackout answers.
      const top = viewer.scene.pick(click.position)?.id;
      const topId = typeof top === 'string' ? top : top?.id;
      if (typeof topId !== 'string' || !picked.has(topId.split('#')[0])) return;
      const ids = viewer.scene
        .drillPick(click.position, 6)
        .map((hit) => (typeof hit.id === 'string' ? hit.id : hit.id?.id))
        .filter((id) => typeof id === 'string')
        .map((id) => id.split('#')[0])
        .filter((id) => picked.has(id));
      const id = ids.find((entry) => entry.startsWith('silence:')) ?? ids[0];
      const detail = picked.get(id ?? topId.split('#')[0])?.();
      if (detail) showCard(detail);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  async function refresh(name) {
    await DRAW[name]();
    // A blackout is drawn over the disease squares, never under them.
    const viewer = getViewer();
    if (sources.silence && viewer?.dataSources.contains(sources.silence))
      viewer.dataSources.raiseToTop(sources.silence);
    getViewer()?.scene.requestRender?.();
    onChange();
  }

  return {
    isOn: (name) => Boolean(on[name]),
    /** What the layer last drew: null before it has, else `{ok, count}`. */
    status: (name) => status[name],
    /** The outbreaks the DISEASE layer is showing, for the map key. */
    diseaseAreas: () => diseaseAreas,
    async set(name, value) {
      if (!(name in on) || on[name] === Boolean(value)) return on[name];
      on[name] = Boolean(value);
      if (on[name]) {
        watchClicks();
        if (sources[name] && name !== 'disease') sources[name].show = true;
        await refresh(name);
        if (!timer)
          timer = win.setInterval(() => {
            for (const layer of ['silence', 'disease'])
              if (on[layer]) refresh(layer);
          }, REFRESH_MS);
      } else {
        clear(name);
        status[name] = null;
        if (sources[name]) sources[name].show = false;
        if (name === 'disease') {
          sources.diseasePoints?.entities.removeAll();
          diseaseSpots = [];
          applyDiseaseZoom(true);
        }
        if (!on.silence && !on.disease) {
          win.clearInterval(timer);
          timer = 0;
        }
        getViewer()?.scene.requestRender?.();
        onChange();
      }
      return on[name];
    },
    /** New headlines can change an outbreak's level. */
    setArticles() {
      if (on.disease) refresh('disease');
    },
    destroy() {
      win.clearInterval(timer);
      clicks?.destroy();
      stopWatchingZoom?.();
      clearOverlaySource(DISEASE_CARDS_ID);
      const viewer = getViewer();
      for (const name of ['silence', 'disease', 'diseasePoints'])
        if (sources[name]) viewer?.dataSources.remove(sources[name], true);
    },
  };
}
