import { iconImage } from '../data/corantoIcons.js';

/**
 * Two ways to be shown the news without clicking through it, sharing one
 * bar over the globe:
 *
 *   - TOUR: fly through the places with the most stories right now, pausing
 *     on each with its newest headline.
 *   - REPLAY: step back through the week of headlines Coranto holds, so the
 *     globe shows what was being reported at each moment.
 *
 * Both only move the view and the time range. Nothing is added to what the
 * sources published.
 */
export const TOUR_STOPS = 8;
export const TOUR_DWELL_MS = 10_000;
export const REPLAY_STEP_H = 3;
export const REPLAY_TICK_MS = 1200;
const WEEK_MS = 7 * 24 * 3_600_000;

/** The places to visit: the most-reported first, at most `limit`. */
export function tourStops(places, limit = TOUR_STOPS) {
  return (places ?? [])
    .filter((place) => (place.articles?.length ?? 0) > 0)
    .slice()
    .sort((a, b) => b.articles.length - a.articles.length)
    .slice(0, limit)
    .map((place) => ({
      key: place.key,
      name: place.name,
      count: place.articles.length,
      headline: place.articles[0]?.title ?? '',
      publisher: place.articles[0]?.publisher ?? '',
    }));
}

/** What the bar says about a stop: how many stories, and the newest one. */
export function tourLine(stop) {
  const noun = stop.count === 1 ? 'story' : 'stories';
  const by = stop.publisher ? ` (${stop.publisher})` : '';
  return `${stop.count} ${noun} · ${stop.headline}${by}`;
}

/**
 * The moments a replay stops at: every `stepHours` from the oldest headline
 * held (no further back than a week) up to now. The last one is now.
 */
export function replaySteps(heldSince, now, stepHours = REPLAY_STEP_H) {
  const step = stepHours * 3_600_000;
  const start = Math.max(
    Number.isFinite(heldSince) ? heldSince : now,
    now - WEEK_MS,
  );
  const steps = [];
  // Start one step in, so the first frame already has something to show.
  for (let at = start + step; at < now; at += step) steps.push(at);
  steps.push(now);
  return steps;
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
/** `Sat 10 Oct 15:00 UTC`. */
export function replayLabel(ms) {
  const date = new Date(ms);
  return `${WEEKDAY[date.getUTCDay()]} ${date.getUTCDate()} ${MONTH[date.getUTCMonth()]} ${String(date.getUTCHours()).padStart(2, '0')}:00 UTC`;
}

/**
 * @param {object} options
 * @param {Document} options.document
 * @param {Window} options.win
 * @param {object} options.layer The news layer.
 * @param {() => void} options.flyHome
 * @param {() => void} [options.onChange] Called when a mode starts or stops.
 */
export function createTransport({
  document,
  win,
  layer,
  flyHome,
  onChange = () => {},
}) {
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (icon, label) => {
    const node = make('button', 'coranto-transport-btn');
    node.type = 'button';
    node.title = label;
    node.setAttribute('aria-label', label);
    const image = make('img');
    image.src = iconImage(icon, '#e6e0f7');
    image.alt = '';
    node.append(image);
    return node;
  };
  const element = make('div', 'coranto-bracket');
  element.id = 'coranto-transport';
  element.hidden = true;
  element.setAttribute('role', 'group');
  const title = make('div', 'coranto-transport-title');
  const detail = make('div', 'coranto-transport-detail');
  const text = make('div', 'coranto-transport-text');
  text.append(title, detail);
  const prev = button('prev', 'Back one');
  const toggle = button('pause', 'Pause');
  const next = button('next', 'Forward one');
  const stop = button('close', 'Stop and go back to now');
  const slider = make('input', 'coranto-transport-slider');
  slider.type = 'range';
  slider.min = '0';
  slider.step = '1';
  slider.setAttribute('aria-label', 'Moment in the week');
  const controls = make('div', 'coranto-transport-controls');
  controls.append(prev, toggle, next, stop);
  element.append(text, controls, slider);

  let mode = null; // 'tour' | 'replay'
  let items = [];
  let index = 0;
  let playing = false;
  let timer = null;

  function schedule() {
    win.clearTimeout(timer);
    timer = null;
    if (!playing || !mode) return;
    timer = win.setTimeout(
      () => {
        if (index >= items.length - 1) {
          // The end: a tour goes home, a replay rests on now.
          if (mode === 'tour') return api.stop();
          playing = false;
          return show();
        }
        index++;
        show();
        schedule();
      },
      mode === 'tour' ? TOUR_DWELL_MS : REPLAY_TICK_MS,
    );
  }

  function show() {
    const item = items[index];
    toggle.firstChild.src = iconImage(playing ? 'pause' : 'play', '#e6e0f7');
    toggle.title = playing ? 'Pause' : 'Play';
    toggle.setAttribute('aria-label', toggle.title);
    slider.hidden = mode !== 'replay';
    if (mode === 'tour') {
      title.textContent = `TOUR // ${index + 1} OF ${items.length} // ${item.name.toUpperCase()}`;
      detail.textContent = tourLine(item);
      layer.selectPlace(item.key, { focus: true });
    } else if (mode === 'replay') {
      slider.max = String(items.length - 1);
      slider.value = String(index);
      const live = index === items.length - 1;
      layer.setAsOf(live ? null : item);
      const view = layer.getView();
      title.textContent = live
        ? 'REPLAY // NOW'
        : `REPLAY // ${replayLabel(item).toUpperCase()}`;
      detail.textContent = `${view.places?.length ?? 0} places with stories from the ${view.rangeHours} hours before${live ? '' : ' that moment'}`;
    }
  }

  function start(nextMode, list) {
    api.stop({ silent: true });
    if (list.length < 2) return false;
    mode = nextMode;
    items = list;
    index = 0;
    playing = true;
    element.hidden = false;
    element.dataset.mode = mode;
    show();
    schedule();
    onChange(mode);
    return true;
  }

  const step = (by) => {
    index = Math.max(0, Math.min(items.length - 1, index + by));
    show();
    schedule();
  };
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  toggle.addEventListener('click', () => {
    playing = !playing;
    // Play from the end starts over.
    if (playing && index >= items.length - 1) index = 0;
    show();
    schedule();
  });
  slider.addEventListener('input', () => {
    index = Number(slider.value);
    playing = false;
    show();
    schedule();
  });

  const api = {
    element,
    get mode() {
      return mode;
    },
    /** Fly through the most-reported places. False when there are too few. */
    startTour() {
      return start('tour', tourStops(layer.getView().places));
    },
    /** Step through the week of headlines held. */
    startReplay(now = Date.now()) {
      return start('replay', replaySteps(layer.getView().heldSince, now));
    },
    stop({ silent = false } = {}) {
      if (!mode) return;
      const was = mode;
      win.clearTimeout(timer);
      timer = null;
      mode = null;
      playing = false;
      element.hidden = true;
      if (was === 'replay') layer.setAsOf(null);
      else {
        layer.selectPlace(null);
        if (!silent) flyHome();
      }
      if (!silent) onChange(null);
    },
  };
  stop.addEventListener('click', () => api.stop());
  return api;
}
