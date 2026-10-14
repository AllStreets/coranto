/**
 * Coranto's settings: what they are, their defaults, and the store that
 * keeps them in the browser. Nothing here leaves the machine.
 */
export const SETTINGS_KEY = 'coranto.settings.v1';

/** id -> the values it accepts; the first is the default. */
export const SETTING_CHOICES = Object.freeze({
  headerLayout: ['menu', 'chips'],
  startView: ['last', 'news', 'instruments'],
  clock: ['utc', 'local'],
  ticker: [true, false],
  sharpGlobe: [true, false],
  noticeWatches: [true, false],
  noticeHazards: [true, false],
  noticeOutbreaks: [true, false],
});

export const SETTING_DEFAULTS = Object.freeze(
  Object.fromEntries(
    Object.entries(SETTING_CHOICES).map(([id, values]) => [id, values[0]]),
  ),
);

/** Keeps only known settings with accepted values; the rest fall back. */
export function cleanSettings(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return Object.fromEntries(
    Object.entries(SETTING_CHOICES).map(([id, values]) => [
      id,
      values.includes(source[id]) ? source[id] : values[0],
    ]),
  );
}

/**
 * @param {object} [options]
 * @param {Storage | null} [options.storage]
 */
export function createSettingsStore({ storage = null } = {}) {
  let values = SETTING_DEFAULTS;
  try {
    values = cleanSettings(JSON.parse(storage?.getItem(SETTINGS_KEY) ?? '{}'));
  } catch {
    values = { ...SETTING_DEFAULTS };
  }
  const listeners = new Set();
  const save = () => {
    try {
      storage?.setItem(SETTINGS_KEY, JSON.stringify(values));
    } catch {
      // A full or blocked store keeps the setting for this visit only.
    }
    for (const listener of listeners) listener(values);
  };
  return {
    get: (id) => values[id],
    all: () => ({ ...values }),
    set(id, value) {
      if (!SETTING_CHOICES[id]?.includes(value) || values[id] === value)
        return false;
      values = { ...values, [id]: value };
      save();
      return true;
    },
    reset() {
      values = { ...SETTING_DEFAULTS };
      save();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Everything Coranto keeps in this browser, keyed as it is stored. */
export function storedData(storage) {
  const out = {};
  if (!storage) return out;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith('coranto.')) continue;
    const raw = storage.getItem(key);
    try {
      out[key] = JSON.parse(raw);
    } catch {
      out[key] = raw;
    }
  }
  return out;
}

/** Removes the named keys, or every Coranto key when none are named. */
export function clearStored(storage, keys = null) {
  if (!storage) return 0;
  const doomed = keys ?? Object.keys(storedData(storage));
  for (const key of doomed) storage.removeItem(key);
  return doomed.length;
}

/** The keys the server can be given, and what each one unlocks. */
export const CONNECTION_KEYS = Object.freeze([
  ['openai', 'OpenAI', 'AI briefs, the analyst tools, translation and voice'],
  [
    'supabase',
    'Supabase',
    'The archive: 90 days of headlines, history on the analyst board, a daily AI cap',
  ],
  ['newsapi', 'NewsAPI', 'More headline sources in the feed'],
  ['fec', 'FEC', 'Campaign money in the Elections lens'],
  ['opensky', 'OpenSky', 'A second source for live aircraft'],
  ['aisstream', 'AISStream', 'Live ships'],
  ['mapillary', 'Mapillary', 'Street-level photographs'],
  ['tomtom', 'TomTom', 'Live road traffic'],
  ['googleMaps', 'Google Maps', 'Photorealistic 3D cities'],
  ['cesiumIon', 'Cesium ion', 'Extra terrain and imagery'],
]);

/** Rows for the key list: `set` is null while the server has not answered. */
export function connectionRows(health) {
  return CONNECTION_KEYS.map(([id, name, unlocks]) => ({
    id,
    name,
    unlocks,
    set: health?.keys ? health.keys[id] === true : null,
  }));
}
