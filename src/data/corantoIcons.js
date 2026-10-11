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
    '<path d="M12 2c.6 2.8-1.2 4.3-2.4 5.7C8.2 9.3 7 10.7 7 13a5 5 0 0 0 10 0c0-1.7-.8-3-1.6-4-.3.9-1 1.6-1.9 1.6 1-2.3-.2-5.6-1.5-8.6Z"/>',
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
    '<ellipse cx="12" cy="12" rx="1.55" ry="8.2"/><path d="M12 8.1 3 14.6l.850 1.7L12 12.9l8.15 3.4.850-1.7Z"/><path d="M12 18 7.7 21.9l.850.85L12 19.7l3.45 3.05.850-.850Z"/>',
  ],
  launch: [
    STROKE,
    '<path d="M12 2c3 1.5 5 5 5 9 0 2.2-.7 3.8-1.5 5h-7C7.7 14.8 7 13.2 7 11c0-4 2-7.5 5-9Z"/><circle cx="12" cy="10" r="1.6"/><path d="M9.5 16 7 19m7.5-3 2.5 3M12 16v4"/>',
  ],
  satellite: [
    STROKE,
    '<rect x="9.5" y="9.5" width="5" height="5" rx="0.8" transform="rotate(45 12 12)"/><path d="M6.3 10.5 3 7.2l3-3 3.3 3.3M17.7 13.5 21 16.8l-3 3-3.3-3.3"/><path d="M15.5 5.5a4.5 4.5 0 0 1 3 3"/>',
  ],
  election: [
    STROKE,
    '<path d="M4 12.5h16V20H4z"/><path d="M8 12.5V5h8v7.5"/><path d="M10.3 8.3l1.3 1.3 2.3-2.6"/>',
  ],
  // Interface
  close: [STROKE, '<path d="M6 6l12 12M18 6 6 18"/>'],
  plus: [STROKE, '<path d="M12 5v14M5 12h14"/>'],
  key: [
    STROKE,
    '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M7 9h.01M7 12.5h.01M7 16h.01M10.5 9H17M10.5 12.5H17M10.5 16H15"/>',
  ],
});

/** Topic colours. These match the `--cat-*` variables in coranto.css. */
export const TOPIC_COLOURS = Object.freeze({
  geopolitics: '#6e8aff',
  technology: '#22d3ee',
  military: '#f2917a',
  finance: '#e8b84b',
  climate: '#34d17a',
  news: '#d5d0e2',
  good: '#34e08a',
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
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48"><g ${attrs.replaceAll('currentColor', colour)}>${body.replaceAll('currentColor', colour)}</g></svg>`,
  );
}

/**
 * A globe marker: the icon on a dark disc ringed in its colour.
 *
 * @param {object} options
 * @param {string} options.icon Name in `ICONS`.
 * @param {string} options.colour Ring and glyph colour.
 * @param {boolean} [options.approximate] A dashed ring: the place is a
 * country or region, not a pinpoint.
 * @param {boolean} [options.selected] Adds a white outer ring.
 */
export function markerImage({
  icon,
  colour,
  approximate = false,
  selected = false,
}) {
  const [attrs, body] = ICONS[icon] ?? ICONS.hazard;
  const glyph = liftColour(colour, 0.45);
  const ring = approximate ? ' stroke-dasharray="5 4"' : '';
  return dataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">` +
      (selected
        ? '<circle cx="32" cy="32" r="30" fill="none" stroke="#ffffff" stroke-width="2.5"/>'
        : '') +
      `<circle cx="32" cy="32" r="25" fill="#07060c" fill-opacity="${approximate ? 0.62 : 0.9}" stroke="${colour}" stroke-width="3.5"${ring}/>` +
      `<g transform="translate(15.2 15.2) scale(1.4)" ${attrs.replaceAll('currentColor', glyph)}>${body.replaceAll('currentColor', glyph)}</g>` +
      `</svg>`,
  );
}
