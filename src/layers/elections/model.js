export const ELECTION_OVERLAY_SOURCE_ID = 'elections';
export const ELECTION_COLOR = '#6e8aff';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** `25 Oct` from `2026-10-25`. */
export function electionDay(date) {
  const [, month, day] = date.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

/** `today`, `tomorrow`, `in 14 days`. */
export function electionCountdown(daysUntil) {
  if (daysUntil <= 0) return 'today';
  if (daysUntil === 1) return 'tomorrow';
  return `in ${daysUntil} days`;
}

/** Marker diameter: nearer elections are larger. */
/** Billboard size in px: nearer polling days are larger, never under 24. */
export function electionMarkerSize(group) {
  if (group.daysUntil <= 14) return 34;
  if (group.daysUntil <= 45) return 28;
  return 24;
}

/** Elections within 45 days are labelled on the globe. */
export const electionHasLabel = (group) => group.daysUntil <= 45;

export function createElectionOverlayEntry({ group, position, selected }) {
  return {
    id: group.key,
    position,
    variant: 'label',
    title: `${group.country} · ${electionDay(group.date)}`,
    accent: ELECTION_COLOR,
    priority: (selected ? 1_000_000 : 0) + (200 - group.daysUntil),
    collisionGroup: 'ambient-label',
    paintLane: 'ambient-label',
    interactive: false,
    edgeFade: 'keyhole',
    horizonCull: true,
    terrainOcclusion: false,
    gapPx: 14,
    verticalOnly: true,
    placement: 'above',
  };
}

/** Stats for the standard feed-state chips. */
export function electionStats({ snapshot, error }) {
  if (!snapshot)
    return {
      count: 0,
      lastUpdate: null,
      error: error ?? null,
      source: 'Wikidata',
    };
  const stats = {
    count: snapshot.groups.length,
    lastUpdate: Date.parse(snapshot.fetchedAt),
    error: error ?? null,
    source: 'Wikidata',
  };
  if (snapshot.stale) stats.stale = true;
  return stats;
}
