import {
  CATEGORY_CODE,
  SOURCE_STATE_COLOUR,
  createNewsFeed,
} from './newsPanel.js';
import { ELECTION_TERMS, createElectionsLens } from './corantoElections.js';
import { getContextStore } from '../data/contextStore.js';
import {
  ALERT_KEY,
  createNotices,
  hazardNotices,
  outbreakNotices,
  unseen,
  watchAlerts,
} from './corantoAlerts.js';
import { aroundStory } from './corantoAround.js';
import { createAnalyst } from './corantoAnalyst.js';
import { geoOf } from './corantoAnalystModel.js';
import { createBoardStore } from './corantoBoardModel.js';
import {
  BROADCASTERS,
  createBroadcasts,
  nearestBroadcaster,
} from './corantoBroadcasts.js';
import { buildCommands } from './corantoCommandList.js';
import { isAmbiguous, rankCommands } from './corantoCommandModel.js';
import { createCommandPalette } from './corantoCommands.js';
import { createDossier } from './corantoDossier.js';
import { buildDossier } from './corantoDossierModel.js';
import {
  NEARBY_KM,
  contactCard,
  contactPin,
  cardPin,
  contactPosition,
  nearbyStoryPlaces,
} from './corantoContact.js';
import { buildViewUrl, readViewFromSearch } from './corantoLink.js';
import {
  LAYER_ICONS,
  TOPIC_COLOURS,
  iconImage,
  layerIconCss,
} from '../data/corantoIcons.js';
import { ATLAS_OVERLAYS, createAtlas } from './corantoAtlas.js';
import {
  setLaunchClicksOpenMission,
  setObjectBrackets,
  setOrbitsThroughEarth,
  setRealOnly,
} from '../data/corantoPolicy.js';
import { createMapKey } from './corantoMapKey.js';
import { createMarketsLens } from './corantoMarkets.js';
import { createNuclearMarks } from './corantoNuclear.js';
import { createSatelliteIcons } from './corantoSatelliteIcons.js';
import { createSceneRestore } from './corantoSceneRestore.js';
import { createSettings } from './corantoSettings.js';
import { createMoon } from './corantoMoon.js';
import { createOverlays } from './corantoOverlays.js';
import { setSplitFlapText } from '../splitFlap.js';
import { enhanceSelect } from './corantoSelect.js';
import { createSides } from './corantoSides.js';
import {
  clearStored,
  createSettingsStore,
  storedData,
} from './corantoSettingsModel.js';
import { createTransport } from './corantoTransport.js';
import { createPowerLens } from './corantoPower.js';
import { createLaunchIcons } from './corantoLaunchIcons.js';
import { createQuakeIcons } from './corantoQuakeIcons.js';
import { RELIEF_TERMS, createReliefLens } from './corantoRelief.js';
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
const ATLAS_DEFAULTS = {
  borders: true,
  countries: false,
  cities: false,
  activity: false,
};
const WELCOME_KEY = 'coranto.welcomed.v1';
const FIRST_RUN_SESSION_KEY = 'gev:first-run-mission-session:v1';

/** Place names drawn on the globe in the NEWS lens. */
const NEWS_LABELS_IN_NEWS = 16;

/** Header layers whose symbols the map key explains itself. */
const KEYED_LAYERS = new Set([
  'hazards',
  'local-firms',
  'ais-live-vessels',
  'satellites',
  'flights',
  'military',
  'earthquakes',
  'rocket-launches',
  'weather-cyclones',
  'telegeography-submarine-cables',
]);

/** Live layers offered in the header. Ids are catalog layer ids. */
const HEADER_LAYERS = [
  [
    'coranto:stories',
    'STORIES',
    'Story markers and place names on the globe. Off, the feed still runs and the globe is clear of them.',
    'stories',
  ],
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
    'Recent and upcoming rocket launches and what they carried. It does not show the satellite catalogue; SATELLITES does that.',
    'launch',
  ],
  ['telegeography-submarine-cables', 'CABLES', 'Undersea cables', 'cable'],
  // Coranto's own, drawn on the ground under everything else. SILENCE
  // (measured internet outages) is built but has no button for now: it
  // was nearly always empty.
  [
    'coranto:disease',
    'DISEASE',
    'Countries under an official disease outbreak notice (WHO, CDC), by how the disease spreads',
    'disease',
  ],
  [
    'coranto:banner',
    'BANNER',
    'The moving line of latest headlines under the header. Off, everything moves up into its place.',
    'banner',
  ],
];
/** The loading chip's words, as the engine's own layers show them. */
const LOADING_LABELS = Object.freeze({
  loading: 'LOADING LIVE DATA',
  complete: 'LOAD COMPLETE',
  error: 'LOAD FAILED',
});
const OVERLAY_PREFIX = 'coranto:';
const OVERLAYS_KEY = 'coranto.overlays.v1';

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
    'The feed on the right is every current headline from the sources, newest first, in the publisher’s own words. Click a headline to open the story here: its summary, where it was placed, and tools such as a checked AI brief and who else covered it. The link to the original article is at the bottom.',
  ],
  [
    'See where',
    'Each marker is a place that stories name, showing the icon of the topic most of them share. A solid ring is a city. A dashed ring is a country or region, so the position is approximate. Click a marker to see only that place’s stories. MAP KEY explains every symbol on the globe.',
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
    'Type in the search box above the feed (or press /) to keep only stories that mention your words, in the headline, summary, publisher or place. Esc clears it. The box beside it sets how far back to look: the last day, three days, or the whole week Coranto keeps.',
  ],
  [
    'Follow what matters to you',
    'Set a search, a place or a topic, then press SAVE THIS VIEW. It becomes a watch on the left with a count of new stories. MY BRIEFING lists the latest stories for every watch on one page. Watches are kept in this browser only.',
  ],
  [
    'Add live layers',
    'LAYERS at the top adds other public feeds to the same globe: natural hazards, aircraft, military flights, ships, satellites, earthquakes, storms and more. Each has a switch. Click a hazard marker to see what it is and open its source.',
  ],
  [
    'Watch power',
    'POWER on the left switches on military aircraft, mapped military sites and plate-reader cameras, and lists military and government aircraft airborne now. Each one links to its live public track. It watches institutions and equipment, not people.',
  ],
  [
    'Follow elections',
    'VOTES on the left lists polling days in the next 120 days as Wikidata records them, marks them on the globe, and narrows the feed to election news. Click one to see that country’s election stories. Dates come from a volunteer-edited database, so check the official body.',
  ],
  [
    'Markets and live TV',
    'MARKETS shows exchange rates and crypto prices with their source and time, beside finance news. LIVE TV plays live news channels from every continent here in the app and pins each newsroom on the globe.',
  ],
  [
    'Add the atlas',
    'MAP OVERLAYS on the left switches on country borders with front lines and disputed lines, every country’s name with its status marks, and a thousand cities with an icon for what each is known as. Select a country or city to see its card and its stories.',
  ],
  [
    'Build a picture',
    'PIN TO ANALYST keeps a story, country or city on the analyst board; an aircraft, ship or site can be pinned from its card, and is kept as it was at that moment. ANALYST at the top opens the board: your pins, the network of names they share, and a brief. SYNTHESIZE, the timeline, the matrix and dead reckoning are worked out from the headlines in code. CONSENSUS, the playbook, the red team brief and the daily brief are written by a model from what you pinned; each says so, and none is checked against a source.',
  ],
  [
    'Be shown the news',
    'TOUR flies through the places with the most stories and pauses on each. REPLAY steps back through the week of headlines held, so you can see what was being reported at any moment. Either stops with its own stop button or Escape.',
  ],
  [
    'One country, everything',
    'Search a country and choose COUNTRY SHEET, or open it from the country’s card. It joins that country’s headlines, people forced to flee, outbreak notices, next election, currency and nearest live channel, each with its source.',
  ],
  [
    'Around a story',
    'AROUND HERE on a story lists what the live layers hold near it right now: quakes, fires, storms, aircraft, ships, launch sites. If the story is about one of those and that layer is off, it offers to switch it on.',
  ],
  [
    'Be told',
    'A notice appears over the globe when one of your watches has more new stories, when a disaster tracker raises an Orange or Red alert, or when the World Health Organization posts an outbreak notice. Under My Watches you can also ask for a browser notification while this tab is in the background.',
  ],
  [
    'Talk to it',
    'The microphone under the globe starts voice control. It can do what search does: "show me the relief lens", "country sheet for Japan", "turn on flights", "play France 24". It needs a microphone and an OpenAI key.',
  ],
  [
    'Find anything',
    'SEARCH at the top, or Ctrl+K (Cmd+K on a Mac), reaches everything from one box: fly to a country or city, open a story, switch a layer, change lens, watch a channel, pick a visual preset or open a tool in INSTRUMENTS. Each result says what it will do. When several things fit, pick the one you mean.',
  ],
  [
    'Go deeper',
    'INSTRUMENTS, on the analyst board’s bar, opens the full control room: tracking, cockpit view, cameras, weather, visual styles, scenes, voice control and share links. The ringed X at its top left closes it and returns you to the board.',
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
    return 'WATCH POWER · MILITARY AND GOVERNMENT AIRCRAFT, BASES';
  if (lens === 'elections') return 'ELECTIONS · POLLING DAYS, NEXT 120 DAYS';
  if (lens === 'markets') return 'MARKETS · FINANCE STORIES BY PLACE';
  if (lens === 'relief')
    return 'RELIEF · WHO OUTBREAK NOTICES, HUMANITARIAN STORIES';
  const places = view.places?.length ?? 0;
  const range = RANGE_WORDS[view.rangeHours] ?? RANGE_WORDS[24];
  return view.goodNewsOnly
    ? `GOOD NEWS · ${range} · ${places} PLACES`
    : `STORIES · ${range} · ${places} PLACES`;
}

/** Where the view is centred and how high, from the camera. */
function hudWhereLine(at) {
  const deg = (radians) => (radians * 180) / Math.PI;
  const part = (value, pos, neg) =>
    `${Math.abs(value).toFixed(2)}°${value >= 0 ? pos : neg}`;
  const km = Math.round(at.height / 1000);
  return `${part(deg(at.latitude), 'N', 'S')} ${part(deg(at.longitude), 'E', 'W')} · ALT ${km.toLocaleString('en-GB')} KM`;
}

/** The newest headline at a place. */
function placeCardTitle(place) {
  return place.articles[0]?.title ?? place.name;
}

/** Who published it, and how much else is there. */
function placeCardMeta(place) {
  const [first] = place.articles;
  const others = place.articles.length - 1;
  const topics = [
    ...new Set(place.articles.map((a) => a.category).filter(Boolean)),
  ];
  return [
    first?.publisher,
    others > 0
      ? `and ${others} more current ${others === 1 ? 'story' : 'stories'} here`
      : '',
    topics.length ? topics.join(', ') : '',
    place.precision === 'city'
      ? ''
      : 'placed at the country or region, not a pinpoint',
  ]
    .filter(Boolean)
    .join(' · ');
}

function placeCardAction(count) {
  return count === 1 ? 'Open this story' : `Read all ${count} in NEWS`;
}

/** The button on an aircraft or ship card that leads to nearby stories. */
function nearbyLabel(near) {
  const stories = near.reduce(
    (sum, entry) => sum + entry.place.articles.length,
    0,
  );
  const { place, km } = near[0];
  return `${stories} ${stories === 1 ? 'story' : 'stories'} within ${NEARBY_KM} km · nearest ${place.name}, ${Math.round(km)} km`;
}

/** The header clock: UTC, or the reader's own time marked as local. */
function clockText(date, local) {
  return local
    ? `LOCAL ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    : `UTC ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}Z`;
}

/** The header button for the analyst board. */
function boardLabel(count) {
  return count ? `ANALYST · ${count}` : 'ANALYST';
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
  if (copied === null) return 'SHARE';
  return copied ? 'COPIED' : 'BLOCKED';
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
            el(document, 'img', {
              class: 'coranto-source-icon',
              src: iconImage('signal', SOURCE_STATE_COLOUR[row.state]),
              alt: '',
            }),
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

  // One switch per layer. They are not shown themselves: the LAYERS list
  // presses them, so the switching rules live in one place.
  const layerNav = el(document, 'nav', {
    id: 'coranto-layers',
    'aria-label': 'Live layers',
  });
  const layerButtons = new Map();
  /**
   * Whether a layer is on as far as the reader is concerned. The satellites
   * layer also runs, with nothing drawn, whenever LAUNCHES needs it; that
   * does not count as SATELLITES being on.
   */
  function layerShown(id) {
    if (id.startsWith(OVERLAY_PREFIX))
      return ownLayers[id.slice(OVERLAY_PREFIX.length)].isOn();
    if (!dataManager?.layers?.has(id) || !dataManager.isEnabled(id))
      return false;
    return (
      id !== 'satellites' ||
      dataManager.getLayerParams?.('satellites')?.showPoints !== false
    );
  }
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
      if (id.startsWith(OVERLAY_PREFIX)) {
        const own = ownLayers[id.slice(OVERLAY_PREFIX.length)];
        button.dataset.busy = 'true';
        Promise.resolve(own.set(!own.isOn()))
          .catch(() => {})
          .finally(() => {
            delete button.dataset.busy;
            saveOwnLayers();
            syncLayers();
          });
        return;
      }
      // While LAUNCHES is on it keeps the satellites layer running with the
      // catalogue hidden. SATELLITES then shows or hides the catalogue and
      // leaves the layer running, so launches keep working.
      if (id === 'satellites' && dataManager.isEnabled('rocket-launches')) {
        const show = !layerShown('satellites');
        dataManager.setLayerParams('satellites', {
          ...dataManager.getLayerParams('satellites'),
          showPoints: show,
          showOrbits: show,
        });
        syncLayers();
        return;
      }
      const next = !dataManager.isEnabled(id);
      button.dataset.busy = 'true';
      Promise.resolve(dataManager.setEnabled(id, next))
        .catch(() => {})
        .finally(() => {
          delete button.dataset.busy;
          syncLayers();
        });
    });
    button.dataset.layer = id;
    layerButtons.set(id, button);
    layerNav.append(button);
  }
  // Every layer in one list: what it is, and a switch.
  const layersBtn = el(document, 'button', {
    id: 'coranto-layers-all',
    type: 'button',
    title: 'Every live layer, with what each one is',
    'aria-expanded': 'false',
    'aria-controls': 'coranto-layers-menu',
  });
  const layersMenu = el(document, 'div', {
    id: 'coranto-layers-menu',
    role: 'region',
    'aria-label': 'Live layers',
  });
  layersMenu.hidden = true;
  const layerRows = new Map();
  for (const [id, label, title, icon] of HEADER_LAYERS) {
    const row = el(
      document,
      'button',
      { type: 'button', class: 'coranto-layer-row', 'aria-pressed': 'false' },
      el(document, 'img', { src: iconImage(icon, '#c9c2de'), alt: '' }),
      el(
        document,
        'span',
        { class: 'coranto-layer-row-text' },
        el(document, 'span', { class: 'coranto-layer-row-name', text: label }),
        el(document, 'span', { class: 'coranto-layer-row-note', text: title }),
      ),
      el(document, 'span', { class: 'coranto-switch-knob' }),
    );
    // The chip already knows how to switch its layer; the row presses it.
    row.addEventListener('click', () => layerButtons.get(id)?.click());
    row.dataset.layer = id;
    layerRows.set(id, row);
    layersMenu.append(row);
  }
  function setLayersMenu(open) {
    layersMenu.hidden = !open;
    layersBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      const box = layersBtn.getBoundingClientRect();
      const width = Math.min(360, win.innerWidth - 16);
      layersMenu.style.left = `${Math.max(8, Math.min(win.innerWidth - width - 8, Math.round(box.left)))}px`;
      layersMenu.style.top = `${Math.round(box.bottom + 6)}px`;
    }
  }
  layersBtn.addEventListener('click', () => setLayersMenu(layersMenu.hidden));
  document.addEventListener('pointerdown', (event) => {
    if (layersMenu.hidden) return;
    if (layersBtn.contains(event.target) || layersMenu.contains(event.target))
      return;
    setLayersMenu(false);
  });

  // Search over everything the app can do: see corantoCommands.js.
  const onMac = /mac|iphone|ipad/i.test(
    win.navigator?.userAgentData?.platform ?? win.navigator?.platform ?? '',
  );
  const searchBtn = el(
    document,
    'button',
    {
      id: 'coranto-search-all',
      type: 'button',
      title:
        'Search everything: places, stories, layers, tools, channels and views',
    },
    el(document, 'img', { src: iconImage('search', '#c9c2de'), alt: '' }),
    el(document, 'span', { text: 'SEARCH' }),
    el(document, 'kbd', { text: onMac ? 'CMD K' : 'CTRL K' }),
  );
  // Countries and cities to fly to, read once when the search first opens.
  let atlasPlaces = [];
  let atlasCountries = [];
  let atlasCities = [];
  let atlasPlacesLoading = null;
  function loadAtlasPlaces() {
    atlasPlacesLoading ??= readAtlasPlaces();
    return atlasPlacesLoading;
  }
  async function readAtlasPlaces() {
    try {
      const [countries, cities] = await Promise.all(
        ['countries', 'cities'].map(async (name) => {
          const response = await win.fetch(`/coranto-atlas/${name}.json`);
          return response.ok ? response.json() : [];
        }),
      );
      atlasCountries = countries;
      atlasCities = cities;
      const byCode = new Map(countries.map((row) => [row.iso2, row.name]));
      atlasPlaces = [
        ...countries.map((row) => ({
          kind: 'country',
          name: row.name,
          detail: 'Country',
          run: () => flyTo(row.lat, row.lng, 4_500_000),
        })),
        // The same country, as its sheet rather than a place to fly to.
        ...countries.map((row) => ({
          kind: 'country',
          commandKind: 'COUNTRY SHEET',
          name: row.name,
          detail: 'Stories, displacement, outbreaks, next election and more',
          keywords: 'dossier sheet profile facts',
          run: () => openDossier(row.iso2),
        })),
        ...cities.map((row) => ({
          kind: 'city',
          name: row.name,
          detail: byCode.get(row.iso2) ?? '',
          keywords: byCode.get(row.iso2) ?? '',
          run: () => flyTo(row.lat, row.lng, 600_000),
        })),
      ];
    } catch {
      atlasPlaces = [];
    }
  }
  /** Press a control that lives in the engine's own panels. */
  const pressEngine = (selector) =>
    win.setTimeout(() => document.querySelector(selector)?.click(), 350);
  const inNews = (run) => () => {
    setMode('news');
    run();
  };
  const inTools = (run) => () => {
    setMode('instruments');
    run();
  };
  /** Open the engine's CONTEXT panel, which the layout hides when full. */
  function openContextPanel() {
    document
      .querySelector("#pp-toggles .panel-collapse-btn[aria-expanded='true']")
      ?.click();
    win.setTimeout(
      () =>
        document
          .querySelector(
            "#global-context-panel .panel-collapse-btn[aria-expanded='false']",
          )
          ?.click(),
      500,
    );
  }
  /** Switch the engine's Contacts context on, if it is not already. */
  function openContacts() {
    openContextPanel();
    win.setTimeout(() => {
      const button = document.querySelector('#global-context-flights-btn');
      if (
        button &&
        !button.classList.contains('active') &&
        button.getAttribute('aria-pressed') !== 'true'
      )
        button.click();
    }, 1100);
  }
  /** True when the engine is following an aircraft, civil or military. */
  function followingAircraft() {
    try {
      return ['flights', 'military'].some(
        (id) =>
          dataManager?.isEnabled(id) &&
          dataManager.layers.get(id)?.module?.getTrackedInfo?.(),
      );
    } catch {
      return false;
    }
  }
  /** Enter the cockpit once the engine offers it; give up after a while. */
  function enterCockpit() {
    openContacts();
    let tries = 0;
    const timer = win.setInterval(() => {
      const entry = document.querySelector('#cockpit-entry');
      if (entry && !entry.hidden) {
        win.clearInterval(timer);
        entry.click();
      } else if (++tries > 40) win.clearInterval(timer);
    }, 500);
  }
  function commandApp() {
    const view = layer.getView();
    return {
      mode: body.dataset.corantoMode,
      setMode,
      setLens: (id) => {
        setMode('news');
        setLens(id);
      },
      lenses: [
        [
          'news',
          'News lens',
          'Every story, on the globe and in the feed',
          'news',
          'stories headlines',
        ],
        [
          'power',
          'Watch Power',
          'Military and government aircraft, bases and plate readers',
          'military',
          'military government aircraft',
        ],
        [
          'elections',
          'Votes',
          'Polling days and US campaign money',
          'election',
          'elections campaign money fec',
        ],
        [
          'markets',
          'Markets',
          'Indices, oil, yields, exchange rates and crypto',
          'finance',
          'finance stocks oil',
        ],
        [
          'relief',
          'Relief',
          'Displaced people and disease outbreaks',
          'displaced',
          'humanitarian refugees outbreaks who unhcr',
        ],
      ].map(([id, title, detail, icon, keywords]) => ({
        id,
        title,
        detail,
        icon,
        keywords,
      })),
      panels: [
        {
          title: 'Whole Earth',
          detail: 'Pull back to see the whole globe',
          kind: 'VIEW',
          icon: 'target',
          keywords: 'home reset zoom out',
          pinned: true,
          run: wholeEarth,
        },
        {
          title: 'My briefing',
          detail: 'What is new since you last looked',
          icon: 'news',
          keywords: 'new since briefing',
          pinned: true,
          run: inNews(() => briefingBtn.click()),
        },
        {
          title: 'The Moon',
          detail: 'Fly out to it: true distance, true size, NASA’s surface map',
          icon: 'moon',
          keywords: 'moon lunar luna space fly',
          pinned: true,
          run: () => {
            const detail = moon.view();
            if (!detail) return;
            card.dataset.owner = 'moon';
            showCard(detail);
          },
        },
        {
          title: 'Settings',
          detail: 'Layout, notices, connections, your data and about',
          icon: 'gear',
          keywords: 'settings preferences options api keys connections about',
          pinned: true,
          run: () => settings.open(),
        },
        {
          title: sides.isAway('rail')
            ? 'Show the left panel'
            : 'Hide the left panel',
          detail: 'Topics, lenses and watches; more room for the globe',
          icon: 'minus',
          keywords:
            'minimize minimise collapse hide sidebar left rail panel full screen globe',
          run: inNews(() => sides.toggle('rail')),
        },
        {
          title: sides.isAway('feed') ? 'Show the feed' : 'Hide the feed',
          detail: 'The headline feed on the right; more room for the globe',
          icon: 'minus',
          keywords:
            'minimize minimise collapse hide sidebar right feed stories panel full screen globe',
          run: inNews(() => sides.toggle('feed')),
        },
        {
          title: 'Header: layer buttons',
          detail: 'Search beside LIVE and a button for every layer',
          icon: 'gear',
          keywords: 'header layout chips buttons filters layers',
          run: () => settingsStore.set('headerLayout', 'chips'),
        },
        {
          title: 'Header: layers list',
          detail: 'One LAYERS button that opens the list',
          icon: 'gear',
          keywords: 'header layout menu dropdown layers',
          run: () => settingsStore.set('headerLayout', 'menu'),
        },
        {
          title: 'Analyst board',
          detail: 'What you have pinned, how it connects, and the tools',
          icon: 'key',
          keywords: 'analyst board pins assets entity network brief',
          pinned: true,
          run: () => board.open(),
        },
        ...[
          [
            'Analyst: synthesize',
            'A brief worked out from the pins, with no model',
            'key',
            'synthesize synthesis brief executive summary',
            () => board.synthesize(),
          ],
          [
            'Analyst: consensus',
            'Five model analysts assess the pins, cross-examine and conclude',
            'outlets',
            'consensus personas agentic analysts ai escalation debate',
            () => board.consensus(),
          ],
          [
            'Analyst: adversary playbook',
            'A model writes an actor-by-actor playbook from the pins',
            'chevronRight',
            'adversary playbook ai predicted moves',
            () => board.playbook(),
          ],
          [
            'Analyst: red team',
            'A model writes the adversary’s view of the pins',
            'hex',
            'red team adversarial ai vulnerabilities',
            () => board.redTeam(),
          ],
          [
            'Analyst: narrative timeline',
            'Headlines related to the pins, by day',
            'clock',
            'narrative timeline history events',
            () => board.timeline(),
          ],
          [
            'Analyst: escalation matrix',
            'How the pins and the headlines couple across domains',
            'grid',
            'escalation matrix cross domain',
            () => board.matrix(),
          ],
          [
            'Analyst: dead reckoning',
            'Countries ranked by how often the headlines name them',
            'target',
            'dead reckoning heat countries mentions momentum',
            () => board.deadReckoning(),
          ],
          [
            'Analyst: saved boards',
            'Boards you saved in this browser',
            'diamond',
            'saved boards load',
            () => board.savedBoards(),
          ],
          [
            'Daily brief',
            'A model writes a situation report from the top headlines',
            'news',
            'daily brief situation report ai sitrep',
            () => board.openDailyBrief(),
          ],
        ].map(([title, detail, icon, keywords, action]) => ({
          title,
          detail,
          icon,
          keywords,
          run: () => {
            loadAtlasPlaces();
            action();
          },
        })),
        {
          title: 'Live TV',
          detail: 'Live news channels from every continent',
          icon: 'broadcast',
          keywords: 'television channels watch',
          pinned: true,
          run: inNews(() => tv.open()),
        },
        {
          title: 'Map key',
          detail: 'What every mark on the globe means',
          icon: 'pin',
          keywords: 'legend icons meaning',
          run: inNews(() => setMapKey(true)),
        },
        {
          title: 'Sources',
          detail: 'Every source and whether it is answering',
          icon: 'outlets',
          keywords: 'publishers feeds live status',
          run: inNews(() => sourcesBtn.click()),
        },
        {
          title: 'Guide',
          detail: 'How Coranto works',
          icon: 'compass',
          keywords: 'help how to',
          run: inNews(() => guideBtn.click()),
        },
        {
          title: 'Share this view',
          detail: 'Copy a link that reopens what you see',
          kind: 'COPY LINK',
          icon: 'link',
          keywords: 'share link url copy',
          run: inNews(() => shareBtn.click()),
        },
        {
          title: 'Save this view',
          detail: 'Keep this search, topic or place under My Watches',
          kind: 'SAVE',
          icon: 'plus',
          keywords: 'watch save',
          run: inNews(() => saveBtn.click()),
        },
        {
          title: 'Good news',
          detail: 'Stories tagged as good news',
          kind: 'TOPIC',
          icon: 'good',
          keywords: 'positive',
          run: inNews(() => goodBtn.click()),
        },
        {
          title: 'Every layer',
          detail: 'The list of live layers with switches',
          icon: 'grid',
          keywords: 'layers list',
          run: () => setLayersMenu(true),
        },
        {
          title: 'Scenes',
          detail: 'Recorded camera tours of the globe',
          icon: 'camera',
          keywords: 'scene tour playback director',
          run: inTools(() => {
            pressEngine(
              "#data-panel .panel-collapse-btn[aria-expanded='true']",
            );
            win.setTimeout(
              () =>
                document
                  .querySelector(
                    "#scene-panel .panel-collapse-btn[aria-expanded='false']",
                  )
                  ?.click(),
              900,
            );
          }),
        },
        {
          title: 'Tour today’s stories',
          detail:
            'Fly through the places with the most stories, pausing on each',
          kind: 'START',
          icon: 'play',
          keywords: 'tour today top stories fly through show me',
          pinned: true,
          run: () => runTransport('tour'),
        },
        {
          title: 'Replay the week',
          detail: 'Step back through the week of headlines held',
          kind: 'START',
          icon: 'rotate',
          keywords: 'replay week playback time history timeline scrub',
          run: () => runTransport('replay'),
        },
        {
          title: 'Cockpit view',
          detail: followingAircraft()
            ? 'Ride along with the aircraft you are following'
            : 'Ride along with an aircraft. Select one on the globe first, then run this',
          kind: followingAircraft() ? 'ENTER' : 'FOLLOW AN AIRCRAFT FIRST',
          icon: 'aircraft',
          keywords: 'cockpit first person pilot ride along flight deck',
          run: inTools(enterCockpit),
        },
        {
          title: 'Contacts',
          detail:
            'The nearest aircraft, ships and mapped sites around what you follow',
          icon: 'target',
          keywords: 'context nearby contacts aircraft vessels sites radar',
          run: inTools(openContacts),
        },
        {
          title: 'Radio',
          detail: 'Live radio stations near the view',
          icon: 'broadcast',
          keywords: 'radio stations audio listen',
          run: inTools(() => {
            openContextPanel();
            pressEngine('#context-radio-toggle-btn');
          }),
        },
        {
          title: 'Visual presets tray',
          detail: 'Normal, CRT, night vision, thermal, comic, noir, snow',
          icon: 'contrast',
          keywords: 'style look filter',
          run: inTools(() =>
            pressEngine("#control-panel-toggle[aria-expanded='false']"),
          ),
        },
        {
          title: 'Voice control',
          detail:
            'Start or stop listening. Needs a microphone and an OpenAI key',
          kind: 'START / STOP',
          icon: 'speaker',
          keywords: 'voice speak talk microphone',
          run: inTools(() => pressEngine('#gev-voice-button')),
        },
        {
          title: 'Find a street address or landmark',
          detail: 'The engine’s own location search',
          icon: 'search',
          keywords: 'location address geocode landmark',
          run: inTools(() => pressEngine('#search-toggle')),
        },
        {
          title: 'Provider keys',
          detail: 'Which optional keys are set, and what each unlocks',
          icon: 'key',
          keywords: 'api keys settings power up',
          run: inTools(() => pressEngine('#key-setup-chip')),
        },
        {
          title: 'Data layers panel',
          detail: 'Every layer with its source and last update',
          icon: 'grid',
          keywords: 'layers sources freshness',
          run: inTools(() =>
            pressEngine(
              "#data-panel .panel-collapse-btn[aria-expanded='false']",
            ),
          ),
        },
      ],
      layers: dataManager
        ? [...dataManager.layers.entries()]
            .filter(([id]) => id !== 'news')
            .map(([id, entry]) => {
              const header = HEADER_LAYERS.find((row) => row[0] === id);
              return {
                id,
                name: entry.module?.name ?? header?.[1] ?? id,
                detail: header?.[2] ?? entry.module?.source ?? '',
                keywords: header?.[1] ?? '',
                icon: LAYER_ICONS[id] ?? header?.[3],
                on: header ? layerShown(id) : dataManager.isEnabled(id),
                toggle: () => {
                  if (header) layerButtons.get(id)?.click();
                  else
                    Promise.resolve(
                      dataManager.setEnabled(id, !dataManager.isEnabled(id)),
                    )
                      .catch(() => {})
                      .finally(syncLayers);
                },
              };
            })
        : [],
      overlays: ATLAS_OVERLAYS.map(([id, label]) => ({
        id,
        label,
        on: atlas.isOn(id),
        toggle: inNews(() => setAtlas(id, !atlas.isOn(id))),
      })),
      topics: CATEGORIES.map(([id, label]) => ({
        id: id ?? 'all',
        label: label[0] + label.slice(1).toLowerCase(),
        icon: id ?? 'news',
        run: inNews(() => {
          setLens('news');
          feed?.setCategory(id);
        }),
      })),
      ranges: [
        [24, 'Last 24 hours'],
        [72, 'Last 3 days'],
        [168, 'Last 7 days'],
      ].map(([hours, label]) => ({
        hours,
        label,
        run: inNews(() => layer.setRangeHours?.(hours)),
      })),
      presets: [
        ['normal', 'Normal', 'No visual filter', 'default plain'],
        ['retro', 'CRT', 'Green phosphor screen with scanlines', 'retro'],
        [
          'surveillance',
          'NVG',
          'Night-vision goggles',
          'night vision surveillance',
        ],
        ['thermal', 'FLIR', 'Thermal contrast', 'thermal heat infrared'],
        [
          'anime',
          'Comic',
          'Bright cel-shaded colour and outlines',
          'cel illustrated',
        ],
        ['noir', 'Noir', 'High-contrast black and white', 'monochrome'],
        ['snow', 'Snow', 'A cold whiteout', 'winter'],
      ].map(([id, label, detail, keywords]) => ({
        id,
        label,
        detail,
        keywords,
        run: () =>
          document.querySelector(`.style-btn[data-style='${id}']`)?.click(),
      })),
      channels: BROADCASTERS.map(([name, city, covers], index) => ({
        name,
        city,
        covers,
        run: inNews(() => tv.openChannel(index)),
      })),
      storyPlaces: (view.places ?? []).map((place) => ({
        key: place.key,
        name: place.name,
        count: place.articles?.length ?? 0,
        run: inNews(() => {
          setLens('news');
          layer.selectPlace(place.key, { focus: true });
        }),
      })),
      places: atlasPlaces,
      articles: view.snapshot?.articles ?? [],
      openStory: (id) => {
        // A story is found in the whole feed, not in whatever a lens, a
        // topic or a search had narrowed it to.
        setMode('news');
        setLens('news');
        feed?.setFilters({});
        layer.selectPlace(null);
        feed?.openStory(storyKeyFor(id));
      },
      searchFeed: (text) => {
        setMode('news');
        setLens('news');
        feed?.setQuery(text);
      },
    };
  }
  const palette = createCommandPalette({
    document,
    getCommands: (query) => buildCommands(commandApp(), query),
  });
  // ── Country sheet ───────────────────────────────────────────────
  // The three routes a sheet reads beyond the feed, kept for ten minutes.
  let dossierSources = null;
  let dossierSourcesAt = 0;
  function readDossierSources() {
    if (dossierSources && Date.now() - dossierSourcesAt < 10 * 60 * 1000)
      return dossierSources;
    dossierSourcesAt = Date.now();
    const read = async (path) => {
      try {
        const response = await win.fetch(path, {
          headers: { Accept: 'application/json' },
        });
        return response.ok ? await response.json() : null;
      } catch {
        return null;
      }
    };
    dossierSources = Promise.all(
      ['/api/relief', '/api/elections', '/api/markets'].map(read),
    ).then(([relief, elections, markets]) => ({ relief, elections, markets }));
    return dossierSources;
  }
  const countryPin = (model) => {
    const row = atlasCountries.find((entry) => entry.iso2 === model.iso2);
    return {
      key: `country:${model.title}`,
      kind: 'country',
      title: model.title,
      lat: row?.lat,
      lon: row?.lng,
      geo: geoOf(
        'country',
        row && {
          ...row,
          conflict_active:
            row.conflict_active || atlas.signals().conflict.has(row.iso2),
        },
      ),
    };
  };
  const dossier = createDossier({
    document,
    openStory: (id) => {
      dossier.close();
      setLens('news');
      feed?.setFilters({});
      layer.selectPlace(null);
      feed?.openStory(storyKeyFor(id));
    },
    showStories: (model) => {
      const group = (layer.getView().places ?? []).find(
        (place) => place.precision === 'country' && place.name === model.title,
      );
      dossier.close();
      setLens('news');
      if (group) layer.selectPlace(group.key, { focus: true });
      else feed?.setQuery(model.title);
    },
    flyTo: (model) => {
      const row = atlasCountries.find((entry) => entry.iso2 === model.iso2);
      if (row) flyTo(row.lat, row.lng, 4_500_000);
    },
    watch: (index) => tv.openChannel(index),
    // Offered where the atlas marks an active conflict.
    conflictBrief: {
      has: (model) => {
        const row = atlasCountries.find((entry) => entry.iso2 === model.iso2);
        return Boolean(
          row?.conflict_active || atlas.signals().conflict.has(model.iso2),
        );
      },
      run: (model) => board.openConflictBrief({ name: model.title }),
    },
    pin: {
      has: (model) => boardStore.has(`country:${model.title}`),
      toggle: (model) => {
        boardStore.toggle(countryPin(model));
        syncBoardButton();
      },
    },
  });
  async function openDossier(iso2) {
    setMode('news');
    await loadAtlasPlaces();
    const country = atlasCountries.find((entry) => entry.iso2 === iso2);
    if (!country) return;
    feed?.closeStory();
    const build = (sources) =>
      buildDossier({
        country,
        articles: layer.getView().snapshot?.articles ?? [],
        cityNames: atlasCities
          .filter((city) => city.iso2 === iso2)
          .map((city) => city.name),
        signals: atlas.signals(),
        relief: sources?.relief ?? null,
        elections: sources?.elections ?? null,
        markets: sources?.markets ?? null,
        channel: nearestBroadcaster({ lat: country.lat, lon: country.lng }),
        now: Date.now(),
      });
    // What the feed knows is shown at once; the rest as it arrives.
    const first = build(null);
    dossier.show(
      {
        ...first,
        sections: first.sections.filter((section) =>
          ['news', 'status'].includes(section.id),
        ),
      },
      { loading: true },
    );
    const sources = await readDossierSources();
    if (dossier.isOpen && dossier.current?.iso2 === iso2)
      dossier.show(build(sources));
  }

  // After a scene, put the look and the view back (people only).
  const sceneRestore =
    win.navigator?.webdriver || !win.MutationObserver
      ? null
      : createSceneRestore({
          document,
          getViewer: () => dataManager?.viewer ?? null,
          Observer: win.MutationObserver,
        });
  // Voice reaches the same commands as search. The engine's voice tool
  // `run_app_command` calls this with a few words; it runs the one thing that
  // fits, or hands back the choices for the voice to read out.
  win.__corantoRunCommand = async (query) => {
    await loadAtlasPlaces();
    const text = String(query ?? '').trim();
    if (!text) return { ok: false, error: 'Nothing was asked for.' };
    const all = rankCommands(buildCommands(commandApp(), text), text, 8);
    const real = all.filter((command) => command.kind !== 'SEARCH');
    const results = real.length ? real : all;
    if (!results.length)
      return { ok: false, error: `Nothing in the app matches "${text}".` };
    if (isAmbiguous(results, text))
      return {
        ok: false,
        needsChoice: true,
        choices: results
          .slice(0, 4)
          .map((command) => ({ name: command.title, does: command.kind })),
      };
    const [command] = results;
    try {
      command.run();
    } catch {
      return { ok: false, error: `"${command.title}" could not be run.` };
    }
    return { ok: true, ran: command.title, does: command.kind };
  };
  // WHO notices are checked on opening and every half hour after.
  const outbreakTimer = win.navigator?.webdriver
    ? null
    : win.setInterval(checkOutbreakNotices, 30 * 60 * 1000);
  if (!win.navigator?.webdriver) win.setTimeout(checkOutbreakNotices, 20_000);
  searchBtn.addEventListener('click', () => {
    loadAtlasPlaces();
    palette.open();
  });

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
  const settingsStore = createSettingsStore({ storage: localStorageRef });
  const settingsBtn = el(
    document,
    'button',
    {
      type: 'button',
      id: 'coranto-settings-btn',
      title: 'Settings: layout, notices, connections, your data and about',
      'aria-label': 'Settings',
    },
    el(document, 'img', { src: iconImage('gear', '#c9c2de'), alt: '' }),
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
  const headerGap = el(document, 'span', { class: 'coranto-header-gap' });
  const brand = el(
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
  );
  const header = el(document, 'header', { id: 'coranto-header' });
  /**
   * The header in one of two layouts. 'menu' keeps the layers in the LAYERS
   * list. 'chips' puts SEARCH beside LIVE and gives every layer its own
   * button; LAYERS stays in the markup for windows too narrow for the row.
   */
  function applyHeaderLayout() {
    const chips = settingsStore.get('headerLayout') === 'chips';
    body.dataset.corantoHeader = chips ? 'chips' : 'menu';
    if (chips) setLayersMenu(false);
    header.replaceChildren(
      brand,
      liveBtn,
      ...(chips
        ? [searchBtn, menuBtn, layersBtn, layerNav]
        : [menuBtn, layersBtn, searchBtn, headerGap]),
      count,
      clock,
      // NEWS is the product; the control room is opened from the analyst
      // board. Automated browsers keep the old switch, which their gates
      // were written against.
      ...(win.navigator?.webdriver ? [modeSwitch] : []),
      boardBtn,
      settingsBtn,
    );
  }
  applyHeaderLayout();

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
    text: 'EARTH',
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
  const lensRelief = el(document, 'button', {
    type: 'button',
    text: 'RELIEF',
    'data-lens': 'relief',
    title:
      'Relief: displaced people and disease outbreaks from official sources, with humanitarian news',
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
    lensRelief,
  );
  const markets = createMarketsLens({ document });
  const relief = createReliefLens({
    document,
    getViewer: () => dataManager?.viewer ?? null,
    showCard: (detail) => {
      card.dataset.owner = 'relief';
      showCard(detail);
    },
    flyTo: (lat, lon, height) => flyTo(lat, lon, height),
  });
  // The analyst tools that a model writes go through one server route.
  async function callAnalystModel(system, user, maxTokens = 420) {
    const controller = new AbortController();
    const timer = win.setTimeout(
      () => controller.abort(),
      maxTokens > 800 ? 55_000 : 30_000,
    );
    try {
      const response = await win.fetch('/api/ai', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system, user, maxTokens }),
      });
      const data = await response.json();
      if (!response.ok || data.error)
        throw new Error(
          data.error === 'AI not configured'
            ? 'API_KEY_MISSING'
            : data.error || 'AI proxy error',
        );
      return data.content || '';
    } finally {
      win.clearTimeout(timer);
    }
  }
  const board = createAnalyst({
    document,
    win,
    store: boardStore,
    getArticles: () => layer.getView().snapshot?.articles ?? [],
    getStories: () => layer.getView().snapshot?.stories ?? [],
    getCountries: () => atlasCountries,
    callModel: callAnalystModel,
    // INSTRUMENTS on the board's bar: the engine's control room, as a tool.
    onInstruments: () => {
      board.close();
      setMode('instruments');
    },
    onMomentum: (tiers) => atlas.setMomentum(tiers),
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
        else if (Number.isFinite(asset.lat) && Number.isFinite(asset.lon))
          flyTo(
            asset.lat,
            asset.lon,
            asset.kind === 'contact' ? 600_000 : 3_000_000,
          );
      }
    },
    onChange: () => {
      syncBoardButton();
      feed?.render();
    },
  });
  boardBtn.addEventListener('click', () => {
    // Dead reckoning reads the country list.
    loadAtlasPlaces();
    board.open();
  });
  const tv = createBroadcasts({
    document,
    getViewer: () => dataManager?.viewer ?? null,
    // Closed from its own X or from anywhere else, the button follows.
    onChange: (open) => {
      tvBtn.setAttribute('aria-pressed', String(open));
      renderMapKey();
    },
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
    showCard: function show(detail) {
      card.dataset.owner = 'power';
      // An aircraft's card can be pinned to the board as it is now.
      const subject = detail?.subject;
      const key = subject ? `contact:${subject.id}` : '';
      showCard(
        subject
          ? {
              ...detail,
              pin: {
                label: pinLabel(boardStore.has(key), boardStore.full),
                run: () => {
                  const pin = cardPin(detail, subject.id, subject, Date.now());
                  if (pin) boardStore.toggle(pin);
                  syncBoardButton();
                  show(detail);
                },
              },
            }
          : detail,
      );
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
    text: 'SHARE',
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
  // Being shown the news: a tour of today's places, and the week replayed.
  const tourBtn = el(document, 'button', {
    type: 'button',
    class: 'coranto-rail-btn',
    text: 'TOUR',
    title:
      'Fly through the places with the most stories right now, pausing on each with its newest headline',
    'aria-pressed': 'false',
  });
  const replayBtn = el(document, 'button', {
    type: 'button',
    class: 'coranto-rail-btn',
    text: 'REPLAY',
    title:
      'Step back through the week of headlines Coranto holds, to see what was being reported at each moment',
    'aria-pressed': 'false',
  });
  const transport = createTransport({
    document,
    win,
    layer,
    flyHome: () => wholeEarth(),
    onChange: (mode) => {
      tourBtn.setAttribute('aria-pressed', String(mode === 'tour'));
      replayBtn.setAttribute('aria-pressed', String(mode === 'replay'));
      body.dataset.corantoTransport = mode ?? 'off';
    },
  });
  /** Start or stop a tour or a replay, from the news lens. */
  function runTransport(mode) {
    if (transport.mode === mode) return transport.stop();
    setMode('news');
    setLens('news');
    feed?.closeStory();
    dossier.close();
    feed?.setFilters({});
    const started =
      mode === 'tour' ? transport.startTour() : transport.startReplay();
    if (!started) {
      const button = mode === 'tour' ? tourBtn : replayBtn;
      const was = button.textContent;
      // Say why nothing happened, on the button itself.
      button.textContent =
        mode === 'tour' ? 'TOO FEW PLACES' : 'TOO LITTLE HELD';
      win.setTimeout(() => (button.textContent = was), 2400);
    }
  }
  tourBtn.addEventListener('click', () => runTransport('tour'));
  replayBtn.addEventListener('click', () => runTransport('replay'));
  // Icons over the quakes, while the earthquakes layer is on.
  const quakeIcons = createQuakeIcons({
    getManager: () => dataManager,
    showCard: (detail) => {
      card.dataset.owner = 'quake';
      showCard(detail);
    },
  });
  // A rocket at each launch site, while the launches layer is on.
  // SILENCE and DISEASE: Coranto's own two layers, drawn on the ground.
  const overlays = createOverlays({
    win,
    getViewer: () => dataManager?.viewer ?? null,
    getArticles: () => layer.getView().snapshot?.articles ?? [],
    showCard: (detail) => {
      card.dataset.owner = 'overlay';
      showCard(detail);
    },
    onChange: () => renderMapKey(),
  });
  /**
   * Coranto's own layers, switched like the engine's. STORIES hides the
   * story markers and names while the feed runs on; BANNER is the ticker.
   */
  let storiesShown = true;
  /**
   * Shows the engine's loading chip for a layer of Coranto's own: LOADING
   * LIVE DATA while it reads, then LOAD COMPLETE or LOAD FAILED. Returns
   * the function to call when the read ends. The engine takes the chip back
   * whenever one of its own layers has something to say.
   */
  let loadingToken = 0;
  const loadingLabel = el(document, 'span', { id: 'coranto-loading-label' });
  const loadingDetail = el(document, 'span', { id: 'coranto-loading-detail' });
  const loadingChip = el(
    document,
    'div',
    {
      id: 'coranto-loading-status',
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'true',
    },
    ...[...(document.getElementById('global-loading-status')?.children ?? [])]
      .filter(
        (node) =>
          node.id !== 'global-loading-label' &&
          node.id !== 'global-loading-detail',
      )
      .map((node) => {
        // The spinner and any other dressing, as the engine's chip has them.
        const copy = node.cloneNode(true);
        if (copy.id) copy.id = copy.id.replace('global-', 'coranto-');
        return copy;
      }),
    loadingLabel,
    loadingDetail,
  );
  loadingChip.hidden = true;
  function layerLoading(name) {
    loadingToken += 1;
    const token = loadingToken;
    const show = (state, text) => {
      loadingChip.hidden = false;
      loadingChip.dataset.state = state;
      setSplitFlapText(loadingLabel, text);
      loadingDetail.replaceChildren(name);
    };
    show('loading', LOADING_LABELS.loading);
    return (ok) => {
      if (token !== loadingToken) return;
      show(
        ok ? 'complete' : 'error',
        LOADING_LABELS[ok ? 'complete' : 'error'],
      );
      win.setTimeout(
        () => {
          if (token !== loadingToken) return;
          loadingChip.hidden = true;
          delete loadingChip.dataset.state;
        },
        ok ? 2200 : 5000,
      );
    };
  }
  const ownLayers = {
    stories: {
      isOn: () => storiesShown,
      set: (on) => {
        storiesShown = Boolean(on);
        layer.setMarkersShown?.(storiesShown);
      },
    },
    disease: {
      isOn: () => overlays.isOn('disease'),
      // The same chip the engine's layers show while their data comes in.
      set: async (on) => {
        if (!on) return overlays.set('disease', false);
        const done = layerLoading('DISEASE');
        try {
          const shown = await overlays.set('disease', true);
          done(overlays.status('disease')?.ok !== false && shown);
          return shown;
        } catch (error) {
          done(false);
          throw error;
        }
      },
    },
    banner: {
      isOn: () => settingsStore.get('ticker') === true,
      set: (on) => settingsStore.set('ticker', Boolean(on)),
    },
  };
  const saveOwnLayers = () =>
    writeStored(
      localStorageRef,
      OVERLAYS_KEY,
      JSON.stringify({
        stories: storiesShown,
        disease: overlays.isOn('disease'),
      }),
    );
  // The Moon, at its true distance and size.
  const moon = createMoon(() => dataManager?.viewer ?? null);
  const launchIcons = createLaunchIcons({
    getManager: () => dataManager,
    isNewsView: () => body.dataset.corantoMode === 'news',
    showCard: (detail) => {
      card.dataset.owner = 'launch';
      showCard(detail);
    },
  });
  // Icons over the named satellites, while the satellites layer is on.
  const satelliteIcons = createSatelliteIcons({
    getManager: () => dataManager,
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
      const pinButton = pin && {
        label: pinLabel(boardStore.has(pin.key), boardStore.full),
        run: () => {
          boardStore.toggle(pin);
          withAction();
        },
      };
      // A country offers its sheet first, and the pin beside it.
      const withAction = () =>
        showCard(
          pin?.iso2
            ? {
                ...detail,
                action: {
                  label: 'Open the country sheet',
                  run: () => {
                    showCard(null);
                    openDossier(pin.iso2);
                  },
                },
                pin: pinButton && {
                  ...pinButton,
                  label: pinLabel(boardStore.has(pin.key), boardStore.full),
                },
              }
            : // A city has one button. `detail.pin` is the pin's data, not a
              // second button, and must not be drawn as one.
              { ...detail, action: pinButton, pin: undefined },
        );
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
    // Headline activity colours country names, so it brings them with it.
    if (name === 'activity' && on && !atlas.isOn('countries'))
      await setAtlas('countries', true, { remember });
    if (name === 'countries' && !on && atlas.isOn('activity'))
      await setAtlas('activity', false, { remember });
    if (remember)
      writeStored(localStorageRef, ATLAS_KEY, JSON.stringify(atlasWanted));
    const button = atlasButtons.get(name);
    button.setAttribute('aria-pressed', String(Boolean(on)));
    button.dataset.busy = 'true';
    const now = await atlas.set(name, on);
    if (name === 'countries' && now)
      await atlas.setArticles(layer.getView().snapshot?.articles ?? []);
    delete button.dataset.busy;
    button.setAttribute('aria-pressed', String(now));
    renderMapKey();
  }
  for (const [name, label, icon] of ATLAS_OVERLAYS) {
    const button = el(
      document,
      'button',
      {
        type: 'button',
        class: 'coranto-switch coranto-switch-iconed',
        'aria-pressed': String(Boolean(atlasWanted[name])),
      },
      el(document, 'img', { src: iconImage(icon, '#b9b1d1'), alt: '' }),
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
      flights: on('flights'),
      military: on('military'),
      storms: on('weather-cyclones'),
      cables: on('telegeography-submarine-cables'),
      nuclear: nuclear.shown,
      broadcasts: tv.isOpen,
      ships: on('ais-live-vessels'),
      satellites: satelliteIcons.shown,
      quakes: quakeIcons.shown,
      launches: launchIcons.shown,
      payloads: launchIcons.shown && launchIcons.payloadCount() > 0,
      outbreaks: relief.marked,
      disease: overlays.status('disease'),
      borders: atlas.isOn('borders'),
      countries: atlas.isOn('countries'),
      activity: atlas.isOn('activity'),
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
  // Notices: a watch with more new stories, a new disaster alert, a new
  // WHO notice. See corantoAlerts.js.
  let alertState = { hazards: null, who: null, outside: false };
  try {
    const saved = JSON.parse(readStored(localStorageRef, ALERT_KEY) ?? 'null');
    if (saved && typeof saved === 'object')
      alertState = {
        hazards: Array.isArray(saved.hazards) ? new Set(saved.hazards) : null,
        who: Array.isArray(saved.who) ? new Set(saved.who) : null,
        outside: saved.outside === true,
      };
  } catch {
    alertState = { hazards: null, who: null, outside: false };
  }
  const saveAlertState = () =>
    writeStored(
      localStorageRef,
      ALERT_KEY,
      JSON.stringify({
        hazards: alertState.hazards ? [...alertState.hazards] : null,
        who: alertState.who ? [...alertState.who] : null,
        outside: alertState.outside,
      }),
    );
  const notices = createNotices({
    document,
    win,
    outsideTab: () => alertState.outside,
    onOpen: (notice) => {
      setMode('news');
      if (notice.kind === 'watch') {
        const watch = watchStore
          .list()
          .find((entry) => entry.id === notice.watchId);
        if (watch) {
          setLens('news');
          openWatch(watch);
        }
      } else if (notice.kind === 'hazard') {
        hazardsLayer?.select?.(notice.hazardId);
        if (Number.isFinite(notice.lat) && Number.isFinite(notice.lon))
          flyTo(notice.lat, notice.lon, 2_500_000);
      } else if (notice.kind === 'outbreak') setLens('relief');
    },
  });
  // Settings: the gear at the right end of the header.
  async function readSettingsSources() {
    const read = async (path) => {
      try {
        const response = await win.fetch(path, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        return response.ok ? await response.json() : null;
      } catch {
        return null;
      }
    };
    const [hazards, relief, markets, elections] = await Promise.all(
      ['/api/hazards', '/api/relief', '/api/markets', '/api/elections'].map(
        read,
      ),
    );
    const rows = (payload) =>
      (payload?.sources ?? []).map((source) => ({
        name: source.name,
        state: source.ok ? 'ok' : 'down',
      }));
    return [
      { group: 'News', rows: sourceRowsShown },
      { group: 'Disasters', rows: rows(hazards) },
      { group: 'Relief', rows: rows(relief) },
      { group: 'Markets', rows: rows(markets) },
      {
        group: 'Elections',
        rows: elections?.source
          ? [
              {
                name: elections.source,
                state: elections.stale ? 'down' : 'ok',
              },
            ]
          : [],
      },
    ];
  }
  const clearAndReload = (keys) => {
    clearStored(localStorageRef, keys);
    win.location.reload();
  };
  const settings = createSettings({
    document,
    win,
    store: settingsStore,
    readSources: readSettingsSources,
    exportData: () => storedData(localStorageRef),
    resets: [
      {
        label: 'Settings',
        note: 'Put every setting on this page back to how it started.',
        button: 'RESET SETTINGS',
        run: () => settingsStore.reset(),
      },
      {
        label: 'Watches',
        note: 'Remove every place and term you watch. Coranto reloads.',
        button: 'CLEAR WATCHES',
        run: () => clearAndReload(['coranto.watches.v1']),
      },
      {
        label: 'Analyst board',
        note: 'Remove every pin and saved board. Coranto reloads.',
        button: 'CLEAR THE BOARD',
        run: () => clearAndReload(['coranto.board.v1', 'coranto.boards.v1']),
      },
      {
        label: 'Everything',
        note: 'Remove all that this browser keeps for Coranto. Coranto reloads.',
        button: 'CLEAR EVERYTHING',
        run: () => clearAndReload(null),
      },
    ],
  });
  let watchFreshBefore = null;
  let watchContext = '';
  function checkWatchNotices(current) {
    const view = layer.getView();
    // A count can also change because the reader changed what is shown: a
    // longer range, another language, a replayed moment. Only a fresh read
    // of the same view is an arrival, and the first read of a view is not.
    const context = view.snapshot
      ? `${view.rangeHours}|${view.language ?? ''}|${view.goodNewsOnly}|${view.asOf ?? ''}`
      : '';
    if (!context || context !== watchContext || view.asOf != null) {
      watchContext = context;
      watchFreshBefore = context
        ? new Map(current.map((watch) => [watch.id, watch.fresh]))
        : null;
      return;
    }
    const arrivals = watchAlerts(watchFreshBefore, current);
    // The open analyst board says so in its status line, as AUSPEX did.
    board.flashWatch(arrivals.length);
    if (settingsStore.get('noticeWatches'))
      for (const notice of arrivals) notices.show(notice);
    watchFreshBefore = new Map(current.map((watch) => [watch.id, watch.fresh]));
  }
  // With no record yet, the first minute only records what is already there:
  // the trackers answer one after another, and none of it is an arrival.
  const hazardsFirstSeenAt = alertState.hazards ? 0 : Date.now();
  function checkHazardNotices(view) {
    const events = view?.snapshot?.events;
    if (!events?.length) return;
    const { fresh, seen } = unseen(alertState.hazards, hazardNotices(events));
    alertState.hazards = seen;
    saveAlertState();
    if (hazardsFirstSeenAt && Date.now() - hazardsFirstSeenAt < 60_000) return;
    // Switched off, an alert is still recorded as seen, so switching notices
    // back on does not replay old ones.
    if (!settingsStore.get('noticeHazards')) return;
    fresh.forEach((notice) => notices.show(notice));
  }
  async function checkOutbreakNotices() {
    try {
      const response = await win.fetch('/api/relief', {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return;
      const payload = await response.json();
      const { fresh, seen } = unseen(
        alertState.who,
        outbreakNotices(payload.outbreaks),
      );
      alertState.who = seen;
      saveAlertState();
      if (settingsStore.get('noticeOutbreaks'))
        fresh.forEach((notice) => notices.show(notice));
    } catch {
      // A source that is down raises nothing; the Relief lens says it is down.
    }
  }
  // Outside the tab: off until asked for, and it says what the browser said.
  const outsideBtn = el(
    document,
    'button',
    {
      type: 'button',
      class: 'coranto-switch coranto-outside-switch',
      'aria-pressed': 'false',
      title:
        'Also send a browser notification when a watch, a disaster alert or a WHO notice arrives while this tab is in the background',
    },
    el(document, 'span', {
      class: 'coranto-switch-label',
      text: 'Notify me outside this tab',
    }),
    el(document, 'span', { class: 'coranto-switch-knob' }),
  );
  const outsideNote = el(document, 'p', { class: 'coranto-save-note' });
  outsideNote.hidden = true;
  function syncOutside(message = '') {
    const allowed = win.Notification?.permission === 'granted';
    outsideBtn.setAttribute(
      'aria-pressed',
      String(alertState.outside && allowed),
    );
    outsideNote.hidden = !message;
    outsideNote.textContent = message;
  }
  outsideBtn.addEventListener('click', async () => {
    if (!win.Notification)
      return syncOutside('This browser has no notifications to switch on.');
    if (alertState.outside && win.Notification.permission === 'granted') {
      alertState.outside = false;
      saveAlertState();
      return syncOutside('Off. Notices still appear here in the page.');
    }
    let permission = win.Notification.permission;
    if (permission === 'default')
      permission = await win.Notification.requestPermission();
    alertState.outside = permission === 'granted';
    saveAlertState();
    syncOutside(
      permission === 'granted'
        ? 'On. You will be told while this tab is in the background.'
        : 'Your browser has notifications blocked for this page. Allow them in its site settings, then switch this on.',
    );
  });
  syncOutside();
  const watchSection = el(
    document,
    'div',
    { class: 'coranto-watches' },
    el(document, 'div', { class: 'coranto-rail-heading', text: 'MY WATCHES' }),
    saveBtn,
    saveNote,
    watchList,
    outsideBtn,
    outsideNote,
  );
  for (const node of [topicList, watchSection])
    node.classList.add('coranto-bracket');
  // Each action wears its own icon, used nowhere else in the app.
  for (const [button, icon] of [
    [guideBtn, 'guide'],
    [sourcesBtn, 'checklist'],
    [homeBtn, 'globe'],
    [tvBtn, 'tv'],
    [shareBtn, 'share'],
    [keyBtn, 'legend'],
    [tourBtn, 'route'],
    [replayBtn, 'history'],
    [briefingBtn, 'briefing'],
  ]) {
    const label = el(document, 'span', { text: button.textContent });
    button.replaceChildren(
      el(document, 'img', {
        // MY BRIEFING is violet throughout; its icon is too.
        src: iconImage(icon, button === briefingBtn ? '#b47cff' : '#b9b1d1'),
        alt: '',
      }),
      label,
    );
  }
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
      tourBtn,
      replayBtn,
      briefingBtn,
    ),
    lensSwitch,
    atlasSection,
    topicList,
    watchSection,
    power.element,
    elections.element,
    markets.element,
    relief.element,
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
      el(
        document,
        'span',
        { class: 'coranto-feed-title' },
        el(document, 'img', { src: iconImage('newsfeed', '#b9b1d1'), alt: '' }),
        el(document, 'span', { text: 'NEWSFEED' }),
      ),
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
  // And a third, for cards that offer both nearby stories and a pin.
  const cardPinBtn = el(document, 'button', {
    type: 'button',
    class: 'coranto-card-action',
  });
  let cardPinRun = null;
  cardPinBtn.addEventListener('click', () => cardPinRun?.());
  const card = el(
    document,
    'aside',
    { id: 'coranto-card', 'aria-label': 'Selected event' },
    el(document, 'div', { class: 'coranto-card-head' }, cardKind, cardClose),
    cardTitle,
    cardMeta,
    cardAction,
    cardPinBtn,
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
    cardPinBtn.hidden = !detail.pin;
    cardPinRun = detail.pin?.run ?? null;
    // Emptied as well as hidden, so no blank box can show.
    cardPinBtn.textContent = detail.pin?.label ?? '';
    cardLink.hidden = !detail.url;
    if (detail.url) {
      cardLink.href = detail.url;
      cardLink.textContent = detail.linkText;
    }
  }

  /** Where a globe object is now, from the object itself. */
  function entityPosition(entity) {
    try {
      const viewer = dataManager?.viewer;
      const raw = entity?.position;
      const point = raw?.getValue
        ? raw.getValue(viewer.clock.currentTime)
        : raw;
      const at = point
        ? viewer.scene.globe.ellipsoid.cartesianToCartographic(point)
        : null;
      if (!at) return null;
      return {
        lat: (at.latitude * 180) / Math.PI,
        lon: (at.longitude * 180) / Math.PI,
      };
    } catch {
      return null;
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
    const pinKey = `contact:${id}`;
    // Stories near it: the same globe, the other half of the picture.
    const at = contactPosition(record) ?? entityPosition(record.entity);
    const near = at ? nearbyStoryPlaces(layer.getView().places ?? [], at) : [];
    showCard({
      ...detail,
      action: near.length
        ? {
            label: nearbyLabel(near),
            run: () => {
              contactDismissed = id;
              contactId = null;
              layer.selectPlace(near[0].place.key);
            },
          }
        : null,
      pin: {
        label: pinLabel(boardStore.has(pinKey), boardStore.full),
        run: () => {
          const pin = contactPin(record, at, Date.now());
          if (pin) boardStore.toggle(pin);
          syncBoardButton();
          pollContact();
        },
      },
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
  // In INSTRUMENTS the feed is not on screen, so a story marker opens a card
  // saying what is there, with a way straight to the stories.
  let instrumentsPlace = null;
  const unsubscribePlace = layer.subscribe?.((view) => renderPlaceCard(view));
  function renderPlaceCard(view) {
    const key = view?.selectedPlaceKey ?? null;
    if (body.dataset.corantoMode !== 'instruments') {
      instrumentsPlace = null;
      return;
    }
    if (key === instrumentsPlace) return;
    instrumentsPlace = key;
    const place = key ? (view.places ?? []).find((p) => p.key === key) : null;
    if (!place) {
      if (card.dataset.owner === 'place') showCard(null);
      return;
    }
    card.dataset.owner = 'place';
    showCard({
      kind: `STORIES · ${place.name.toUpperCase()} · ${place.precision.toUpperCase()}`,
      title: placeCardTitle(place),
      meta: placeCardMeta(place),
      action: {
        label: placeCardAction(place.articles.length),
        run: () => {
          const only = place.articles.length === 1 ? place.articles[0] : null;
          setMode('news');
          if (only) feed?.openStory(storyKeyFor(only.id));
        },
      },
      onClose: () => layer.selectPlace(null),
    });
  }
  /** The story an article belongs to, as the feed knows it. */
  function storyKeyFor(articleId) {
    const story = (layer.getView().snapshot?.stories ?? []).find((entry) =>
      entry.articleIds.includes(articleId),
    );
    return story?.id ?? articleId;
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

  // The way back out of the control room: to the analyst board it was
  // opened from.
  const instrumentsExit = el(
    document,
    'button',
    {
      type: 'button',
      id: 'coranto-instruments-exit',
      title: 'Close Instruments and go back to the analyst board',
      'aria-label': 'Close Instruments',
    },
    el(document, 'img', { src: iconImage('close', '#e9e4f5'), alt: '' }),
  );
  instrumentsExit.addEventListener('click', () => {
    setMode('news');
    loadAtlasPlaces();
    board.open();
  });
  // Either side of the news view can be put away for more of the globe.
  const sides = createSides({
    document,
    win,
    rail,
    feed: feedAside,
    storage: localStorageRef,
    onChange: () => {
      // The globe's canvas has a new width once the panel has slid.
      for (const delay of [0, 140, 300])
        win.setTimeout(() => {
          win.dispatchEvent(new win.Event('resize'));
          dataManager?.viewer?.scene?.requestRender?.();
        }, delay);
    },
  });
  body.append(
    header,
    hud,
    sourcesMenu,
    layersMenu,
    palette.element,
    dossier.element,
    transport.element,
    notices.element,
    settings.element,
    ...sides.elements,
    instrumentsExit,
    loadingChip,
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
    briefingBtn.lastElementChild.textContent = freshTotal
      ? `MY BRIEFING · ${freshTotal} NEW`
      : 'MY BRIEFING';
    briefingBtn.hidden = watches.length === 0;
    checkWatchNotices(
      watches.map((watch) => ({
        id: watch.id,
        name: watch.name,
        fresh: watchStories(snapshot, watch).fresh,
      })),
    );
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
    else if (lens === 'relief') {
      if (card.dataset.owner === 'relief') showCard(null);
      relief.leave();
      feed?.setAny([]);
    }
    lens = next;
    lensNews.setAttribute('aria-pressed', String(lens === 'news'));
    lensPower.setAttribute('aria-pressed', String(lens === 'power'));
    lensElections.setAttribute('aria-pressed', String(lens === 'elections'));
    lensMarkets.setAttribute('aria-pressed', String(lens === 'markets'));
    lensRelief.setAttribute('aria-pressed', String(lens === 'relief'));
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
    if (lens === 'relief') {
      feed?.setAny(RELIEF_TERMS);
      relief.enter();
    }
    if (lens === 'elections') {
      feed?.setAny(ELECTION_TERMS);
      elections.enter();
    }
  }

  /**
   * For people the headlines are on in both views: the ticker, the LIVE
   * count and the story markers are part of INSTRUMENTS too.
   */
  function ensureNewsOn() {
    if (
      body.dataset.corantoFrame === 'one' &&
      dataManager?.layers?.has('news') &&
      !dataManager.isEnabled('news')
    )
      Promise.resolve(dataManager.setEnabled('news', true)).catch(() => {});
  }

  function setMode(mode, { remember = true } = {}) {
    const next = mode === 'instruments' ? 'instruments' : 'news';
    body.dataset.corantoMode = next;
    // A launch click opens a card in the news view and the engine's mission
    // view in the control room. Automated browsers keep the engine's way.
    setLaunchClicksOpenMission(
      next !== 'news' || body.dataset.corantoFrame !== 'one',
    );
    if (next !== 'news' && card.dataset.owner === 'launch') showCard(null);
    modeNews.setAttribute('aria-pressed', String(next === 'news'));
    modeTools.setAttribute('aria-pressed', String(next === 'instruments'));
    if (remember) writeStored(localStorageRef, MODE_KEY, next);
    ensureNewsOn();
    // A place selected in one view is still selected in the other.
    if (next !== 'instruments' && card.dataset.owner === 'place')
      showCard(null);
    renderPlaceCard(layer.getView());
    // The engine lays its panels out from measured sizes.
    win.dispatchEvent?.(new win.Event('resize'));
  }

  function syncLayers() {
    if (!dataManager) return;
    for (const [id, button] of layerButtons) {
      const known =
        id.startsWith(OVERLAY_PREFIX) || dataManager.layers?.has(id);
      button.hidden = !known;
      if (known) button.setAttribute('aria-pressed', String(layerShown(id)));
      const row = layerRows.get(id);
      row.hidden = !known;
      row.setAttribute('aria-pressed', String(layerShown(id)));
    }
    const onCount = [...layerRows.values()].filter(
      (row) => row.getAttribute('aria-pressed') === 'true',
    ).length;
    layersBtn.textContent = `LAYERS · ${onCount} ON`;
    // Satellite icons follow the satellites layer (people only).
    if (body.dataset.corantoFrame === 'one') {
      // The nuclear-armed states are marked with the hazards, and only
      // then. The full country markers carry the mark themselves.
      const nuclearWanted = layerShown('hazards') && !atlas.isOn('countries');
      if (nuclearWanted && !nuclear.shown) {
        nuclear.show();
        renderMapKey();
      } else if (!nuclearWanted && nuclear.shown) {
        nuclear.hide();
        if (card.dataset.owner === 'nuclear') showCard(null);
        renderMapKey();
      }
      const on = layerShown('satellites');
      if (on && !satelliteIcons.shown) satelliteIcons.start();
      else if (!on && satelliteIcons.shown) satelliteIcons.stop();
      const quakes =
        dataManager.layers?.has('earthquakes') &&
        dataManager.isEnabled('earthquakes');
      const launches = layerShown('rocket-launches');
      if (launches && !launchIcons.shown) launchIcons.start();
      else if (!launches && launchIcons.shown) {
        launchIcons.stop();
        if (card.dataset.owner === 'launch') showCard(null);
      }
      if (quakes && !quakeIcons.shown) quakeIcons.start();
      else if (!quakes && quakeIcons.shown) {
        quakeIcons.stop();
        launchIcons.stop();
        if (card.dataset.owner === 'quake') showCard(null);
      }
    }
    renderMapKey();
  }

  function tick() {
    const showLocalTime = settingsStore.get('clock') !== 'utc';
    const date = new Date();
    clock.dateTime = date.toISOString();
    clock.textContent = clockText(date, showLocalTime);
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
    // The feed's drop-downs show what the feed has just chosen.
    win.setTimeout(() => feedSelects.forEach((entry) => entry.refresh()), 0);
    if (sharedView) {
      // Deferred: applying it re-enters this render.
      win.setTimeout(applySharedView, 0);
    }
    const state = model.healthState;
    liveBtn.dataset.state = state;
    sourceRowsShown = model.sources;
    renderSourcesMenu();
    renderPlaceCard(layer.getView());
    // Country marks that depend on the headlines follow the headlines.
    atlas.setArticles(layer.getView().snapshot?.articles ?? []);
    const sources = model.sources.filter((source) => source.state !== 'off');
    const live = sources.filter((source) => source.state === 'ok').length;
    liveText.textContent = liveLabel(state, live, sources.length);
    count.textContent = model.total ? `${model.total} HEADLINES` : '';
    topicCount.textContent = count.textContent;
    // Two figures, one at each end of the line under the title.
    feedCount.replaceChildren(
      ...(!model.total
        ? []
        : model.grouped
          ? [`${model.shown} STORIES`, `${model.headlines} HEADLINES`]
          : [`${model.shown} SHOWN`, `OF ${model.total}`]
      ).map((text) => el(document, 'span', { text })),
    );
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
    shareBtn.lastElementChild.textContent = copyLabel(copied);
    win.setTimeout(() => {
      shareBtn.lastElementChild.textContent = copyLabel(null);
    }, 2200);
  });
  lensNews.addEventListener('click', () => setLens('news'));
  lensPower.addEventListener('click', () => setLens('power'));
  lensElections.addEventListener('click', () => setLens('elections'));
  lensMarkets.addEventListener('click', () => setLens('markets'));
  lensRelief.addEventListener('click', () => setLens('relief'));
  tvBtn.addEventListener('click', () => {
    tv.toggle();
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
  settingsBtn.addEventListener('click', () => settings.open());
  /**
   * The globe is drawn at the screen's own resolution, capped at twice the
   * layout size. The engine's default is the layout size, which on a
   * high-density screen leaves every icon and name on the globe soft.
   */
  function applySharpGlobe() {
    const viewer = dataManager?.viewer;
    if (!viewer || body.dataset.corantoFrame !== 'one') return;
    const density = Math.max(1, win.devicePixelRatio || 1);
    const sharp = settingsStore.get('sharpGlobe') && density > 1;
    viewer.useBrowserRecommendedResolution = !sharp;
    viewer.resolutionScale = sharp ? Math.min(2, density) / density : 1;
    viewer.scene.requestRender?.();
  }
  const applySettings = () => {
    applyHeaderLayout();
    applySharpGlobe();
    syncLayers();
    body.dataset.corantoTicker = settingsStore.get('ticker') ? 'on' : 'off';
    tick();
  };
  settingsStore.subscribe(applySettings);
  applySettings();
  const onKey = (event) => {
    // Ctrl+K, or Cmd+K on a Mac, opens the search over everything.
    if (
      (event.metaKey || event.ctrlKey) &&
      !event.altKey &&
      event.key?.toLowerCase() === 'k'
    ) {
      event.preventDefault();
      loadAtlasPlaces();
      palette.toggle();
      return;
    }
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
    if (settings.isOpen()) {
      settings.close();
      return;
    }
    // The analyst board closes one layer at a time, top first.
    if (board.closeTop()) return;
    setSourcesMenu(false);
    feed?.closeStory();
    dossier.close();
    transport.stop();
    if (!guide.hidden) guide.hidden = true;
    if (!briefing.hidden) closeBriefing();
    tv.close();
  };
  document.addEventListener('keydown', onKey);
  // SOURCES opens the feed's list of sources; pressed again, it closes it.
  // The feed's own status bar does the same, and the two stay in step.
  const showSources = () => {
    const open = !feed?.sourcesShown?.();
    feed?.showSources(open);
    if (open) {
      if (sides.isAway('feed')) sides.set('feed', false);
      feedBody.scrollTop = 0;
    }
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
  // For people, nothing on the globe is simulated.
  setRealOnly(body.dataset.corantoFrame === 'one');
  // Coranto's own icons mark what is tracked; the engine's corner brackets
  // around each object are switched off for people.
  setObjectBrackets(body.dataset.corantoFrame !== 'one');
  // Nor is an orbit drawn across the ground from the far side of the Earth.
  setOrbitsThroughEarth(body.dataset.corantoFrame !== 'one');
  // In the shared frame the engine's layer list shows icons, not emoji.
  const layerIconStyle = el(document, 'style', {
    text: layerIconCss("body[data-coranto-frame='one']"),
  });
  document.head?.append(layerIconStyle);
  const startView = settingsStore.get('startView');
  setMode(
    win.navigator?.webdriver || startView === 'last'
      ? (storedMode ?? defaultMode)
      : startView,
    { remember: false },
  );
  if (body.dataset.corantoMode === 'news') {
    // News opens straight onto the feed; the engine's mission launcher
    // belongs to the control room.
    writeStored(sessionStorageRef, FIRST_RUN_SESSION_KEY, 'dismissed');
  }

  // The feed's three drop-downs, drawn in Coranto's own style for people.
  let feedSelects = [];
  feed = createNewsFeed({
    document,
    body: feedBody,
    layer,
    onModel,
    onSources: (open) => sourcesBtn.setAttribute('aria-pressed', String(open)),
    board: boardStore,
    watch: {
      nearest: nearestBroadcaster,
      open: (index) => tv.openChannel(index),
    },
    around: {
      read: (place, storyText) =>
        aroundStory({
          place,
          storyText,
          readLayer: (id) => {
            if (!layerShown(id)) return { on: false, rows: [] };
            // Hazards keep their events in the layer's own view.
            if (id === 'hazards')
              return {
                on: true,
                rows: hazardsLayer?.getView?.()?.snapshot?.events ?? [],
              };
            let rows = [];
            try {
              rows =
                dataManager.layers
                  .get(id)
                  ?.module?.getAnalystRecords?.(20_000) ?? [];
            } catch {
              rows = [];
            }
            return { on: true, rows };
          },
        }),
      flyTo: (lat, lon) => flyTo(lat, lon, 350_000),
      switchOn: (id) => {
        Promise.resolve(dataManager?.setEnabled(id, true))
          .catch(() => {})
          .finally(() => {
            syncLayers();
            feed?.refresh();
            // The layer fills in over the next few seconds.
            for (const wait of [2500, 7000])
              win.setTimeout(() => feed?.refresh(), wait);
          });
      },
    },
  });
  if (!win.navigator?.webdriver && win.MutationObserver)
    feedSelects = [...feedBody.querySelectorAll('select.news-select')].map(
      (select) => enhanceSelect(select, { document, win }),
    );
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
        for (const [name] of ATLAS_OVERLAYS)
          if (atlasWanted[name]) setAtlas(name, true, { remember: false });
      }
      applySharpGlobe();
      if (!win.navigator?.webdriver) moon.install();
      // SILENCE and DISEASE come back as they were left.
      try {
        const wanted = JSON.parse(
          readStored(localStorageRef, OVERLAYS_KEY) ?? '{}',
        );
        if (wanted?.disease === true && !win.navigator?.webdriver)
          ownLayers.disease.set(true).then(syncLayers, () => {});
        if (wanted?.stories === false && !win.navigator?.webdriver)
          ownLayers.stories.set(false);
      } catch {
        // A broken stored value leaves both off.
      }
      syncLayers();
      hazardsLayer = manager.layers?.get('hazards')?.module ?? null;
      applyGlobeText();
      unsubscribeHazards =
        hazardsLayer?.subscribe?.((view) => {
          renderCard(view);
          checkHazardNotices(view);
        }) ?? null;
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
      if (body.dataset.corantoMode !== 'news') {
        timers.push(setTimeout(ensureNewsOn, 1500));
        return;
      }
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
      layerIconStyle.remove();
      unsubscribePlace?.();
      satelliteIcons.stop();
      sceneRestore?.destroy();
      delete win.__corantoRunCommand;
      win.clearInterval(outbreakTimer);
      notices.clear();
      quakeIcons.stop();
      nuclear.hide();
      atlas.destroy();
      board.destroy();
      document.removeEventListener('pointerdown', onOutside);
      unsubscribeHazards?.();
      feedSelects.forEach((entry) => entry.destroy());
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
