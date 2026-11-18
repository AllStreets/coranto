import test from 'node:test';
import assert from 'node:assert/strict';
import * as Cesium from 'cesium';
import {
  POLAR_UNDERLAY_ROLE,
  installPolarUnderlay,
  placeOverBase,
  repairDatelineEdges,
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

test('only tiles at the dateline are repaired', async () => {
  const calls = [];
  const provider = {
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    requestImage: (x, y, level) => {
      calls.push([x, y, level]);
      return Promise.resolve({ width: 256, height: 256, tag: `${x}` });
    },
  };
  const drawn = [];
  const doc = {
    createElement: () => ({
      getContext: () => ({ drawImage: (...args) => drawn.push(args.length) }),
    }),
  };
  repairDatelineEdges(provider, { document: doc });
  const middle = await provider.requestImage(1, 0, 2);
  assert.equal(middle.tag, '1');
  assert.equal(drawn.length, 0);
  const west = await provider.requestImage(0, 0, 2);
  assert.notEqual(west.tag, '0');
  assert.equal(drawn.length, 2);
  const east = await provider.requestImage(3, 1, 2);
  assert.equal(east.width, 256);
  assert.equal(drawn.length, 4);
  assert.equal(provider.requestImage(0, 0, 2, null) instanceof Promise, true);
  assert.deepEqual(calls[0], [1, 0, 2]);
});

test('a throttled request stays undefined', () => {
  const provider = {
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    requestImage: () => undefined,
  };
  repairDatelineEdges(provider, { document: { createElement: () => ({}) } });
  assert.equal(provider.requestImage(0, 0, 1), undefined);
});
