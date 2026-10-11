import * as Cesium from 'cesium';
import { iconImage } from '../data/corantoIcons.js';
import { distanceKm } from './corantoContact.js';
import { cullBeyondHorizon } from './corantoHorizon.js';

/**
 * Live television news, as AUSPEX had it: a player inside the app and a pin
 * on the globe for each newsroom. The channels are AUSPEX's list plus two in
 * South America, so every inhabited continent has a newsroom of its own. All
 * allow their stream to be shown on other sites.
 *
 * Nothing is loaded from YouTube until the reader opens LIVE TV. The player
 * is YouTube's own, from its no-cookie address. A channel that will not play
 * here says so and offers its page instead; no other video is substituted.
 *
 * Rows: [name, city, what it covers, YouTube channel id, latitude,
 * longitude, colour]. The colours and positions are AUSPEX's, except
 * Africanews, which AUSPEX placed near Bangui and is in Pointe-Noire.
 */
export const BROADCASTERS = Object.freeze([
  [
    'Al Jazeera English',
    'Doha',
    'Middle East, Africa, Asia',
    'UCNye-wNBqNL5ZzHSJj3l8Bg',
    25.2854,
    51.531,
    '#E8A020',
  ],
  [
    'France 24 English',
    'Paris',
    'France, Africa, Europe',
    'UCQfwfsi5VrQ8yKZ-UWmAEFg',
    48.8738,
    2.295,
    '#3d8bff',
  ],
  [
    'DW News',
    'Berlin',
    'Germany, Europe',
    'UCknLrEdhRCp1aegoMqRaCZg',
    52.52,
    13.405,
    '#ff5a5a',
  ],
  [
    'Africanews',
    'Pointe-Noire',
    'Pan-African',
    'UC1_E8NeF5QHY2dtdLRBCCLA',
    -4.7692,
    11.8664,
    '#E05C00',
  ],
  [
    'CNA',
    'Singapore',
    'Asia and the Pacific',
    'UC83jt4dlz1Gjl58fzQrrKZg',
    1.3521,
    103.8198,
    '#00B4D8',
  ],
  [
    '9 News Australia',
    'Sydney',
    'Australia and the Pacific',
    'UCIYLOcEUX6TbBo7HQVF2PKA',
    -33.8688,
    151.2093,
    '#FFB000',
  ],
  [
    'CBS News',
    'New York',
    'United States',
    'UC8p1vwvWtl6T73JiExfWs1g',
    40.7614,
    -73.9776,
    '#5b8fe0',
  ],
  [
    'NBC News',
    'New York',
    'United States',
    'UCeY0bbntWzzVIaj2z3QigXg',
    40.7589,
    -73.9851,
    '#8e78ff',
  ],
  // South America. AUSPEX had no newsroom on the continent; these two were
  // added on 2026-10-11, when both were live on YouTube and allowed their
  // stream to be shown on other sites.
  [
    'Todo Noticias',
    'Buenos Aires',
    'Argentina and South America, in Spanish',
    'UCj6PcyLvpnIRT_2W_mwa9Aw',
    -34.6037,
    -58.3816,
    '#2fb5e8',
  ],
  [
    'CNN Brasil',
    'São Paulo',
    'Brazil and South America, in Portuguese',
    'UCvdwhh_fDyWccR42-rReZLw',
    -23.5505,
    -46.6333,
    '#e5484d',
  ],
  [
    'DW Español',
    'Berlin',
    'Latin America, in Spanish',
    'UCT4Jg8h03dD0iN3Pb5L0PMA',
    52.52,
    13.405,
    '#ff4fa3',
  ],
  [
    'Yahoo Finance',
    'New York',
    'Markets and business',
    'UCEAZeUIeJs0IjQiqTCdVSIg',
    40.7549,
    -73.984,
    '#4aa3df',
  ],
]);

/** The channel's live page on the video site. */
/**
 * The broadcaster whose newsroom is nearest a point, with the distance.
 * Nearness is all it means: the channel shows its own live output, which may
 * or may not be about a story placed there.
 * @param {{lat: number, lon: number}|null} at
 * @returns {{index: number, name: string, city: string, km: number}|null}
 */
export function nearestBroadcaster(at) {
  if (!Number.isFinite(at?.lat) || !Number.isFinite(at?.lon)) return null;
  let best = null;
  BROADCASTERS.forEach(([name, city, , , lat, lon], index) => {
    const km = distanceKm(at, { lat, lon });
    if (!best || km < best.km) best = { index, name, city, km };
  });
  return best && { ...best, km: Math.round(best.km) };
}

export const broadcastUrl = (channelId) =>
  `https://www.youtube.com/channel/${channelId}/live`;

/** The address of the embedded player for a channel's current live stream. */
export function broadcastEmbedUrl(channelId, origin = '') {
  const params = new URLSearchParams({
    channel: channelId,
    autoplay: '1',
    playsinline: '1',
    rel: '0',
    enablejsapi: '1',
  });
  if (origin) params.set('origin', origin);
  return `https://www.youtube-nocookie.com/embed/live_stream?${params}`;
}

/** Player error codes that mean the stream cannot be shown here. */
const BLOCKED = new Set([2, 5, 100, 101, 150, 153]);

/** Read a player message; true when it reports a stream that cannot play. */
export function isPlayerError(data) {
  let message = data;
  if (typeof data === 'string') {
    try {
      message = JSON.parse(data);
    } catch {
      return false;
    }
  }
  if (!message || typeof message !== 'object') return false;
  if (message.event === 'onError') return BLOCKED.has(Number(message.info));
  return BLOCKED.has(Number(message.info?.error ?? NaN));
}

const dataUri = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
const MONO = "Menlo, 'SF Mono', Consolas, 'DejaVu Sans Mono', monospace";

/** A newsroom's pin: a small labelled box on a stem, in its colour. */
export function broadcasterPin(name, city, colour, active) {
  const title = name.toUpperCase();
  const width = Math.ceil(Math.max(title.length * 4.5, city.length * 3.8) + 22);
  const box = 22;
  const height = box + 10;
  return {
    width,
    height,
    image: dataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * 3}" height="${height * 3}" opacity="${active ? 1 : 0.9}">` +
        `<rect x="0.75" y="0.75" width="${width - 1.5}" height="${box - 1.5}" fill="#06050b" fill-opacity="0.92" stroke="${colour}" stroke-width="${active ? 1.5 : 1}"/>` +
        `<circle cx="8" cy="${box / 2}" r="2.5" fill="${active ? '#ff3b4e' : colour}"/>` +
        `<text x="15" y="10" font-family="${MONO}" font-size="6.5" font-weight="700" letter-spacing="0.5" fill="${colour}">${title.replace(/&/g, '&amp;')}</text>` +
        `<text x="15" y="17.5" font-family="${MONO}" font-size="5.2" letter-spacing="0.5" fill="#e4dff2">${city.toUpperCase()}</text>` +
        `<rect x="${width / 2 - 0.5}" y="${box}" width="1" height="7" fill="${colour}"/>` +
        `<circle cx="${width / 2}" cy="${box + 8}" r="2" fill="${colour}"/></svg>`,
    ),
  };
}

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

const PREFIX = 'broadcaster:';
// Pins are drawn larger than their design size so the names read easily.
const PIN_SCALE = 1.6;

/**
 * The Live TV player. Returns `{ element, open, close, isOpen }`.
 * @param {object} options
 * @param {Document} options.document
 * @param {() => object|null} [options.getViewer] For the globe pins.
 */
export function createBroadcasts({ document, getViewer = () => null }) {
  const win = document.defaultView;
  let current = 0;
  let isOpen = false;
  let frame = null;
  let pins = null;
  let stopCulling = null;
  let handler = null;

  const stage = el(document, 'div', { class: 'coranto-tv-stage' });
  const blocked = el(
    document,
    'div',
    { class: 'coranto-tv-blocked' },
    el(document, 'p', {
      text: 'This channel is not showing a live stream that can play here.',
    }),
  );
  const blockedLink = el(document, 'a', {
    target: '_blank',
    rel: 'noopener noreferrer',
    text: 'Open its page at youtube.com',
  });
  blocked.append(blockedLink);
  blocked.hidden = true;
  const station = el(document, 'span', { class: 'coranto-tv-station' });
  const external = el(document, 'a', {
    class: 'coranto-tv-external',
    target: '_blank',
    rel: 'noopener noreferrer',
    text: 'youtube.com',
  });
  const tabs = el(document, 'div', {
    class: 'coranto-tv-tabs',
    role: 'group',
    'aria-label': 'Channel',
  });
  const closeButton = el(
    document,
    'button',
    {
      type: 'button',
      class: 'coranto-story-close',
      'aria-label': 'Close live TV',
    },
    el(document, 'img', { src: iconImage('close', '#d5d0e2'), alt: '' }),
  );
  const element = el(
    document,
    'aside',
    { id: 'coranto-tv', 'aria-label': 'Live television news' },
    el(
      document,
      'div',
      { class: 'coranto-story-head' },
      el(document, 'span', { class: 'coranto-tv-live' }),
      el(document, 'span', {
        class: 'coranto-story-where',
        text: 'LIVE // TELEVISION NEWS',
      }),
      closeButton,
    ),
    stage,
    el(document, 'div', { class: 'coranto-tv-foot' }, station, external),
    tabs,
    el(document, 'p', {
      class: 'coranto-tv-note',
      text: 'The player is YouTube’s own and loads only while this panel is open. Each newsroom is pinned on the globe. Drag the title to move the panel; drag its corner to resize it.',
    }),
  );
  element.hidden = true;

  function drawPins() {
    const viewer = getViewer();
    if (!viewer) return;
    stopCulling?.();
    if (pins) viewer.scene.primitives.remove(pins);
    pins = new Cesium.BillboardCollection({ scene: viewer.scene });
    const stacked = new Map();
    BROADCASTERS.forEach(([name, city, , , lat, lon, colour], index) => {
      const pin = broadcasterPin(name, city, colour, index === current);
      // Newsrooms in the same city are stacked, not drawn on top of each other.
      const level = stacked.get(city) ?? 0;
      stacked.set(city, level + 1);
      pins.add({
        id: PREFIX + index,
        position: Cesium.Cartesian3.fromDegrees(lon, lat, 3000),
        image: pin.image,
        width: pin.width * PIN_SCALE,
        height: pin.height * PIN_SCALE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(
          0,
          -level * (pin.height - 8) * PIN_SCALE,
        ),
        disableDepthTestDistance: 50_000,
      });
    });
    viewer.scene.primitives.add(pins);
    stopCulling = cullBeyondHorizon(viewer, pins);
    if (!handler) {
      handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click) => {
        const id = viewer.scene.pick(click.position)?.id;
        if (typeof id === 'string' && id.startsWith(PREFIX))
          tune(Number(id.slice(PREFIX.length)));
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }
    viewer.scene.requestRender?.();
  }

  function clearPins() {
    const viewer = getViewer();
    stopCulling?.();
    stopCulling = null;
    if (pins) viewer?.scene?.primitives?.remove(pins);
    pins = null;
    handler?.destroy();
    handler = null;
    viewer?.scene?.requestRender?.();
  }

  function tune(index) {
    current = Math.max(0, Math.min(BROADCASTERS.length - 1, index));
    const [name, city, covers, channelId] = BROADCASTERS[current];
    blocked.hidden = true;
    frame?.remove();
    frame = el(document, 'iframe', {
      class: 'coranto-tv-frame',
      title: `${name} live`,
      src: broadcastEmbedUrl(channelId, win?.location?.origin ?? ''),
      allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
      allowfullscreen: '',
      referrerpolicy: 'strict-origin-when-cross-origin',
    });
    // Ask the player to report its state, so a blocked stream can be told.
    frame.addEventListener('load', () => {
      try {
        frame.contentWindow?.postMessage(
          JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
          'https://www.youtube-nocookie.com',
        );
      } catch {
        /* the player simply will not report errors */
      }
    });
    stage.replaceChildren(frame, blocked);
    station.textContent = `${name} · ${city} · ${covers}`;
    external.href = broadcastUrl(channelId);
    blockedLink.href = broadcastUrl(channelId);
    for (const [i, tab] of [...tabs.children].entries())
      tab.setAttribute('aria-pressed', String(i === current));
    drawPins();
  }

  BROADCASTERS.forEach(([name, , , , , , colour], index) => {
    const tab = el(document, 'button', {
      type: 'button',
      class: 'coranto-tv-tab',
      'aria-pressed': 'false',
      text: name,
    });
    tab.style.setProperty('--tv', colour);
    tab.addEventListener('click', () => tune(index));
    tabs.append(tab);
  });

  const onMessage = (event) => {
    if (!isOpen || event.source !== frame?.contentWindow) return;
    if (!/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(event.origin)) return;
    if (isPlayerError(event.data)) blocked.hidden = false;
  };

  const api = {
    element,
    get isOpen() {
      return isOpen;
    },
    open() {
      if (isOpen) return;
      isOpen = true;
      element.hidden = false;
      win?.addEventListener('message', onMessage);
      tune(current);
    },
    close() {
      if (!isOpen) return;
      isOpen = false;
      element.hidden = true;
      win?.removeEventListener('message', onMessage);
      // Removing the player stops the stream and every request to YouTube.
      frame?.remove();
      frame = null;
      clearPins();
    },
    toggle() {
      if (isOpen) api.close();
      else api.open();
    },
    /** Open the panel on one channel, by its row in `BROADCASTERS`. */
    openChannel(index) {
      current = Math.max(0, Math.min(BROADCASTERS.length - 1, index));
      if (isOpen) tune(current);
      else api.open();
    },
  };
  closeButton.addEventListener('click', api.close);

  // Drag the panel by its title strip; it stays inside the window.
  const handle = element.firstElementChild;
  handle.style.cursor = 'move';
  handle.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    const box = element.getBoundingClientRect();
    const start = { x: event.clientX - box.left, y: event.clientY - box.top };
    const move = (next) => {
      const maxX = (win?.innerWidth ?? 0) - box.width - 6;
      const maxY = (win?.innerHeight ?? 0) - 60;
      element.style.left = `${Math.max(6, Math.min(maxX, next.clientX - start.x))}px`;
      element.style.top = `${Math.max(6, Math.min(maxY, next.clientY - start.y))}px`;
      element.style.right = 'auto';
    };
    const stop = () => {
      win?.removeEventListener('pointermove', move);
      win?.removeEventListener('pointerup', stop);
    };
    win?.addEventListener('pointermove', move);
    win?.addEventListener('pointerup', stop);
    event.preventDefault();
  });
  return api;
}
