import * as Cesium from 'cesium';

/**
 * Camera presets for notable locations.
 * Phase 1 default: fly to Austin, TX on load.
 */
export const CAMERA_PRESETS = {
  austin: {
    destination: Cesium.Cartesian3.fromDegrees(-97.7431, 30.2672, 800),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-35),
      roll: 0.0,
    },
  },
  sf: {
    destination: Cesium.Cartesian3.fromDegrees(-122.4194, 37.7749, 1000),
    orientation: {
      heading: Cesium.Math.toRadians(30),
      pitch: Cesium.Math.toRadians(-30),
      roll: 0.0,
    },
  },
  nyc: {
    destination: Cesium.Cartesian3.fromDegrees(-73.9857, 40.7484, 1200),
    orientation: {
      heading: Cesium.Math.toRadians(-20),
      pitch: Cesium.Math.toRadians(-30),
      roll: 0.0,
    },
  },
};

/**
 * Fly the camera to a preset location with a smooth animation.
 */
export function flyToPreset(viewer, presetName, duration = 3.0) {
  const preset = CAMERA_PRESETS[presetName];
  if (!preset) return;

  viewer.camera.flyTo({
    destination: preset.destination,
    orientation: preset.orientation,
    duration,
    easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
  });
}

/**
 * Opening shots: where the camera starts (`from`, set at once) and where it
 * glides to (`to`). Heights in metres; heading and pitch in degrees.
 */
const OPENING_SHOTS = {
  austin: {
    from: {
      lon: -97.7431,
      lat: 30.2672,
      height: 25000,
      heading: 0,
      pitch: -90,
    },
    to: { lon: -97.7431, lat: 30.2672, height: 600, heading: 15, pitch: -30 },
  },
  // Coranto's: over Lake Michigan, looking west across the shore to the Loop.
  chicago: {
    from: { lon: -87.4, lat: 41.874, height: 9000, heading: 266, pitch: -28 },
    to: { lon: -87.47, lat: 41.878, height: 5500, heading: 264, pitch: -25 },
  },
};

const shotView = (shot) => ({
  destination: Cesium.Cartesian3.fromDegrees(shot.lon, shot.lat, shot.height),
  orientation: {
    heading: Cesium.Math.toRadians(shot.heading),
    pitch: Cesium.Math.toRadians(shot.pitch),
    roll: 0.0,
  },
});

/**
 * Set the camera on an opening shot, then glide in after a brief pause.
 * @returns {Function} Cancels the pending or active startup flight.
 */
function flyOpeningShot(viewer, name) {
  const shot = OPENING_SHOTS[name];
  viewer.camera.setView(shotView(shot.from));
  const timer = setTimeout(() => {
    if (viewer.isDestroyed()) return;
    viewer.camera.flyTo({
      ...shotView(shot.to),
      duration: 4.0,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    });
  }, 500);
  return () => {
    clearTimeout(timer);
    if (!viewer.isDestroyed()) viewer.camera.cancelFlight();
  };
}

/**
 * Set camera to Austin on load with a cinematic fly-in.
 * @returns {Function} Cancels the pending or active startup flight.
 */
export function flyToAustin(viewer) {
  return flyOpeningShot(viewer, 'austin');
}

/**
 * Coranto's opening: Chicago from over the lake, with the same fly-in.
 * @returns {Function} Cancels the pending or active startup flight.
 */
export function flyToChicago(viewer) {
  return flyOpeningShot(viewer, 'chicago');
}
