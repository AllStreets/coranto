/**
 * Coranto's map and interface icons, as inline SVG. The topic, hazard and
 * city glyphs are AUSPEX's own set (Apache-2, Connor Evans); the rest are
 * drawn here in the same 24-unit stroke style. No emoji and no text glyphs:
 * every marker on the globe and every icon in the key comes from this file.
 */

const STROKE =
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const SOLID = 'fill="currentColor" stroke="none"';

/** name -> [attributes, inner markup], all on a 24 by 24 grid. */
export const ICONS = Object.freeze({
  // Story topics
  geopolitics: [
    STROKE,
    '<path d="M3 9.5 12 4l9 5.5"/><path d="M5.5 10v8M9.5 10v8M14.5 10v8M18.5 10v8"/><path d="M3.5 18.5h17M4.5 21h15"/>',
  ],
  military: [
    STROKE,
    '<path d="M12 2.5 4.5 5.2v5.6c0 4.7 3.2 8 7.5 10.2 4.3-2.2 7.5-5.5 7.5-10.2V5.2L12 2.5Z"/><path d="M12 8.3l1.15 2.4 2.6.3-1.95 1.8.5 2.6L12 16.4l-2.3 1.2.5-2.6L8.25 11l2.6-.3L12 8.3Z"/>',
  ],
  finance: [
    STROKE,
    '<path d="M3.5 20.5h17"/><path d="M6.5 20.5v-5M11 20.5V11M15.5 20.5v-7M20 20.5V6.5"/>',
  ],
  climate: [
    STROKE,
    '<path d="M5 18C5 9.5 11 5 19.5 5 19.5 13.5 13.5 19 5 19c-.4 0-.8 0-1.1-.1Z"/><path d="M5 18.5c2.4-4.2 5.6-7 9.8-8.6"/>',
  ],
  technology: [
    STROKE,
    '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M10 7V4M14 7V4M10 20v-3M14 20v-3M7 10H4M7 14H4M20 10h-3M20 14h-3"/>',
  ],
  news: [
    STROKE,
    '<path d="M5 4.5h11v15H6.5A1.5 1.5 0 0 1 5 18V4.5Z"/><path d="M16 9h3v9a1.5 1.5 0 0 1-3 0"/><path d="M8 8.5h5M8 12h5M8 15.5h3"/>',
  ],
  good: [
    STROKE,
    '<path d="M12 20.5s-7-4.3-7-9.6A4 4 0 0 1 12 8.4a4 4 0 0 1 7 2.5c0 5.3-7 9.6-7 9.6Z"/>',
  ],
  // Hazards
  earthquake: [
    STROKE,
    '<circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><path d="M7 12a5 5 0 0 1 10 0"/><path d="M4 12a8 8 0 0 1 16 0"/>',
  ],
  volcano: [
    STROKE,
    '<path d="M3 20h18l-5.5-9h-5L3 20Z"/><path d="M10.5 11l1.5-3 1.5 3"/><path d="M12 5V3M9.5 5.5 8 4M14.5 5.5 16 4"/>',
  ],
  flood: [
    STROKE,
    '<path d="M2 8c2 0 2.5 1.5 5 1.5S14 8 14 8s2 1.5 4.5 1.5S22 8 22 8"/><path d="M2 13c2 0 2.5 1.5 5 1.5S14 13 14 13s2 1.5 4.5 1.5S22 13 22 13"/><path d="M2 18c2 0 2.5 1.5 5 1.5S14 18 14 18s2 1.5 4.5 1.5S22 18 22 18"/>',
  ],
  cyclone: [
    STROKE,
    '<path d="M12 12m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0"/><path d="M14.2 12c0-4.5-3-7.5-8-8 2.5 1 4 2.5 4.6 4.6"/><path d="M9.8 12c0 4.5 3 7.5 8 8-2.5-1-4-2.5-4.6-4.6"/>',
  ],
  wildfire: [
    SOLID,
    // Three tongues of flame, so it does not read as a drop of water.
    '<path d="M12.4 1.8c.5 3.1 2.3 4.8 3.5 6.9.6-.8.9-1.8.8-3 1.7 2 3 5 3 7.8a7.7 7.7 0 0 1-15.4 0c0-2.8 1.4-4.7 2.7-6.4.4 1.3 1.1 2.2 2.1 2.6C8.9 8.4 10.3 4.9 12.4 1.8Z"/><path d="M12 21.2a3.3 3.3 0 0 1-3.3-3.3c0-1.800 1.300-2.900 2.300-4.600.500 1.500 1.300 2 2.200 2.900.5-.5.800-1.100.900-1.800.8.900 1.200 2.100 1.200 3.500a3.3 3.3 0 0 1-3.300 3.300Z" fill="#07060c" fill-opacity="0.55"/>',
  ],
  drought: [
    STROKE,
    '<circle cx="12" cy="6" r="2.5"/><path d="M12 2.5V1M16 6h1.5M6.5 6H8M15 3l1-1M9 3 8 2"/><path d="M3 16h18M8 13l-1 3 2 4M14 13l1 3-1.5 4M11.5 13v3l1 4"/>',
  ],
  ice: [
    STROKE,
    '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><path d="M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5"/>',
  ],
  hazard: [
    STROKE,
    '<path d="M12 3 22 20H2L12 3Z"/><line x1="12" y1="9" x2="12" y2="14"/><circle cx="12" cy="17.5" r="0.8" fill="currentColor" stroke="none"/>',
  ],
  // Things that move, pointing up (north)
  aircraft: [
    SOLID,
    '<ellipse cx="12" cy="12" rx="1.55" ry="8.2"/><path d="M12 8.1 3 14.6l.850 1.7L12 12.9l8.15 3.4.85-1.7Z"/><path d="M12 18 7.7 21.9l.850.85L12 19.7l3.45 3.05.85-.850Z"/>',
  ],
  launch: [
    STROKE,
    '<path d="M12 2c3 1.5 5 5 5 9 0 2.2-.7 3.8-1.5 5h-7C7.7 14.8 7 13.2 7 11c0-4 2-7.5 5-9Z"/><circle cx="12" cy="10" r="1.6"/><path d="M9.5 16 7 19m7.5-3 2.5 3M12 16v4"/>',
  ],
  satellite: [
    STROKE,
    // A bus with two solar wings and a dish, tilted as satellites are drawn.
    '<g transform="rotate(-40 12 12)"><rect x="9.7" y="8" width="4.6" height="8" rx="0.9" fill="currentColor" stroke="none"/><rect x="1.4" y="9.3" width="6.4" height="5.4" rx="0.5" fill="currentColor" fill-opacity="0.32"/><rect x="16.2" y="9.3" width="6.4" height="5.4" rx="0.5" fill="currentColor" fill-opacity="0.32"/><path d="M4.6 9.3v5.4M19.4 9.3v5.4M7.8 12h1.9M14.3 12h1.9M12 8V5.8"/><path d="M9.5 3.6a2.7 2.7 0 0 0 5 0"/></g>',
  ],
  election: [
    STROKE,
    '<path d="M4 12.5h16V20H4z"/><path d="M8 12.5V5h8v7.5"/><path d="M10.3 8.3l1.3 1.3 2.3-2.6"/>',
  ],
  ship: [
    SOLID,
    '<path d="M12 2c2.6 3.4 3.6 8 3 13l-.9 6.5H9.9L9 15C8.4 10 9.4 5.4 12 2Z"/>',
  ],
  cable: [
    STROKE,
    '<path d="M2 15c3 0 3-6 6-6s3 6 6 6 3-6 6-6h2"/><circle cx="4" cy="15" r="1.4" fill="currentColor" stroke="none"/>',
  ],
  nuclear: [
    SOLID,
    '<circle cx="12" cy="12" r="2.1"/><path d="M9.9 8.36L7.2 3.69A9.6 9.6 0 0 1 16.8 3.69L14.1 8.36A4.2 4.2 0 0 0 9.9 8.36ZM16.2 12L21.6 12A9.6 9.6 0 0 1 16.8 20.31L14.1 15.64A4.2 4.2 0 0 0 16.2 12ZM9.9 15.64L7.2 20.31A9.6 9.6 0 0 1 2.4 12L7.8 12A4.2 4.2 0 0 0 9.9 15.64Z"/>',
  ],
  conflict: [SOLID, '<path d="M12 3.2 21.5 20h-19L12 3.2Z"/>'],
  sanction: [STROKE, '<circle cx="12" cy="12" r="8.5"/><path d="M6 18 18 6"/>'],
  star: [
    SOLID,
    '<path d="M12 2.4l2.9 6.1 6.7.8-4.95 4.6 1.3 6.6L12 17.3 6.05 20.5l1.3-6.6L2.4 9.3l6.7-.800L12 2.4Z"/>',
  ],
  broadcast: [
    STROKE,
    '<circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/><path d="M8.2 15.8a5.4 5.4 0 0 1 0-7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.4 18.6a9.3 9.3 0 0 1 0-13.2M18.6 5.4a9.3 9.3 0 0 1 0 13.2"/>',
  ],
  car: [
    STROKE,
    '<path d="M4 16.5v-3.2l1.8-4.6A2 2 0 0 1 7.7 7.4h8.6a2 2 0 0 1 1.9 1.3l1.8 4.6v3.2"/><path d="M3.5 13.3h17"/><circle cx="7.5" cy="16.8" r="1.7"/><circle cx="16.5" cy="16.8" r="1.7"/>',
  ],
  bus: [
    STROKE,
    '<rect x="5" y="4" width="14" height="13.5" rx="2"/><path d="M5 11.5h14M8 20v-2.5M16 20v-2.5"/><circle cx="8.5" cy="14.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="15.5" cy="14.5" r="0.9" fill="currentColor" stroke="none"/>',
  ],
  bike: [
    STROKE,
    '<circle cx="6.5" cy="15.5" r="3.5"/><circle cx="17.5" cy="15.5" r="3.5"/><path d="M6.5 15.5 10 8.5h5l2.5 7M10 8.5l3 7M9 6.5h2.5"/>',
  ],
  camera: [
    STROKE,
    '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.3-2h5.4L16 7h2.5A1.5 1.5 0 0 1 20 8.5v8A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5v-8Z"/><circle cx="12" cy="12.5" r="3.2"/>',
  ],
  wind: [
    STROKE,
    '<path d="M3 9h10.5a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 13h15a2.5 2.5 0 1 1-2.5 2.5"/><path d="M3 17h7"/>',
  ],
  rain: [
    STROKE,
    '<path d="M7 15a4 4 0 0 1 .600-7.95A5 5 0 0 1 17.3 8.5 3.3 3.3 0 0 1 17 15H7Z"/><path d="M8.5 18l-.800 2M12.5 18l-.800 2M16.5 18l-.800 2"/>',
  ],
  cloud: [
    STROKE,
    '<path d="M7 18a4.5 4.5 0 0 1 .600-8.95A5.5 5.5 0 0 1 18.2 10.5 3.8 3.8 0 0 1 17.5 18H7Z"/>',
  ],
  bolt: [SOLID, '<path d="M13.5 2 5 13.5h5.5L9.5 22 19 9.5h-5.8L13.5 2Z"/>'],
  compass: [
    STROKE,
    '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5 15.5 8.5Z"/>',
  ],
  circle: [STROKE, '<circle cx="12" cy="12" r="7.5"/>'],
  grid: [
    STROKE,
    '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 9.5h16M4 14.5h16M9.5 4v16M14.5 4v16"/>',
  ],
  moon: [
    STROKE,
    '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z"/>',
  ],
  thermometer: [
    STROKE,
    '<path d="M10 14.2V5.5a2 2 0 0 1 4 0v8.7a4 4 0 1 1-4 0Z"/><path d="M12 9v7"/><circle cx="12" cy="17.3" r="1.3" fill="currentColor" stroke="none"/>',
  ],
  sparkle: [
    SOLID,
    '<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3Z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/>',
  ],
  contrast: [
    STROKE,
    '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none"/>',
  ],
  square: [STROKE, '<rect x="5" y="5" width="14" height="14" rx="1.5"/>'],
  search: [STROKE, '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>'],
  pin: [
    STROKE,
    '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
  ],
  outbreak: [STROKE, '<path d="M2 12h4l2-5 3 10 2.5-7 1.5 2H22"/>'],
  displaced: [
    STROKE,
    '<circle cx="8" cy="6.5" r="2.2"/><path d="M4.5 20v-5.5a3.5 3.5 0 0 1 7 0V20"/><path d="M14 12h7M18 9l3 3-3 3"/>',
  ],
  // Interface
  pencil: [
    STROKE,
    '<path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 0 1 3 0l.5.5a2.1 2.1 0 0 1 0 3L8.5 19 4 20Z"/><path d="M14.5 6l3.5 3.5"/>',
  ],
  sun: [
    STROKE,
    '<circle cx="12" cy="12" r="3.6"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
  ],
  translate: [
    STROKE,
    '<path d="M3.5 6h9.5M8.2 4v2M5.6 6c.7 3 2.8 5.4 6.2 6.8M10.9 6c-.8 3.3-3.1 5.7-6.7 7"/><path d="m12.6 20 4-9 4 9M14 17h5.2"/>',
  ],
  play: [SOLID, '<path d="M7 4.5v15l12.5-7.5z"/>'],
  pause: [SOLID, '<path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z"/>'],
  prev: [SOLID, '<path d="M11.5 12 21 5.5v13zM2.5 12 12 5.5v13z"/>'],
  next: [SOLID, '<path d="M12.5 12 3 5.5v13zM21.5 12 12 5.5v13z"/>'],
  external: [STROKE, '<path d="M9 5H5v14h14v-4M13 4h7v7M20 4l-9 9"/>'],
  chevronRight: [STROKE, '<path d="m9 5 7 7-7 7"/>'],
  chevronDown: [STROKE, '<path d="m5 9 7 7 7-7"/>'],
  chevronLeft: [STROKE, '<path d="m15 5-7 7 7 7"/>'],
  rotate: [STROKE, '<path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/>'],
  target: [
    STROKE,
    '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22"/>',
  ],
  speaker: [
    STROKE,
    '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.6 7.6 0 0 1 0 11"/>',
  ],
  outlets: [
    STROKE,
    '<rect x="3.5" y="5" width="11" height="14" rx="1.2"/><path d="M17.5 8.5h3v9a1.5 1.5 0 0 1-3 0"/><path d="M6.5 9h5M6.5 12h5M6.5 15h3"/>',
  ],
  figures: [
    STROKE,
    '<path d="M4 19.5h16"/><path d="M7 19.5v-6M12 19.5V7M17 19.5v-9"/><path d="M5.5 9.5 10.5 5l3 2.5L19 4"/>',
  ],
  link: [
    STROKE,
    '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M17.5 13.5V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V8A1.5 1.5 0 0 1 6 6.5h4.5"/>',
  ],
  close: [STROKE, '<path d="M6 6l12 12M18 6 6 18"/>'],
  plus: [STROKE, '<path d="M12 5v14M5 12h14"/>'],
  minus: [STROKE, '<path d="M5 12h14"/>'],
  key: [
    STROKE,
    '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M7 9h.01M7 12.5h.01M7 16h.01M10.5 9H17M10.5 12.5H17M10.5 16H15"/>',
  ],
});

/** Topic colours. These match the `--cat-*` variables in coranto.css. */
export const TOPIC_COLOURS = Object.freeze({
  geopolitics: '#6e8aff',
  technology: '#22d3ee',
  // Military red, on markers, icons, bars and the map key alike.
  military: '#e23b3f',
  finance: '#e8b84b',
  climate: '#34d17a',
  news: '#d5d0e2',
  good: '#a8e05f',
});

/** Which icon a hazard kind uses. Kinds without their own use the triangle. */
const HAZARD_ICON = {
  earthquake: 'earthquake',
  volcano: 'volcano',
  flood: 'flood',
  cyclone: 'cyclone',
  storm: 'cyclone',
  wildfire: 'wildfire',
  drought: 'drought',
  'extreme temperature': 'drought',
  ice: 'ice',
  snow: 'ice',
};
export const hazardIcon = (kind) => HAZARD_ICON[kind] ?? 'hazard';

/**
 * Each hazard in the colour of what it is: fire orange, water blue, ice
 * pale, dry land tan. How severe a tracker calls it is shown by a ring
 * around the marker, not by its colour.
 */
export const HAZARD_KIND_COLOURS = Object.freeze({
  wildfire: '#ff9a2e',
  volcano: '#ff6b4a',
  earthquake: '#f2c14e',
  flood: '#4aa8ff',
  cyclone: '#7fe6ed',
  storm: '#7fe6ed',
  drought: '#c9a26b',
  'extreme temperature': '#f4a261',
  ice: '#cfeeff',
  snow: '#e8f4ff',
  landslide: '#b08968',
  dust: '#d6c7a1',
});
export const HAZARD_OTHER_COLOUR = '#b9b3c9';
export const hazardKindColour = (kind) =>
  HAZARD_KIND_COLOURS[kind] ?? HAZARD_OTHER_COLOUR;
/** The ring a tracker's alert level adds: Red and Orange only. */
export const ALERT_RING_COLOURS = Object.freeze({
  Red: '#ff4d5e',
  Orange: '#fb923c',
});

/** Mix a hex colour toward white by `amount` (0 to 1). */
export function liftColour(hex, amount) {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : 'ffffff';
  const channel = (i) => {
    const c = parseInt(value.slice(i, i + 2), 16);
    return Math.round(c + (255 - c) * amount)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

const dataUri = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

/** A bare icon as an image, in one colour. For buttons and the map key. */
export function iconImage(name, colour = '#ffffff') {
  const [attrs, body] = ICONS[name] ?? ICONS.hazard;
  return dataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96"><g ${attrs.replaceAll('currentColor', colour)}>${body.replaceAll('currentColor', colour)}</g></svg>`,
  );
}

/**
 * A satellite for the globe: a pale body with a dish, and two solar wings in
 * `colour`, each divided into cells. It is a small picture, not a line icon,
 * so it still reads as a satellite at sixteen pixels; the dark edge keeps it
 * clear over ocean, land and space alike.
 */
export function satelliteImage(colour = '#c89bff') {
  const edge = '#07060d';
  const body = '#f3f0fb';
  return dataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128"><g transform="rotate(-35 32 32)" stroke="${edge}" stroke-width="2.4" stroke-linejoin="round" paint-order="stroke">` +
      `<rect x="2" y="23" width="20" height="18" rx="1.5" fill="${colour}"/><rect x="42" y="23" width="20" height="18" rx="1.5" fill="${colour}"/>` +
      `<path d="M8.7 23v18M15.3 23v18M48.7 23v18M55.3 23v18" stroke-width="1.5" fill="none"/>` +
      `<path d="M22 32h4M38 32h4" stroke="${body}" stroke-width="3" paint-order="normal"/>` +
      `<rect x="25" y="19" width="14" height="26" rx="3" fill="${body}"/><rect x="25" y="28" width="14" height="6" fill="${colour}" stroke="none"/>` +
      `<path d="M32 19v-6" stroke="${body}" stroke-width="2.6" paint-order="normal"/><path d="M24.5 8.5a7.6 7.6 0 0 0 15 0z" fill="${body}"/></g></svg>`,
  );
}

/**
 * A globe marker: the icon on a dark disc ringed in its colour. It is a
 * vector drawn at twice its largest on-screen size, so it stays sharp on
 * high-density displays.
 *
 * @param {object} options
 * @param {string} options.icon Name in `ICONS`.
 * @param {string} options.colour Ring and glyph colour.
 * @param {boolean} [options.approximate] A dashed ring: the place is a
 * country or region, not a pinpoint.
 * @param {boolean} [options.selected] Adds a white outer ring.
 * @param {'Red'|'Orange'|null} [options.alert] Adds an outer ring in the
 * alert's colour, for a hazard a tracker has rated.
 */
export function markerImage({
  icon,
  colour,
  approximate = false,
  selected = false,
  alert = null,
}) {
  const [attrs, body] = ICONS[icon] ?? ICONS.hazard;
  const glyph = liftColour(colour, 0.45);
  const ring = approximate ? ' stroke-dasharray="5 4"' : '';
  return dataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128">` +
      (ALERT_RING_COLOURS[alert]
        ? `<circle cx="32" cy="32" r="29.2" fill="none" stroke="${ALERT_RING_COLOURS[alert]}" stroke-width="3"/>`
        : '') +
      (selected
        ? `<circle cx="32" cy="32" r="${ALERT_RING_COLOURS[alert] ? 31 : 30}" fill="none" stroke="#ffffff" stroke-width="${ALERT_RING_COLOURS[alert] ? 1.8 : 2.5}"/>`
        : '') +
      `<circle cx="32" cy="32" r="25" fill="#07060c" fill-opacity="${approximate ? 0.62 : 0.9}" stroke="${colour}" stroke-width="3.5"${ring}/>` +
      `<g transform="translate(15.2 15.2) scale(1.4)" ${attrs.replaceAll('currentColor', glyph)}>${body.replaceAll('currentColor', glyph)}</g>` +
      `</svg>`,
  );
}

/** The icon each engine layer shows in the layer list, by layer id. */
export const LAYER_ICONS = Object.freeze({
  news: 'news',
  elections: 'election',
  satellites: 'satellite',
  flights: 'aircraft',
  military: 'military',
  'local-adsb': 'broadcast',
  'ais-live-vessels': 'ship',
  traffic: 'car',
  transit: 'bus',
  bikeshare: 'bike',
  cctv: 'camera',
  'recent-imagery': 'satellite',
  'street-level': 'camera',
  'alpr-cameras': 'camera',
  'military-installations': 'target',
  'local-datacenters': 'technology',
  'telegeography-submarine-cables': 'cable',
  'local-dams': 'flood',
  hazards: 'hazard',
  'rocket-launches': 'launch',
  earthquakes: 'earthquake',
  'local-firms': 'wildfire',
  'fire-perimeters': 'wildfire',
  wind: 'wind',
  'weather-radar': 'rain',
  'weather-satellite': 'cloud',
  'weather-lightning': 'bolt',
  'weather-cyclones': 'cyclone',
  directions: 'compass',
  radio: 'speaker',
});

/** Engine controls whose text glyph or emoji becomes an icon: selector to icon. */
export const CONTROL_ICONS = Object.freeze({
  ".style-btn[data-style='normal'] .btn-icon": 'circle',
  ".style-btn[data-style='retro'] .btn-icon": 'grid',
  ".style-btn[data-style='surveillance'] .btn-icon": 'moon',
  ".style-btn[data-style='thermal'] .btn-icon": 'thermometer',
  ".style-btn[data-style='anime'] .btn-icon": 'sparkle',
  ".style-btn[data-style='noir'] .btn-icon": 'contrast',
  ".style-btn[data-style='snow'] .btn-icon": 'ice',
  '#hud-toggle .pp-icon': 'target',
  '#detection-toggle .pp-icon': 'grid',
  '#models3d-toggle .pp-icon': 'aircraft',
  '#scope-toggle .pp-icon': 'target',
  '#draw-toggle .pp-icon': 'pencil',
  '#celestial-toggle .pp-icon': 'sun',
  '#clean-view-toggle .pp-icon': 'square',
  '#bloom-toggle .pp-icon': 'sparkle',
  '#sharpen-toggle .pp-icon': 'search',
  '#share-btn .share-icon': 'link',
  '#search-toggle > span': 'search',
});

/**
 * Style rules that swap text glyphs and emoji in the engine's controls for
 * icons. `scope` is a selector the rules sit under, so only the intended
 * view changes; the engine's markup is left as it is.
 */
/** Elements whose whole text is one glyph, and the icon that stands in. */
export const GLYPH_ICONS = Object.freeze({
  '#cockpit-radio-prev-btn': 'prev',
  '#context-radio-mini-prev-btn': 'prev',
  '.ui-glyph-prev': 'prev',
  '#cockpit-radio-next-btn': 'next',
  '#context-radio-mini-next-btn': 'next',
  '.ui-glyph-next': 'next',
  '#cockpit-radio-play-btn': 'play',
  '#context-radio-mini-play-btn': 'play',
  '[data-mission-replay-toggle]': 'pause',
  "#cockpit-radio-play-btn[aria-label^='Pause']": 'pause',
  "#context-radio-mini-play-btn[aria-label^='Pause']": 'pause',
  "[data-mission-replay-toggle][aria-label^='Resume']": 'play',
  '.cockpit-utility-glyph': 'chevronLeft',
  ".cockpit-utility-glyph[aria-expanded='true']": 'chevronRight',
  '.rail-card-disclosure': 'chevronRight',
  "[data-open='true'] .rail-card-disclosure": 'chevronDown',
  '.orbit-icon': 'rotate',
  '.ui-glyph-external': 'external',
  '#sl-error > span[aria-hidden]': 'hazard',
  '#tr3b-toggle': 'aircraft',
});

function glyphCss(scope, colour) {
  const selectors = Object.keys(GLYPH_ICONS);
  return (
    `${selectors.map((s) => `${scope} ${s}`).join(',')}{font-size:0!important;background-position:center;background-repeat:no-repeat;background-size:12px}` +
    `${scope} .ui-glyph,${scope} .orbit-icon,${scope} .rail-card-disclosure,${scope} #sl-error > span[aria-hidden]{display:inline-block;width:12px;height:12px;vertical-align:-2px}` +
    selectors
      .map(
        (s) =>
          `${scope} ${s}{background-image:url("${iconImage(GLYPH_ICONS[s], colour)}")}`,
      )
      .join('') +
    // The HUD drew its corners with box characters and its live mark with a
    // bullet: draw the same shapes as lines and a disc.
    `${scope} .hud-bracket{font-size:0!important;width:16px;height:16px;border:0 solid currentColor}` +
    `${scope} .hud-top-left .hud-bracket{border-width:2px 0 0 2px}` +
    `${scope} .hud-top-right .hud-bracket{border-width:2px 2px 0 0}` +
    `${scope} .hud-bottom-left .hud-bracket{border-width:0 0 2px 2px}` +
    `${scope} .hud-bottom-right .hud-bracket{border-width:0 2px 2px 0}` +
    `${scope} #hud-rec-dot{font-size:0!important;display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff3333;box-shadow:0 0 6px rgba(255,51,51,.8)}`
  );
}

export function layerIconCss(scope, colour = '#cfc8e6') {
  const rows = Object.entries(LAYER_ICONS).map(
    ([id, icon]) =>
      `${scope} .data-toggle-row[data-layer-id='${id}'] .data-icon{background-image:url("${iconImage(icon, colour)}")}`,
  );
  const controls = Object.entries(CONTROL_ICONS).map(
    ([selector, icon]) =>
      `${scope} ${selector}{font-size:0!important;display:inline-block;width:16px;height:16px;background:url("${iconImage(icon, colour)}") center/contain no-repeat}`,
  );
  return (
    `${scope} .data-toggle-row .data-icon{font-size:0!important;width:16px;height:16px;flex:0 0 16px;background:center/contain no-repeat}` +
    rows.join('') +
    controls.join('') +
    // The location line starts with a pin emoji: hide that one character
    // and show the pin icon in its place.
    `${scope} #location-mini-city{padding-left:17px;background:url("${iconImage('pin', colour)}") left center/13px no-repeat}` +
    `${scope} #location-mini-city::first-letter{font-size:0!important}` +
    // Collapse buttons used plus, minus and triangle characters.
    `${scope} .panel-collapse-btn{font-size:0!important;background:url("${iconImage('plus', colour)}") center/11px no-repeat}` +
    `${scope} .panel-collapse-btn[aria-expanded='true']{background-image:url("${iconImage('minus', colour)}")}` +
    // Key tiers were coloured emoji dots.
    `${scope} .key-setup-tier{font-size:0!important;display:inline-block;width:8px;height:8px;border-radius:50%;background:#e8b84b}` +
    `${scope} .key-setup-tier[title^='Metered']{background:#ff4d5e}` +
    glyphCss(scope, colour)
  );
}
