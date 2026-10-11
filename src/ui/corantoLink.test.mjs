import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildViewUrl,
  decodeView,
  encodeView,
  readViewFromSearch,
} from './corantoLink.js';

test('a view survives the trip through a link', () => {
  const view = {
    lens: 'elections',
    criteria: {
      query: 'Brazil  runoff',
      category: 'geopolitics',
      placeKey: 'country:Brazil',
      publisher: 'The Hindu',
      language: 'fr',
      goodNews: true,
    },
  };
  const decoded = decodeView(encodeView(view));
  assert.equal(decoded.lens, 'elections');
  assert.deepEqual(decoded.criteria, {
    query: 'brazil runoff',
    category: 'geopolitics',
    placeKey: 'country:Brazil',
    publisher: 'The Hindu',
    language: 'fr',
    goodNews: true,
  });
});

test('defaults are left out, and "every language" is kept apart from English', () => {
  assert.equal(encodeView({}), '');
  assert.equal(encodeView({ lens: 'news', criteria: { language: 'en' } }), '');
  assert.equal(decodeView(encodeView({ criteria: { language: null, query: 'x' } })).criteria.language, null);
  assert.equal(decodeView('q=x').criteria.language, 'en');
});

test('a bad link is ignored, never trusted', () => {
  assert.equal(decodeView(''), null);
  assert.equal(decodeView('x'.repeat(700)), null);
  assert.equal(decodeView('l=<script>&q=ok').lens, 'news');
  assert.equal(readViewFromSearch('?other=1'), null);
  assert.equal(readViewFromSearch('?c=l%3Dmarkets').lens, 'markets');
});

test('the link keeps the camera fragment beside the view', () => {
  const url = buildViewUrl(
    { href: 'http://localhost:4173/?c=q%3Dold#v=2&lat=1&lon=2' },
    { lens: 'power', criteria: {} },
  );
  assert.equal(url, 'http://localhost:4173/?c=l%3Dpower#v=2&lat=1&lon=2');
  assert.match(
    buildViewUrl({ href: 'http://localhost:4173/' }, { criteria: { query: 'grain' } }),
    /\?c=q%3Dgrain$/,
  );
});
