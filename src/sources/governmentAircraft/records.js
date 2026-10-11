/**
 * Government aircraft: head-of-state, government and international-body
 * aircraft that are airborne and broadcasting their own position.
 *
 * Which aircraft count comes from the plane-alert database, a public list
 * kept by the SDR-Enthusiasts project under the Open Database Licence. Every
 * entry names an operator and carries a reference link. Positions are what
 * each aircraft itself broadcasts over ADS-B, read from adsb.lol. Coranto
 * adds nothing to either: an aircraft that is not in the list, or is not
 * broadcasting a position, is simply absent.
 */

export const REGISTRY_URL =
  'https://raw.githubusercontent.com/sdr-enthusiasts/plane-alert-db/main/plane-alert-db.csv';
export const REGISTRY_HOME =
  'https://github.com/sdr-enthusiasts/plane-alert-db';

/**
 * The list's categories that mean a government operates the aircraft, and
 * the plain label Coranto shows for each. The list's own category names are
 * editorial; the operator and the reference link are what is shown.
 */
export const GOVERNMENT_CATEGORIES = Object.freeze({
  Governments: 'Government',
  'Head of State': 'Head of state',
  'Royal Aircraft': 'Royal flight',
  'Dictator Alert': 'Government',
  Quango: 'International body',
});

/** Split one CSV line, honouring double-quoted fields. */
export function splitCsvLine(line) {
  const out = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      out.push(field);
      field = '';
    } else field += char;
  }
  out.push(field);
  return out;
}

/**
 * Parse the plane-alert CSV into the government aircraft it lists.
 * @returns {Map<string, object>} keyed by lower-case transponder address.
 */
export function parseRegistry(csv) {
  const lines = String(csv ?? '').split(/\r?\n/);
  const header = splitCsvLine(lines[0] ?? '').map((name) =>
    name.replace(/^[$#]+/, '').trim(),
  );
  const at = (name) => header.indexOf(name);
  const [iHex, iReg, iOperator, iType, iGroup, iCategory, iLink] = [
    at('ICAO'),
    at('Registration'),
    at('Operator'),
    at('Type'),
    at('CMPG'),
    at('Category'),
    at('Link'),
  ];
  const registry = new Map();
  if (iHex < 0 || iOperator < 0 || iCategory < 0) return registry;
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const row = splitCsvLine(line);
    const hex = String(row[iHex] ?? '')
      .trim()
      .toLowerCase();
    const role = GOVERNMENT_CATEGORIES[String(row[iCategory] ?? '').trim()];
    const operator = String(row[iOperator] ?? '').trim();
    if (!/^[0-9a-f]{6}$/.test(hex) || !role || !operator) continue;
    const link = String(row[iLink] ?? '').trim();
    registry.set(hex, {
      icao24: hex,
      registration: String(row[iReg] ?? '').trim(),
      operator,
      type: String(row[iType] ?? '').trim(),
      role,
      // An air force flies many government transports; the list says which.
      militaryOperated: String(row[iGroup] ?? '').trim() === 'Mil',
      reference: /^https:\/\/\S+$/.test(link) ? link : null,
    });
  }
  return registry;
}

const number = (value) => (Number.isFinite(value) ? value : null);

/** Join an adsb.lol `/v2/hex` answer to the registry. Positions only. */
export function parsePositions(data, registry) {
  const at = Number.isFinite(data?.now) ? data.now : null;
  const out = [];
  for (const raw of Array.isArray(data?.ac) ? data.ac : []) {
    const hex = String(raw?.hex ?? '')
      .trim()
      .toLowerCase();
    const entry = registry.get(hex);
    if (!entry || !Number.isFinite(raw.lat) || !Number.isFinite(raw.lon))
      continue;
    if (Math.abs(raw.lat) > 90 || Math.abs(raw.lon) > 180) continue;
    const onGround = raw.alt_baro === 'ground';
    const age = Number.isFinite(raw.seen_pos) ? raw.seen_pos : null;
    out.push({
      ...entry,
      callsign: String(raw.flight ?? '').trim(),
      lat: raw.lat,
      lon: raw.lon,
      onGround,
      altitudeFt: onGround ? null : number(raw.alt_baro),
      speedKt: number(raw.gs),
      track: number(raw.track),
      // When the aircraft last reported this position.
      seenAt:
        at !== null && age !== null
          ? new Date(at - age * 1000).toISOString()
          : null,
      trackerUrl: `https://adsb.lol/?icao=${hex}`,
    });
  }
  return out;
}

/** True when a record has what the interface must show. */
export function isShowableGovernmentAircraft(record) {
  return Boolean(
    record &&
    /^[0-9a-f]{6}$/.test(record.icao24 ?? '') &&
    typeof record.operator === 'string' &&
    record.operator &&
    typeof record.role === 'string' &&
    Number.isFinite(record.lat) &&
    Number.isFinite(record.lon) &&
    typeof record.trackerUrl === 'string',
  );
}
