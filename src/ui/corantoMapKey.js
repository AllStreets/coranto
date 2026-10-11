import {
  TOPIC_COLOURS,
  hazardIcon,
  iconImage,
  markerImage,
} from '../data/corantoIcons.js';
import { HAZARD_COLORS } from '../layers/hazards/model.js';
import { ELECTION_COLOR } from '../layers/elections/model.js';

/**
 * The map key: what each marker on the globe means. It is built from what is
 * switched on now, so it never describes a symbol that is not on the map.
 */

const TOPICS = [
  ['geopolitics', 'Geopolitics'],
  ['military', 'Military'],
  ['finance', 'Finance'],
  ['climate', 'Climate'],
  ['technology', 'Technology'],
  ['news', 'General news'],
];

const marker = (icon, colour, extra = {}) => ({
  image: markerImage({ icon, colour, ...extra }),
});

/**
 * @param {object} state
 * @param {boolean} state.news Story markers are on the globe.
 * @param {boolean} state.goodNewsOnly
 * @param {string[]} state.hazardKinds Kinds in the current hazard feed, or [].
 * @param {boolean} state.elections
 * @param {boolean} state.fires
 * @param {boolean} state.governmentAircraft
 * @param {string[]} state.otherLayers Names of other layers switched on.
 * @returns {Array<{heading: string, rows: Array<{image?: string, swatch?: string, label: string}>}>}
 */
export function buildMapKeyModel(state) {
  const sections = [];
  if (state.news) {
    sections.push({
      heading: state.goodNewsOnly
        ? 'STORIES · GOOD NEWS ONLY'
        : 'STORIES BY TOPIC',
      rows: state.goodNewsOnly
        ? [{ ...marker('good', TOPIC_COLOURS.good), label: 'Good news' }]
        : TOPICS.map(([id, label]) => ({
            ...marker(id, TOPIC_COLOURS[id]),
            label,
          })),
    });
    sections.push({
      heading: 'HOW A STORY IS PLACED',
      rows: [
        {
          ...marker('news', TOPIC_COLOURS.news),
          label: 'Solid ring: the story names a city',
        },
        {
          ...marker('news', TOPIC_COLOURS.news, { approximate: true }),
          label: 'Dashed ring: placed at a country or region, not a pinpoint',
        },
        {
          ...marker('news', TOPIC_COLOURS.news, { selected: true }),
          label: 'White ring: the place you selected',
        },
        {
          label:
            'A larger marker means more stories. Its icon is the topic most of them share.',
        },
      ],
    });
  }
  const kinds = [...new Set(state.hazardKinds ?? [])].sort();
  if (kinds.length) {
    const seen = new Set();
    const rows = [];
    for (const kind of kinds) {
      const icon = hazardIcon(kind);
      if (seen.has(icon)) continue;
      seen.add(icon);
      rows.push({
        ...marker(icon, HAZARD_COLORS.Orange),
        label: kinds
          .filter((other) => hazardIcon(other) === icon)
          .map((other) => other[0].toUpperCase() + other.slice(1))
          .join(', '),
      });
    }
    sections.push({ heading: 'NATURAL HAZARDS', rows });
    sections.push({
      heading: 'HAZARD ALERT LEVEL',
      rows: [
        { swatch: HAZARD_COLORS.Red, label: 'Red alert from the tracker' },
        { swatch: HAZARD_COLORS.Orange, label: 'Orange alert' },
        {
          swatch: HAZARD_COLORS.Green,
          label: 'Lower alert, or no level given',
        },
      ],
    });
  }
  const more = [];
  if (state.elections)
    more.push({
      swatch: ELECTION_COLOR,
      label: 'Polling day in the next 120 days',
    });
  if (state.governmentAircraft)
    more.push({
      image: iconImage('aircraft', '#e8d5a3'),
      label: 'Government aircraft broadcasting its position',
    });
  if (state.fires)
    more.push(
      {
        swatch: '#ffb020',
        square: true,
        label: 'Fires seen by satellite in this area',
      },
      { swatch: '#ff0000', square: true, label: 'The most intense fire areas' },
    );
  if (more.length) sections.push({ heading: 'ALSO ON THE MAP', rows: more });
  if (state.otherLayers?.length)
    sections.push({
      heading: 'OTHER LAYERS ON',
      rows: [
        {
          label: `${state.otherLayers.join(', ')}. Select any item on the globe to see what it is and where its data comes from.`,
        },
      ],
    });
  if (!sections.length)
    sections.push({
      heading: 'NOTHING TO EXPLAIN',
      rows: [{ label: 'No layer with markers is switched on.' }],
    });
  return sections;
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

/** @param {{document: Document, onClose: () => void}} options */
export function createMapKey({ document, onClose }) {
  const body = el(document, 'div', { class: 'coranto-key-body' });
  const close = el(
    document,
    'button',
    {
      type: 'button',
      class: 'coranto-key-close',
      'aria-label': 'Close the map key',
    },
    el(document, 'img', { src: iconImage('close', '#d5d0e2'), alt: '' }),
  );
  close.addEventListener('click', onClose);
  const element = el(
    document,
    'aside',
    { id: 'coranto-key', 'aria-label': 'Map key' },
    el(
      document,
      'div',
      { class: 'coranto-key-head' },
      el(document, 'span', { text: 'MAP KEY' }),
      close,
    ),
    body,
  );
  element.hidden = true;
  let shown = '';
  return {
    element,
    /** Redraw only when what the key says has changed. */
    render(state) {
      const sections = buildMapKeyModel(state);
      const signature = JSON.stringify(
        sections.map((s) => [s.heading, s.rows.map((r) => r.label)]),
      );
      if (signature === shown) return;
      shown = signature;
      body.replaceChildren(
        ...sections.flatMap((section) => [
          el(document, 'div', {
            class: 'coranto-key-heading',
            text: section.heading,
          }),
          ...section.rows.map((row) =>
            el(
              document,
              'div',
              { class: 'coranto-key-row' },
              row.image
                ? el(document, 'img', { src: row.image, alt: '' })
                : row.swatch
                  ? el(document, 'span', {
                      class: row.square
                        ? 'coranto-key-swatch coranto-key-square'
                        : 'coranto-key-swatch',
                      style: `background:${row.swatch}`,
                    })
                  : el(document, 'span', { class: 'coranto-key-gap' }),
              el(document, 'span', { text: row.label }),
            ),
          ),
        ]),
      );
    },
  };
}
