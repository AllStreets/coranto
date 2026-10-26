import test from 'node:test';
import assert from 'node:assert/strict';
import * as Cesium from 'cesium';
import {
  BLUE_MARBLE_CREDIT,
  BLUE_MARBLE_FULL_ABOVE,
  BLUE_MARBLE_GONE_BELOW,
  blueMarbleAlpha,
  createBlueMarble,
} from './blueMarble.js';
import { createDayNight } from './dayNight.js';
import { placeOverBase, tagLayer } from './globeStack.js';

const tileLayer = () =>
  new Cesium.ImageryLayer(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://example.test/{z}/{x}/{y}.png',
    }),
  );

function fakeViewer(height) {
  return {
    scene: {
      light: new Cesium.SunLight(),
      globe: {
        enableLighting: false,
        lightingFadeOutDistance: 1,
        lightingFadeInDistance: 2,
        dynamicAtmosphereLighting: true,
        dynamicAtmosphereLightingFromSun: false,
      },
      preRender: new Cesium.Event(),
    },
    imageryLayers: new Cesium.ImageryLayerCollection(),
    camera: { positionCartographic: { height } },
    isDestroyed: () => false,
  };
}

function fakeWindow() {
  const listeners = new Map();
  return {
    listeners,
    setInterval: () => Symbol('interval'),
    clearInterval() {},
    addEventListener(type, fn) {
      listeners.set(type, fn);
    },
    removeEventListener(type, fn) {
      if (listeners.get(type) === fn) listeners.delete(type);
    },
  };
}

test('Blue Marble is the whole Earth and gone by continent scale', () => {
  assert.equal(blueMarbleAlpha(13_500_000), 1); // the whole-Earth view
  assert.equal(blueMarbleAlpha(BLUE_MARBLE_FULL_ABOVE), 1);
  assert.equal(blueMarbleAlpha(BLUE_MARBLE_GONE_BELOW), 0);
  assert.equal(blueMarbleAlpha(5_500), 0); // the Chicago opening shot
  assert.equal(blueMarbleAlpha(Number.NaN), 0);
});

test('up close the layer is off, so it draws and loads nothing', () => {
  const viewer = fakeViewer(13_500_000);
  viewer.imageryLayers.add(tileLayer(), 0);
  const bm = createBlueMarble(viewer, {
    Cesium,
    win: fakeWindow(),
    requestRender: () => {},
  });
  bm.setEnabled(true);
  const layer = viewer.imageryLayers.get(1);
  assert.equal(layer.corantoRole, 'blue-marble');
  assert.equal(layer.imageryProvider.credit.html, BLUE_MARBLE_CREDIT);
  assert.equal(layer.alpha, 1);
  assert.equal(layer.show, true);

  viewer.camera.positionCartographic.height = 6_000;
  viewer.scene.preRender.raiseEvent();
  assert.equal(layer.alpha, 0);
  assert.equal(layer.show, false);

  viewer.camera.positionCartographic.height = 4_000_000;
  viewer.scene.preRender.raiseEvent();
  assert.ok(layer.alpha > 0 && layer.alpha < 1);
  assert.equal(layer.show, true);
});

test('base map, then Blue Marble, then city lights, then overlays', () => {
  const viewer = fakeViewer(13_500_000);
  const base = tileLayer();
  const overlay = tileLayer();
  viewer.imageryLayers.add(base, 0);
  viewer.imageryLayers.add(overlay);
  const win = fakeWindow();
  // City lights first, then Blue Marble: the order still comes out right.
  createDayNight(viewer, { Cesium, win, requestRender: () => {} }).setEnabled(
    true,
  );
  createBlueMarble(viewer, {
    Cesium,
    win: fakeWindow(),
    requestRender: () => {},
  }).setEnabled(true);
  const roles = [];
  for (let i = 0; i < viewer.imageryLayers.length; i++)
    roles.push(viewer.imageryLayers.get(i).corantoRole ?? 'other');
  assert.deepEqual(roles, ['other', 'blue-marble', 'city-lights', 'other']);
  assert.equal(viewer.imageryLayers.get(0), base);
  assert.equal(viewer.imageryLayers.get(3), overlay);
});

test('the order survives the base map being swapped', () => {
  const layers = new Cesium.ImageryLayerCollection();
  layers.add(tileLayer(), 0);
  const lights = tagLayer(tileLayer(), 'city-lights');
  const marble = tagLayer(tileLayer(), 'blue-marble');
  layers.add(lights);
  layers.add(marble);
  layers.add(tileLayer());
  layers.remove(layers.get(0), true);
  const next = tileLayer();
  layers.add(next, 0);
  placeOverBase(layers);
  assert.equal(layers.get(0), next);
  assert.equal(layers.get(1), marble);
  assert.equal(layers.get(2), lights);
});

test('switching off removes it and its listeners', () => {
  const viewer = fakeViewer(13_500_000);
  const win = fakeWindow();
  const bm = createBlueMarble(viewer, {
    Cesium,
    win,
    requestRender: () => {},
  });
  bm.setEnabled(true);
  bm.setEnabled(false);
  assert.equal(viewer.imageryLayers.length, 0);
  assert.equal(viewer.scene.preRender.numberOfListeners, 0);
  assert.equal(win.listeners.size, 0);
  assert.equal(bm.isEnabled(), false);
});
