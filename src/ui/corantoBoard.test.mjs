import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOARD_LIMIT,
  boardLinks,
  boardText,
  boardTitle,
  buildMatrix,
  matrixShade,
  buildSynthesis,
  buildTimeline,
  corroboration,
  createBoardStore,
  entitiesOf,
} from './corantoBoardModel.js';

const story = (key, title, extra = {}) => ({
  key,
  kind: 'story',
  title,
  url: `https://example.org/${key}`,
  ...extra,
});
const memory = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  };
};

test('entities match whole words, and short names only in capitals', () => {
  assert.deepEqual(
    entitiesOf({ title: 'US and Russia agree, he told us; AI chips' }),
    ['US', 'Russia', 'AI', 'Chip'],
  );
  assert.deepEqual(
    entitiesOf({ title: 'A fedora, a bus, some chairs and a grate' }),
    [],
  );
  assert.deepEqual(
    entitiesOf({
      title: 'Fed holds rates',
      summary: 'Oil and inflation eased',
    }),
    ['Fed', 'Oil', 'Rate', 'Inflation'],
  );
});

test('two items link when both mention an entity; the link says which', () => {
  const links = boardLinks([
    story('a', 'US sanctions Iran oil exports', { category: 'geopolitics' }),
    story('b', 'Iran says talks with EU continue', { category: 'geopolitics' }),
    story('c', 'Bitcoin falls as Fed speaks', { category: 'finance' }),
  ]);
  assert.deepEqual(links, [
    { a: 'a', b: 'b', terms: ['Iran'], sameTopic: true },
  ]);
});

test('related headlines are counted by shared long words, never invented', () => {
  const asset = story(
    'a',
    'Riyadh airport struck again after Houthi missile attack',
  );
  const articles = [
    {
      title: 'Houthi missile strikes Riyadh airport terminal',
      url: 'https://x/1',
      publishedAt: '2026-10-11T10:00:00Z',
      publisher: 'A',
    },
    {
      title: 'Airport in Riyadh closed after missile attack by Houthi forces',
      url: 'https://x/2',
      publishedAt: '2026-10-10T10:00:00Z',
      publisher: 'B',
    },
    {
      title: 'Pope to undergo surgery',
      url: 'https://x/3',
      publishedAt: '2026-10-11T09:00:00Z',
      publisher: 'C',
    },
    {
      title: asset.title,
      url: asset.url,
      publishedAt: '2026-10-11T08:00:00Z',
      publisher: 'D',
    },
  ];
  assert.deepEqual(corroboration(asset, articles), {
    count: 2,
    level: 'medium',
  });
  assert.deepEqual(corroboration(asset, []), { count: 0, level: 'low' });
  const days = buildTimeline([asset], articles);
  assert.deepEqual(
    days.map((d) => [d.day, d.items.length]),
    [
      ['2026-10-11', 2],
      ['2026-10-10', 1],
    ],
  );
  assert.ok(
    days
      .flatMap((d) => d.items)
      .every((item) => item.url.startsWith('https://')),
  );
});

test('the brief is counts and lists, and says it was not written by a model', () => {
  const assets = [
    story('a', 'US sanctions Iran', { category: 'geopolitics', place: 'Iran' }),
    { key: 'country:Iran', kind: 'country', title: 'Iran' },
  ];
  const brief = buildSynthesis(assets, []);
  assert.equal(
    brief.summary,
    '2 pinned items: 1 story and 1 place, across 1 topic and 1 location. 1 link between them.',
  );
  assert.deepEqual(brief.entities, ['US', 'Iran']);
  assert.equal(boardTitle(assets), 'Iran');
  assert.match(
    boardText(assets, [], Date.UTC(2026, 9, 11, 20)),
    /Not written by a model\.$/,
  );
  assert.equal(buildSynthesis([], []).summary, '');
});

test('the board survives a reload, has a limit, and saved boards can be loaded', () => {
  const storage = memory();
  let clock = 1000;
  const store = createBoardStore({ storage, now: () => clock++ });
  assert.equal(store.toggle(story('a', 'First')), 'pinned');
  assert.equal(
    store.toggle({ key: 'x', kind: 'nonsense', title: 'Bad' }),
    'invalid',
  );
  assert.equal(
    store.toggle(story('b', 'Second', { url: 'javascript:alert(1)' })),
    'pinned',
  );
  assert.equal(store.list()[1].url, '');
  const again = createBoardStore({ storage });
  assert.deepEqual(
    again.list().map((a) => a.key),
    ['a', 'b'],
  );
  const saved = store.save();
  assert.equal(saved.assets.length, 2);
  assert.equal(store.toggle(story('a', 'First')), 'removed');
  store.clear();
  assert.equal(store.save(), null);
  assert.equal(store.load(saved.id), true);
  assert.deepEqual(
    store.list().map((a) => a.key),
    ['a', 'b'],
  );
  store.deleteSaved(saved.id);
  assert.equal(createBoardStore({ storage }).saved().length, 0);
  for (let i = 0; i < BOARD_LIMIT + 3; i++)
    store.toggle(story(`n${i}`, `Item ${i}`));
  assert.equal(store.list().length, BOARD_LIMIT);
  assert.equal(store.toggle(story('extra', 'One more')), 'full');
});

test('items link through any name they both use, not only the fixed list', () => {
  const links = boardLinks([
    story(
      'a',
      'Saudi health minister visits survivors of deadly Riyadh airport attack',
      { category: 'geopolitics' },
    ),
    story(
      'b',
      'Trump weighs joining the fight against Houthis after Riyadh airport attack',
      { category: 'military' },
    ),
    story(
      'c',
      'Andy Burnham to publish all details of his dealings with Manchester City',
      { category: 'geopolitics' },
    ),
  ]);
  assert.deepEqual(links, [
    { a: 'a', b: 'b', terms: ['Riyadh'], sameTopic: false },
  ]);
});

test('the matrix counts overlap between topics and matches whole words only', () => {
  const assets = [
    story('a', 'x', { category: 'military' }),
    story('b', 'y', { category: 'finance' }),
  ];
  const articles = [
    {
      title: 'Oil market rattled as missile strikes hit ports',
      url: 'https://x/1',
    },
    { title: 'Army chief said the navy will expand', url: 'https://x/2' },
    { title: 'He said nothing about the detail', url: 'https://x/3' },
  ];
  const { cells, max } = buildMatrix(assets, articles);
  // One pinned military item counts double on the diagonal, plus two headlines.
  assert.equal(cells.military.military.score, 4);
  // Both topics are pinned (3) and one headline uses words from both.
  assert.equal(cells.military.finance.score, 4);
  assert.deepEqual(
    cells.military.finance.matches.map((a) => a.url),
    ['https://x/1'],
  );
  // "said" and "detail" do not count as the technology word "ai".
  assert.equal(cells.technology.technology.score, 0);
  assert.equal(max, 4);
  assert.deepEqual(
    [4, 2, 1, 0].map((score) => matrixShade(score, 4)),
    [3, 2, 1, 0],
  );
});
