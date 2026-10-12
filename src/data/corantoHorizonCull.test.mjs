import assert from 'node:assert/strict';
import test from 'node:test';

import * as Cesium from 'cesium';

import { cullEntitiesBeyondHorizon } from './corantoHorizonCull.js';

const at = (lon, lat, height = 0) =>
  Cesium.Cartesian3.fromDegrees(lon, lat, height);

function fakeViewer(cameraPosition) {
  const listeners = [];
  return {
    listeners,
    scene: {
      globe: { ellipsoid: Cesium.Ellipsoid.WGS84 },
      preRender: {
        addEventListener(fn) {
          listeners.push(fn);
          return () => listeners.splice(listeners.indexOf(fn), 1);
        },
      },
    },
    camera: { positionWC: cameraPosition },
    clock: { currentTime: null },
  };
}

test('a marker behind the Earth is switched off, and a near one stays on', () => {
  // Low over the North Carolina coast.
  const viewer = fakeViewer(at(-75.62, 35.95, 900));
  const near = { position: at(-75.63, 35.96), show: true };
  const farSide = { position: at(114.17, 22.32), show: true }; // Hong Kong
  const stop = cullEntitiesBeyondHorizon(viewer, () => [near, farSide]);
  viewer.listeners[0]();
  assert.equal(near.show, true);
  assert.equal(farSide.show, false);
  stop();
  assert.equal(viewer.listeners.length, 0);
});

test('from far above, the near half of the globe shows and the far half does not', () => {
  const viewer = fakeViewer(at(-75, 22, 13_500_000));
  const americas = { position: at(-99, 31), show: false };
  const asia = { position: at(105, 35), show: true };
  cullEntitiesBeyondHorizon(viewer, () => [americas, asia]);
  viewer.listeners[0]();
  assert.equal(americas.show, true, 'a marker comes back when it is in view');
  assert.equal(asia.show, false);
});

test('a viewer that cannot be watched is left alone', () => {
  assert.doesNotThrow(() => cullEntitiesBeyondHorizon({}, () => [])());
});
