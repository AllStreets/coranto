import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  CITY_COLOURS,
  CITY_ICONS,
  COUNTRY_MARKS,
} from '../data/corantoAtlasStyle.js';
import { ICONS } from '../data/corantoIcons.js';
import {
  cityCard,
  cityImage,
  countryCard,
  countryImage,
  textImage,
} from './corantoAtlas.js';
import { buildMapKeyModel } from './corantoMapKey.js';

const read = (name) =>
  JSON.parse(
    fs.readFileSync(
      new URL(`../../public/coranto-atlas/${name}.json`, import.meta.url),
      'utf8',
    ),
  );

test('the atlas data is AUSPEX’s: 197 countries, 1,000 cities, 17 lines', () => {
  const countries = read('countries');
  const cities = read('cities');
  const borders = read('borders');
  assert.equal(countries.length, 197);
  assert.equal(cities.length, 1000);
  assert.equal(borders.lines.length, 17);
  assert.deepEqual(
    countries
      .filter((c) => c.nuclear_armed)
      .map((c) => c.iso2)
      .sort(),
    ['CN', 'FR', 'GB', 'IL', 'IN', 'KP', 'PK', 'RU', 'US'],
  );
  for (const country of countries)
    assert.ok(
      Number.isFinite(country.lat) &&
        Number.isFinite(country.lng) &&
        country.name,
      country.iso2,
    );
  for (const city of cities) {
    assert.ok(CITY_ICONS[city.type], `${city.name}: ${city.type}`);
    assert.ok([1, 2, 3].includes(city.tier), city.name);
  }
  for (const group of ['conflictCoast', 'conflictShared', 'coast', 'shared'])
    assert.ok(borders[group].length > 20, group);
  assert.ok(
    borders.lines.every((line) => ['conflict', 'disputed'].includes(line.kind)),
  );
});

test('markers are vector images with no emoji or text glyphs for status', () => {
  const us = {
    iso2: 'US',
    name: 'United States',
    nuclear_armed: true,
    un_p5: true,
    nato_member: true,
    strategic_tier: 1,
  };
  const image = decodeURIComponent(countryImage(us).image);
  assert.match(image, /^data:image\/svg\+xml,<svg /);
  assert.match(image, />UNITED STATES<\/text>/);
  // Status is drawn with icons; the only text is the country's own name.
  assert.doesNotMatch(image.replace('UNITED STATES', ''), /[^\x00-\x7f]/);
  assert.ok(COUNTRY_MARKS.every(([, icon]) => ICONS[icon]));
  assert.match(
    decodeURIComponent(cityImage('port')),
    new RegExp(CITY_COLOURS.port),
  );
  assert.match(
    decodeURIComponent(textImage('São Tomé & <b>').image),
    /SÃO TOMÉ &amp; &lt;B&gt;/,
  );
});

test('cards say what the item is and that the designations are a kept table', () => {
  const us = {
    name: 'United States',
    nuclear_armed: true,
    un_p5: true,
    nato_member: true,
    strategic_tier: 1,
  };
  const card = countryCard(us, 31);
  assert.equal(card.kind, 'COUNTRY · TIER 1');
  assert.match(
    card.meta,
    /Nuclear-armed · UN Security Council permanent member · NATO member/,
  );
  assert.match(card.meta, /31 current stories name it/);
  assert.match(card.meta, /not a live feed/);
  assert.match(
    countryCard({ name: 'Belize' }, 0).meta,
    /^No special strategic designations on record · No current story names it/,
  );
  const city = cityCard(
    {
      name: 'Rotterdam',
      iso2: 'NL',
      type: 'port',
      population: 651631,
      tier: 2,
    },
    1,
  );
  assert.equal(city.kind, 'CITY · PORT');
  assert.match(
    city.meta,
    /^NL · population 651,631 · tier 2 · 1 current story names it/,
  );
});

test('the map key lists atlas overlays only when they are on', () => {
  const off = buildMapKeyModel({ news: true }).map((s) => s.heading);
  assert.ok(!off.includes('BORDERS AND LINES') && !off.includes('CITY ICONS'));
  const on = buildMapKeyModel({
    borders: true,
    countries: true,
    cityTypes: ['city', 'capital'],
  });
  assert.deepEqual(
    on.map((s) => s.heading),
    ['BORDERS AND LINES', 'COUNTRY MARKS', 'CITY ICONS'],
  );
  assert.deepEqual(
    on[2].rows.map((r) => r.label),
    ['City', 'Capital'],
  );
});
