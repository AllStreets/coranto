import * as Cesium from 'cesium';
import { markerImage, satelliteImage } from '../data/corantoIcons.js';
import { cullBeyondHorizon } from './corantoHorizon.js';

/**
 * Launch icons: one rocket at each launch site in the engine's launch list,
 * so a site can be found from orbit and selected. A site with several
 * launches shows the one nearest to now; its card says how many others the
 * list holds for that site.
 *
 * Every row is the engine's own, from Launch Library 2.
 */
const PREFIX = 'launch-icon:';
// The engine's own mark for a launch, which sits over the icon.
const ENGINE_PREFIX = 'rocket-launch:';
const PAYLOAD_PREFIX = 'launch-payload:';
/** What the card says about where a launch's drawn path comes from. */
export const PATH_NOTE = Object.freeze({
  estimated:
    'flight path ESTIMATED from the launch site and target orbit; no flown track is published',
  'catalogued-orbit':
    'orbit from the payload’s catalogued elements; the climb to it is ESTIMATED',
  none: '',
});
/** A launch's satellite is marked for a week after it flies. */
export const PAYLOAD_DAYS = 7;
export const PAYLOAD_COLOUR = '#7ef0c8';
const REFRESH_MS = 30_000;
export const LAUNCH_UPCOMING = '#4fd8ff';
export const LAUNCH_FLOWN = '#9fb3c4';

const siteKey = (row) => `${row.lat.toFixed(2)},${row.lon.toFixed(2)}`;

/**
 * Group launches by site. Each site leads with its next launch, or, when
 * none is still to come, its most recent one.
 * @returns {Array<{key: string, lat: number, lon: number, lead: object, others: number, upcoming: boolean}>}
 */
export function launchSites(rows) {
  const sites = new Map();
  for (const row of rows ?? []) {
    if (!Number.isFinite(row?.lat) || !Number.isFinite(row?.lon)) continue;
    const key = siteKey(row);
    if (!sites.has(key)) sites.set(key, []);
    sites.get(key).push(row);
  }
  return [...sites.entries()].map(([key, launches]) => {
    const timed = launches.filter((row) => Number.isFinite(row.hoursUntil));
    const ahead = timed
      .filter((row) => row.hoursUntil >= 0)
      .sort((a, b) => a.hoursUntil - b.hoursUntil);
    const behind = timed
      .filter((row) => row.hoursUntil < 0)
      .sort((a, b) => b.hoursUntil - a.hoursUntil);
    const lead = ahead[0] ?? behind[0] ?? launches[0];
    return {
      key,
      lat: lead.lat,
      lon: lead.lon,
      lead,
      launches,
      others: launches.length - 1,
      upcoming: ahead.length > 0,
    };
  });
}

function when(hours) {
  const size = Math.abs(hours);
  const amount =
    size < 1
      ? `${Math.max(1, Math.round(size * 60))} min`
      : size < 48
        ? `${Math.round(size)} h`
        : `${Math.round(size / 24)} days`;
  return hours >= 0 ? `in ${amount}` : `${amount} ago`;
}

/**
 * The satellites that recent launches put up: only launches that have flown
 * in the last week, and only where the launch is matched to a satellite in
 * the published catalogue. A launch still to come has nothing in orbit, and
 * an unmatched one is not guessed at.
 */
export function launchPayloads(rows) {
  return (rows ?? [])
    .filter(
      (row) =>
        row?.payload?.noradId &&
        Number.isFinite(row.hoursUntil) &&
        row.hoursUntil < 0 &&
        row.hoursUntil >= -PAYLOAD_DAYS * 24,
    )
    .map((row) => ({
      launchId: row.id,
      launchName: row.name ?? row.missionName ?? 'Launch',
      noradId: String(row.payload.noradId),
      name:
        String(row.payload.name ?? '').trim() || `NORAD ${row.payload.noradId}`,
      hoursUntil: row.hoursUntil,
    }));
}

/** The card for a satellite a recent launch carried. */
export function payloadCard(payload) {
  if (!payload) return null;
  return {
    kind: `SATELLITE · LAUNCHED ${when(payload.hoursUntil).toUpperCase()}`,
    title: payload.name,
    meta: [
      `carried by ${payload.launchName}`,
      `catalogue number ${payload.noradId}`,
      'where it is now, from its published orbital elements',
      'Launch Library 2 · CelesTrak',
    ].join(' · '),
    url: `https://celestrak.org/NORAD/elements/gp.php?CATNR=${encodeURIComponent(payload.noradId)}&FORMAT=TLE`,
    linkText: 'Open its orbital elements at celestrak.org',
  };
}

/** The card for one launch site. */
export function launchCard(site) {
  if (!site?.lead) return null;
  const { lead } = site;
  const timed = Number.isFinite(lead.hoursUntil);
  return {
    kind: timed
      ? `LAUNCH · ${lead.hoursUntil >= 0 ? 'PLANNED' : 'FLOWN'} ${when(lead.hoursUntil).toUpperCase()}`
      : 'LAUNCH',
    title: lead.name ?? lead.missionName ?? 'Launch',
    meta: [
      lead.provider,
      lead.launchSite,
      lead.status ? `status: ${lead.status}` : '',
      Number.isFinite(lead.launchTimeMs)
        ? `${new Date(lead.launchTimeMs).toISOString().slice(0, 16).replace('T', ' ')} UTC`
        : '',
      site.others > 0
        ? `${site.others} other ${site.others === 1 ? 'launch' : 'launches'} from this site in the list`
        : '',
      'Launch Library 2',
    ]
      .filter(Boolean)
      .join(' · '),
    url: '',
    linkText: '',
  };
}

/**
 * @param {object} options
 * @param {() => object|null} options.getManager The layer manager.
 * @param {(detail: object|null) => void} options.showCard
 */
export function createLaunchIcons({
  getManager,
  showCard,
  isNewsView = () => true,
}) {
  let icons = null;
  let stopCulling = null;
  let stopMoving = null;
  let clicks = null;
  let timer = null;
  let sites = new Map();
  let signature = '';
  let payloads = new Map();
  let payloadIcons = new Map();
  let lastMove = 0;

  const layer = () =>
    getManager()?.layers?.get('rocket-launches')?.module ?? null;

  function draw(viewer) {
    if (!icons) return;
    const list = launchSites(layer()?.getAnalystRecords?.(400) ?? []);
    const next = list
      .map((site) => `${site.key}:${site.lead.id}:${site.upcoming}`)
      .join('|');
    if (next === signature) return;
    signature = next;
    sites = new Map(list.map((site) => [site.key, site]));
    icons.removeAll();
    for (const site of list)
      icons.add({
        id: PREFIX + site.key,
        position: Cesium.Cartesian3.fromDegrees(site.lon, site.lat, 1500),
        image: markerImage({
          icon: 'launch',
          colour: site.upcoming ? LAUNCH_UPCOMING : LAUNCH_FLOWN,
        }),
        width: site.upcoming ? 28 : 24,
        height: site.upcoming ? 28 : 24,
        disableDepthTestDistance: 50_000,
      });
    // The satellites those launches carried, where the catalogue has them.
    payloads = new Map();
    payloadIcons = new Map();
    for (const payload of launchPayloads(
      list.flatMap((site) => site.launches),
    )) {
      payloads.set(payload.launchId, payload);
      payloadIcons.set(
        payload.launchId,
        icons.add({
          id: PAYLOAD_PREFIX + payload.launchId,
          position: Cesium.Cartesian3.ZERO,
          image: satelliteImage(PAYLOAD_COLOUR),
          width: 26,
          height: 26,
          show: false,
        }),
      );
    }
    lastMove = 0;
    viewer.scene.requestRender?.();
  }

  /** Move each payload icon to where its satellite is now. */
  function movePayloads(viewer) {
    if (!payloadIcons.size) return;
    const now = Date.now();
    if (now - lastMove < 1000) return;
    lastMove = now;
    const satellites = getManager()?.layers?.get('satellites')?.module;
    const occluder = new Cesium.EllipsoidalOccluder(
      viewer.scene.globe?.ellipsoid ?? Cesium.Ellipsoid.WGS84,
      viewer.camera.positionWC,
    );
    for (const [launchId, icon] of payloadIcons) {
      const found = satellites?.findByQuery?.(payloads.get(launchId).noradId);
      if (!found?.position) {
        icon.show = false;
        continue;
      }
      icon.position = found.position;
      icon.show = occluder.isPointVisible(found.position);
    }
  }

  /** The launch whose mission view the card opened, to close with the card. */
  let openedMission = null;
  function closeMission() {
    if (!openedMission) return;
    openedMission = null;
    layer()?.closeMission?.();
  }

  return {
    get shown() {
      return icons !== null;
    },
    count: () => sites.size,
    payloadCount: () => payloads.size,
    /** Leave any mission view this opened (the view changed). */
    closeMission,
    start() {
      const viewer = getManager()?.viewer;
      if (!viewer || icons) return;
      icons = new Cesium.BillboardCollection({ scene: viewer.scene });
      viewer.scene.primitives.add(icons);
      stopCulling = cullBeyondHorizon(viewer, icons);
      signature = '';
      draw(viewer);
      timer = setInterval(() => draw(viewer), REFRESH_MS);
      // The list arrives a little after the layer is switched on.
      setTimeout(() => draw(viewer), 3000);
      setTimeout(() => draw(viewer), 9000);
      clicks = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      clicks.setInputAction((click) => {
        const picked = viewer.scene.pick(click.position)?.id;
        const id = typeof picked === 'string' ? picked : picked?.id;
        if (typeof id !== 'string') return;
        let site = null;
        if (id.startsWith(PREFIX)) site = sites.get(id.slice(PREFIX.length));
        else if (id.startsWith(ENGINE_PREFIX)) {
          // The engine's mark was on top: show that very launch.
          const launchId = id.slice(ENGINE_PREFIX.length);
          for (const entry of sites.values()) {
            const lead = entry.launches.find((row) => row.id === launchId);
            if (lead) site = { ...entry, lead };
          }
        }
        // In the control room the engine's own mission panel answers.
        if (!isNewsView()) return;
        if (id.startsWith(PAYLOAD_PREFIX)) {
          const detail = payloadCard(
            payloads.get(id.slice(PAYLOAD_PREFIX.length)),
          );
          if (detail) showCard(detail);
          return;
        }
        const detail = launchCard(site);
        if (!detail) return;
        closeMission();
        const launchId = site.lead.id;
        const path = layer()?.missionPath?.(launchId) ?? { source: 'none' };
        const open = (how) => () => {
          if (layer()?.[how]?.(launchId)) openedMission = launchId;
        };
        showCard({
          ...detail,
          meta: [detail.meta, PATH_NOTE[path.source]]
            .filter(Boolean)
            .join(' · '),
          // The camera stays where it is; the flight path is a choice.
          action:
            path.source === 'none'
              ? undefined
              : { label: 'Show the flight path', run: open('openMission') },
          pin: path.replayable
            ? { label: 'Replay the launch', run: open('replayMission') }
            : undefined,
          onClose: closeMission,
        });
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      stopMoving = viewer.scene.preRender.addEventListener(() =>
        movePayloads(viewer),
      );
    },
    stop() {
      const viewer = getManager()?.viewer;
      clearInterval(timer);
      timer = null;
      stopCulling?.();
      stopCulling = null;
      stopMoving?.();
      stopMoving = null;
      closeMission();
      clicks?.destroy();
      clicks = null;
      if (icons) viewer?.scene?.primitives?.remove(icons);
      icons = null;
      sites = new Map();
      payloads = new Map();
      payloadIcons = new Map();
      viewer?.scene?.requestRender?.();
    },
  };
}
