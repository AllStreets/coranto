import * as Cesium from 'cesium';

/**
 * Hide map markers that are behind the Earth.
 *
 * Markers are drawn without a depth test near the camera so terrain does not
 * swallow them. The cost is that, zoomed in on one town, markers from the far
 * side of the globe show through the ground. This switches a marker off
 * whenever the Earth is between it and the camera, and on again when it is
 * not.
 *
 * @param {object} viewer The Cesium viewer.
 * @param {() => Iterable<object>|null|undefined} getEntities The entities to
 * watch now. It is asked each pass, so a layer that redraws is followed.
 * @returns {() => void} Stop watching.
 */
export function cullEntitiesBeyondHorizon(viewer, getEntities) {
  const preRender = viewer?.scene?.preRender;
  if (!preRender?.addEventListener) return () => {};
  let last = 0;
  const remove = preRender.addEventListener(() => {
    const now = Date.now();
    if (now - last < 200) return;
    last = now;
    const entities = getEntities();
    if (!entities) return;
    const occluder = new Cesium.EllipsoidalOccluder(
      viewer.scene.globe?.ellipsoid ?? Cesium.Ellipsoid.WGS84,
      viewer.camera.positionWC,
    );
    const time = viewer.clock?.currentTime;
    for (const entity of entities) {
      const position = entity.position?.getValue
        ? entity.position.getValue(time)
        : entity.position;
      if (!position) continue;
      const visible = isInFrontOfEarth(occluder, position);
      if (entity.show !== visible) entity.show = visible;
    }
  });
  return () => remove?.();
}

/** True when the Earth is not between the camera and the point. */
export function isInFrontOfEarth(occluder, position) {
  return occluder.isPointVisible(position);
}
