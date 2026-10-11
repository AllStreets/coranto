import { createNewsFeed } from './newsPanel.js';

const MODE_KEY = 'coranto.mode.v1';
const FIRST_RUN_SESSION_KEY = 'gev:first-run-mission-session:v1';

/** Live layers offered in the header. Ids are catalog layer ids. */
const HEADER_LAYERS = [
  ['flights', 'FLIGHTS', 'Live civil aircraft'],
  ['military', 'MILITARY', 'Military aircraft broadcasting their position'],
  ['ais-live-vessels', 'SHIPS', 'Live vessels (needs an AISStream key)'],
  ['satellites', 'SATELLITES', 'Satellites from public orbital elements'],
  ['earthquakes', 'QUAKES', 'USGS earthquakes, last 24 hours'],
  ['local-firms', 'FIRES', 'NASA FIRMS active fires (needs a key)'],
  ['weather-cyclones', 'STORMS', 'NOAA tropical cyclones'],
  ['rocket-launches', 'LAUNCHES', 'Recent and upcoming rocket launches'],
  ['telegeography-submarine-cables', 'CABLES', 'Undersea cables'],
];

const CATEGORIES = [
  [null, 'ALL COVERAGE'],
  ['geopolitics', 'GEOPOLITICS'],
  ['military', 'MILITARY'],
  ['finance', 'FINANCE'],
  ['climate', 'CLIMATE'],
  ['technology', 'TECHNOLOGY'],
];

const GUIDE = [
  [
    'Read',
    'The feed on the right is every current headline from the sources, newest first. Each headline is the publisher’s own words and opens the original article.',
  ],
  [
    'See where',
    'Each gold marker is a place that stories name. A solid dot is a city. A hollow ring is a country or region, so the position is approximate. Click a marker to see only that place’s stories.',
  ],
  [
    'Check why',
    'Under every story is the reason it sits where it does, for example “matched Kyiv in headline”. Click that line to fly to the place. Stories that name no place say “No location”.',
  ],
  [
    'Filter',
    'The list on the left narrows the feed by topic. Topics are automatic tags from keywords, not editorial judgements. Good news shows only headlines tagged as progress.',
  ],
  [
    'Check the sources',
    'The LIVE badge counts how many sources answered. Click it to see each one. A source that is down is named as down; nothing is shown in its place.',
  ],
  [
    'Add live layers',
    'The buttons along the top add other public feeds to the same globe: aircraft, military flights, ships, satellites, earthquakes, storms and more.',
  ],
  [
    'Go deeper',
    'INSTRUMENTS switches to the full control room: tracking, cockpit view, cameras, weather, visual styles, voice control and share links. NEWS brings you back.',
  ],
  [
    'Move the globe',
    'Drag to spin. Scroll to zoom. Hold Ctrl (or the right mouse button) and drag to tilt.',
  ],
];

function el(document, tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.filter(Boolean));
  return node;
}

const pad = (n) => String(n).padStart(2, '0');

const LIVE_LABELS = {
  loading: 'CONNECTING',
  down: 'NO SOURCE REACHABLE',
  stale: 'SAVED RESULTS',
};

/** Text for the header badge: a fixed phrase, or the count of live sources. */
function liveLabel(state, live, total) {
  return LIVE_LABELS[state] ?? `LIVE · ${live}/${total}`;
}

function readStored(storage, key) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStored(storage, key, value) {
  try {
    storage?.setItem(key, value);
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
}

/**
 * Coranto's own frame around the globe, modelled on AUSPEX: a header with the
 * live badge and layer switches, a ticker of the latest headlines, a topic
 * list, and a full-height feed. The engine's control-room panels are a second
 * mode, one click away.
 *
 * @param {object} options
 * @param {Document} options.document
 * @param {object} options.layer The news layer.
 * @param {Window} [options.window]
 */
export function createCorantoShell({
  document,
  layer,
  window: win = globalThis.window,
}) {
  if (!document?.body) return null;
  const { body } = document;
  let dataManager = null;
  let feed = null;
  let category = null;
  const timers = [];

  let localStorageRef = null;
  let sessionStorageRef = null;
  try {
    localStorageRef = win.localStorage;
    sessionStorageRef = win.sessionStorage;
  } catch {
    /* blocked storage */
  }
  const startedWithLink = Boolean(win.location?.hash);

  // ── Header ──────────────────────────────────────────────────────
  const liveBtn = el(document, 'button', {
    id: 'coranto-live',
    type: 'button',
    title: 'Show which sources answered',
  });
  const liveDot = el(document, 'span', { class: 'coranto-live-dot' });
  const liveText = el(document, 'span', { text: 'CONNECTING' });
  liveBtn.append(liveDot, liveText);

  const layerNav = el(document, 'nav', {
    id: 'coranto-layers',
    'aria-label': 'Live layers',
  });
  const layerButtons = new Map();
  for (const [id, label, title] of HEADER_LAYERS) {
    const button = el(document, 'button', {
      type: 'button',
      class: 'coranto-layer',
      title,
      'aria-pressed': 'false',
      text: label,
    });
    button.addEventListener('click', () => {
      if (!dataManager) return;
      const next = !dataManager.isEnabled(id);
      button.dataset.busy = 'true';
      Promise.resolve(dataManager.setEnabled(id, next))
        .catch(() => {})
        .finally(() => {
          delete button.dataset.busy;
          syncLayers();
        });
    });
    layerButtons.set(id, button);
    layerNav.append(button);
  }

  const count = el(document, 'span', { id: 'coranto-count' });
  const clock = el(document, 'time', { id: 'coranto-clock' });
  const modeNews = el(document, 'button', {
    type: 'button',
    text: 'NEWS',
    title: 'The headline feed on the globe',
  });
  const modeTools = el(document, 'button', {
    type: 'button',
    text: 'INSTRUMENTS',
    title:
      'The full control room: tracking, cameras, weather, styles and voice',
  });
  const modeSwitch = el(
    document,
    'div',
    { id: 'coranto-mode', role: 'group', 'aria-label': 'View' },
    modeNews,
    modeTools,
  );
  const header = el(
    document,
    'header',
    { id: 'coranto-header' },
    el(
      document,
      'div',
      { class: 'coranto-brand' },
      el(document, 'img', { src: '/logo.svg', alt: '' }),
      el(
        document,
        'div',
        {},
        el(
          document,
          'div',
          { class: 'coranto-wordmark' },
          'COR',
          el(document, 'em', { text: 'ANTO' }),
        ),
        el(document, 'div', {
          class: 'coranto-tagline',
          text: 'EVERY STORY HAS A PLACE AND A DATE',
        }),
      ),
    ),
    liveBtn,
    layerNav,
    count,
    clock,
    modeSwitch,
  );

  // ── Ticker ──────────────────────────────────────────────────────
  const tickerTrack = el(document, 'div', { class: 'coranto-ticker-track' });
  const ticker = el(
    document,
    'div',
    { id: 'coranto-ticker', 'aria-label': 'Latest headlines' },
    el(document, 'span', { class: 'coranto-ticker-label', text: 'LATEST' }),
    el(document, 'div', { class: 'coranto-ticker-window' }, tickerTrack),
  );
  let tickerKey = '';

  // ── Topic rail ──────────────────────────────────────────────────
  const guideBtn = el(document, 'button', {
    type: 'button',
    class: 'coranto-rail-btn',
    text: 'GUIDE',
    title: 'How to use Coranto',
  });
  const sourcesBtn = el(document, 'button', {
    type: 'button',
    class: 'coranto-rail-btn',
    text: 'SOURCES',
    title: 'Which sources answered',
  });
  const homeBtn = el(document, 'button', {
    type: 'button',
    class: 'coranto-rail-btn',
    text: 'WHOLE EARTH',
    title: 'Pull back to the whole globe',
  });
  const topicList = el(document, 'div', { class: 'coranto-topics' });
  const topicButtons = new Map();
  for (const [id, label] of CATEGORIES) {
    const button = el(document, 'button', {
      type: 'button',
      class: 'coranto-topic',
      'data-category': id ?? 'all',
    });
    const number = el(document, 'span', { class: 'coranto-topic-count' });
    button.append(
      el(document, 'span', { class: 'coranto-topic-pip' }),
      el(document, 'span', { class: 'coranto-topic-label', text: label }),
      number,
    );
    button.addEventListener('click', () => {
      category = id;
      layer.setGoodNewsOnly(false);
      feed?.setCategory(id);
    });
    topicButtons.set(id, { button, number });
    topicList.append(button);
  }
  const goodBtn = el(document, 'button', {
    type: 'button',
    class: 'coranto-topic coranto-topic-good',
    title:
      'Headlines automatically tagged as progress: medical, science, space, humanity',
  });
  const goodCount = el(document, 'span', { class: 'coranto-topic-count' });
  goodBtn.append(
    el(document, 'span', { class: 'coranto-topic-pip' }),
    el(document, 'span', { class: 'coranto-topic-label', text: 'GOOD NEWS' }),
    goodCount,
  );
  goodBtn.addEventListener('click', () => {
    const next = !layer.getView().goodNewsOnly;
    category = null;
    feed?.setCategory(null);
    layer.setGoodNewsOnly(next);
  });
  topicList.append(goodBtn);
  const rail = el(
    document,
    'nav',
    { id: 'coranto-rail', 'aria-label': 'Topics' },
    el(
      document,
      'div',
      { class: 'coranto-rail-actions' },
      guideBtn,
      sourcesBtn,
      homeBtn,
    ),
    topicList,
  );

  // ── Feed ────────────────────────────────────────────────────────
  const feedCount = el(document, 'span', { class: 'coranto-feed-count' });
  const feedBody = el(document, 'div', { id: 'coranto-feed-body' });
  const feedAside = el(
    document,
    'aside',
    { id: 'coranto-feed', 'aria-label': 'Headline feed' },
    el(
      document,
      'div',
      { class: 'coranto-feed-head' },
      el(document, 'span', { class: 'coranto-feed-title', text: 'THE FEED' }),
      feedCount,
    ),
    feedBody,
  );

  // ── Guide ───────────────────────────────────────────────────────
  const guideClose = el(document, 'button', {
    type: 'button',
    class: 'coranto-guide-close',
    text: 'Close',
  });
  const guide = el(
    document,
    'div',
    { id: 'coranto-guide', role: 'dialog', 'aria-label': 'How to use Coranto' },
    el(
      document,
      'div',
      { class: 'coranto-guide-card' },
      el(document, 'div', {
        class: 'coranto-guide-kicker',
        text: 'CORANTO · GUIDE',
      }),
      el(document, 'h2', { text: 'How to read the world here' }),
      el(
        document,
        'ol',
        {},
        ...GUIDE.map(([title, text]) =>
          el(
            document,
            'li',
            {},
            el(document, 'strong', { text: title }),
            el(document, 'span', { text }),
          ),
        ),
      ),
      guideClose,
    ),
  );
  guide.hidden = true;

  body.append(header, ticker, rail, feedAside, guide);

  // ── Behaviour ───────────────────────────────────────────────────
  function setMode(mode, { remember = true } = {}) {
    const next = mode === 'instruments' ? 'instruments' : 'news';
    body.dataset.corantoMode = next;
    modeNews.setAttribute('aria-pressed', String(next === 'news'));
    modeTools.setAttribute('aria-pressed', String(next === 'instruments'));
    if (remember) writeStored(localStorageRef, MODE_KEY, next);
    // The engine lays its panels out from measured sizes.
    win.dispatchEvent?.(new win.Event('resize'));
  }

  function syncLayers() {
    if (!dataManager) return;
    for (const [id, button] of layerButtons) {
      const known = dataManager.layers?.has(id);
      button.hidden = !known;
      if (known)
        button.setAttribute('aria-pressed', String(dataManager.isEnabled(id)));
    }
  }

  function tick() {
    const date = new Date();
    clock.dateTime = date.toISOString();
    clock.textContent = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  function wholeEarth() {
    const camera = dataManager?.viewer?.camera;
    if (!camera) return;
    // Centre on the viewer's own longitude, taken from the clock offset.
    const lon = Math.max(
      -180,
      Math.min(180, -new Date().getTimezoneOffset() / 4),
    );
    const position = camera.positionCartographic.constructor.fromDegrees(
      lon,
      22,
      13_500_000,
    );
    camera.cancelFlight?.();
    camera.flyTo({
      destination:
        dataManager.viewer.scene.globe.ellipsoid.cartographicToCartesian(
          position,
        ),
      orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
      duration: 1.6,
    });
  }

  function onModel(model) {
    const state = model.healthState;
    liveBtn.dataset.state = state;
    const sources = model.sources.filter((source) => source.state !== 'off');
    const live = sources.filter((source) => source.state === 'ok').length;
    liveText.textContent = liveLabel(state, live, sources.length);
    count.textContent = model.total ? `${model.total} STORIES` : '';
    feedCount.textContent = model.total
      ? `${model.shown} OF ${model.total}`
      : '';

    const byCategory = new Map(
      model.categories.map((row) => [row.value, row.count]),
    );
    for (const [id, { button, number }] of topicButtons) {
      number.textContent = String(
        id === null ? model.total : (byCategory.get(id) ?? 0),
      );
      button.setAttribute(
        'aria-pressed',
        String(!model.goodNewsOnly && category === id),
      );
    }
    goodCount.textContent = String(model.goodNewsCount);
    goodBtn.setAttribute('aria-pressed', String(model.goodNewsOnly));

    const snapshot = layer.getView().snapshot;
    const latest = (snapshot?.articles ?? []).slice(0, 24);
    const key = latest.map((article) => article.id).join(',');
    if (key !== tickerKey) {
      tickerKey = key;
      const items = latest.map((article) => {
        const link = el(document, 'a', {
          href: article.url,
          target: '_blank',
          rel: 'noopener noreferrer',
        });
        link.append(
          el(document, 'span', {
            class: 'coranto-ticker-source',
            text: article.publisher,
          }),
          article.title,
        );
        return link;
      });
      tickerTrack.replaceChildren(...items);
      tickerTrack.style.setProperty(
        '--coranto-ticker-seconds',
        `${Math.max(40, latest.length * 9)}s`,
      );
      ticker.dataset.empty = String(latest.length === 0);
    }
  }

  modeNews.addEventListener('click', () => setMode('news'));
  modeTools.addEventListener('click', () => setMode('instruments'));
  guideBtn.addEventListener('click', () => {
    guide.hidden = false;
    guideClose.focus();
  });
  guideClose.addEventListener('click', () => {
    guide.hidden = true;
    guideBtn.focus();
  });
  guide.addEventListener('click', (event) => {
    if (event.target === guide) guide.hidden = true;
  });
  const onKey = (event) => {
    if (event.key === 'Escape' && !guide.hidden) guide.hidden = true;
  };
  document.addEventListener('keydown', onKey);
  const showSources = () => {
    feed?.showSources(true);
    feedBody.scrollTop = 0;
  };
  liveBtn.addEventListener('click', showSources);
  sourcesBtn.addEventListener('click', showSources);
  homeBtn.addEventListener('click', wholeEarth);

  const storedMode = readStored(localStorageRef, MODE_KEY);
  // Automated browsers get the control room: the engine's own browser gates
  // drive those panels and expect them on screen.
  const defaultMode = win.navigator?.webdriver ? 'instruments' : 'news';
  setMode(storedMode ?? defaultMode, { remember: false });
  if (body.dataset.corantoMode === 'news') {
    // News opens straight onto the feed; the engine's mission launcher
    // belongs to the control room.
    writeStored(sessionStorageRef, FIRST_RUN_SESSION_KEY, 'dismissed');
  }

  feed = createNewsFeed({ document, body: feedBody, layer, onModel });
  tick();
  timers.push(setInterval(tick, 1000), setInterval(syncLayers, 1000));

  return {
    /** Called once the layer manager exists. */
    attachDataManager(manager) {
      dataManager = manager;
      syncLayers();
      if (body.dataset.corantoMode !== 'news' || startedWithLink) return;
      // A fresh visit in news mode: headlines on, whole Earth in view.
      timers.push(
        setTimeout(() => {
          if (!dataManager.isEnabled('news'))
            Promise.resolve(dataManager.setEnabled('news', true)).catch(
              () => {},
            );
          wholeEarth();
        }, 1500),
      );
    },
    destroy() {
      for (const timer of timers) {
        clearInterval(timer);
        clearTimeout(timer);
      }
      document.removeEventListener('keydown', onKey);
      feed?.destroy();
      for (const node of [header, ticker, rail, feedAside, guide])
        node.remove();
      delete body.dataset.corantoMode;
    },
  };
}
