import { CATEGORY_CODE, createNewsFeed } from './newsPanel.js';
import { ELECTION_TERMS, createElectionsLens } from './corantoElections.js';
import { getContextStore } from '../data/contextStore.js';
import { createBoard } from './corantoBoard.js';
import { createBoardStore } from './corantoBoardModel.js';
import { createBroadcasts } from './corantoBroadcasts.js';
import { contactCard } from './corantoContact.js';
import { buildViewUrl, readViewFromSearch } from './corantoLink.js';
import { TOPIC_COLOURS, iconImage } from '../data/corantoIcons.js';
import { ATLAS_OVERLAYS, createAtlas } from './corantoAtlas.js';
import { createMapKey } from './corantoMapKey.js';
import { createMarketsLens } from './corantoMarkets.js';
import { createNuclearMarks } from './corantoNuclear.js';
import { createPowerLens } from './corantoPower.js';
import {
  WATCH_LIMIT,
  briefingText,
  buildBriefing,
  createWatchStore,
  hasCriteria,
  watchStories,
} from './watches.js';

const MODE_KEY = 'coranto.mode.v1';
const ATLAS_KEY = 'coranto.atlas.v1';
/** Borders are on unless switched off, as in AUSPEX. */
const ATLAS_DEFAULTS = { borders: true, countries: false, cities: false };
const WELCOME_KEY = 'coranto.welcomed.v1';
const FIRST_RUN_SESSION_KEY = 'gev:first-run-mission-session:v1';

/** Place names drawn on the globe in the NEWS lens. */
const NEWS_LABELS_IN_NEWS = 16;

/** Header layers whose symbols the map key explains itself. */
const KEYED_LAYERS = new Set(['hazards', 'local-firms', 'ais-live-vessels']);

/** Live layers offered in the header. Ids are catalog layer ids. */
const HEADER_LAYERS = [
  [
    'hazards',
    'HAZARDS',
    'Cyclones, floods, volcanoes and more (GDACS, NASA)',
    'hazard',
  ],
  ['flights', 'FLIGHTS', 'Live civil aircraft', 'aircraft'],
  [
    'military',
    'MILITARY',
    'Military aircraft broadcasting their position',
    'military',
  ],
  ['ais-live-vessels', 'SHIPS', 'Live vessels broadcasting over AIS', 'ship'],
  [
    'satellites',
    'SATELLITES',
    'Satellites from public orbital elements',
    'satellite',
  ],
  ['earthquakes', 'QUAKES', 'USGS earthquakes, last 24 hours', 'earthquake'],
  [
    'local-firms',
    'FIRES',
    'Active fires seen by NASA satellites in the last 24 hours',
    'wildfire',
  ],
  ['weather-cyclones', 'STORMS', 'NOAA tropical cyclones', 'cyclone'],
  [
    'rocket-launches',
    'LAUNCHES',
    'Recent and upcoming rocket launches. Satellites show too while this is on; they go back to how they were when you switch it off.',
    'launch',
  ],
  ['telegeography-submarine-cables', 'CABLES', 'Undersea cables', 'cable'],
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
    'Search',
    'Type in the search box above the feed (or press /) to keep only stories that mention your words, in the headline, summary, publisher or place. Esc clears it.',
  ],
  [
    'Follow what matters to you',
    'Set a search, a place or a topic, then press SAVE THIS VIEW. It becomes a watch on the left with a count of new stories. MY BRIEFING lists the latest stories for every watch on one page. Watches are kept in this browser only.',
  ],
  [
    'Add live layers',
    'The buttons along the top add other public feeds to the same globe: natural hazards, aircraft, military flights, ships, satellites, earthquakes, storms and more. Click a hazard marker to see what it is and open its source.',
  ],
  [
    'Watch power',
    'WATCH POWER on the left switches on military aircraft, mapped military sites and plate-reader cameras, and lists the aircraft airborne now. Each one links to its live public track. It watches institutions and equipment, not people.',
  ],
  [
    'Follow elections',
    'ELECTIONS on the left lists polling days in the next 120 days as Wikidata records them, marks them on the globe, and narrows the feed to election news. Click one to see that country’s election stories. Dates come from a volunteer-edited database, so check the official body.',
  ],
  [
    'Markets and live TV',
    'MARKETS shows exchange rates and crypto prices with their source and time, beside finance news. LIVE TV plays live news channels from every continent here in the app and pins each newsroom on the globe.',
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

/** `3 min ago`, `2 h ago`, `1 d ago` */
function relativeAge(ms) {
  const minutes = Math.max(0, Math.floor((Date.now() - ms) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.floor(hours / 24)} d ago`;
}

const LIVE_LABELS = {
  loading: 'CONNECTING',
  down: 'NO SOURCE REACHABLE',
  stale: 'SAVED RESULTS',
};

/** `GDACS · since 6 Oct 2026` */
function hazardMeta(item) {
  const started = new Date(item.startedAt);
  const month = started.toLocaleString('en-GB', { month: 'short' });
  return `${item.source} · since ${started.getDate()} ${month} ${started.getFullYear()}`;
}

/** The briefing copy button's wording before, after and on a failed copy. */
const RANGE_WORDS = {
  24: 'LAST 24 HOURS',
  72: 'LAST 3 DAYS',
  168: 'LAST 7 DAYS',
};

/** The one line over the globe that says what the lens is showing. */
function hudLensLine(lens, view) {
  if (lens === 'power')
    return 'WATCH POWER // MILITARY AND GOVERNMENT AIRCRAFT, BASES';
  if (lens === 'elections') return 'ELECTIONS // POLLING DAYS, NEXT 120 DAYS';
  if (lens === 'markets') return 'MARKETS // FINANCE STORIES BY PLACE';
  const places = view.places?.length ?? 0;
  const range = RANGE_WORDS[view.rangeHours] ?? RANGE_WORDS[24];
  return view.goodNewsOnly
    ? `GOOD NEWS // ${range} // ${places} PLACES`
    : `STORIES // ${range} // ${places} PLACES`;
}

/** Where the view is centred and how high, from the camera. */
function hudWhereLine(at) {
  const deg = (radians) => (radians * 180) / Math.PI;
  const part = (value, pos, neg) =>
    `${Math.abs(value).toFixed(2)}°${value >= 0 ? pos : neg}`;
  const km = Math.round(at.height / 1000);
  return `${part(deg(at.latitude), 'N', 'S')} ${part(deg(at.longitude), 'E', 'W')} // ALT ${km.toLocaleString('en-GB')} KM`;
}

/** The header button for the analyst board. */
function boardLabel(count) {
  return count ? `BOARD · ${count}` : 'BOARD';
}

/** The pin button on a card. */
function pinLabel(pinned, full) {
  if (pinned) return 'Unpin from the board';
  return full ? 'The board is full' : 'Pin to the board';
}

/** What to tell the reader after SAVE THIS VIEW is pressed. */
function saveNoteText(saved, hadCriteria, count) {
  if (saved) return `Saved as ${saved.name}. It is listed below.`;
  if (!hadCriteria)
    return 'Nothing to save yet. Type a search, choose a topic or select a place on the globe, then press save.';
  return count >= WATCH_LIMIT
    ? `You have ${WATCH_LIMIT} watches, the most this browser keeps. Remove one to save another.`
    : 'This view is already saved below.';
}

function briefingCopyLabel(copied) {
  if (copied === null) return 'Copy as text';
  return copied ? 'Copied' : 'Copy blocked';
}

/** The share button's wording before, after and on a failed copy. */
function copyLabel(copied) {
  if (copied === null) return 'SHARE VIEW';
  return copied ? 'LINK COPIED' : 'COPY BLOCKED';
}

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
  // A Coranto link carries a view to reopen (see corantoLink.js).
  let sharedView = readViewFromSearch(win.location?.search);

  // ── Header ──────────────────────────────────────────────────────
  const liveBtn = el(document, 'button', {
    id: 'coranto-live',
    type: 'button',
    title: 'Show or hide the list of sources and whether each is answering',
    'aria-expanded': 'false',
    'aria-controls': 'coranto-sources-menu',
  });
  // The list of sources that drops down from the LIVE button.
  const sourcesMenu = el(document, 'div', {
    id: 'coranto-sources-menu',
    role: 'region',
    'aria-label': 'News sources and whether each is answering',
  });
  sourcesMenu.hidden = true;
  let sourceRowsShown = [];
  function renderSourcesMenu() {
    if (sourcesMenu.hidden) return;
    const rows = sourceRowsShown;
    const groups = [
      ['down', 'NOT ANSWERING'],
      ['ok', 'LIVE'],
      ['off', 'NOT SET UP'],
    ];
    const nodes = [];
    for (const [state, heading] of groups) {
      const members = rows.filter((row) => row.state === state);
      if (!members.length) continue;
      nodes.push(
        el(document, 'div', {
          class: 'coranto-sources-heading',
          text: `${heading} · ${members.length}`,
        }),
      );
      for (const row of members)
        nodes.push(
          el(
            document,
            'div',
            { class: 'coranto-source-row', 'data-state': row.state },
            el(document, 'span', { class: 'coranto-source-dot' }),
            el(document, 'span', {
              class: 'coranto-source-name',
              text: row.name,
            }),
            el(document, 'span', {
              class: 'coranto-source-detail',
              text: row.detail,
            }),
          ),
        );
    }
    if (!nodes.length)
      nodes.push(
        el(document, 'p', {
          class: 'coranto-power-none',
          text: 'Still connecting to the sources…',
        }),
      );
    sourcesMenu.replaceChildren(...nodes);
  }
  function setSourcesMenu(open) {
    sourcesMenu.hidden = !open;
    liveBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      // Sit directly under the button, wherever the header has put it.
      const box = liveBtn.getBoundingClientRect();
      sourcesMenu.style.left = `${Math.max(8, Math.round(box.left))}px`;
      sourcesMenu.style.top = `${Math.round(box.bottom + 6)}px`;
      renderSourcesMenu();
    }
  }
  const liveDot = el(document, 'span', { class: 'coranto-live-dot' });
  const liveText = el(document, 'span', { text: 'CONNECTING' });
  liveBtn.append(liveDot, liveText);

  const layerNav = el(document, 'nav', {
    id: 'coranto-layers',
    'aria-label': 'Live layers',
  });
  const layerButtons = new Map();
  for (const [id, label, title, icon] of HEADER_LAYERS) {
    const button = el(
      document,
      'button',
      {
        type: 'button',
        class: 'coranto-layer',
        title,
        'aria-pressed': 'false',
      },
      el(document, 'img', { src: iconImage(icon, '#c9c2de'), alt: '' }),
      el(document, 'span', { text: label }),
    );
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

  // The analyst board is one button in the header, so it is there in both
  // NEWS and INSTRUMENTS.
  const boardStore = createBoardStore({ storage: localStorageRef });
  const boardBtn = el(
    document,
    'button',
    {
      type: 'button',
      id: 'coranto-board-btn',
      title:
        'The analyst board: what you have pinned, how it connects, and a brief worked out from it',
    },
    el(document, 'img', { src: iconImage('key', '#c9c2de'), alt: '' }),
    el(document, 'span'),
  );
  const syncBoardButton = () => {
    boardBtn.lastElementChild.textContent = boardLabel(
      boardStore.list().length,
    );
  };
  syncBoardButton();
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
  const menuBtn = el(document, 'button', {
    id: 'coranto-menu',
    type: 'button',
    text: 'MENU',
    title: 'Lenses, topics and your watches',
    'aria-expanded': 'false',
  });
  menuBtn.addEventListener('click', () => {
    const open = body.dataset.corantoMenu !== 'open';
    if (open) body.dataset.corantoMenu = 'open';
    else delete body.dataset.corantoMenu;
    menuBtn.setAttribute('aria-expanded', String(open));
  });
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
          el(document, 'em', { text: 'CORANTO' }),
        ),
        el(document, 'div', {
          class: 'coranto-tagline',
          text: 'WATCH THE WORLD BACK',
        }),
      ),
    ),
    liveBtn,
    menuBtn,
    layerNav,
    count,
    clock,
    boardBtn,
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
  const topicCount = el(document, 'small');
  const topicList = el(
    document,
    'div',
    { class: 'coranto-topics' },
    el(
      document,
      'div',
      { class: 'coranto-strip' },
      el(document, 'span', { text: 'TOPICS' }),
      topicCount,
    ),
  );
  const topicButtons = new Map();
  for (const [id, label] of CATEGORIES) {
    const button = el(document, 'button', {
      type: 'button',
      class: 'coranto-topic',
      'data-category': id ?? 'all',
    });
    const number = el(document, 'span', { class: 'coranto-topic-count' });
    button.append(
      el(document, 'img', {
        class: 'coranto-topic-icon',
        src: iconImage(id ?? 'news', TOPIC_COLOURS[id ?? 'news']),
        alt: '',
      }),
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
    el(document, 'img', {
      class: 'coranto-topic-icon',
      src: iconImage('good', TOPIC_COLOURS.good),
      alt: '',
    }),
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
  const lensNews = el(document, 'button', {
    type: 'button',
    text: 'NEWS',
    'data-lens': 'news',
    title: 'News: topics and your watches',
    'aria-pressed': 'true',
  });
  const lensPower = el(document, 'button', {
    type: 'button',
    text: 'POWER',
    'data-lens': 'power',
    title:
      'Watch Power: military and government aircraft, military sites and plate readers, from public sources',
    'aria-pressed': 'false',
  });
  const lensElections = el(document, 'button', {
    type: 'button',
    text: 'VOTES',
    'data-lens': 'elections',
    title:
      'Elections: upcoming polling days, US campaign money and election news',
    'aria-pressed': 'false',
  });
  const lensMarkets = el(document, 'button', {
    type: 'button',
    text: 'MARKETS',
    'data-lens': 'markets',
    title:
      'Markets: indices, oil, exchange rates and crypto, with finance news',
    'aria-pressed': 'false',
  });
  const lensSwitch = el(
    document,
    'div',
    { class: 'coranto-lens-switch', role: 'group', 'aria-label': 'Lens' },
    lensNews,
    lensPower,
    lensElections,
    lensMarkets,
  );
  const markets = createMarketsLens({ document });
  const board = createBoard({
    document,
    store: boardStore,
    getArticles: () => layer.getView().snapshot?.articles ?? [],
    onOpen: (asset) => {
      board.close();
      if (body.dataset.corantoMode !== 'news') setMode('news');
      if (asset.kind === 'story') feed?.openStory(asset.key);
      else {
        const place = (layer.getView().places ?? []).find(
          (entry) =>
            entry.precision === asset.kind && entry.name === asset.title,
        );
        if (place) layer.selectPlace(place.key, { focus: true });
        else flyTo(asset.lat, asset.lon, 3_000_000);
      }
    },
    onChange: () => {
      syncBoardButton();
      feed?.render();
    },
  });
  boardBtn.addEventListener('click', () => board.open());
  const tv = createBroadcasts({
    document,
    getViewer: () => dataManager?.viewer ?? null,
  });
  const elections = createElectionsLens({
    document,
    getDataManager: () => dataManager,
    showCard: (detail) => {
      if (detail) card.dataset.owner = 'elections';
      else if (card.dataset.owner !== 'elections') return;
      showCard(detail);
    },
    onCountry: (country) =>
      feed?.setQuery(country ? country.toLowerCase() : ''),
  });
  const power = createPowerLens({
    document,
    getDataManager: () => dataManager,
    showCard: (detail) => {
      card.dataset.owner = 'power';
      showCard(detail);
    },
  });

  const tvBtn = el(document, 'button', {
    type: 'button',
    class: 'coranto-rail-btn',
    text: 'LIVE TV',
    title:
      'Watch live television news here, with each newsroom pinned on the globe',
  });
  const shareBtn = el(document, 'button', {
    type: 'button',
    class: 'coranto-rail-btn',
    text: 'SHARE VIEW',
    title: 'Copy a link that reopens this lens, search and place',
  });
  const keyBtn = el(document, 'button', {
    type: 'button',
    class: 'coranto-rail-btn',
    text: 'MAP KEY',
    title: 'Show or hide what each marker on the globe means',
    'aria-expanded': 'false',
    'aria-controls': 'coranto-key',
  });
  // Nuclear-armed states are always marked, as in AUSPEX.
  const nuclear = createNuclearMarks({
    getViewer: () => dataManager?.viewer ?? null,
    showCard: (detail) => {
      card.dataset.owner = 'nuclear';
      showCard(detail);
    },
  });
  // AUSPEX's atlas overlays: borders, countries, cities.
  const atlas = createAtlas({
    getViewer: () => dataManager?.viewer ?? null,
    showCard: (detail) => {
      card.dataset.owner = 'atlas';
      const pin = detail?.pin;
      const withAction = () =>
        showCard({
          ...detail,
          action: pin && {
            label: pinLabel(boardStore.has(pin.key), boardStore.full),
            run: () => {
              boardStore.toggle(pin);
              withAction();
            },
          },
        });
      withAction();
    },
    // Narrow the feed to the place when current stories name it.
    selectPlace: (kind, name) => {
      const group = (layer.getView().places ?? []).find(
        (place) => place.precision === kind && place.name === name,
      );
      if (group) layer.selectPlace(group.key);
      return group ? group.articles.length : 0;
    },
  });
  let atlasWanted = { ...ATLAS_DEFAULTS };
  try {
    atlasWanted = {
      ...ATLAS_DEFAULTS,
      ...JSON.parse(readStored(localStorageRef, ATLAS_KEY) ?? '{}'),
    };
  } catch {
    atlasWanted = { ...ATLAS_DEFAULTS };
  }
  const atlasButtons = new Map();
  const atlasList = el(document, 'div', { class: 'coranto-switches' });
  async function setAtlas(name, on, { remember = true } = {}) {
    atlasWanted[name] = Boolean(on);
    if (remember)
      writeStored(localStorageRef, ATLAS_KEY, JSON.stringify(atlasWanted));
    const button = atlasButtons.get(name);
    button.setAttribute('aria-pressed', String(Boolean(on)));
    button.dataset.busy = 'true';
    const now = await atlas.set(name, on);
    delete button.dataset.busy;
    button.setAttribute('aria-pressed', String(now));
    // The full country markers carry the nuclear mark themselves.
    if (name === 'countries') {
      if (now) nuclear.hide();
      else if (body.dataset.corantoFrame === 'one') nuclear.show();
    }
    renderMapKey();
  }
  for (const [name, label] of ATLAS_OVERLAYS) {
    const button = el(
      document,
      'button',
      {
        type: 'button',
        class: 'coranto-switch',
        'aria-pressed': String(Boolean(atlasWanted[name])),
      },
      el(document, 'span', { class: 'coranto-switch-label', text: label }),
      el(document, 'span', { class: 'coranto-switch-knob' }),
    );
    button.addEventListener('click', () =>
      setAtlas(name, button.getAttribute('aria-pressed') !== 'true'),
    );
    atlasButtons.set(name, button);
    atlasList.append(button);
  }
  const atlasSection = el(
    document,
    'div',
    { class: 'coranto-overlays coranto-bracket' },
    el(document, 'div', {
      class: 'coranto-rail-heading',
      text: 'MAP OVERLAYS',
    }),
    atlasList,
  );
  const mapKey = createMapKey({
    document,
    onClose: () => setMapKey(false),
  });
  function renderMapKey() {
    if (mapKey.element.hidden || !dataManager) return;
    const on = (id) =>
      Boolean(dataManager.layers?.has(id) && dataManager.isEnabled(id));
    const view = layer.getView();
    mapKey.render({
      news: on('news'),
      goodNewsOnly: Boolean(view.goodNewsOnly),
      hazardKinds: on('hazards')
        ? (hazardsLayer?.getView?.()?.snapshot?.events ?? []).map(
            (event) => event.kind,
          )
        : [],
      elections: on('elections'),
      fires: on('local-firms'),
      governmentAircraft: lens === 'power',
      nuclear: nuclear.shown,
      broadcasts: tv.isOpen,
      ships: on('ais-live-vessels'),
      borders: atlas.isOn('borders'),
      countries: atlas.isOn('countries'),
      cityTypes: atlas.cityTypes(),
      otherLayers: HEADER_LAYERS.filter(
        ([id]) => !KEYED_LAYERS.has(id) && on(id),
      ).map(([, label]) => label),
    });
  }
  function setMapKey(open) {
    mapKey.element.hidden = !open;
    keyBtn.setAttribute('aria-expanded', String(open));
    renderMapKey();
  }
  keyBtn.addEventListener('click', () => setMapKey(mapKey.element.hidden));
  const briefingBtn = el(document, 'button', {
    type: 'button',
    class: 'coranto-rail-btn coranto-rail-briefing',
    text: 'MY BRIEFING',
    title: 'The latest stories for every watch you have saved',
  });
  const saveBtn = el(
    document,
    'button',
    {
      type: 'button',
      class: 'coranto-watch-save',
      title:
        'Save the current search, place and topic as a watch. Kept in this browser only.',
    },
    el(document, 'img', { src: iconImage('plus', '#b47cff'), alt: '' }),
    el(document, 'span', { text: 'SAVE THIS VIEW' }),
  );
  const saveNote = el(document, 'p', {
    class: 'coranto-watch-note',
    role: 'status',
  });
  saveNote.hidden = true;
  const watchList = el(document, 'div', { class: 'coranto-watch-list' });
  const watchSection = el(
    document,
    'div',
    { class: 'coranto-watches' },
    el(document, 'div', { class: 'coranto-rail-heading', text: 'MY WATCHES' }),
    saveBtn,
    saveNote,
    watchList,
  );
  for (const node of [topicList, watchSection])
    node.classList.add('coranto-bracket');
  const rail = el(
    document,
    'nav',
    { id: 'coranto-rail', 'aria-label': 'Topics and watches' },
    el(
      document,
      'div',
      { class: 'coranto-rail-actions' },
      guideBtn,
      sourcesBtn,
      homeBtn,
      tvBtn,
      shareBtn,
      keyBtn,
      briefingBtn,
    ),
    lensSwitch,
    atlasSection,
    topicList,
    watchSection,
    power.element,
    elections.element,
    markets.element,
  );

  // ── Feed ────────────────────────────────────────────────────────
  const feedCount = el(document, 'span', { class: 'coranto-feed-count' });
  const groupStories = el(document, 'button', {
    type: 'button',
    text: 'STORIES',
    title: 'One card per story, with every outlet that carried it',
    'aria-pressed': 'true',
  });
  const groupAll = el(document, 'button', {
    type: 'button',
    text: 'EVERY HEADLINE',
    title: 'Every headline on its own, ungrouped',
    'aria-pressed': 'false',
  });
  const groupSwitch = el(
    document,
    'div',
    { class: 'coranto-group-switch', role: 'group', 'aria-label': 'Grouping' },
    groupStories,
    groupAll,
  );
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
      groupSwitch,
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
      el(document, 'p', {
        class: 'coranto-guide-welcome',
        text: 'Welcome to Coranto. Everything here is a real headline from a named publisher, pinned to the place it names. Nothing is invented, and every item links to its source. This guide is always under GUIDE on the left.',
      }),
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

  // ── Briefing ────────────────────────────────────────────────────
  const briefingBody = el(document, 'div', { class: 'coranto-briefing-body' });
  const briefingClose = el(document, 'button', {
    type: 'button',
    class: 'coranto-guide-close',
    text: 'Close',
  });
  const briefingSeen = el(document, 'button', {
    type: 'button',
    class: 'coranto-guide-close coranto-briefing-seen',
    text: 'Mark all as read',
  });
  const briefingCopy = el(document, 'button', {
    type: 'button',
    class: 'coranto-guide-close coranto-briefing-seen',
    text: 'Copy as text',
    title: 'Copy the briefing with every link, for a note or a message',
  });
  const briefing = el(
    document,
    'div',
    { id: 'coranto-briefing', role: 'dialog', 'aria-label': 'My briefing' },
    el(
      document,
      'div',
      { class: 'coranto-guide-card coranto-briefing-card' },
      el(document, 'div', {
        class: 'coranto-guide-kicker',
        text: 'CORANTO · MY BRIEFING',
      }),
      el(document, 'h2', { text: 'What you follow, right now' }),
      el(document, 'p', {
        class: 'coranto-briefing-note',
        text: 'Publisher headlines selected by your watches. Nothing here is rewritten or ranked; each list is newest first.',
      }),
      briefingBody,
      el(
        document,
        'div',
        { class: 'coranto-briefing-actions' },
        briefingCopy,
        briefingSeen,
        briefingClose,
      ),
    ),
  );
  briefing.hidden = true;

  // ── Selected-event card ─────────────────────────────────────────
  const cardKind = el(document, 'span', { class: 'coranto-card-kind' });
  const cardTitle = el(document, 'div', { class: 'coranto-card-title' });
  const cardMeta = el(document, 'div', { class: 'coranto-card-meta' });
  const cardLink = el(document, 'a', {
    class: 'coranto-card-link',
    target: '_blank',
    rel: 'noopener noreferrer',
  });
  const cardClose = el(
    document,
    'button',
    { type: 'button', class: 'coranto-card-close', 'aria-label': 'Close' },
    el(document, 'img', { src: iconImage('close', '#d5d0e2'), alt: '' }),
  );
  // An optional second button on a card, such as PIN TO BOARD.
  const cardAction = el(document, 'button', {
    type: 'button',
    class: 'coranto-card-action',
  });
  let cardActionRun = null;
  cardAction.addEventListener('click', () => cardActionRun?.());
  const card = el(
    document,
    'aside',
    { id: 'coranto-card', 'aria-label': 'Selected event' },
    el(document, 'div', { class: 'coranto-card-head' }, cardKind, cardClose),
    cardTitle,
    cardMeta,
    cardAction,
    cardLink,
  );
  card.hidden = true;
  let hazardsLayer = null;
  let unsubscribeHazards = null;

  let cardOnClose = null;

  /** Show the event card for a hazard, an aircraft or anything with a source. */
  function showCard(detail) {
    card.hidden = !detail;
    cardOnClose = detail?.onClose ?? null;
    if (!detail) return;
    card.dataset.alert = detail.alert ?? 'none';
    cardKind.textContent = detail.kind;
    cardTitle.textContent = detail.title;
    cardMeta.textContent = detail.meta;
    cardAction.hidden = !detail.action;
    cardActionRun = detail.action?.run ?? null;
    if (detail.action) cardAction.textContent = detail.action.label;
    cardLink.hidden = !detail.url;
    if (detail.url) {
      cardLink.href = detail.url;
      cardLink.textContent = detail.linkText;
    }
  }

  // Whatever the engine has selected (an aircraft, a ship, a mapped site)
  // gets a card too, so tracking detail shows without leaving the news view.
  let contactId = null;
  let contactDismissed = null;
  function pollContact() {
    if (body.dataset.corantoMode !== 'news') return;
    let record = null;
    try {
      const store = getContextStore();
      record = store.selectedEntityId
        ? (store.entities.get(store.selectedEntityId) ?? null)
        : null;
    } catch {
      record = null;
    }
    const id = record?.id ?? null;
    if (id && id === contactDismissed) return;
    if (!id) contactDismissed = null;
    const detail = id ? contactCard(record) : null;
    if (!detail) {
      if (contactId && card.dataset.owner === 'contact') showCard(null);
      contactId = null;
      return;
    }
    // Another lens's card stays until the reader picks a different contact.
    if (id === contactId && card.dataset.owner !== 'contact') return;
    contactId = id;
    card.dataset.owner = 'contact';
    showCard({
      ...detail,
      onClose: () => {
        contactDismissed = id;
        contactId = null;
      },
    });
  }

  function renderCard(view) {
    const item = view?.enabled ? view.selected : null;
    if (!item) {
      // Leave a card another lens opened alone.
      if (card.dataset.owner === 'hazard') showCard(null);
      return;
    }
    let host = '';
    try {
      host = new URL(item.url).hostname.replace(/^www\./, '');
    } catch {
      host = 'source';
    }
    card.dataset.owner = 'hazard';
    showCard({
      alert: item.alert,
      kind: item.alert
        ? `${item.kind.toUpperCase()} · ${item.alert.toUpperCase()} ALERT`
        : item.kind.toUpperCase(),
      title: item.title,
      meta: hazardMeta(item),
      url: item.url,
      linkText: `Open at ${host}`,
      onClose: () => hazardsLayer?.select(null),
    });
  }
  cardClose.addEventListener('click', () => {
    const close = cardOnClose;
    showCard(null);
    close?.();
  });

  // The frame over the globe: corner brackets, one line saying what the lens
  // is showing, and where the view is centred. It takes no clicks.
  const hudLens = el(document, 'div', { class: 'coranto-hud-lens' });
  const hudWhere = el(document, 'div', { class: 'coranto-hud-where' });
  const hud = el(
    document,
    'div',
    { id: 'coranto-hud', 'aria-hidden': 'true' },
    el(document, 'i', { class: 'coranto-hud-c coranto-hud-tl' }),
    el(document, 'i', { class: 'coranto-hud-c coranto-hud-tr' }),
    el(document, 'i', { class: 'coranto-hud-c coranto-hud-bl' }),
    el(document, 'i', { class: 'coranto-hud-c coranto-hud-br' }),
    hudLens,
    hudWhere,
  );
  function updateHud() {
    const view = layer.getView();
    hudLens.textContent = hudLensLine(lens, view);
    const at = dataManager?.viewer?.camera?.positionCartographic;
    hudWhere.textContent = at ? hudWhereLine(at) : '';
  }

  body.append(
    header,
    hud,
    sourcesMenu,
    mapKey.element,
    board.element,
    ticker,
    rail,
    feedAside,
    card,
    guide,
    briefing,
    tv.element,
  );

  // ── Behaviour ───────────────────────────────────────────────────
  const watchStore = createWatchStore({ storage: localStorageRef });

  function currentCriteria() {
    const view = layer.getView();
    return {
      ...(feed?.getFilters() ?? {}),
      category,
      placeKey: view.selectedPlaceKey,
      language: view.language,
      goodNews: view.goodNewsOnly,
    };
  }

  function openWatch(watch) {
    const c = watch.criteria;
    category = c.category;
    layer.setLanguage(c.language);
    layer.setGoodNewsOnly(c.goodNews);
    layer.selectPlace(c.placeKey, { focus: Boolean(c.placeKey) });
    feed?.setFilters({
      query: c.query,
      category: c.category,
      publisher: c.publisher,
    });
    watchStore.markSeen([watch.id]);
    renderWatches();
  }

  function renderWatches() {
    const snapshot = layer.getView().snapshot;
    const watches = watchStore.list();
    watchList.replaceChildren(
      ...watches.map((watch) => {
        const { total, fresh } = watchStories(snapshot, watch);
        const open = el(document, 'button', {
          type: 'button',
          class: 'coranto-watch',
          title: `Show this watch: ${total} current ${total === 1 ? 'story' : 'stories'}`,
        });
        open.append(
          el(document, 'span', {
            class: 'coranto-watch-name',
            text: watch.name,
          }),
          el(document, 'span', {
            class: 'coranto-watch-count',
            text: fresh ? `${fresh} new` : String(total),
            ...(fresh ? { 'data-fresh': 'true' } : {}),
          }),
        );
        open.addEventListener('click', () => openWatch(watch));
        const remove = el(
          document,
          'button',
          {
            type: 'button',
            class: 'coranto-watch-remove',
            'aria-label': `Remove the watch ${watch.name}`,
            title: 'Remove this watch',
          },
          el(document, 'img', { src: iconImage('close', '#a9a2bf'), alt: '' }),
        );
        remove.addEventListener('click', () => {
          watchStore.remove(watch.id);
          renderWatches();
        });
        return el(
          document,
          'div',
          { class: 'coranto-watch-row' },
          open,
          remove,
        );
      }),
    );
    const freshTotal = watches.reduce(
      (sum, watch) => sum + watchStories(snapshot, watch).fresh,
      0,
    );
    briefingBtn.textContent = freshTotal
      ? `MY BRIEFING · ${freshTotal} NEW`
      : 'MY BRIEFING';
    briefingBtn.hidden = watches.length === 0;
    saveBtn.dataset.ready = String(hasCriteria(currentCriteria()));
  }

  function renderBriefing() {
    const sections = buildBriefing(layer.getView().snapshot, watchStore.list());
    briefingBody.replaceChildren(
      ...sections.map(({ watch, stories, total, fresh }) => {
        const head = el(
          document,
          'div',
          { class: 'coranto-briefing-head' },
          el(document, 'h3', { text: watch.name }),
          el(document, 'span', {
            text: fresh
              ? `${fresh} new · ${total} current`
              : `${total} current`,
          }),
        );
        const list = el(document, 'ol', { class: 'coranto-briefing-list' });
        for (const story of stories) {
          const link = el(document, 'a', {
            href: story.url,
            target: '_blank',
            rel: 'noopener noreferrer',
            text: story.title,
            title: 'Open this story here',
          });
          // A plain click opens the story in the app, over the globe.
          link.addEventListener('click', (event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey) return;
            event.preventDefault();
            closeBriefing();
            feed?.openStory(story.id);
          });
          const meta = [
            CATEGORY_CODE[story.category] ?? 'NEWS',
            story.publisher,
            relativeAge(story.newest),
            story.outlets > 1 ? `${story.outlets} outlets` : '',
            story.differing.length ? 'figures differ' : '',
          ].filter(Boolean);
          list.append(
            el(
              document,
              'li',
              {
                'data-category': story.category || 'none',
                ...(story.fresh ? { 'data-fresh': 'true' } : {}),
              },
              link,
              el(document, 'span', { text: meta.join(' · ') }),
            ),
          );
        }
        if (!stories.length)
          list.append(
            el(
              document,
              'li',
              { class: 'coranto-briefing-none' },
              el(document, 'span', {
                text: 'No current story matches this watch.',
              }),
            ),
          );
        const openBtn = el(document, 'button', {
          type: 'button',
          class: 'coranto-briefing-open',
          text:
            total > stories.length
              ? `Show all ${total} in the feed`
              : 'Show in the feed',
        });
        openBtn.addEventListener('click', () => {
          briefing.hidden = true;
          openWatch(watch);
        });
        return el(
          document,
          'section',
          { class: 'coranto-briefing-section' },
          head,
          list,
          openBtn,
        );
      }),
    );
  }

  let lens = 'news';
  /**
   * Text on the globe follows the lens. In NEWS the busiest places are named;
   * in the other lenses the story icons stay but their names step back, so
   * the lens's own subject is what you read. Hazards are named only when
   * selected: the icon already says what kind each one is.
   */
  function applyGlobeText() {
    if (body.dataset.corantoFrame !== 'one') return;
    layer.setLabelLimit?.(lens === 'news' ? NEWS_LABELS_IN_NEWS : 0);
    hazardsLayer?.setAmbientLabels?.(false);
  }
  function setLens(next) {
    if (next === lens) return;
    // Each lens starts at the top of the rail.
    rail.scrollTop = 0;
    // Undo what the lens being left set up.
    if (lens === 'power') {
      if (card.dataset.owner === 'power') showCard(null);
      power.leave();
    } else if (lens === 'elections') {
      if (card.dataset.owner === 'elections') showCard(null);
      elections.leave();
      feed?.setAny([]);
      feed?.setQuery('');
    } else if (lens === 'markets') markets.leave();
    lens = next;
    lensNews.setAttribute('aria-pressed', String(lens === 'news'));
    lensPower.setAttribute('aria-pressed', String(lens === 'power'));
    lensElections.setAttribute('aria-pressed', String(lens === 'elections'));
    lensMarkets.setAttribute('aria-pressed', String(lens === 'markets'));
    topicList.hidden = lens !== 'news';
    watchSection.hidden = lens !== 'news';
    layer.setGoodNewsOnly(false);
    // Each lens shows its own slice of the news beside it.
    category =
      lens === 'power' ? 'military' : lens === 'markets' ? 'finance' : null;
    feed?.setCategory(category);
    applyGlobeText();
    if (lens === 'power') power.enter();
    if (lens === 'markets') markets.enter();
    if (lens === 'elections') {
      feed?.setAny(ELECTION_TERMS);
      elections.enter();
    }
  }

  /** The news view always has its headlines on (people only). */
  function ensureNewsOn() {
    if (
      body.dataset.corantoFrame === 'one' &&
      body.dataset.corantoMode === 'news' &&
      dataManager?.layers?.has('news') &&
      !dataManager.isEnabled('news')
    )
      Promise.resolve(dataManager.setEnabled('news', true)).catch(() => {});
  }

  function setMode(mode, { remember = true } = {}) {
    const next = mode === 'instruments' ? 'instruments' : 'news';
    body.dataset.corantoMode = next;
    modeNews.setAttribute('aria-pressed', String(next === 'news'));
    modeTools.setAttribute('aria-pressed', String(next === 'instruments'));
    if (remember) writeStored(localStorageRef, MODE_KEY, next);
    ensureNewsOn();
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
    renderMapKey();
  }

  function tick() {
    const date = new Date();
    clock.dateTime = date.toISOString();
    clock.textContent = `UTC ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}Z`;
    updateHud();
  }

  function flyTo(lat, lon, height) {
    const camera = dataManager?.viewer?.camera;
    if (!camera || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
    camera.cancelFlight?.();
    camera.flyTo({
      destination:
        dataManager.viewer.scene.globe.ellipsoid.cartographicToCartesian(
          camera.positionCartographic.constructor.fromDegrees(lon, lat, height),
        ),
      orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
      duration: 1.6,
    });
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

  function applySharedView() {
    if (!sharedView || !layer.getView().snapshot) return;
    const view = sharedView;
    sharedView = null;
    setLens(view.lens);
    const c = view.criteria;
    if (view.lens === 'news') category = c.category;
    layer.setLanguage(c.language);
    layer.setGoodNewsOnly(c.goodNews);
    layer.selectPlace(c.placeKey);
    feed?.setFilters({
      query: c.query,
      category: view.lens === 'news' ? c.category : category,
      publisher: c.publisher,
    });
  }

  function onModel(model) {
    if (sharedView) {
      // Deferred: applying it re-enters this render.
      win.setTimeout(applySharedView, 0);
    }
    const state = model.healthState;
    liveBtn.dataset.state = state;
    sourceRowsShown = model.sources;
    renderSourcesMenu();
    const sources = model.sources.filter((source) => source.state !== 'off');
    const live = sources.filter((source) => source.state === 'ok').length;
    liveText.textContent = liveLabel(state, live, sources.length);
    count.textContent = model.total ? `${model.total} HEADLINES` : '';
    topicCount.textContent = count.textContent;
    feedCount.textContent = !model.total
      ? ''
      : model.grouped
        ? `${model.shown} STORIES · ${model.headlines} HEADLINES`
        : `${model.shown} OF ${model.total}`;
    groupStories.setAttribute('aria-pressed', String(model.grouped));
    groupAll.setAttribute('aria-pressed', String(!model.grouped));

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

    renderWatches();
    if (!briefing.hidden) renderBriefing();
    const tickerView = layer.getView();
    const snapshot = tickerView.snapshot;
    // The ticker follows the feed's language choice.
    const latest = (snapshot?.articles ?? [])
      .filter(
        (article) =>
          !tickerView.language ||
          (article.lang ?? 'en') === tickerView.language,
      )
      .slice(0, 24);
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

  groupStories.addEventListener('click', () => feed?.setGrouped(true));
  groupAll.addEventListener('click', () => feed?.setGrouped(false));
  saveBtn.addEventListener('click', () => {
    const criteria = currentCriteria();
    const saved = watchStore.add(criteria);
    saveNote.hidden = false;
    saveNote.dataset.tone = saved ? 'ok' : 'hint';
    saveNote.textContent = saveNoteText(
      saved,
      hasCriteria(criteria),
      watchStore.list().length,
    );
    if (!saved && !hasCriteria(criteria)) feed?.focusSearch();
    renderWatches();
  });
  briefingBtn.addEventListener('click', () => {
    renderBriefing();
    briefing.hidden = false;
    // Keep the top of the briefing in view.
    briefingClose.focus({ preventScroll: true });
    briefing.firstElementChild.scrollTop = 0;
  });
  const closeBriefing = () => {
    briefing.hidden = true;
    renderWatches();
  };
  briefingClose.addEventListener('click', closeBriefing);
  briefingCopy.addEventListener('click', async () => {
    const text = briefingText(
      buildBriefing(layer.getView().snapshot, watchStore.list()),
      Date.now(),
    );
    let copied = false;
    try {
      await win.navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = false;
    }
    briefingCopy.textContent = briefingCopyLabel(copied);
    win.setTimeout(() => {
      briefingCopy.textContent = briefingCopyLabel(null);
    }, 2200);
  });
  briefingSeen.addEventListener('click', () => {
    watchStore.markSeen();
    renderBriefing();
    renderWatches();
  });
  briefing.addEventListener('click', (event) => {
    if (event.target === briefing) closeBriefing();
  });
  shareBtn.addEventListener('click', async () => {
    const url = buildViewUrl(win.location, {
      lens,
      criteria: currentCriteria(),
    });
    let copied = false;
    try {
      await win.navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      copied = false;
    }
    shareBtn.textContent = copyLabel(copied);
    win.setTimeout(() => {
      shareBtn.textContent = copyLabel(null);
    }, 2200);
  });
  lensNews.addEventListener('click', () => setLens('news'));
  lensPower.addEventListener('click', () => setLens('power'));
  lensElections.addEventListener('click', () => setLens('elections'));
  lensMarkets.addEventListener('click', () => setLens('markets'));
  tvBtn.addEventListener('click', () => {
    tv.toggle();
    tvBtn.setAttribute('aria-pressed', String(tv.isOpen));
    renderMapKey();
  });
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
    // "/" jumps to the search box, as on most reading sites.
    if (
      event.key === '/' &&
      body.dataset.corantoMode === 'news' &&
      !event.metaKey &&
      !event.ctrlKey &&
      !/^(?:INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? '')
    ) {
      event.preventDefault();
      feed?.focusSearch();
      return;
    }
    if (event.key !== 'Escape') return;
    setSourcesMenu(false);
    feed?.closeStory();
    if (!guide.hidden) guide.hidden = true;
    if (!briefing.hidden) closeBriefing();
    tv.close();
    board.close();
  };
  document.addEventListener('keydown', onKey);
  const showSources = () => {
    feed?.showSources(true);
    feedBody.scrollTop = 0;
  };
  liveBtn.addEventListener('click', () => setSourcesMenu(sourcesMenu.hidden));
  // A click anywhere else closes the list.
  const onOutside = (event) => {
    if (sourcesMenu.hidden) return;
    if (liveBtn.contains(event.target) || sourcesMenu.contains(event.target))
      return;
    setSourcesMenu(false);
  };
  document.addEventListener('pointerdown', onOutside);
  sourcesBtn.addEventListener('click', showSources);
  homeBtn.addEventListener('click', wholeEarth);

  const storedMode = readStored(localStorageRef, MODE_KEY);
  // Automated browsers get the control room: the engine's own browser gates
  // drive those panels and expect them on screen.
  const defaultMode = win.navigator?.webdriver ? 'instruments' : 'news';
  // People get one frame: the headline ticker stays under the header in both
  // views. Automated browsers keep the engine's own layout, which its browser
  // gates measure.
  body.dataset.corantoFrame = win.navigator?.webdriver ? 'classic' : 'one';
  setMode(storedMode ?? defaultMode, { remember: false });
  if (body.dataset.corantoMode === 'news') {
    // News opens straight onto the feed; the engine's mission launcher
    // belongs to the control room.
    writeStored(sessionStorageRef, FIRST_RUN_SESSION_KEY, 'dismissed');
  }

  feed = createNewsFeed({
    document,
    body: feedBody,
    layer,
    onModel,
    board: boardStore,
  });
  // First visit: open the guide once. Automated browsers are left alone.
  if (
    body.dataset.corantoMode === 'news' &&
    !win.navigator?.webdriver &&
    readStored(localStorageRef, WELCOME_KEY) === null
  ) {
    guide.dataset.welcome = 'true';
    guide.hidden = false;
    writeStored(localStorageRef, WELCOME_KEY, '1');
  }
  tick();
  timers.push(
    setInterval(tick, 1000),
    setInterval(syncLayers, 1000),
    setInterval(() => power.refresh(), 5000),
    setInterval(pollContact, 800),
  );

  return {
    /** Called once the layer manager exists. */
    attachDataManager(manager) {
      dataManager = manager;
      // People only: automated browsers keep the engine's own scene.
      if (body.dataset.corantoFrame === 'one') {
        nuclear.show();
        for (const [name] of ATLAS_OVERLAYS)
          if (atlasWanted[name]) setAtlas(name, true, { remember: false });
      }
      syncLayers();
      hazardsLayer = manager.layers?.get('hazards')?.module ?? null;
      applyGlobeText();
      unsubscribeHazards = hazardsLayer?.subscribe?.(renderCard) ?? null;
      if (sharedView) {
        // A shared Coranto view always opens in the news view with news on.
        setMode('news', { remember: false });
        timers.push(
          setTimeout(() => {
            if (!dataManager.isEnabled('news'))
              Promise.resolve(dataManager.setEnabled('news', true)).catch(
                () => {},
              );
            // Without a camera in the link, start from the whole globe.
            if (!startedWithLink) wholeEarth();
          }, 1200),
        );
        return;
      }
      if (body.dataset.corantoMode === 'news' && startedWithLink) {
        // A link sets the camera and layers, but the news view is nothing
        // without its headlines: switch them on if the link left them off.
        timers.push(setTimeout(ensureNewsOn, 1500));
        return;
      }
      if (body.dataset.corantoMode !== 'news') return;
      // A fresh visit in news mode: headlines on, whole Earth in view.
      timers.push(
        setTimeout(() => {
          for (const id of ['news', 'hazards'])
            if (dataManager.layers?.has(id) && !dataManager.isEnabled(id))
              Promise.resolve(dataManager.setEnabled(id, true)).catch(() => {});
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
      nuclear.hide();
      atlas.destroy();
      board.destroy();
      document.removeEventListener('pointerdown', onOutside);
      unsubscribeHazards?.();
      feed?.destroy();
      for (const node of [
        header,
        hud,
        sourcesMenu,
        mapKey.element,
        ticker,
        rail,
        feedAside,
        card,
        guide,
        briefing,
        tv.element,
      ])
        node.remove();
      delete body.dataset.corantoMode;
    },
  };
}
