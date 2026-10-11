import assert from 'node:assert/strict';
import test from 'node:test';
import { detectProgress } from './progress.js';
import { normalizeArticle } from './records.js';

test('progress headlines are tagged by kind', () => {
  const cases = [
    ['Scientists may have found a shortcut to fusion energy', 'science'],
    ['A quantum prediction from 1931 just came to life', 'science'],
    ['FDA approves first gene therapy for rare blindness', 'medical'],
    ['Country declared malaria-free after decades of work', 'medical'],
    ['Probe lands on the Moon after week-long transit', 'space'],
    ['Navi Pillay wins Nobel Peace Prize', 'humanity'],
    ['Hostages released after months of talks', 'humanity'],
  ];
  for (const [title, kind] of cases)
    assert.equal(detectProgress(title), kind, title);
});

test('a headline with a peril or dispute word is never good news', () => {
  for (const title of [
    "Nobel peace laureate says US sanctions on ICC 'unacceptable'",
    'Trump fumes over Nobel peace prize snub and criticizes Norway',
    'Discovery of mass grave after deadly attack',
    'Vaccine rollout stalls as outbreak spreads',
    'Breakthrough in talks fails to end war',
    'Rover team warns of budget collapse',
  ])
    assert.equal(detectProgress(title), null, title);
});

test('ordinary headlines and empty input get no tag', () => {
  assert.equal(detectProgress('Parliament debates the budget'), null);
  assert.equal(detectProgress(''), null);
  assert.equal(detectProgress(undefined), null);
});

test('the tag comes from the headline and travels on the article', () => {
  const now = Date.parse('2026-10-10T12:00:00Z');
  const { article } = normalizeArticle(
    {
      title: 'Scientists report fusion milestone in Oxford',
      summary: 'The result was confirmed by a second lab.',
      url: 'https://example.org/fusion',
      publisher: 'Example',
      publishedAt: '2026-10-10T10:00:00Z',
    },
    { sourceId: 'x', fetchedAt: now, now },
  );
  assert.equal(article.progress, 'science');
});
