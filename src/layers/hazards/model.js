export const HAZARD_OVERLAY_SOURCE_ID = 'hazards';
export const HAZARD_OVERLAY_COHORT_LIMIT = 48;

/**
 * Colour by the tracker's own alert level. Red is kept for a Red alert, as
 * in AUSPEX: when the screen shows red it means a tracker called it severe.
 */
export const HAZARD_COLORS = Object.freeze({
  Red: '#ff4d5e',
  Orange: '#fb923c',
  Green: '#5ac8fa',
  none: '#5ac8fa',
});

const KIND_LABEL = {
  'extreme temperature': 'TEMPERATURE',
};

export const hazardColor = (item) => HAZARD_COLORS[item.alert ?? 'none'];

/** Marker diameter in pixels by alert level. */
export function hazardMarkerSize(item) {
  if (item.alert === 'Red') return 34;
  if (item.alert === 'Orange') return 28;
  return 22;
}

/** Short upper-case kind for labels and cards. */
export const hazardKindLabel = (item) =>
  KIND_LABEL[item.kind] ?? item.kind.toUpperCase();

/** Only Orange and Red alerts are labelled on the globe, to keep it calm. */
export const hazardHasLabel = (item) =>
  item.alert === 'Red' || item.alert === 'Orange';

export function createHazardOverlayEntry({ item, position, selected }) {
  return {
    id: item.id,
    position,
    variant: 'label',
    title: hazardKindLabel(item),
    accent: hazardColor(item),
    priority: (selected ? 1_000_000 : 0) + (item.alert === 'Red' ? 2000 : 1000),
    collisionGroup: 'ambient-label',
    paintLane: 'ambient-label',
    interactive: false,
    edgeFade: 'keyhole',
    horizonCull: true,
    terrainOcclusion: false,
    gapPx: 13,
    verticalOnly: true,
    placement: 'above',
  };
}

/** Stats for the standard feed-state chips. */
export function hazardStats({ snapshot, error }) {
  const sources = snapshot?.sources ?? [];
  const live = sources.filter((source) => source.ok).length;
  const source = sources.length
    ? `${live} of ${sources.length} trackers`
    : 'GDACS · NASA EONET';
  if (!snapshot)
    return { count: 0, lastUpdate: null, error: error ?? null, source };
  const stats = {
    count: snapshot.events.length,
    lastUpdate: Date.parse(snapshot.fetchedAt),
    error: error ?? null,
    source,
  };
  if (snapshot.stale) stats.stale = true;
  else if (live < sources.length) stats.partial = true;
  return stats;
}
