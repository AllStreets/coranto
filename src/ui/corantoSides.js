import { iconImage } from '../data/corantoIcons.js';

export const SIDES_KEY = 'coranto.sides.v1';
/** How near the top of a panel the cursor must be for its button to show. */
const TOP_ZONE_PX = 96;
/** How near a screen edge the cursor must be for the return button to show. */
const EDGE_ZONE_PX = 84;

/** Which sides are put away, read from what was stored. */
export function readSides(raw) {
  try {
    const value = JSON.parse(raw ?? '{}');
    return { rail: value?.rail === true, feed: value?.feed === true };
  } catch {
    return { rail: false, feed: false };
  }
}

/**
 * Putting the news view's side panels away, and bringing them back.
 *
 * A small button appears at the top of a panel while the cursor is there;
 * it slides that panel off its edge and the globe takes the room. A round
 * button then appears at mid-height when the cursor nears that edge, and
 * brings the panel back. The choice is remembered.
 *
 * @param {object} options
 * @param {Document} options.document
 * @param {Window} options.win
 * @param {HTMLElement} options.rail the left column
 * @param {HTMLElement} options.feed the right column
 * @param {Storage | null} options.storage
 * @param {() => void} [options.onChange] the globe's room changed
 */
export function createSides({
  document,
  win,
  rail,
  feed,
  storage,
  onChange = () => {},
}) {
  const body = document.body;
  let state = { rail: false, feed: false };
  try {
    state = readSides(storage?.getItem(SIDES_KEY));
  } catch {
    // A blocked store starts with both sides shown.
  }
  const panels = { rail, feed };
  const WORDS = {
    rail: ['Hide the left panel', 'Show the left panel', 'chevronRight'],
    feed: ['Hide the feed', 'Show the feed', 'chevronLeft'],
  };
  const button = (className, title, icon, colour) => {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = className;
    node.title = title;
    node.setAttribute('aria-label', title);
    const image = document.createElement('img');
    image.src = iconImage(icon, colour);
    image.alt = '';
    node.append(image);
    return node;
  };
  const hide = {};
  const show = {};
  for (const side of ['rail', 'feed']) {
    hide[side] = button('coranto-side-min', WORDS[side][0], 'minus', '#d5d0e2');
    hide[side].dataset.side = side;
    hide[side].addEventListener('click', () => set(side, true));
    show[side] = button(
      'coranto-side-show',
      WORDS[side][1],
      WORDS[side][2],
      '#e9e4f5',
    );
    show[side].dataset.side = side;
    show[side].addEventListener('click', () => set(side, false));
  }

  function apply() {
    for (const side of ['rail', 'feed']) {
      const key = side === 'rail' ? 'corantoRail' : 'corantoFeed';
      if (state[side]) body.dataset[key] = 'min';
      else delete body.dataset[key];
      // A panel that is away is out of the tab order too.
      panels[side].inert = state[side];
      show[side].hidden = !state[side];
      hide[side].hidden = state[side];
    }
  }
  function set(side, away) {
    if (state[side] === away) return;
    state = { ...state, [side]: away };
    try {
      storage?.setItem(SIDES_KEY, JSON.stringify(state));
    } catch {
      // Kept for this visit only.
    }
    apply();
    delete show[side].dataset.near;
    if (!away) hide[side].focus({ preventScroll: true });
    onChange();
  }

  // The buttons follow the cursor: top of a panel, or the edge of the screen.
  const onMove = (event) => {
    for (const side of ['rail', 'feed']) {
      const box = panels[side].getBoundingClientRect();
      const over =
        !state[side] &&
        (hide[side].contains(event.target) ||
          (event.clientX >= box.left &&
            event.clientX <= box.right &&
            event.clientY >= box.top &&
            event.clientY <= box.top + TOP_ZONE_PX));
      if (over) hide[side].dataset.near = '';
      else delete hide[side].dataset.near;
      const edge =
        side === 'rail'
          ? event.clientX <= EDGE_ZONE_PX
          : event.clientX >= win.innerWidth - EDGE_ZONE_PX;
      if (state[side] && edge) show[side].dataset.near = '';
      else delete show[side].dataset.near;
    }
  };
  document.addEventListener('mousemove', onMove, { passive: true });
  apply();

  return {
    // The small buttons sit on the line between a panel and the globe.
    elements: [hide.rail, hide.feed, show.rail, show.feed],
    isAway: (side) => Boolean(state[side]),
    set,
    toggle: (side) => set(side, !state[side]),
    destroy() {
      document.removeEventListener('mousemove', onMove);
      for (const side of ['rail', 'feed']) {
        hide[side].remove();
        show[side].remove();
        panels[side].inert = false;
      }
      delete body.dataset.corantoRail;
      delete body.dataset.corantoFeed;
    },
  };
}
