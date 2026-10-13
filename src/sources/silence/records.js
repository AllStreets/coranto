/**
 * Reading IODA's outage alerts into the places Coranto's SILENCE layer
 * fills. IODA (Internet Outage Detection and Analysis, Georgia Tech) raises
 * an alert whenever a measure of a place's connectivity leaves its normal
 * range, however slightly, so most open alerts are not blackouts. A place is
 * shown only when the latest alert for it is still open and the measured
 * level is far below its own recent normal.
 */

/** A level at or below this share of normal is a blackout. */
export const BLACKOUT_DROP = 0.5;
/** A level this far below normal, but short of a blackout, is a major outage. */
export const MAJOR_DROP = 0.3;

/**
 * What each IODA measure is. Routing and active probing each measure
 * reachability directly and count alone. The other two are indirect and
 * count only when a second measure agrees.
 */
export const SILENCE_MEASURES = Object.freeze({
  bgp: { label: 'routed networks (BGP)', alone: true },
  'ping-slash24': { label: 'networks answering probes', alone: true },
  'merit-nt': { label: 'traffic seen by a network telescope', alone: false },
  gtr: { label: 'Google traffic', alone: false },
});

/** The newest alert per place and measure, from one IODA alerts reply. */
export function latestAlerts(data) {
  const latest = new Map();
  for (const alert of Array.isArray(data?.data) ? data.data : []) {
    const entity = alert?.entity;
    const code = typeof entity?.code === 'string' ? entity.code.trim() : '';
    const type = entity?.type;
    const measure = alert?.datasource;
    if (
      !code ||
      (type !== 'country' && type !== 'region') ||
      !SILENCE_MEASURES[measure] ||
      !Number.isFinite(alert.time)
    )
      continue;
    const key = `${type}/${code}/${measure}`;
    const held = latest.get(key);
    if (!held || alert.time > held.time) latest.set(key, alert);
  }
  return [...latest.values()];
}

/**
 * The places in a blackout or a major outage now.
 *
 * @param {object[]} alerts newest alert per place and measure
 * @returns {Array<{type: string, code: string, name: string, iso2: string, tier: 'blackout'|'major', drop: number, measures: Array<{id: string, label: string, drop: number, value: number, normal: number}>, since: string}>}
 */
export function silencePlaces(alerts) {
  const places = new Map();
  for (const alert of alerts) {
    const normal = Number(alert.historyValue);
    const value = Number(alert.value);
    // A closed alert, or one with no normal to compare with, shows nothing.
    if (alert.level === 'normal' || !(normal > 0) || !(value >= 0)) continue;
    const drop = 1 - value / normal;
    if (!(drop >= MAJOR_DROP)) continue;
    const { entity } = alert;
    const key = `${entity.type}/${entity.code}`;
    const place = places.get(key) ?? {
      type: entity.type,
      code: entity.code,
      name: String(entity.name ?? '').trim() || entity.code,
      iso2:
        entity.type === 'country'
          ? entity.code
          : String(entity.attrs?.country_code ?? ''),
      measures: [],
      since: alert.time,
    };
    place.measures.push({
      id: alert.datasource,
      label: SILENCE_MEASURES[alert.datasource].label,
      drop: Math.round(drop * 100) / 100,
      value,
      normal,
    });
    place.since = Math.min(place.since, alert.time);
    places.set(key, place);
  }
  const out = [];
  for (const place of places.values()) {
    const direct = place.measures.filter(
      (measure) => SILENCE_MEASURES[measure.id].alone,
    );
    // One direct measure is enough; indirect ones need company.
    if (!direct.length && place.measures.length < 2) continue;
    const drop = Math.max(
      ...(direct.length ? direct : place.measures).map((m) => m.drop),
    );
    out.push({
      ...place,
      drop,
      tier: drop >= BLACKOUT_DROP ? 'blackout' : 'major',
      since: new Date(place.since * 1000).toISOString(),
    });
  }
  const whole = new Set(
    out.filter((place) => place.type === 'country').map((p) => p.code),
  );
  // A region inside a country already shown whole adds nothing.
  return out
    .filter((place) => place.type === 'country' || !whole.has(place.iso2))
    .sort((a, b) => b.drop - a.drop);
}
