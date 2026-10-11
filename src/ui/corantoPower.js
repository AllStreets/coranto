import * as Cesium from 'cesium';

/**
 * The Watch Power lens: what states fly (military and government aircraft)
 * and where their bases and plate readers are, drawn from public sources and shown beside the news.
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

/** Top-down aircraft outline, from AUSPEX, pointing up (north). */
const PLANE_PATHS =
  '<ellipse cx="28" cy="28" rx="3.6" ry="19"/>' +
  '<path d="M28 19 L7 34 L9 38 L28 30 L47 38 L49 34 Z"/>' +
  '<path d="M28 42 L18 51 L20 53 L28 46 L36 53 L38 51 Z"/>';
const GOVERNMENT_COLOUR = '#e8d5a3';

/** A plane marker as an image, in one colour with a dark edge. */
export function planeMarker(colour) {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="112" height="112"><g fill="${colour}" stroke="#05060a" stroke-width="2" stroke-linejoin="round">${PLANE_PATHS}</g></svg>`,
  )}`;
}

/** Name for a government aircraft: callsign, else registration, else address. */
export function governmentName(record) {
  return (
    String(record.callsign ?? '').trim() ||
    String(record.registration ?? '').trim() ||
    String(record.icao24).toUpperCase()
  );
}

/** One line of facts about a government aircraft. */
export function governmentFacts(record) {
  const facts = [record.operator];
  if (record.onGround) facts.push('on the ground');
  else if (Number.isFinite(record.altitudeFt))
    facts.push(
      `${(Math.round(record.altitudeFt / 100) * 100).toLocaleString('en-GB')} ft`,
    );
  if (Number.isFinite(record.speedKt) && !record.onGround)
    facts.push(`${Math.round(record.speedKt)} kt`);
  return facts.filter(Boolean).join(' · ');
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

const GOVERNMENT_REFRESH_MS = 2 * 60 * 1000;
const GOVERNMENT_PREFIX = 'government-aircraft:';

/** The section heading for the government aircraft list. */
function governmentHeading(government) {
  return government.status === 'ready'
    ? `GOVERNMENT AIRCRAFT · ${government.aircraft.length}`
    : 'GOVERNMENT AIRCRAFT';
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
 * @param {typeof fetch} [options.fetchImpl]
 */
export function createPowerLens({
  document,
  getDataManager,
  showCard,
  fetchImpl = (...args) => globalThis.fetch(...args),
}) {
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

  // Government aircraft are not an engine layer: the lens reads the route
  // itself and draws its own markers.
  let government = { status: 'idle', aircraft: [], listed: 0 };
  let governmentTimer = null;
  const governmentMarkers = [];
  let governmentClicks = null;
  const govHeading = el(document, 'div', {
    class: 'coranto-rail-heading',
    text: 'GOVERNMENT AIRCRAFT',
  });
  const govNote = el(document, 'p', { class: 'coranto-power-intro' });
  const govList = el(document, 'div', { class: 'coranto-power-air' });

  const airHeading = el(document, 'div', {
    class: 'coranto-rail-heading',
    text: 'MILITARY AIRCRAFT · AIRBORNE NOW',
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
    govHeading,
    govNote,
    govList,
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
      subject: { id: record.icao24, lat: record.lat, lon: record.lon },
      onClose: () => {
        selectedId = null;
        refresh();
      },
    });
    refresh();
  }

  function clearGovernmentMarkers() {
    const entities = getDataManager()?.viewer?.entities;
    for (const marker of governmentMarkers.splice(0)) entities?.remove(marker);
    governmentClicks?.destroy();
    governmentClicks = null;
  }

  function drawGovernmentMarkers() {
    clearGovernmentMarkers();
    const viewer = getDataManager()?.viewer;
    const ellipsoid = viewer?.scene?.globe?.ellipsoid;
    const Cartographic = viewer?.camera?.positionCartographic?.constructor;
    if (!viewer?.entities || !ellipsoid || !Cartographic) return;
    const image = planeMarker(GOVERNMENT_COLOUR);
    for (const record of government.aircraft) {
      const position = ellipsoid.cartographicToCartesian(
        Cartographic.fromDegrees(
          record.lon,
          record.lat,
          Number.isFinite(record.altitudeFt) ? record.altitudeFt * 0.3048 : 0,
        ),
      );
      governmentMarkers.push(
        viewer.entities.add({
          id: `${GOVERNMENT_PREFIX}${record.icao24}`,
          position,
          billboard: {
            image,
            width: 26,
            height: 26,
            // Nose along the broadcast track; north-up when it gave none.
            rotation: Number.isFinite(record.track)
              ? (-record.track * Math.PI) / 180
              : 0,
            alignedAxis: position.constructor.UNIT_Z,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        }),
      );
    }
    // Selecting a marker on the globe opens the same card as its row.
    if (government.aircraft.length) {
      governmentClicks = new Cesium.ScreenSpaceEventHandler(
        viewer.scene.canvas,
      );
      governmentClicks.setInputAction((click) => {
        const picked = viewer.scene.pick(click.position);
        const id = picked?.id?.id ?? picked?.id;
        if (typeof id !== 'string' || !id.startsWith(GOVERNMENT_PREFIX)) return;
        const record = government.aircraft.find(
          (entry) => entry.icao24 === id.slice(GOVERNMENT_PREFIX.length),
        );
        if (record) selectGovernment(record);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }
    viewer.scene.requestRender?.();
  }

  async function loadGovernment() {
    try {
      const response = await fetchImpl('/api/government-aircraft', {
        headers: { Accept: 'application/json' },
      });
      if (response.status === 503)
        government = { status: 'unavailable', aircraft: [], listed: 0 };
      else if (!response.ok) throw new Error('government-aircraft');
      else {
        const payload = await response.json();
        government = {
          status: 'ready',
          aircraft: (payload.aircraft ?? []).filter(
            (record) =>
              Number.isFinite(record?.lat) && Number.isFinite(record?.lon),
          ),
          listed: payload.listed ?? 0,
          stale: Boolean(payload.stale),
          complete: payload.complete !== false,
        };
      }
    } catch {
      if (government.status !== 'ready')
        government = { status: 'unavailable', aircraft: [], listed: 0 };
    }
    if (!active) return;
    drawGovernmentMarkers();
    refresh();
  }

  function selectGovernment(record) {
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
      kind: `GOVERNMENT AIRCRAFT · ${record.role.toUpperCase()}`,
      title: governmentName(record),
      meta: [
        governmentFacts(record),
        record.type,
        record.registration ? `registration ${record.registration}` : '',
        `transponder ${record.icao24.toUpperCase()}`,
        'listed in the plane-alert database',
      ]
        .filter(Boolean)
        .join(' · '),
      url: record.trackerUrl,
      linkText: 'Open its live track at adsb.lol',
      subject: { id: record.icao24, lat: record.lat, lon: record.lon },
      onClose: () => {
        selectedId = null;
        refresh();
      },
    });
    refresh();
  }

  function governmentNote() {
    if (government.status === 'unavailable')
      return 'The government aircraft list or adsb.lol is not reachable. Nothing to show.';
    if (government.status !== 'ready') return 'Checking which are airborne…';
    const n = government.aircraft.length;
    const base = `${n} of ${government.listed} listed government, head-of-state and international-body aircraft ${n === 1 ? 'is' : 'are'} broadcasting a position now. The list is the public plane-alert database; positions are the aircraft’s own.`;
    return government.complete
      ? base
      : `${base} Part of the list could not be checked this time.`;
  }

  function renderGovernment() {
    govHeading.textContent = governmentHeading(government);
    govNote.textContent = governmentNote();
    govList.replaceChildren(
      ...government.aircraft.slice(0, 60).map((record) => {
        const row = el(
          document,
          'button',
          {
            type: 'button',
            class: 'coranto-power-plane coranto-power-gov',
            ...(record.icao24 === selectedId ? { 'aria-current': 'true' } : {}),
          },
          el(document, 'span', {
            class: 'coranto-power-callsign',
            text: governmentName(record),
          }),
          el(document, 'span', {
            class: 'coranto-power-facts',
            text: governmentFacts(record),
          }),
        );
        row.addEventListener('click', () => selectGovernment(record));
        return row;
      }),
    );
  }

  function refresh() {
    const manager = getDataManager();
    if (!manager || !active) return;
    renderGovernment();
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
      ? `MILITARY AIRCRAFT · AIRBORNE NOW · ${aircraft.length}`
      : 'MILITARY AIRCRAFT · AIRBORNE NOW';
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
      loadGovernment();
      governmentTimer = setInterval(loadGovernment, GOVERNMENT_REFRESH_MS);
      refresh();
    },
    /** Hide the lens and switch off only what it switched on. */
    leave() {
      active = false;
      element.hidden = true;
      selectedId = null;
      clearInterval(governmentTimer);
      governmentTimer = null;
      clearGovernmentMarkers();
      const manager = getDataManager();
      if (manager)
        for (const id of turnedOn)
          if (manager.isEnabled(id))
            Promise.resolve(manager.setEnabled(id, false)).catch(() => {});
      turnedOn.clear();
    },
  };
}
