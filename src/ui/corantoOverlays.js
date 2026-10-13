import * as Cesium from 'cesium';
import {
  DISEASE_LEVEL_ALPHA,
  SILENCE_STYLE,
  diseaseCard,
  outbreakAreas,
  silenceCard,
  squaresOver,
} from './corantoOverlayModel.js';

const REFRESH_MS = 10 * 60 * 1000;
/** Disease squares, in degrees: large enough to read from orbit. */
const SQUARE_DEG = 2;

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
  const sources = { silence: null, disease: null };
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

  async function drawDisease() {
    const source = sourceFor('disease');
    if (!source) return;
    const [relief, cdc, countries] = await Promise.all([
      read('/api/relief').catch(() => null),
      read('/api/outbreaks').catch(() => null),
      loadShapes('countries'),
    ]);
    if (!on.disease) return;
    clear('disease');
    if (!relief && !cdc) {
      status.disease = { ok: false, count: 0, families: [] };
      diseaseAreas = [];
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
    const byCountry = new Map();
    for (const area of diseaseAreas) {
      if (!countries[area.iso2]) continue;
      byCountry.set(area.iso2, [...(byCountry.get(area.iso2) ?? []), area]);
    }
    for (const [iso2, areas] of byCountry) {
      const id = `disease:${iso2}`;
      picked.set(id, () => diseaseCard(areas[0].country, areas));
      // One square per grid cell; a country with several outbreaks shows
      // them side by side, square by square.
      squaresOver(countries[iso2].rings, SQUARE_DEG).forEach(
        ([lon, lat], index) => {
          const area = areas[index % areas.length];
          source.entities.add({
            id: `${id}#${index}`,
            rectangle: {
              coordinates: Cesium.Rectangle.fromDegrees(
                lon + 0.08,
                lat + 0.08,
                lon + SQUARE_DEG - 0.08,
                lat + SQUARE_DEG - 0.08,
              ),
              material: Cesium.Color.fromCssColorString(
                area.family.colour,
              ).withAlpha(DISEASE_LEVEL_ALPHA[area.level]),
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              zIndex: 1,
            },
          });
        },
      );
    }
    status.disease = {
      ok: Boolean(relief) && Boolean(cdc) && !relief.stale && !cdc.stale,
      count: byCountry.size,
      families: [
        ...new Map(
          diseaseAreas.map((area) => [area.family.id, area.family]),
        ).values(),
      ],
    };
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
        if (sources[name]) sources[name].show = true;
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
      const viewer = getViewer();
      for (const name of ['silence', 'disease'])
        if (sources[name]) viewer?.dataSources.remove(sources[name], true);
    },
  };
}
