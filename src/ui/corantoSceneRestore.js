/**
 * Putting things back after a scene. A scene sets its own visual preset,
 * display switches and camera, and the engine leaves them that way when the
 * scene ends. A reader who played one would be left in night vision, far
 * from where they were. This remembers the look and the view when playback
 * starts and restores them when it stops.
 *
 * It restores the preset, the four display switches, the display sliders
 * (label density, bloom and sharpen strength) and the camera.
 */
export const LOOK_SWITCHES = Object.freeze([
  '#bloom-toggle',
  '#sharpen-toggle',
  '#hud-toggle',
  '#detection-toggle',
]);

export const LOOK_SLIDERS = Object.freeze([
  '#detection-density-slider',
  '#detection-fade-slider',
  '#detection-opacity-slider',
  '#bloom-intensity-slider',
  '#sharpen-intensity-slider',
]);

/** The sliders to set, and to what, to get from `now` back to `before`. */
export function sliderChanges(before, now) {
  return LOOK_SLIDERS.filter(
    (selector) =>
      typeof before?.sliders?.[selector] === 'string' &&
      before.sliders[selector] !== now?.sliders?.[selector],
  ).map((selector) => [selector, before.sliders[selector]]);
}

/** Which controls must be pressed to get from `now` back to `before`. */
export function lookChanges(before, now) {
  const press = [];
  if (before?.style && before.style !== now?.style)
    press.push(`.style-btn[data-style='${before.style}']`);
  for (const selector of LOOK_SWITCHES)
    if (
      selector in (before?.switches ?? {}) &&
      before.switches[selector] !== now?.switches?.[selector]
    )
      press.push(selector);
  return press;
}

/**
 * @param {object} options
 * @param {Document} options.document
 * @param {() => object|null} options.getViewer
 * @param {typeof MutationObserver} options.Observer
 */
export function createSceneRestore({ document, getViewer, Observer }) {
  const body = document.body;
  const readLook = () => ({
    style: document.querySelector('.style-btn.active')?.dataset.style ?? null,
    switches: Object.fromEntries(
      LOOK_SWITCHES.map((selector) => [
        selector,
        Boolean(document.querySelector(selector)?.classList.contains('active')),
      ]),
    ),
    sliders: Object.fromEntries(
      LOOK_SLIDERS.map((selector) => [
        selector,
        document.querySelector(selector)?.value,
      ]),
    ),
  });
  let saved = null;

  function onChange() {
    const playing = body.classList.contains('scene-playback-mode');
    if (playing && !saved) {
      const camera = getViewer()?.camera;
      saved = {
        look: readLook(),
        view: camera && {
          destination: camera.positionWC.clone(),
          orientation: {
            heading: camera.heading,
            pitch: camera.pitch,
            roll: camera.roll,
          },
        },
      };
      return;
    }
    if (playing || !saved) return;
    const { look, view } = saved;
    saved = null;
    const now = readLook();
    for (const selector of lookChanges(look, now))
      document.querySelector(selector)?.click();
    for (const [selector, value] of sliderChanges(look, now)) {
      const slider = document.querySelector(selector);
      if (!slider) continue;
      slider.value = value;
      // The engine listens for the same events a hand on the slider sends.
      for (const type of ['input', 'change'])
        slider.dispatchEvent(
          new (document.defaultView?.Event ?? Event)(type, { bubbles: true }),
        );
    }
    const camera = getViewer()?.camera;
    if (camera && view) {
      camera.cancelFlight?.();
      camera.flyTo({ ...view, duration: 1.4 });
    }
  }

  const observer = Observer ? new Observer(onChange) : null;
  observer?.observe(body, { attributes: true, attributeFilter: ['class'] });
  return { destroy: () => observer?.disconnect() };
}
