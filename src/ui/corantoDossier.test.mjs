import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDossier } from './corantoDossierModel.js';

const now = Date.parse('2026-10-12T12:00:00Z');
const sudan = { iso2: 'SD', name: 'Sudan', lat: 15, lng: 30 };
const article = (id, title, place) => ({
  id,
  title,
  publisher: 'BBC',
  publishedAt: '2026-10-12T10:00:00Z',
  place,
});
const inputs = {
  country: sudan,
  cityNames: ['Khartoum'],
  articles: [
    article('a', 'Fighting resumes in Sudan', {
      name: 'Sudan',
      precision: 'country',
    }),
    article('b', 'Aid convoy reaches Khartoum', {
      name: 'Khartoum',
      precision: 'city',
    }),
    article('c', 'Markets rally in Tokyo', {
      name: 'Tokyo',
      precision: 'city',
    }),
    article('d', 'Unplaced story', null),
  ],
  signals: {
    conflict: new Set(['SD']),
    activity: new Map([['SD', { level: 'high' }]]),
  },
  relief: {
    displacement: {
      year: 2025,
      rows: [],
      all: [
        {
          iso3: 'SDN',
          total: 12_900_343,
          refugees: 2_820_737,
          asylumSeekers: 940_297,
          displacedInside: 9_139_309,
          othersInNeed: null,
          url: 'https://www.unhcr.org/refugee-statistics/',
        },
      ],
    },
    outbreaks: [
      {
        disease: 'Cholera',
        publishedAt: '2026-10-01T00:00:00Z',
        url: 'https://www.who.int/x',
        place: { name: 'Sudan' },
      },
      {
        disease: 'Ebola',
        publishedAt: '2026-10-02T00:00:00Z',
        place: { name: 'Uganda' },
      },
    ],
  },
  elections: { groups: [] },
  markets: { quotes: [] },
  channel: { index: 0, name: 'Al Jazeera English', city: 'Doha', km: 2100 },
  now,
};
const section = (model, id) => model.sections.find((entry) => entry.id === id);

test('a country sheet joins what each source says about that country', () => {
  const model = buildDossier(inputs);
  assert.equal(model.title, 'Sudan');
  const news = section(model, 'news');
  assert.equal(model.stories, 2, 'the country and its cities, nothing else');
  assert.match(news.summary, /2 headlines .* headline activity high/);
  assert.deepEqual(
    news.rows.map((row) => row.id),
    ['a', 'b'],
  );
  assert.deepEqual(section(model, 'status').chips, [
    'Named in current conflict headlines',
  ]);
  const displaced = section(model, 'displaced');
  assert.equal(displaced.summary, '12.9 million people from Sudan');
  assert.deepEqual(
    displaced.rows.map((row) => `${row.label} ${row.value}`),
    [
      'Refugees 2,820,737',
      'Asylum-seekers 940,297',
      'Displaced inside the country 9,139,309',
    ],
    'a figure UNHCR leaves blank is left out, not shown as zero',
  );
  assert.deepEqual(
    section(model, 'outbreaks').rows.map((row) => row.label),
    ['Cholera'],
  );
  assert.match(section(model, 'election').summary, /No polling day/);
  assert.equal(
    section(model, 'currency'),
    undefined,
    'no tracked rate: no section',
  );
  assert.equal(model.channel.label, 'Al Jazeera English, Doha');
});

test('a source that is down is named, and nothing stands in for it', () => {
  const model = buildDossier({ ...inputs, relief: null, elections: null });
  assert.match(section(model, 'displaced').summary, /UNHCR is not answering/);
  assert.equal(section(model, 'outbreaks'), undefined);
  assert.match(section(model, 'election').summary, /not answering/);
});

test('an election and a tracked currency appear when the sources have them', () => {
  const model = buildDossier({
    ...inputs,
    country: {
      iso2: 'JP',
      name: 'Japan',
      lat: 36,
      lng: 138,
      nuclear_armed: false,
    },
    articles: [],
    signals: {},
    elections: {
      groups: [
        {
          iso2: 'JP',
          date: '2026-10-18',
          daysUntil: 6,
          contests: [{ title: '2026 Yokohama mayoral election' }],
        },
      ],
    },
    markets: {
      quotes: [
        {
          label: 'USD/JPY',
          value: 151.234567,
          asOfText: 'reference rate of 2026-10-09',
          source: 'European Central Bank',
          url: 'https://www.ecb.europa.eu/',
        },
      ],
    },
  });
  assert.equal(section(model, 'election').summary, '2026-10-18 · in 6 days');
  assert.equal(
    section(model, 'currency').summary,
    '1 US dollar = 151.2346 JPY · reference rate of 2026-10-09',
  );
  assert.equal(
    section(model, 'news').summary,
    'No current headline is placed here.',
  );
  assert.equal(section(model, 'status'), undefined);
});
