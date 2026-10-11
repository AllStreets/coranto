import { normalizeVesselType } from './vesselLabels.js';

/**
 * Top-down ship outlines for the vessel layer, by class. The class comes
 * from the ship's own AIS type code, so it is only as specific as that code:
 * "passenger" covers ferries and cruise ships alike, and a ship that
 * broadcasts no type gets the plain hull.
 */

/** The hull a vessel is drawn with. */
export function shipClass(type) {
  const text = normalizeVesselType(type).toUpperCase();
  if (/CARGO/.test(text)) return 'cargo';
  if (/TANKER/.test(text)) return 'tanker';
  if (/PASSENGER/.test(text)) return 'passenger';
  if (/MILITARY|LAW ENFORCE/.test(text)) return 'military';
  if (
    /FISHING|TUG|TOWING|PILOT|SAR|SAILING|PLEASURE|HIGH-SPEED|TENDER|DIVE|DREDGER|MEDICAL|ANTI-POLLUTION/.test(
      text,
    )
  )
    return 'small';
  return 'other';
}

export const SHIP_CLASS_LABELS = Object.freeze({
  cargo: 'Cargo and container ship',
  tanker: 'Tanker',
  passenger: 'Passenger ship (ferry or cruise)',
  military: 'Military or law-enforcement vessel',
  small: 'Small craft: fishing, tug, pilot, rescue, sailing',
  other: 'Other, or type not broadcast',
});

const DARK = 'rgba(4,10,16,0.62)';
const LIGHT = 'rgba(255,255,255,0.82)';

/** Hull outline and deck detail, bow up, centred on 0,0 in a 32-unit box. */
const HULLS = {
  cargo: {
    hull: 'M0,-15 C3.4,-11.5 4.6,-7.5 4.6,-3.5 L4.6,12 Q4.6,14.2 2.4,14.2 L-2.4,14.2 Q-4.6,14.2 -4.6,12 L-4.6,-3.5 C-4.6,-7.5 -3.4,-11.5 0,-15Z',
    // Container stacks along the deck, bridge at the stern.
    deck:
      [-6.4, -2.8, 0.8, 4.4]
        .map(
          (y) =>
            `<rect x="-3.1" y="${y}" width="2.7" height="2.9" fill="${DARK}"/><rect x="0.4" y="${y}" width="2.7" height="2.9" fill="${DARK}"/>`,
        )
        .join('') +
      `<rect x="-3.2" y="9" width="6.4" height="3" rx="0.6" fill="${LIGHT}"/>`,
  },
  tanker: {
    hull: 'M0,-15 C4,-11.5 5.2,-7.5 5.2,-3.5 L5.2,11.5 Q5.2,14.2 2.6,14.2 L-2.6,14.2 Q-5.2,14.2 -5.2,11.5 L-5.2,-3.5 C-5.2,-7.5 -4,-11.5 0,-15Z',
    // A pipe run down the centreline with manifolds, bridge at the stern.
    deck:
      `<rect x="-0.55" y="-9" width="1.1" height="16.5" fill="${DARK}"/>` +
      [-6, -1.5, 3]
        .map((y) => `<circle cx="0" cy="${y}" r="1.7" fill="${DARK}"/>`)
        .join('') +
      `<rect x="-3.4" y="9" width="6.8" height="3" rx="0.6" fill="${LIGHT}"/>`,
  },
  passenger: {
    hull: 'M0,-15 C4.4,-11 5.6,-6.5 5.6,-2 L5.6,9 C5.6,12.6 3.4,14.4 0,14.4 C-3.4,14.4 -5.6,12.6 -5.6,9 L-5.6,-2 C-5.6,-6.5 -4.4,-11 0,-15Z',
    // Stepped upper decks and a funnel.
    deck:
      `<path d="M0,-9.5 C2.6,-7 3.4,-4 3.4,-1 L3.4,8.5 C3.4,10.6 2,11.6 0,11.6 C-2,11.6 -3.4,10.6 -3.4,8.5 L-3.4,-1 C-3.4,-4 -2.6,-7 0,-9.5Z" fill="${LIGHT}"/>` +
      `<rect x="-1.9" y="-3.5" width="3.8" height="9" rx="1.2" fill="${DARK}"/>` +
      `<circle cx="0" cy="7.6" r="1.25" fill="${DARK}"/>`,
  },
  military: {
    hull: 'M0,-15.5 L3.2,-7 L4,2 L4,10.5 L2.6,14.4 L-2.6,14.4 L-4,10.5 L-4,2 L-3.2,-7Z',
    // Forward gun, superstructure, flight deck aft.
    deck:
      `<circle cx="0" cy="-6.2" r="1.35" fill="${DARK}"/><rect x="-0.35" y="-9.6" width="0.7" height="3.4" fill="${DARK}"/>` +
      `<path d="M-2.4,-2.6 L2.4,-2.6 L2.9,4.2 L-2.9,4.2Z" fill="${DARK}"/>` +
      `<circle cx="0" cy="9.4" r="2.5" fill="none" stroke="${LIGHT}" stroke-width="0.8"/>`,
  },
  small: {
    hull: 'M0,-9.5 C2.9,-6 3.7,-2.5 3.7,1 L3.2,7.2 Q3,8.8 1.6,8.8 L-1.6,8.8 Q-3,8.8 -3.2,7.2 L-3.7,1 C-3.7,-2.5 -2.9,-6 0,-9.5Z',
    deck: `<rect x="-1.9" y="-1" width="3.8" height="4.6" rx="1" fill="${DARK}"/>`,
  },
  other: {
    hull: 'M0,-14 C3.6,-10.5 4.6,-7 4.6,-3 L4.6,11 Q4.6,13.4 2.4,13.4 L-2.4,13.4 Q-4.6,13.4 -4.6,11 L-4.6,-3 C-4.6,-7 -3.6,-10.5 0,-14Z',
    deck: `<rect x="-0.5" y="-8" width="1" height="17" fill="${DARK}"/>`,
  },
};

/**
 * One ship as an SVG, bow up. Drawn at twice the size it is shown so the
 * outline stays sharp.
 * @param {string} cls From `shipClass`.
 * @param {string} colour Hull colour.
 * @param {boolean} [selected]
 */
export function shipSvg(cls, colour, selected = false) {
  const { hull, deck } = HULLS[cls] ?? HULLS.other;
  const edge = selected ? 'rgba(6,26,32,0.95)' : 'rgba(4,18,24,0.9)';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="-16 -16 32 32">` +
    `<path d="${hull}" fill="${colour}" stroke="${edge}" stroke-width="${selected ? 1.2 : 0.8}" stroke-linejoin="round"/>` +
    `${deck}</svg>`
  );
}
