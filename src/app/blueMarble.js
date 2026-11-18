/**
 * The Blue Marble globe: NASA's Blue Marble with shaded relief and ocean
 * depth, the AUSPEX planet, shown when the whole Earth is in view.
 *
 * Close-up clarity comes first. Blue Marble is 500 m imagery, so it fades
 * into the base map as the camera comes down and is switched off entirely
 * below continent scale. From there in, every view is the full-detail base
 * map, exactly as without it.
 *
 * It sits on the globe's own imagery, never on Google Photorealistic 3D
 * Tiles; with that stack active the globe is hidden and nothing changes.
 *
 * @module app/blueMarble
 */

import { createPolarCaps, placeOverBase, tagLayer } from './globeStack.js';
import { smoothRamp } from './dayNight.js';

/** Below this camera height only the base map shows (metres). */
export const BLUE_MARBLE_GONE_BELOW = 2_500_000;
/** Above this height Blue Marble shows at full strength (metres). */
export const BLUE_MARBLE_FULL_ABOVE = 6_000_000;

export const BLUE_MARBLE_URL =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/2004-08-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg';
export const BLUE_MARBLE_CREDIT =
  'Blue Marble: NASA Earth Observatory (shaded relief and bathymetry) via NASA GIBS';

/** How visible Blue Marble is at a camera height in metres. */
export function blueMarbleAlpha(height) {
  return smoothRamp(height, BLUE_MARBLE_GONE_BELOW, BLUE_MARBLE_FULL_ABOVE);
}

function createBlueMarbleLayer(Cesium) {
  const provider = new Cesium.UrlTemplateImageryProvider({
    url: BLUE_MARBLE_URL,
    maximumLevel: 8,
    credit: BLUE_MARBLE_CREDIT,
  });
  const layer = new Cesium.ImageryLayer(provider, { alpha: 0, show: false });
  return tagLayer(layer, 'blue-marble');
}

/**
 * Esri's ocean beside the cap is teal, Blue Marble's is navy. As Blue Marble
 * fades out the caps take on Esri's tone, so they meet the base map without
 * an edge at every height: untouched at globe scale, matched up close.
 * Measured on the Arctic Ocean at 85 degrees north.
 */
export const POLAR_CAP_TO_BASE = Object.freeze({
  hue: 0.28,
  saturation: 0.7,
  brightness: 1.6,
});

/** Colour adjustments for the polar caps at a Blue Marble alpha. */
export function polarCapTone(alpha) {
  const t = 1 - Math.min(1, Math.max(0, Number(alpha) || 0));
  return {
    hue: POLAR_CAP_TO_BASE.hue * t,
    saturation: 1 + (POLAR_CAP_TO_BASE.saturation - 1) * t,
    brightness: 1 + (POLAR_CAP_TO_BASE.brightness - 1) * t,
  };
}

/**
 * Blue Marble over the polar caps, past the Mercator edge. Always at full
 * strength while Blue Marble is on: at globe scale it matches the layer
 * beside it, and closer in there is no other imagery of the poles to show,
 * so it is toned to the base map instead (polarCapTone).
 */
function createBlueMarbleCaps(Cesium) {
  return createPolarCaps(Cesium, {
    gibsLayer: 'BlueMarble_ShadedRelief_Bathymetry',
    format: 'image/jpeg',
    role: 'polar-marble',
    credit: BLUE_MARBLE_CREDIT,
  });
}

/**
 * Switch the Blue Marble globe on or off for a viewer.
 *
 * @param {object} viewer A Cesium Viewer.
 * @param {object} options
 * @param {object} options.Cesium The Cesium namespace.
 * @param {Function} [options.requestRender]
 * @param {object} [options.win] The event target for map stack changes.
 * @returns {{ setEnabled(on: boolean): void, isEnabled(): boolean, update(): void, destroy(): void }}
 */
export function createBlueMarble(
  viewer,
  {
    Cesium,
    requestRender = () => viewer?.scene?.requestRender?.(),
    win = globalThis.window ?? globalThis,
  },
) {
  const scene = viewer.scene;
  let layer = null;
  let caps = [];
  let removeListener = null;

  const onStackChanged = () => {
    if (layer && viewer.imageryLayers.contains(layer))
      placeOverBase(viewer.imageryLayers);
    requestRender();
  };

  /** Fade with height; below continent scale it is off and loads nothing. */
  function updateAlpha() {
    if (!layer) return;
    const alpha = blueMarbleAlpha(viewer.camera.positionCartographic?.height);
    if (layer.alpha !== alpha) layer.alpha = alpha;
    const show = alpha > 0;
    if (layer.show !== show) layer.show = show;
    const tone = polarCapTone(alpha);
    for (const cap of caps) Object.assign(cap, tone);
  }

  function enable() {
    layer = createBlueMarbleLayer(Cesium);
    viewer.imageryLayers.add(layer);
    caps = createBlueMarbleCaps(Cesium);
    for (const cap of caps) viewer.imageryLayers.add(cap);
    placeOverBase(viewer.imageryLayers);
    updateAlpha();
    // Every drawn frame, before it draws: a height check, nothing more.
    removeListener = scene.preRender.addEventListener(updateAlpha);
    win.addEventListener?.('gev:map-stack-changed', onStackChanged);
    requestRender();
  }

  function disable() {
    win.removeEventListener?.('gev:map-stack-changed', onStackChanged);
    removeListener?.();
    removeListener = null;
    for (const each of [layer, ...caps])
      if (each && viewer.imageryLayers.contains(each))
        viewer.imageryLayers.remove(each, true);
    layer = null;
    caps = [];
    requestRender();
  }

  return {
    setEnabled(on) {
      if (Boolean(on) === Boolean(layer) || viewer.isDestroyed?.()) return;
      if (on) enable();
      else disable();
    },
    isEnabled: () => Boolean(layer),
    update: updateAlpha,
    destroy() {
      if (layer && !viewer.isDestroyed?.()) disable();
      layer = null;
    },
  };
}
