/**
 * The Watch Power lens: what states fly and where their bases and plate
 * readers are, drawn from public sources and shown beside the news.
 *
 * Everything here is something already broadcast or already mapped in public:
 * aircraft transmit their own position over ADS-B, and installations and
 * plate-reader cameras are entries in OpenStreetMap. The lens watches
 * institutions and equipment. It does not identify or follow individuals.
 */

const POWER_LAYERS = [
  {
    id: 'military',
    label: 'MILITARY AIRCRAFT',
    note: 'Aircraft broadcasting their own position (ADS-B, via adsb.lol)',
    auto: true,
  },
  {
    id: 'military-installations',
    label: 'MILITARY SITES',
    note: 'Bases and sites mapped in OpenStreetMap, near the view',
    auto: true,
  },
  {
    id: 'alpr-cameras',
    label: 'PLATE READERS',
    note: 'Licence-plate reader cameras mapped in OpenStreetMap. Zoom into a city.',
    auto: false,
  },
];

/** What a layer switch shows: a wording when off, else its item count. */
function layerCount(on, stats) {
  if (!on) return 'off';
  return Number.isFinite(stats?.count) ? String(stats.count) : '…';
}

/** A broadcast callsign, or the transponder address when it is blank or junk. */
export function aircraftName(record) {
  const callsign = String(record.callsign ?? '').trim();
  return /[A-Z0-9]/i.test(callsign)
    ? callsign
    : String(record.icao24).toUpperCase();
}

const feet = (metres) => Math.round((metres * 3.28084) / 100) * 100;

/** One line of facts about an aircraft record, from what it broadcast. */
export function aircraftFacts(record) {
  const facts = [];
  if (record.aircraftClass) facts.push(String(record.aircraftClass));
  if (record.onGround) facts.push('on the ground');
  else if (Number.isFinite(record.altitudeM))
    facts.push(`${feet(record.altitudeM).toLocaleString('en-GB')} ft`);
  if (Number.isFinite(record.speedMps) && !record.onGround)
    facts.push(`${Math.round(record.speedMps * 1.94384)} kt`);
  return facts.join(' · ');
}

/** Aircraft with a position, named ones first, then by altitude. */
export function sortAircraft(records) {
  return (records ?? [])
    .filter(
      (record) => Number.isFinite(record?.lat) && Number.isFinite(record?.lon),
    )
    .sort(
      (a, b) =>
        Number(/[A-Z0-9]/i.test(b.callsign ?? '')) -
          Number(/[A-Z0-9]/i.test(a.callsign ?? '')) ||
        (b.altitudeM ?? -1) - (a.altitudeM ?? -1) ||
        String(a.id).localeCompare(String(b.id)),
    );
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

/**
 * @param {object} options
 * @param {Document} options.document
 * @param {() => object|null} options.getDataManager
 * @param {(detail: object|null) => void} options.showCard
 */
export function createPowerLens({ document, getDataManager, showCard }) {
  const turnedOn = new Set();
  let active = false;
  let selectedId = null;

  const toggles = new Map();
  const toggleList = el(document, 'div', { class: 'coranto-power-layers' });
  for (const spec of POWER_LAYERS) {
    const count = el(document, 'span', { class: 'coranto-power-count' });
    const button = el(
      document,
      'button',
      {
        type: 'button',
        class: 'coranto-power-layer',
        title: spec.note,
        'aria-pressed': 'false',
      },
      el(document, 'span', { class: 'coranto-power-label', text: spec.label }),
      count,
    );
    button.addEventListener('click', () => {
      const manager = getDataManager();
      if (!manager) return;
      const next = !manager.isEnabled(spec.id);
      if (next) turnedOn.add(spec.id);
      else turnedOn.delete(spec.id);
      Promise.resolve(manager.setEnabled(spec.id, next))
        .catch(() => {})
        .finally(refresh);
    });
    toggles.set(spec.id, { button, count });
    toggleList.append(button);
  }

  const airHeading = el(document, 'div', {
    class: 'coranto-rail-heading',
    text: 'AIRBORNE NOW',
  });
  const airList = el(document, 'div', { class: 'coranto-power-air' });
  const element = el(
    document,
    'div',
    { class: 'coranto-power' },
    el(document, 'p', {
      class: 'coranto-power-intro',
      text: 'What states fly, and where their bases and plate readers are. Every item is already public: aircraft broadcast their own position, and the sites and cameras are mapped in OpenStreetMap.',
    }),
    toggleList,
    airHeading,
    airList,
    el(document, 'p', {
      class: 'coranto-power-foot',
      text: 'Public cameras, satellites and tracking tools are in INSTRUMENTS.',
    }),
  );
  element.hidden = true;

  function selectAircraft(record) {
    const manager = getDataManager();
    selectedId = record.icao24;
    const camera = manager?.viewer?.camera;
    if (camera) {
      camera.cancelFlight?.();
      camera.flyTo({
        destination:
          manager.viewer.scene.globe.ellipsoid.cartographicToCartesian(
            camera.positionCartographic.constructor.fromDegrees(
              record.lon,
              record.lat,
              900_000,
            ),
          ),
        orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
        duration: 1.6,
      });
    }
    showCard({
      kind: 'MILITARY AIRCRAFT',
      title: aircraftName(record),
      meta: [
        aircraftFacts(record),
        record.operator,
        `transponder ${record.icao24.toUpperCase()}`,
      ]
        .filter(Boolean)
        .join(' · '),
      url: `https://adsb.lol/?icao=${encodeURIComponent(record.icao24)}`,
      linkText: 'Open its live track at adsb.lol',
      onClose: () => {
        selectedId = null;
        refresh();
      },
    });
    refresh();
  }

  function refresh() {
    const manager = getDataManager();
    if (!manager || !active) return;
    for (const spec of POWER_LAYERS) {
      const { button, count } = toggles.get(spec.id);
      const known = manager.layers?.has(spec.id);
      button.hidden = !known;
      if (!known) continue;
      const on = manager.isEnabled(spec.id);
      button.setAttribute('aria-pressed', String(on));
      const stats = on ? manager.layers.get(spec.id).module.getStats?.() : null;
      count.textContent = layerCount(on, stats);
    }
    const military = manager.isEnabled('military')
      ? manager.layers.get('military')?.module
      : null;
    const aircraft = sortAircraft(military?.getAnalystRecords?.(400) ?? []);
    airHeading.textContent = military
      ? `AIRBORNE NOW · ${aircraft.length}`
      : 'AIRBORNE NOW';
    airList.replaceChildren(
      ...aircraft.slice(0, 60).map((record) => {
        const row = el(
          document,
          'button',
          {
            type: 'button',
            class: 'coranto-power-plane',
            ...(record.icao24 === selectedId ? { 'aria-current': 'true' } : {}),
          },
          el(document, 'span', {
            class: 'coranto-power-callsign',
            text: aircraftName(record),
          }),
          el(document, 'span', {
            class: 'coranto-power-facts',
            text: aircraftFacts(record),
          }),
        );
        row.addEventListener('click', () => selectAircraft(record));
        return row;
      }),
    );
    if (military && !aircraft.length)
      airList.append(
        el(document, 'p', {
          class: 'coranto-power-none',
          text: 'No military aircraft with a position right now.',
        }),
      );
  }

  return {
    element,
    refresh,
    /** Show the lens and switch on its default layers. */
    enter() {
      active = true;
      element.hidden = false;
      const manager = getDataManager();
      if (manager)
        for (const spec of POWER_LAYERS)
          if (
            spec.auto &&
            manager.layers?.has(spec.id) &&
            !manager.isEnabled(spec.id)
          ) {
            turnedOn.add(spec.id);
            Promise.resolve(manager.setEnabled(spec.id, true))
              .catch(() => {})
              .finally(refresh);
          }
      refresh();
    },
    /** Hide the lens and switch off only what it switched on. */
    leave() {
      active = false;
      element.hidden = true;
      selectedId = null;
      const manager = getDataManager();
      if (manager)
        for (const id of turnedOn)
          if (manager.isEnabled(id))
            Promise.resolve(manager.setEnabled(id, false)).catch(() => {});
      turnedOn.clear();
    },
  };
}
