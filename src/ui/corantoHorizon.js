import * as Cesium from 'cesium';

/**
 * Hide markers that are over the horizon. The engine does not depth-test
 * markers against the ground, so without this a marker on the far side of
 * the Earth shows through when you are down at street level.
 *
 * @param {object} viewer
 * @param {object} collection A Cesium BillboardCollection.
 * @returns {() => void} Stop watching.
 */
export function cullBeyondHorizon(viewer, collection) {
  const ellipsoid = viewer.scene.globe?.ellipsoid ?? Cesium.Ellipsoid.WGS84;
  let last = 0;
  let lastPose = '';
  const update = (force = false) => {
    const now = Date.now();
    if (!force && now - last < 200) return;
    const camera = viewer.camera.positionWC;
    // Nothing to do while the camera has not moved.
    const pose = `${Math.round(camera.x)}:${Math.round(camera.y)}:${Math.round(camera.z)}`;
    if (!force && pose === lastPose) return;
    last = now;
    lastPose = pose;
    const occluder = new Cesium.EllipsoidalOccluder(ellipsoid, camera);
    for (let i = 0; i < collection.length; i++) {
      const billboard = collection.get(i);
      const visible = occluder.isPointVisible(billboard.position);
      if (billboard.show !== visible) billboard.show = visible;
    }
  };
  update(true);
  const remove = viewer.scene.preRender.addEventListener(() => update());
  return () => remove();
}
