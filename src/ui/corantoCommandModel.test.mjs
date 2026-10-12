import assert from 'node:assert/strict';
import test from 'node:test';

import { isAmbiguous, rankCommands } from './corantoCommandModel.js';

const command = (title, kind, extra = {}) => ({
  id: `${kind}:${title}`,
  title,
  kind,
  run() {},
  ...extra,
});
const all = [
  command('Flights', 'SWITCH ON', { keywords: 'aircraft planes air traffic' }),
  command('Military', 'SWITCH ON'),
  command('Military', 'TOPIC'),
  command('Paris', 'FLY TO', { keywords: 'France capital' }),
  command('Paris', '4 STORIES'),
  command('France 24 English', 'WATCH LIVE', { keywords: 'Paris tv' }),
  command('Whole Earth', 'VIEW', { pinned: true }),
  command('Guide', 'OPEN', { pinned: true }),
  command('São Paulo', 'FLY TO'),
];
const titles = (query) =>
  rankCommands(all, query).map((entry) => `${entry.title} · ${entry.kind}`);

test('with nothing typed, only the pinned commands are offered', () => {
  assert.deepEqual(titles(''), ['Whole Earth · VIEW', 'Guide · OPEN']);
});

test('a name comes before a mention of it', () => {
  assert.deepEqual(titles('paris'), [
    'Paris · FLY TO',
    'Paris · 4 STORIES',
    'France 24 English · WATCH LIVE',
  ]);
});

test('every word typed must fit, and keywords count', () => {
  assert.deepEqual(titles('planes'), ['Flights · SWITCH ON']);
  assert.deepEqual(titles('france live'), ['France 24 English · WATCH LIVE']);
  assert.deepEqual(titles('paris submarine'), []);
});

test('accents and capitals do not matter', () => {
  assert.deepEqual(titles('sao paulo'), ['São Paulo · FLY TO']);
  assert.deepEqual(titles('WHOLE'), ['Whole Earth · VIEW']);
});

test('the same name doing different things is flagged as a choice', () => {
  assert.equal(isAmbiguous(rankCommands(all, 'military')), true);
  assert.equal(isAmbiguous(rankCommands(all, 'paris')), true);
  assert.equal(isAmbiguous(rankCommands(all, 'flights')), false);
  // Two things that begin with what was typed also count.
  const mixed = [
    command('Military', 'TOPIC'),
    command('Military Flights', 'SWITCH ON'),
  ];
  assert.equal(isAmbiguous(mixed, 'milit'), true);
  assert.equal(isAmbiguous(mixed, 'mi'), false, 'too little typed to say');
  assert.equal(isAmbiguous([]), false);
});

test('a limit is kept', () => {
  assert.equal(rankCommands(all, 'a', 2).length, 2);
});

// ── The command list ────────────────────────────────────────────────

const { buildCommands } = await import('./corantoCommandList.js');

function app(calls = []) {
  const note = (name) => () => calls.push(name);
  return {
    mode: 'news',
    setMode: (mode) => calls.push(`mode:${mode}`),
    setLens: (lens) => calls.push(`lens:${lens}`),
    lenses: [{ id: 'relief', title: 'Relief', icon: 'displaced' }],
    panels: [{ title: 'Live TV', icon: 'broadcast', run: note('tv') }],
    layers: [
      {
        id: 'flights',
        name: 'Live Flights',
        on: false,
        toggle: note('flights'),
      },
      { id: 'satellites', name: 'Satellites', on: true, toggle: note('sats') },
    ],
    overlays: [
      { id: 'cities', label: 'Cities', on: false, toggle: note('cities') },
    ],
    topics: [{ id: 'military', label: 'Military', run: note('topic') }],
    ranges: [{ hours: 168, label: 'Last 7 days', run: note('range') }],
    presets: [{ id: 'noir', label: 'Noir', run: note('noir') }],
    channels: [
      {
        name: 'France 24 English',
        city: 'Paris',
        covers: 'Europe',
        run: note('f24'),
      },
    ],
    storyPlaces: [
      { key: 'city:Paris', name: 'Paris', count: 4, run: note('stories') },
    ],
    places: [
      { kind: 'city', name: 'Paris', detail: 'France', run: note('fly') },
    ],
    articles: [
      { id: 'a1', title: 'Paris talks resume on trade', publisher: 'BBC' },
      { id: 'a2', title: 'Quake strikes Panama', publisher: 'CNA' },
    ],
    openStory: (id) => calls.push(`story:${id}`),
    searchFeed: (text) => calls.push(`search:${text}`),
  };
}

test('a layer command says which way it will switch', () => {
  const commands = buildCommands(app());
  const kindOf = (title) => commands.find((c) => c.title === title).kind;
  assert.equal(kindOf('Live Flights'), 'SWITCH ON');
  assert.equal(kindOf('Satellites'), 'SWITCH OFF');
  assert.equal(kindOf('News view'), 'YOU ARE HERE');
  assert.equal(kindOf('Instruments view'), 'GO TO');
});

test('one name can be a place to fly to, stories to read, a channel and a headline', () => {
  const calls = [];
  const results = rankCommands(buildCommands(app(calls), 'paris'), 'paris');
  assert.deepEqual(
    results.map((c) => `${c.title} · ${c.kind}`),
    [
      'Paris · 4 STORIES',
      'Paris · FLY TO',
      'Paris talks resume on trade · STORY',
      'France 24 English · WATCH LIVE',
      'Search the feed for “paris” · SEARCH',
    ],
  );
  assert.equal(isAmbiguous(results), true);
  results.forEach((c) => c.run());
  assert.deepEqual(calls, [
    'stories',
    'fly',
    'story:a1',
    'f24',
    'search:paris',
  ]);
});

test('headlines are searched only once enough is typed, and nothing is invented', () => {
  assert.equal(
    buildCommands(app(), 'pa').some((c) => c.kind === 'STORY'),
    false,
  );
  const none = rankCommands(buildCommands(app(), 'zzzz'), 'zzzz');
  assert.deepEqual(
    none.map((c) => c.kind),
    ['SEARCH'],
    'with no match the only offer is to search the feed',
  );
});
