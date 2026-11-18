import test from 'node:test';
import assert from 'node:assert/strict';
import * as Cesium from 'cesium';
import {
  POLAR_UNDERLAY_ROLE,
  installPolarUnderlay,
  placeOverBase,
  tagLayer,
} from './globeStack.js';

const tileLayer = () =>
  new Cesium.ImageryLayer(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://example.test/{z}/{x}/{y}.png',
    }),
  );

function fakeViewer() {
  return {
    imageryLayers: new Cesium.ImageryLayerCollection(),
    isDestroyed: () => false,
  };
}

const fakeCesium = {
  ...Cesium,
  buildModuleUrl: (path) => `https://example.test/cesium/${path}`,
  TileMapServiceImageryProvider: {
    fromUrl: () => new Promise(() => {}),
  },
};

test('the polar underlay stays beneath every base map swap', () => {
  const viewer = fakeViewer();
  const layers = viewer.imageryLayers;
  const remove = installPolarUnderlay(viewer, fakeCesium);
  const underlay = layers.get(0);
  assert.equal(underlay.corantoRole, POLAR_UNDERLAY_ROLE);

  const esri = tileLayer();
  layers.add(esri, 0);
  assert.equal(layers.get(0), underlay);
  assert.equal(layers.get(1), esri);
  assert.equal(esri.isBaseLayer(), false);

  layers.remove(esri, true);
  const next = tileLayer();
  layers.add(next, 0);
  assert.equal(layers.get(0), underlay);
  assert.equal(layers.get(1), next);

  remove();
  assert.equal(layers.contains(underlay), false);
  layers.add(tileLayer(), 0);
  assert.equal(layers.length, 2);
});

test('globe layers sit above the base map, not above the underlay', () => {
  const viewer = fakeViewer();
  const layers = viewer.imageryLayers;
  installPolarUnderlay(viewer, fakeCesium);
  const underlay = layers.get(0);
  const lights = tagLayer(tileLayer(), 'city-lights');
  const marble = tagLayer(tileLayer(), 'blue-marble');
  layers.add(lights);
  layers.add(marble);
  const base = tileLayer();
  layers.add(base, 0);
  placeOverBase(layers);
  assert.deepEqual(
    [0, 1, 2, 3].map((i) => layers.get(i)),
    [underlay, base, marble, lights],
  );
});

test('with no base map, globe layers start just above the underlay', () => {
  const viewer = fakeViewer();
  const layers = viewer.imageryLayers;
  installPolarUnderlay(viewer, fakeCesium);
  const underlay = layers.get(0);
  const lights = tagLayer(tileLayer(), 'city-lights');
  const marble = tagLayer(tileLayer(), 'blue-marble');
  layers.add(lights);
  layers.add(marble);
  placeOverBase(layers);
  assert.deepEqual(
    [0, 1, 2].map((i) => layers.get(i)),
    [underlay, marble, lights],
  );
});
