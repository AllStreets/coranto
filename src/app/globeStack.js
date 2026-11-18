/**
 * Coranto's own globe layers sit directly above the base map, in a fixed
 * order, and under every data overlay. The map controller keeps the base
 * map at index 0 and swaps it on a stack change; each of these layers is
 * tagged with its role and put back in place afterwards.
 *
 * @module app/globeStack
 */

/** Role of the whole-Earth underlay pinned beneath the base map. */
export const POLAR_UNDERLAY_ROLE = 'polar-underlay';

/** Bottom to top, just above the base map. */
export const OVER_BASE_ORDER = Object.freeze([
  'blue-marble',
  'polar-marble',
  'city-lights',
  'polar-lights',
]);

/**
 * Web Mercator imagery stops at 85.0511 degrees. Polar caps start a hair
 * inside that so the cap and the map meet with no gap.
 */
export const POLAR_CAP_EDGE = 85;

export const GIBS_GEOGRAPHIC_WMS =
  'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';

/**
 * The polar caps of a NASA GIBS layer, from its geographic (EPSG:4326)
 * edition, which reaches both poles. The same imagery as the Web Mercator
 * layer it completes, so the two meet without a seam. Each cap requests
 * only its own tiles, a few near each pole.
 *
 * @param {object} Cesium The Cesium namespace.
 * @param {object} options
 * @param {string} options.gibsLayer The GIBS layer identifier.
 * @param {string} options.format 'image/jpeg' or 'image/png'.
 * @param {string} options.role The OVER_BASE_ORDER role for both caps.
 * @param {string} options.credit
 * @param {object} [options.layerOptions] ImageryLayer options (alpha and so on).
 * @returns {object[]} The north and south cap layers.
 */
export function createPolarCaps(
  Cesium,
  { gibsLayer, format, role, credit, layerOptions = {} },
) {
  const caps = [
    Cesium.Rectangle.fromDegrees(-180, POLAR_CAP_EDGE, 180, 90),
    Cesium.Rectangle.fromDegrees(-180, -90, 180, -POLAR_CAP_EDGE),
  ];
  return caps.map((rectangle) => {
    const provider = new Cesium.WebMapServiceImageryProvider({
      url: GIBS_GEOGRAPHIC_WMS,
      layers: gibsLayer,
      parameters: { format, transparent: format === 'image/png' },
      rectangle,
      maximumLevel: 7,
      credit,
    });
    return tagLayer(
      new Cesium.ImageryLayer(provider, { ...layerOptions, rectangle }),
      role,
    );
  });
}

/** Mark a layer with its role in OVER_BASE_ORDER. */
export function tagLayer(layer, role) {
  layer.corantoRole = role;
  return layer;
}

function moveTo(layers, layer, index) {
  const top = layers.length - 1;
  const target = Math.min(index, top);
  while (layers.indexOf(layer) > target) layers.lower(layer);
  while (layers.indexOf(layer) < target) layers.raise(layer);
}

/** Put every tagged layer in its slot, starting just above the base map. */
export function placeOverBase(layers) {
  const tagged = [];
  for (let i = 0; i < layers.length; i++) {
    const layer = layers.get(i);
    if (OVER_BASE_ORDER.includes(layer.corantoRole)) tagged.push(layer);
  }
  tagged.sort(
    (a, b) =>
      OVER_BASE_ORDER.indexOf(a.corantoRole) -
      OVER_BASE_ORDER.indexOf(b.corantoRole),
  );
  // The polar underlay, when present, holds index 0 beneath everything.
  let underlays = 0;
  for (let i = 0; i < layers.length; i++)
    if (layers.get(i).corantoRole === POLAR_UNDERLAY_ROLE) underlays++;
  // With no base map under them, they start just above the underlay.
  const hasBase = layers.length > tagged.length + underlays;
  let slot = underlays + (hasBase ? 1 : 0);
  for (const layer of tagged) moveTo(layers, layer, slot++);
}

/**
 * Pin a whole-Earth layer under the base map so the poles are real imagery.
 *
 * Web Mercator base maps (Esri, Blue Marble from GIBS) stop at 85.05 degrees.
 * Cesium stretches the bottom imagery layer to fill any tile it does not
 * cover, so with a Mercator map at index 0 the top row of pixels is smeared
 * across each polar cap as a fan of streaks. Cesium's bundled Natural Earth II
 * is geographic and covers both poles; held at index 0 it fills the caps, and
 * the base map above it is no longer stretched. Elsewhere the base map covers
 * it completely, so nothing else changes. It ships with Cesium: no network,
 * no key, three small levels.
 *
 * @param {object} viewer A Cesium Viewer.
 * @param {object} Cesium The Cesium namespace.
 * @returns {() => void} Removes the underlay and its listener.
 */
export function installPolarUnderlay(viewer, Cesium) {
  const layers = viewer.imageryLayers;
  const layer = tagLayer(
    Cesium.ImageryLayer.fromProviderAsync(
      Cesium.TileMapServiceImageryProvider.fromUrl(
        Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
      ),
    ),
    POLAR_UNDERLAY_ROLE,
  );
  layers.add(layer, 0);
  // The map controller inserts each new base map at index 0; push the
  // underlay back beneath it in the same call, before a frame is drawn.
  const keepAtBottom = () => {
    if (layers.contains(layer) && layers.indexOf(layer) !== 0)
      layers.lowerToBottom(layer);
  };
  const stopListening = layers.layerAdded.addEventListener(keepAtBottom);
  return () => {
    stopListening();
    if (!viewer.isDestroyed?.() && layers.contains(layer))
      layers.remove(layer, true);
  };
}

/**
 * Paint over a dark column at the dateline edge of a Web Mercator layer.
 *
 * NASA's Black Marble tiles from GIBS (EPSG:3857) carry a darker first
 * column at -180 degrees and a darker last column at +180; where the two
 * meet the globe shows a thin dark line down the 180th meridian. Only the
 * tiles touching the dateline are touched: each of their edge columns is
 * replaced by its neighbour, so the layer reads continuously across it.
 * Every other tile passes through untouched.
 *
 * @param {object} provider A Cesium imagery provider (Web Mercator tiling).
 * @param {object} [options]
 * @param {Document} [options.document]
 * @returns {object} The same provider.
 */
export function repairDatelineEdges(
  provider,
  { document: doc = globalThis.document } = {},
) {
  const request = provider.requestImage.bind(provider);
  provider.requestImage = (x, y, level, req) => {
    const pending = request(x, y, level, req);
    if (!pending || !doc?.createElement) return pending;
    const last = provider.tilingScheme.getNumberOfXTilesAtLevel(level) - 1;
    if (x !== 0 && x !== last) return pending;
    return Promise.resolve(pending).then((image) =>
      copyEdgeColumns(doc, image, x === 0, x === last),
    );
  };
  return provider;
}

function copyEdgeColumns(doc, image, left, right) {
  const width = image?.width;
  const height = image?.height;
  if (!(width > 2) || !(height > 0)) return image;
  const canvas = doc.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return image;
  context.drawImage(image, 0, 0);
  if (left) context.drawImage(canvas, 1, 0, 1, height, 0, 0, 1, height);
  if (right)
    context.drawImage(canvas, width - 2, 0, 1, height, width - 1, 0, 1, height);
  return canvas;
}
