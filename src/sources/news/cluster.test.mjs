import assert from 'node:assert/strict';
import test from 'node:test';
import { clusterArticles, headlineTerms, sameStory } from './cluster.js';

const a = (id, publisher, title, place = null) => ({
  id,
  publisher,
  title,
  publishedAt: '2026-10-10T10:00:00.000Z',
  place,
});
const city = (name) => ({ name, precision: 'city' });
const region = (name) => ({ name, precision: 'region' });

test('headline terms drop short and filler words and fold plurals', () => {
  assert.deepEqual(
    [...headlineTerms("Trump says Ukraine's leaders need 12 new jets")].sort(),
    ['12', 'jets', 'leader', 'trump', 'ukraine'],
  );
  assert.equal(headlineTerms('').size, 0);
});

test('the same event told by different outlets is one story', () => {
  const stories = clusterArticles([
    a('1', 'BBC', 'Twelve killed and 300 injured in attack on airport in Saudi capital Riyadh'),
    a('2', 'NPR', 'Attack on Riyadh airport killed 12 people and wounded over 300 more'),
    a('3', 'Al Jazeera', 'Twelve killed, more than 300 injured in Riyadh airport attack'),
    a('4', 'Al Jazeera', 'World condemns deadly Houthi attack on Saudi Arabia’s Riyadh airport'),
    a('5', 'DW', 'Taiwan to boost military spending to deter war with China'),
  ]);
  assert.equal(stories.length, 2);
  assert.deepEqual(stories[0].articleIds, ['1', '2', '3', '4']);
  // Two Al Jazeera pieces count once: outlets are distinct publishers.
  assert.equal(stories[0].outlets, 3);
  assert.deepEqual([stories[1].articleIds, stories[1].outlets], [['5'], 1]);
});

test('alike wording about different places stays separate', () => {
  const stories = clusterArticles([
    a('1', 'ABC', 'Pregnant woman among eight killed in Pennsylvania shooting', region('Pennsylvania')),
    a('2', 'SCMP', '9 dead, including children and pregnant woman, in shooting in Erie, Pennsylvania', region('Pennsylvania')),
    a('3', 'Al Jazeera', 'ICE agent in New York shooting also involved in assault of pregnant woman', city('New York City')),
  ]);
  assert.deepEqual(stories.map((s) => s.articleIds), [['1', '2'], ['3']]);
});

test('two shared words are not enough', () => {
  assert.equal(
    sameStory(
      headlineTerms('Central bank holds interest rates steady'),
      headlineTerms('Central bank governor resigns over scandal'),
    ),
    false,
  );
});

test('every article lands in exactly one story and ids are stable', () => {
  const articles = [
    a('b', 'X', 'Floods displace thousands in Kenya after heavy rain'),
    a('a', 'Y', 'Kenya floods displace thousands after days of heavy rain'),
    a('c', 'Z', 'Quiet day in parliament'),
  ];
  const first = clusterArticles(articles);
  const again = clusterArticles([...articles].reverse());
  assert.equal(first.flatMap((s) => s.articleIds).length, 3);
  assert.deepEqual(first.map((s) => s.id).sort(), again.map((s) => s.id).sort());
  assert.equal(first[0].id, 's-a');
  assert.deepEqual(clusterArticles([]), []);
});
