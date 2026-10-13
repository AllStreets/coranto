import * as Cesium from 'cesium';

/** NASA's Lunar Reconnaissance Orbiter colour map (public domain). */
export const MOON_TEXTURE = '/coranto-atlas/moon.jpg';
export const MOON_SOURCE = Object.freeze({
  name: 'NASA Scientific Visualization Studio, CGI Moon Kit (LRO)',
  url: 'https://svs.gsfc.nasa.gov/4720',
});
/** How far in front of the Moon the camera stops, in metres. */
const VIEW_DISTANCE_M = 9_500_000;

/** Where the Moon is now, in the globe's own frame, in metres. */
export function moonPosition(time) {
  const inertial =
    Cesium.Simon1994PlanetaryPositions.computeMoonPositionInEarthInertialFrame(
      time,
    );
  const toFixed =
    Cesium.Transforms.computeIcrfToFixedMatrix(time) ??
    Cesium.Transforms.computeTemeToPseudoFixedMatrix(time);
  return Cesium.Matrix3.multiplyByVector(
    toFixed,
    inertial,
    new Cesium.Cartesian3(),
  );
}

/** What the Moon's card says: its real distance now, and where it is from. */
export function moonCard(distanceM) {
  const km = Math.round(distanceM / 1000);
  return {
    kind: 'THE MOON · TRUE SIZE AND DISTANCE',
    title: 'The Moon',
    meta: [
      `${km.toLocaleString('en-US')} km from the centre of the Earth right now`,
      'about ten times farther out than the highest satellites drawn',
      'radius 1,737 km, a little over a quarter of the Earth’s',
      'lit by the Sun and seen here from its sunlit side; from Earth it shows today’s phase',
      'position worked out from the date, not observed',
    ].join(' · '),
    url: MOON_SOURCE.url,
    linkText:
      'The surface map is NASA’s, from the Lunar Reconnaissance Orbiter',
  };
}

/**
 * The Moon, where it really is. The engine already keeps a Moon at its true
 * position and size; this gives it NASA's photographic surface and a way to
 * go and look at it, since at that distance it is a speck from Earth orbit.
 *
 * @param {() => object|null} getViewer
 */
export function createMoon(getViewer) {
  let installed = false;
  function install() {
    const viewer = getViewer();
    if (!viewer || installed) return Boolean(viewer);
    const previous = viewer.scene.moon;
    viewer.scene.moon = new Cesium.Moon({
      textureUrl: MOON_TEXTURE,
      onlySunLighting: true,
    });
    if (previous && !previous.isDestroyed?.()) previous.destroy();
    installed = true;
    return true;
  }
  return {
    install,
    /** Fly out to the Moon. Returns its card, or null with no globe. */
    view() {
      const viewer = getViewer();
      if (!install() || !viewer) return null;
      const time = viewer.clock.currentTime;
      const position = moonPosition(time);
      const distance = Cesium.Cartesian3.magnitude(position);
      // Stand on the Moon's sunlit side, so its surface can be seen whatever
      // the phase is from Earth.
      const toFixed =
        Cesium.Transforms.computeIcrfToFixedMatrix(time) ??
        Cesium.Transforms.computeTemeToPseudoFixedMatrix(time);
      const sun = Cesium.Matrix3.multiplyByVector(
        toFixed,
        Cesium.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(
          time,
        ),
        new Cesium.Cartesian3(),
      );
      const sunward = Cesium.Cartesian3.normalize(
        Cesium.Cartesian3.subtract(sun, position, new Cesium.Cartesian3()),
        new Cesium.Cartesian3(),
      );
      const direction = Cesium.Cartesian3.negate(
        sunward,
        new Cesium.Cartesian3(),
      );
      // Up is the Earth's north, squared off against the line of sight.
      const right = Cesium.Cartesian3.cross(
        direction,
        Cesium.Cartesian3.UNIT_Z,
        new Cesium.Cartesian3(),
      );
      const up = Cesium.Cartesian3.normalize(
        Cesium.Cartesian3.cross(right, direction, new Cesium.Cartesian3()),
        new Cesium.Cartesian3(),
      );
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.add(
          position,
          Cesium.Cartesian3.multiplyByScalar(
            sunward,
            VIEW_DISTANCE_M,
            new Cesium.Cartesian3(),
          ),
          new Cesium.Cartesian3(),
        ),
        orientation: { direction, up },
        duration: 4,
      });
      return moonCard(distance);
    },
  };
}
