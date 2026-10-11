import assert from 'node:assert/strict';
import test from 'node:test';
import { NEWS_CITIES } from './cities.js';
import {
  GAZETTEER_SIZE,
  REMOVED_PLACE_NAMES,
  matchPlace,
} from './gazetteer.js';

test('a city named in the headline is placed at its table coordinate', () => {
  const kyiv = NEWS_CITIES.find(([name]) => name === 'Kyiv');
  const place = matchPlace('Explosion reported in central Kyiv overnight');
  assert.deepEqual(place, {
    name: 'Kyiv',
    lat: kyiv[2],
    lon: kyiv[3],
    precision: 'city',
    matched: 'Kyiv',
    field: 'title',
  });
});

test('the same text always yields the same coordinate', () => {
  const a = matchPlace('Talks resume in Geneva');
  const b = matchPlace('Talks resume in Geneva');
  assert.deepEqual(a, b);
});

test('a city beats a country in the same field', () => {
  assert.equal(matchPlace('UK budget rattles London markets').name, 'London');
});

test('the headline is searched before the summary', () => {
  const place = matchPlace('France warns on tariffs', 'Speaking in Brussels.');
  assert.equal(place.name, 'France');
  assert.equal(place.field, 'title');
});

test('the summary is used when the headline names no place', () => {
  const place = matchPlace('Leaders meet for talks', 'The summit is in Doha.');
  assert.equal(place.name, 'Doha');
  assert.equal(place.field, 'summary');
});

test('demonyms resolve to the country at country precision', () => {
  const place = matchPlace('Ukrainian grid hit again');
  assert.equal(place.name, 'Ukraine');
  assert.equal(place.precision, 'country');
  assert.equal(place.matched, 'Ukrainian');
});

test('US states and named regions are region precision', () => {
  assert.equal(matchPlace('Storm hits Florida coast').precision, 'region');
  assert.equal(matchPlace('Aid trucks enter Gaza').name, 'Gaza');
});

test('AUSPEX substring misplacements do not recur', () => {
  // "us" inside other words used to pin stories to the United States.
  assert.equal(matchPlace('Small business owners brace for change'), null);
  assert.equal(matchPlace('Russia announces new budget').name, 'Russia');
  assert.equal(matchPlace('Focus on housing, campus leaders say'), null);
  // The company is not the rainforest.
  assert.equal(matchPlace('Amazon shares jump after earnings'), null);
  // San Jose used to land in Costa Rica whichever one was meant.
  assert.equal(matchPlace('San Jose council votes on transit plan'), null);
});

test('upper-case abbreviations match and lower-case words do not', () => {
  assert.equal(matchPlace('US and UK sign pact').name, 'United States');
  assert.equal(matchPlace('U.S. jobs report beats forecast').name, 'United States');
  assert.equal(matchPlace('Join us for the turkey and china sale'), null);
});

test('longer names win over the names inside them', () => {
  assert.equal(matchPlace('Guinea-Bissau votes').name, 'Guinea-Bissau');
  assert.equal(matchPlace('Floods in Papua New Guinea').name, 'Papua New Guinea');
  assert.equal(matchPlace('South Sudan talks stall').name, 'South Sudan');
  assert.equal(matchPlace('Nigeria fuel prices rise').name, 'Nigeria');
});

test('phrases that contain a place name but are not that place', () => {
  assert.equal(matchPlace('New Mexico governor signs bill'), null);
  assert.equal(matchPlace('Manchester United sack manager'), null);
  assert.equal(matchPlace('Countries reaffirm the Paris Agreement'), null);
});

test('removed names never match', () => {
  for (const name of ['Georgia', 'Jordan', 'Chad', 'Male', 'Victoria'])
    assert.equal(matchPlace(`Report from ${name} today`), null, name);
  assert.ok(REMOVED_PLACE_NAMES.has('San Jose'));
});

test('text with no place, or no text, is unplaced', () => {
  assert.equal(matchPlace('A quiet day with nothing of note'), null);
  assert.equal(matchPlace(''), null);
  assert.equal(matchPlace(undefined), null);
});

test('the index is populated', () => {
  assert.ok(GAZETTEER_SIZE > 1200);
});
