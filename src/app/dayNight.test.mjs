import test from 'node:test';
import assert from 'node:assert/strict';
import * as Cesium from 'cesium';
import {
  CITY_LIGHTS_CREDIT,
  CITY_LIGHTS_FROM,
  CITY_LIGHTS_FULL,
  DAY_NIGHT_CLEAR_BELOW,
  DAY_NIGHT_FULL_ABOVE,
  cityLightsAlpha,
  createDayNight,
  smoothRamp,
  subsolarPoint,
} from './dayNight.js';

const near = (actual, expected, within, label) =>
  assert.ok(
    Math.abs(actual - expected) <= within,
    `${label}: ${actual} is not within ${within} of ${expected}`,
  );

test('the sun is overhead where it should be', () => {
  // March equinox 2026 is 20 Mar 14:46 UTC; at 12:00 UTC the sun is over
  // the equator, near the Greenwich meridian (equation of time about -7 min).
  const equinox = subsolarPoint(Cesium, new Date('2026-03-20T12:00:00Z'));
  near(equinox.lat, 0, 0.5, 'equinox latitude');
  near(equinox.lon, 2, 1.5, 'equinox longitude');
  // June solstice: over the Tropic of Cancer, and at 18:00 UTC over the Americas.
  const solstice = subsolarPoint(Cesium, new Date('2026-06-21T18:00:00Z'));
  near(solstice.lat, 23.44, 0.3, 'solstice latitude');
  near(solstice.lon, -90, 1.5, 'solstice longitude');
});

test('the sun moves west a quarter of a degree a minute', () => {
  const a = subsolarPoint(Cesium, new Date('2026-10-25T12:00:00Z'));
  const b = subsolarPoint(Cesium, new Date('2026-10-25T12:01:00Z'));
  near(a.lon - b.lon, 0.25, 0.01, 'degrees per minute');
});

test('city lights are gone up close and full from orbit', () => {
  assert.equal(cityLightsAlpha(5_500), 0); // the Chicago opening shot
  assert.equal(cityLightsAlpha(CITY_LIGHTS_FROM), 0);
  assert.equal(cityLightsAlpha(CITY_LIGHTS_FULL), 1);
  assert.equal(cityLightsAlpha(13_500_000), 1); // the whole-Earth view
  const mid = cityLightsAlpha((CITY_LIGHTS_FROM + CITY_LIGHTS_FULL) / 2);
  near(mid, 0.5, 1e-9, 'halfway');
  assert.equal(cityLightsAlpha(Number.NaN), 0);
  assert.ok(smoothRamp(5, 0, 10) > smoothRamp(4, 0, 10));
});

const tileLayer = () =>
  new Cesium.ImageryLayer(
    new Cesium.UrlTemplateImageryProvider({ url: 'https://example.test/{z}/{x}/{y}.png' }),
  );

function fakeViewer(height) {
  const scene = {
    light: new Cesium.SunLight(),
    globe: {
      enableLighting: false,
      lightingFadeOutDistance: 1,
      lightingFadeInDistance: 2,
      nightFadeOutDistance: 3,
      nightFadeInDistance: 4,
      dynamicAtmosphereLighting: true,
      dynamicAtmosphereLightingFromSun: false,
    },
    preRender: new Cesium.Event(),
  };
  const imageryLayers = new Cesium.ImageryLayerCollection();
  return {
    scene,
    imageryLayers,
    camera: { positionCartographic: { height } },
    isDestroyed: () => false,
  };
}

function fakeWindow() {
  const listeners = new Map();
  const intervals = new Set();
  return {
    intervals,
    listeners,
    setInterval(fn) {
      const id = Symbol('interval');
      intervals.add(id);
      return id;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
    addEventListener(type, fn) {
      listeners.set(type, fn);
    },
    removeEventListener(type, fn) {
      if (listeners.get(type) === fn) listeners.delete(type);
    },
  };
}

test('switching on lights the globe and adds city lights above the base map', () => {
  const viewer = fakeViewer(13_500_000);
  const base = tileLayer();
  const overlay = tileLayer();
  viewer.imageryLayers.add(base, 0);
  viewer.imageryLayers.add(overlay);
  const win = fakeWindow();
  const dn = createDayNight(viewer, {
    Cesium,
    win,
    requestRender: () => {},
    now: () => new Date('2026-06-21T18:00:00Z'),
  });
  dn.setEnabled(true);

  const globe = viewer.scene.globe;
  assert.equal(globe.enableLighting, true);
  assert.equal(globe.lightingFadeOutDistance, DAY_NIGHT_CLEAR_BELOW);
  assert.equal(globe.lightingFadeInDistance, DAY_NIGHT_FULL_ABOVE);
  assert.ok(viewer.scene.light instanceof Cesium.DirectionalLight);
  // The light travels from the sun: over the Americas at 18:00 UTC in June.
  const toSun = Cesium.Cartesian3.negate(
    viewer.scene.light.direction,
    new Cesium.Cartesian3(),
  );
  const lon = Cesium.Math.toDegrees(Math.atan2(toSun.y, toSun.x));
  near(lon, -90, 1.5, 'light longitude');

  assert.equal(viewer.imageryLayers.length, 3);
  assert.equal(viewer.imageryLayers.get(0), base);
  const lights = viewer.imageryLayers.get(1);
  assert.equal(viewer.imageryLayers.get(2), overlay);
  assert.equal(lights.dayAlpha, 0);
  assert.equal(lights.nightAlpha, 1);
  assert.equal(lights.alpha, 1);
  assert.equal(lights.imageryProvider.credit.html, CITY_LIGHTS_CREDIT);
  assert.equal(win.intervals.size, 1);

  // Zooming in to a city: the lights fade out before the frame draws.
  viewer.camera.positionCartographic.height = 5_500;
  viewer.scene.preRender.raiseEvent();
  assert.equal(lights.alpha, 0);
});

test('a new base map keeps the city lights just above it', () => {
  const viewer = fakeViewer(13_500_000);
  const win = fakeWindow();
  const first = tileLayer();
  viewer.imageryLayers.add(first, 0);
  const dn = createDayNight(viewer, { Cesium, win, requestRender: () => {} });
  dn.setEnabled(true);
  const lights = viewer.imageryLayers.get(1);
  // The map controller swaps the base layer at index 0 and adds an overlay.
  viewer.imageryLayers.remove(first, true);
  const next = tileLayer();
  viewer.imageryLayers.add(next, 0);
  viewer.imageryLayers.add(
    tileLayer(),
  );
  win.listeners.get('gev:map-stack-changed')();
  assert.equal(viewer.imageryLayers.get(0), next);
  assert.equal(viewer.imageryLayers.get(1), lights);
});

test('switching off puts everything back the way it was', () => {
  const viewer = fakeViewer(13_500_000);
  const before = { ...viewer.scene.globe };
  const sun = viewer.scene.light;
  const win = fakeWindow();
  const dn = createDayNight(viewer, { Cesium, win, requestRender: () => {} });
  dn.setEnabled(true);
  dn.setEnabled(false);
  assert.deepEqual({ ...viewer.scene.globe }, before);
  assert.equal(viewer.scene.light, sun);
  assert.equal(viewer.imageryLayers.length, 0);
  assert.equal(win.intervals.size, 0);
  assert.equal(win.listeners.size, 0);
  assert.equal(viewer.scene.preRender.numberOfListeners, 0);
  assert.equal(dn.isEnabled(), false);
});
