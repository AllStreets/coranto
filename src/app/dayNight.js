/**
 * Real day and night on the globe: sunlight from where the sun actually is
 * this minute, a dark night side, and NASA's Black Marble city lights where
 * it is night.
 *
 * Close-up clarity comes first. Cesium fades the shading out as the camera
 * comes down (`lightingFadeOutDistance`), but it does not fade a night
 * imagery layer, so the city lights are faded here by camera height: from
 * continent scale down, the globe is the normal full-detail imagery, and a
 * city at night looks exactly as it does by day.
 *
 * The app clock is left alone (flights and the moon read it); the scene gets
 * its own directional light, turned once a minute.
 *
 * Google Photorealistic 3D Tiles carry daylight baked into their textures
 * and hide the globe, so with that stack active none of this is visible and
 * nothing about the tiles changes.
 *
 * @module app/dayNight
 */

import { placeOverBase, tagLayer } from './globeStack.js';

/** Below this camera height the globe is plain daylight imagery (metres). */
export const DAY_NIGHT_CLEAR_BELOW = 3_000_000;
/** Above this height day and night show at full strength (metres). */
export const DAY_NIGHT_FULL_ABOVE = 10_000_000;
/** City lights start to show above this height (metres). */
export const CITY_LIGHTS_FROM = 4_000_000;
/** City lights are at full strength above this height (metres). */
export const CITY_LIGHTS_FULL = 8_000_000;
/** Makes up for the 30% light Cesium leaves on the night side. */
export const CITY_LIGHTS_BRIGHTNESS = 3.2;
/** How often the sun moves (ms). It covers a quarter of a degree a minute. */
export const SUN_TICK_MS = 60_000;

export const CITY_LIGHTS_URL =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png';
export const CITY_LIGHTS_CREDIT =
  'City lights: NASA Black Marble (VIIRS, 2016) via NASA GIBS';

/** 0 at or below `from`, 1 at or above `to`, smooth in between. */
export function smoothRamp(value, from, to) {
  if (!Number.isFinite(value)) return 0;
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/** How visible the city lights layer is at a camera height in metres. */
export function cityLightsAlpha(height) {
  return smoothRamp(height, CITY_LIGHTS_FROM, CITY_LIGHTS_FULL);
}

/**
 * The unit vector from Earth's centre toward the sun, in Earth-fixed
 * coordinates, for a JavaScript Date.
 */
export function sunDirectionFixed(Cesium, date = new Date()) {
  const time = Cesium.JulianDate.fromDate(date);
  const inertial =
    Cesium.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(
      time,
    );
  // TEME to pseudo-fixed is within a small fraction of a degree, well under
  // a pixel at globe scale, and unlike the ICRF transform it needs no Earth
  // orientation data to be downloaded first.
  const toFixed = Cesium.Transforms.computeTemeToPseudoFixedMatrix(time);
  const fixed = Cesium.Matrix3.multiplyByVector(
    toFixed,
    inertial,
    new Cesium.Cartesian3(),
  );
  return Cesium.Cartesian3.normalize(fixed, fixed);
}

/** The latitude and longitude where the sun is overhead, in degrees. */
export function subsolarPoint(Cesium, date = new Date()) {
  const d = sunDirectionFixed(Cesium, date);
  return {
    lat: Cesium.Math.toDegrees(Math.asin(d.z)),
    lon: Cesium.Math.toDegrees(Math.atan2(d.y, d.x)),
  };
}

function createCityLightsLayer(Cesium) {
  const provider = new Cesium.UrlTemplateImageryProvider({
    url: CITY_LIGHTS_URL,
    maximumLevel: 8,
    credit: CITY_LIGHTS_CREDIT,
  });
  // Cesium leaves the night side at 30% light, which would dim the lights
  // to almost nothing; the layer's own brightness makes up for it. Unlit
  // ground stays black, since only lit pixels get brighter.
  const layer = new Cesium.ImageryLayer(provider, {
    dayAlpha: 0,
    nightAlpha: 1,
    alpha: 0,
    brightness: CITY_LIGHTS_BRIGHTNESS,
  });
  return tagLayer(layer, 'city-lights');
}

/**
 * Switch real day and night on or off for a viewer.
 *
 * @param {object} viewer A Cesium Viewer.
 * @param {object} options
 * @param {object} options.Cesium The Cesium namespace.
 * @param {Function} [options.requestRender]
 * @param {() => Date} [options.now]
 * @param {object} [options.win] Supplies setInterval, clearInterval and the
 *   event target for map stack changes.
 * @returns {{ setEnabled(on: boolean): void, isEnabled(): boolean, update(): void, destroy(): void }}
 */
export function createDayNight(
  viewer,
  {
    Cesium,
    requestRender = () => viewer?.scene?.requestRender?.(),
    now = () => new Date(),
    win = globalThis.window ?? globalThis,
  },
) {
  const scene = viewer.scene;
  const globe = scene.globe;
  let enabled = false;
  let saved = null;
  let layer = null;
  let timer = null;
  let removeCameraListener = null;

  const onStackChanged = () => {
    placeLayer();
    requestRender();
  };

  /** Keep the city lights just above the base map, under every overlay. */
  function placeLayer() {
    if (layer && viewer.imageryLayers.contains(layer))
      placeOverBase(viewer.imageryLayers);
  }

  function updateSun() {
    if (!enabled) return;
    const toSun = sunDirectionFixed(Cesium, now());
    scene.light.direction = Cesium.Cartesian3.negate(
      toSun,
      scene.light.direction,
    );
  }

  function updateLightsAlpha() {
    if (!layer) return;
    const height = viewer.camera.positionCartographic?.height;
    const alpha = cityLightsAlpha(height);
    if (layer.alpha !== alpha) layer.alpha = alpha;
  }

  function enable() {
    saved = {
      light: scene.light,
      enableLighting: globe.enableLighting,
      lightingFadeOutDistance: globe.lightingFadeOutDistance,
      lightingFadeInDistance: globe.lightingFadeInDistance,
      nightFadeOutDistance: globe.nightFadeOutDistance,
      nightFadeInDistance: globe.nightFadeInDistance,
      dynamicAtmosphereLighting: globe.dynamicAtmosphereLighting,
      dynamicAtmosphereLightingFromSun: globe.dynamicAtmosphereLightingFromSun,
    };
    scene.light = new Cesium.DirectionalLight({
      direction: new Cesium.Cartesian3(1, 0, 0),
      intensity: 2.0,
    });
    enabled = true;
    updateSun();
    globe.enableLighting = true;
    globe.lightingFadeOutDistance = DAY_NIGHT_CLEAR_BELOW;
    globe.lightingFadeInDistance = DAY_NIGHT_FULL_ABOVE;
    // nightFade*Distance stay at Cesium's defaults: they set how far out the
    // night side turns into plain atmosphere, and the defaults keep the
    // ground and its lights visible until about 50,000 km.
    globe.dynamicAtmosphereLighting = true;
    globe.dynamicAtmosphereLightingFromSun = false;

    layer = createCityLightsLayer(Cesium);
    viewer.imageryLayers.add(layer);
    placeLayer();
    updateLightsAlpha();
    // Every drawn frame, before it draws: a height check, nothing more.
    removeCameraListener = scene.preRender.addEventListener(updateLightsAlpha);
    timer = win.setInterval(() => {
      updateSun();
      requestRender();
    }, SUN_TICK_MS);
    win.addEventListener?.('gev:map-stack-changed', onStackChanged);
    requestRender();
  }

  function disable() {
    enabled = false;
    if (timer !== null) win.clearInterval(timer);
    timer = null;
    win.removeEventListener?.('gev:map-stack-changed', onStackChanged);
    removeCameraListener?.();
    removeCameraListener = null;
    if (layer && viewer.imageryLayers.contains(layer))
      viewer.imageryLayers.remove(layer, true);
    layer = null;
    if (saved) {
      scene.light = saved.light;
      globe.enableLighting = saved.enableLighting;
      globe.lightingFadeOutDistance = saved.lightingFadeOutDistance;
      globe.lightingFadeInDistance = saved.lightingFadeInDistance;
      globe.nightFadeOutDistance = saved.nightFadeOutDistance;
      globe.nightFadeInDistance = saved.nightFadeInDistance;
      globe.dynamicAtmosphereLighting = saved.dynamicAtmosphereLighting;
      globe.dynamicAtmosphereLightingFromSun =
        saved.dynamicAtmosphereLightingFromSun;
      saved = null;
    }
    requestRender();
  }

  return {
    setEnabled(on) {
      if (Boolean(on) === enabled || viewer.isDestroyed?.()) return;
      if (on) enable();
      else disable();
    },
    isEnabled: () => enabled,
    update() {
      updateSun();
      updateLightsAlpha();
    },
    destroy() {
      if (enabled && !viewer.isDestroyed?.()) disable();
      enabled = false;
    },
  };
}
