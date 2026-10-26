import * as Cesium from 'cesium';
import { iconImage, glyphImage } from '../data/corantoIcons.js';
import { formatPeople } from '../sources/relief/format.js';
import { cullBeyondHorizon } from './corantoHorizon.js';

/**
 * The Relief lens: official humanitarian figures beside the humanitarian
 * news. Forced displacement is UNHCR's; disease outbreaks are the World
 * Health Organization's notices. Nothing here is estimated or written by a
 * model. A source that is down is named and its section says so.
 *
 * Food-security classification is not shown: it needs a key that Coranto does
 * not have, and the lens says that rather than leaving a silent gap.
 */

/** Words that mark a headline as humanitarian news. */
export const RELIEF_TERMS = Object.freeze([
  'humanitarian',
  'refugee',
  'refugees',
  'displaced',
  'displacement',
  'famine',
  'hunger',
  'aid',
  'relief',
  'outbreak',
  'cholera',
  'ebola',
  'epidemic',
  'evacuation',
  'evacuated',
  'shelter',
  'malnutrition',
  'unhcr',
  'migrants',
]);
export const OUTBREAK_COLOUR = '#ff74a8';

/** Turn the route's state into what the lens shows. */
export function buildReliefModel(state) {
  if (state?.status === 'unavailable')
    return {
      note: 'Neither UNHCR nor the World Health Organization is reachable. Nothing to show.',
      down: [],
      displacement: null,
      outbreaks: [],
    };
  if (state?.status !== 'ready')
    return {
      note: 'Reading UNHCR and WHO…',
      down: [],
      displacement: null,
      outbreaks: [],
    };
  const payload = state.payload ?? {};
  const rows = payload.displacement?.rows ?? [];
  const top = rows[0]?.total ?? 0;
  return {
    note: payload.stale
      ? `Showing figures saved ${String(payload.fetchedAt).slice(0, 10)}; the sources are not answering now.`
      : '',
    down: (payload.sources ?? []).filter((s) => !s.ok).map((s) => s.name),
    displacement: rows.length
      ? {
          year: payload.displacement.year,
          rows: rows.map((row, index) => ({
            id: row.iso3,
            rank: String(index + 1),
            name: row.name,
            total: formatPeople(row.total),
            share: top > 0 ? row.total / top : 0,
            detail: [
              row.refugees !== null
                ? `${formatPeople(row.refugees)} refugees`
                : '',
              row.displacedInside !== null
                ? `${formatPeople(row.displacedInside)} displaced inside the country`
                : '',
            ]
              .filter(Boolean)
              .join(' · '),
            title: [
              `${row.name}, ${row.year}`,
              row.refugees !== null
                ? `refugees ${row.refugees.toLocaleString('en-GB')}`
                : '',
              row.asylumSeekers !== null
                ? `asylum-seekers ${row.asylumSeekers.toLocaleString('en-GB')}`
                : '',
              row.displacedInside !== null
                ? `displaced inside the country ${row.displacedInside.toLocaleString('en-GB')}`
                : '',
              row.othersInNeed !== null
                ? `others in need of international protection ${row.othersInNeed.toLocaleString('en-GB')}`
                : '',
            ]
              .filter(Boolean)
              .join(' · '),
            url: row.url,
          })),
        }
      : null,
    outbreaks: (payload.outbreaks ?? []).map((item) => ({
      id: item.id,
      disease: item.disease,
      where: item.where,
      date: String(item.publishedAt).slice(0, 10),
      url: item.url,
      place: item.place,
    })),
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

const PREFIX = 'outbreak:';

/**
 * @param {object} options
 * @param {Document} options.document
 * @param {() => object|null} options.getViewer
 * @param {(detail: object|null) => void} options.showCard
 * @param {(lat: number, lon: number, height: number) => void} options.flyTo
 * @param {typeof fetch} [options.fetchImpl]
 */
export function createReliefLens({
  document,
  getViewer,
  showCard,
  flyTo,
  fetchImpl = (...args) => globalThis.fetch(...args),
}) {
  let active = false;
  let tab = 'displaced';
  let state = { status: 'loading' };
  let marks = null;
  let stopCulling = null;
  let clicks = null;

  const tabs = el(document, 'div', {
    class: 'coranto-money-tabs',
    role: 'group',
    'aria-label': 'Show',
  });
  const body = el(document, 'div', { class: 'coranto-relief-body' });
  const element = el(
    document,
    'div',
    { class: 'coranto-power coranto-relief' },
    el(document, 'p', {
      class: 'coranto-power-intro',
      text: 'Official humanitarian figures, with humanitarian news beside them. Displacement is from the UN refugee agency; outbreaks are the World Health Organization’s own notices. Nothing here is an estimate of Coranto’s.',
    }),
    tabs,
    body,
  );
  element.hidden = true;

  function clearMarks() {
    const viewer = getViewer();
    stopCulling?.();
    stopCulling = null;
    clicks?.destroy();
    clicks = null;
    if (marks) viewer?.scene?.primitives?.remove(marks);
    marks = null;
    viewer?.scene?.requestRender?.();
  }

  function outbreakCard(item) {
    showCard({
      kind: `DISEASE OUTBREAK · WHO NOTICE ${item.date}`,
      title: item.disease,
      meta: [
        item.where,
        item.place
          ? item.place.precision === 'city'
            ? ''
            : 'marked at the country, not a pinpoint'
          : 'not placed on the map',
        'World Health Organization, Disease Outbreak News',
      ]
        .filter(Boolean)
        .join(' · '),
      url: item.url,
      linkText: 'Read the notice at who.int',
    });
  }

  function drawMarks(outbreaks) {
    clearMarks();
    const viewer = getViewer();
    if (!viewer || !active) return;
    marks = new Cesium.BillboardCollection({ scene: viewer.scene });
    const seen = new Set();
    const image = glyphImage({ icon: 'outbreak', colour: OUTBREAK_COLOUR });
    for (const item of outbreaks) {
      // One mark per place: the newest notice there.
      if (!item.place || seen.has(item.place.name)) continue;
      seen.add(item.place.name);
      marks.add({
        id: PREFIX + item.id,
        position: Cesium.Cartesian3.fromDegrees(
          item.place.lon,
          item.place.lat,
          2500,
        ),
        image,
        width: 30,
        height: 30,
        // Beside any story marker that shares the country's point.
        pixelOffset: new Cesium.Cartesian2(-22, -22),
        disableDepthTestDistance: 50_000,
      });
    }
    viewer.scene.primitives.add(marks);
    stopCulling = cullBeyondHorizon(viewer, marks);
    clicks = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    clicks.setInputAction((click) => {
      const id = viewer.scene.pick(click.position)?.id;
      if (typeof id !== 'string' || !id.startsWith(PREFIX)) return;
      const item = outbreaks.find(
        (entry) => entry.id === id.slice(PREFIX.length),
      );
      if (item) outbreakCard(item);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    viewer.scene.requestRender?.();
  }

  function render() {
    if (!active) return;
    const model = buildReliefModel(state);
    tabs.replaceChildren(
      ...[
        ['displaced', 'Displaced people'],
        ['outbreaks', 'Outbreaks'],
      ].map(([id, label]) => {
        const button = el(document, 'button', {
          type: 'button',
          class: 'coranto-money-tab',
          'aria-pressed': String(tab === id),
          text: label,
        });
        button.addEventListener('click', () => {
          tab = id;
          render();
        });
        return button;
      }),
    );
    const nodes = [];
    if (model.note)
      nodes.push(
        el(document, 'p', { class: 'coranto-power-none', text: model.note }),
      );
    for (const name of model.down)
      nodes.push(
        el(document, 'p', {
          class: 'coranto-markets-down',
          text: `${name} is not answering.`,
        }),
      );
    if (tab === 'displaced' && model.displacement) {
      nodes.push(
        el(document, 'div', {
          class: 'coranto-rail-heading',
          text: `FORCED TO FLEE, BY COUNTRY OF ORIGIN · ${model.displacement.year}`,
        }),
      );
      const list = el(document, 'div', { class: 'coranto-money-list' });
      for (const row of model.displacement.rows) {
        const bar = el(document, 'span', { class: 'coranto-money-bar' });
        bar.style.width = `${Math.round(row.share * 100)}%`;
        list.append(
          el(
            document,
            'a',
            {
              class: 'coranto-money-row',
              href: row.url,
              target: '_blank',
              rel: 'noopener noreferrer',
              title: row.title,
            },
            el(document, 'span', {
              class: 'coranto-money-rank',
              text: row.rank,
            }),
            el(
              document,
              'span',
              { class: 'coranto-money-who' },
              el(document, 'span', {
                class: 'coranto-money-name',
                text: row.name,
              }),
              el(document, 'span', {
                class: 'coranto-money-detail',
                text: row.detail,
              }),
            ),
            el(document, 'span', {
              class: 'coranto-money-raised',
              text: row.total,
            }),
            bar,
          ),
        );
      }
      nodes.push(
        list,
        el(document, 'p', {
          class: 'coranto-markets-source',
          text: `UNHCR Refugee Data Finder · figures for ${model.displacement.year} · refugees, asylum-seekers, people displaced inside their country and others in need of protection`,
        }),
      );
    }
    if (tab === 'outbreaks') {
      nodes.push(
        el(document, 'div', {
          class: 'coranto-rail-heading',
          text: `WHO OUTBREAK NOTICES · ${model.outbreaks.length}`,
        }),
      );
      for (const item of model.outbreaks) {
        const row = el(
          document,
          'button',
          { type: 'button', class: 'coranto-election', title: item.disease },
          el(document, 'span', {
            class: 'coranto-election-date',
            text: item.date.slice(5),
          }),
          el(
            document,
            'span',
            { class: 'coranto-election-body' },
            el(document, 'span', {
              class: 'coranto-election-country',
              text: item.where || 'Place not stated',
            }),
            el(document, 'span', {
              class: 'coranto-election-title',
              text: item.disease,
            }),
          ),
        );
        row.addEventListener('click', () => {
          if (item.place) flyTo(item.place.lat, item.place.lon, 4_500_000);
          outbreakCard(item);
        });
        nodes.push(row);
      }
      if (state.status === 'ready' && !model.outbreaks.length)
        nodes.push(
          el(document, 'p', {
            class: 'coranto-power-none',
            text: 'The World Health Organization’s notices are not available now.',
          }),
        );
      nodes.push(
        el(document, 'p', {
          class: 'coranto-markets-source',
          text: 'World Health Organization, Disease Outbreak News · newest first · each is marked on the globe where its place could be matched',
        }),
      );
    }
    nodes.push(
      el(document, 'p', {
        class: 'coranto-power-foot',
        text: 'Not shown: food-security (famine) classification. The official source needs a key Coranto does not have yet.',
      }),
    );
    body.replaceChildren(...nodes);
  }

  async function load() {
    try {
      const response = await fetchImpl('/api/relief', {
        headers: { Accept: 'application/json' },
      });
      if (response.status === 503) state = { status: 'unavailable' };
      else if (!response.ok) throw new Error('relief');
      else state = { status: 'ready', payload: await response.json() };
    } catch {
      if (state.status !== 'ready') state = { status: 'unavailable' };
    }
    if (!active) return;
    render();
    drawMarks(buildReliefModel(state).outbreaks);
  }

  return {
    element,
    /** True while outbreak marks are on the globe. */
    get marked() {
      return marks !== null;
    },
    enter() {
      active = true;
      element.hidden = false;
      render();
      if (state.status === 'ready')
        drawMarks(buildReliefModel(state).outbreaks);
      load();
    },
    leave() {
      active = false;
      element.hidden = true;
      clearMarks();
    },
  };
}

/** The icon for an outbreak, for the map key. */
export const outbreakKeyImage = () => iconImage('outbreak', OUTBREAK_COLOUR);
