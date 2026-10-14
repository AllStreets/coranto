import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SETTINGS_KEY,
  SETTING_DEFAULTS,
  cleanSettings,
  clearStored,
  connectionRows,
  createSettingsStore,
  storedData,
} from './corantoSettingsModel.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

test('unknown settings and values fall back to the defaults', () => {
  assert.deepEqual(
    cleanSettings({ headerLayout: 'sideways', clock: 'local', extra: 1 }),
    { ...SETTING_DEFAULTS, clock: 'local' },
  );
  assert.deepEqual(cleanSettings(null), SETTING_DEFAULTS);
});

test('a setting is saved at once and told to subscribers', () => {
  const storage = memoryStorage();
  const store = createSettingsStore({ storage });
  const seen = [];
  store.subscribe((values) => seen.push(values.headerLayout));
  assert.equal(store.set('headerLayout', 'menu'), true);
  assert.equal(store.set('headerLayout', 'menu'), false);
  assert.equal(store.set('headerLayout', 'nonsense'), false);
  assert.deepEqual(seen, ['menu']);
  assert.equal(JSON.parse(storage.getItem(SETTINGS_KEY)).headerLayout, 'menu');
  assert.equal(
    createSettingsStore({ storage }).get('headerLayout'),
    'menu',
    'read back on the next visit',
  );
  store.reset();
  assert.equal(store.get('headerLayout'), 'chips');
});

test('a broken stored value does not stop the app', () => {
  const store = createSettingsStore({
    storage: memoryStorage({ [SETTINGS_KEY]: '{not json' }),
  });
  assert.deepEqual(store.all(), SETTING_DEFAULTS);
});

test('export and clearing touch only Coranto keys', () => {
  const storage = memoryStorage({
    'coranto.watches.v1': '[{"id":"a"}]',
    'coranto.mode.v1': 'news',
    'someone.else': 'keep',
  });
  assert.deepEqual(storedData(storage), {
    'coranto.watches.v1': [{ id: 'a' }],
    'coranto.mode.v1': 'news',
  });
  assert.equal(clearStored(storage, ['coranto.watches.v1']), 1);
  assert.equal(storage.getItem('coranto.mode.v1'), 'news');
  assert.equal(clearStored(storage), 1);
  assert.equal(storage.getItem('someone.else'), 'keep');
});

test('key rows say set, not set, or unknown, and never a value', () => {
  const rows = connectionRows({ keys: { openai: true, fec: false } });
  assert.equal(rows.find((row) => row.id === 'openai').set, true);
  assert.equal(rows.find((row) => row.id === 'fec').set, false);
  assert.equal(rows.find((row) => row.id === 'tomtom').set, false);
  assert.equal(connectionRows(null)[0].set, null);
});
