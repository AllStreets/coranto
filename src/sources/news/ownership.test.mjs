import assert from 'node:assert/strict';
import test from 'node:test';

import { listOf, storyToolColumns } from '../../ui/newsPanel.js';
import { outletOwnership } from './ownership.js';

test('ownership comes from the table, by whole name only', () => {
  assert.deepEqual(outletOwnership('BBC'), {
    owner: 'BBC (UK licence fee)',
    type: 'public',
    label: 'PUBLIC',
    country: 'gb',
  });
  assert.equal(outletOwnership('Al Jazeera Arabic').type, 'state');
  assert.equal(outletOwnership('BBC Mundo').owner, 'BBC (UK licence fee)');
  assert.equal(
    outletOwnership('ProPublica'),
    null,
    'not in the table: nothing',
  );
  // Australia's public broadcaster is not Disney's ABC News.
  assert.equal(outletOwnership('ABC News (Australia)'), null);
  assert.equal(outletOwnership('Reuters UK'), null, 'no matching by fragment');
  assert.equal(outletOwnership(''), null);
});

test('no entry carries a political label', () => {
  for (const name of ['bbc', 'fox news', 'rt', 'the guardian'])
    assert.deepEqual(Object.keys(outletOwnership(name)).sort(), [
      'country',
      'label',
      'owner',
      'type',
    ]);
});

test('a list reads as a sentence', () => {
  assert.equal(listOf(['Africa']), 'Africa');
  assert.equal(listOf(['Africa', 'Asia']), 'Africa and Asia');
  assert.equal(listOf(['Africa', 'Asia', 'Europe']), 'Africa, Asia and Europe');
});

test('story tools fill their rows', () => {
  assert.deepEqual(
    [1, 3, 5, 6, 7, 8].map(storyToolColumns),
    [1, 3, 5, 3, 4, 4],
  );
});
