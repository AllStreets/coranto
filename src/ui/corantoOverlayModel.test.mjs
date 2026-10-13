import assert from 'node:assert/strict';
import test from 'node:test';

import { parseTravelNotices } from '../sources/outbreaks/records.js';
import { latestAlerts, silencePlaces } from '../sources/silence/records.js';
import { PATH_NOTE } from './corantoLaunchIcons.js';
import {
  countriesNamed,
  diseaseCard,
  diseaseFamily,
  diseaseKeyword,
  labelPoint,
  outbreakAreas,
  silenceCard,
  squaresOver,
} from './corantoOverlayModel.js';
import { readSides } from './corantoSides.js';

const alert = (
  type,
  code,
  name,
  datasource,
  value,
  historyValue,
  extra = {},
) => ({
  datasource,
  entity: { type, code, name, attrs: extra.attrs ?? {} },
  time: extra.time ?? 1_791_800_000,
  level: extra.level ?? 'critical',
  value,
  historyValue,
});

test('only a deep, still-open drop is a blackout or a major outage', () => {
  const alerts = latestAlerts({
    data: [
      // 1% off normal: an alert, not an outage.
      alert('country', 'SS', 'South Sudan', 'bgp', 111, 113),
      // Deep, on routing alone.
      alert('region', '2956', 'Sokoto', 'bgp', 27, 95, {
        attrs: { country_code: 'NG' },
      }),
      alert('region', '4499', 'Distrito Capital', 'bgp', 10795, 16422, {
        attrs: { country_code: 'VE' },
      }),
      // Deep, but on one indirect measure with nothing to back it.
      alert('region', '4414', 'Washington', 'merit-nt', 21, 276, {
        attrs: { country_code: 'US' },
      }),
      // Was deep, has since closed: the newer alert wins.
      alert('country', 'IQ', 'Iraq', 'bgp', 500, 3000, { time: 100 }),
      alert('country', 'IQ', 'Iraq', 'bgp', 3000, 3000, {
        time: 200,
        level: 'normal',
      }),
      // Two indirect measures agreeing.
      alert('country', 'XX', 'Example', 'merit-nt', 10, 100),
      alert('country', 'XX', 'Example', 'gtr', 20, 100),
      // A region inside a country already shown whole.
      alert('region', '9', 'Inside', 'bgp', 1, 100, {
        attrs: { country_code: 'XX' },
      }),
      {
        datasource: 'made-up',
        entity: { type: 'country', code: 'ZZ' },
        time: 1,
      },
    ],
  });
  const places = silencePlaces(alerts);
  assert.deepEqual(
    places.map((place) => `${place.name}:${place.tier}`),
    ['Example:blackout', 'Sokoto:blackout', 'Distrito Capital:major'],
  );
  const sokoto = places.find((place) => place.name === 'Sokoto');
  assert.equal(sokoto.iso2, 'NG');
  assert.equal(sokoto.drop, 0.72);
  const card = silenceCard(sokoto);
  assert.match(card.kind, /INTERNET BLACKOUT · MEASURED/);
  assert.match(card.meta, /72% below normal \(27 of 95\)/);
  assert.match(card.meta, /does not say why/);
  assert.equal(card.url, 'https://ioda.inetintel.cc.gatech.edu/region/2956');
});

const FEED = `<rss><channel>
<item><title>Level 1 - Global Dengue</title><description><![CDATA[Risk. Country List :  Colombia, Vietnam Country List :  Colombia, Vietnam, Ecuador, including the Gal&#225;pagos Islands, Panama]]></description><link>https://wwwnc.cdc.gov/travel/notices/level1/dengue-global</link><pubDate>Fri, 02 Oct 2026 04:00:00 GMT</pubDate></item>
<item><title>Level 4 - Ebola Bundibugyo Virus Disease in Ituri and Nord-Kivu Provinces of the Democratic Republic of the Congo</title><description>x</description><link>https://wwwnc.cdc.gov/travel/notices/level4/ebola-drc</link><pubDate>Thu, 01 Oct 2026 04:00:00 GMT</pubDate></item>
<item><title>Level 2 - Ebola Bundibugyo Virus Disease in the Democratic Republic of the Congo and Uganda</title><description>x</description><link>https://wwwnc.cdc.gov/travel/notices/level2/ebola-drc-uganda</link><pubDate>Thu, 01 Oct 2026 04:00:00 GMT</pubDate></item>
<item><title>Not a notice</title><link>https://example.org/x</link><pubDate>Thu, 01 Oct 2026 04:00:00 GMT</pubDate></item>
</channel></rss>`;
const COUNTRIES = [
  { iso2: 'CO', name: 'Colombia' },
  { iso2: 'VN', name: 'Vietnam' },
  { iso2: 'EC', name: 'Ecuador' },
  { iso2: 'PA', name: 'Panama' },
  { iso2: 'CD', name: 'DR Congo' },
  { iso2: 'CG', name: 'Congo' },
  { iso2: 'UG', name: 'Uganda' },
  { iso2: 'NE', name: 'Niger' },
  { iso2: 'NG', name: 'Nigeria' },
  { iso2: 'RU', name: 'Russia' },
];

test('CDC notices give a level, a disease and the countries named', () => {
  const notices = parseTravelNotices(FEED);
  assert.equal(notices.length, 3);
  assert.deepEqual(
    [notices[0].level, notices[0].disease, notices[0].places],
    [1, 'Dengue', ['Colombia', 'Vietnam', 'Ecuador', 'Panama']],
  );
  assert.equal(notices[1].level, 4);
  assert.equal(notices[1].disease, 'Ebola Bundibugyo Virus Disease');
});

test('a country is found by its whole name, under any official spelling', () => {
  assert.deepEqual(
    countriesNamed(
      'Ituri and Nord-Kivu Provinces of the Democratic Republic of the Congo and Uganda',
      COUNTRIES,
    ),
    ['CD', 'UG'],
  );
  assert.deepEqual(countriesNamed('Nigeria', COUNTRIES), ['NG']);
  assert.deepEqual(countriesNamed('the Russian Federation', COUNTRIES), ['RU']);
  assert.deepEqual(countriesNamed('Sub-Saharan Africa', COUNTRIES), []);
});

test('outbreaks are graded from official notices; headlines can raise one', () => {
  const now = Date.UTC(2026, 9, 12);
  const who = [
    {
      title: 'Avian Influenza A(H5N1) - the Russian Federation',
      disease: 'Avian Influenza A(H5N1)',
      where: 'the Russian Federation',
      publishedAt: '2026-10-01T00:00:00Z',
      url: 'https://www.who.int/x',
    },
    {
      title: 'Cholera - Niger',
      disease: 'Cholera',
      where: 'Niger',
      publishedAt: '2026-01-01T00:00:00Z',
      url: 'https://www.who.int/old',
    },
  ];
  const articles = Array.from({ length: 5 }, (_, index) => ({
    title: `Dengue cases rise in Colombia ${index}`,
    summary: '',
  }));
  const areas = outbreakAreas({
    who,
    notices: parseTravelNotices(FEED),
    articles,
    countries: COUNTRIES,
    now,
  });
  const at = (iso2) => areas.filter((area) => area.iso2 === iso2);
  assert.equal(at('CD').length, 1, 'two notices, one outbreak');
  assert.equal(at('CD')[0].level, 3, 'CDC level 4 draws as the top level');
  assert.equal(at('CD')[0].family.id, 'haemorrhagic');
  assert.equal(at('UG')[0].level, 2);
  assert.equal(at('CG').length, 0, 'the other Congo is not named');
  assert.equal(at('CO')[0].level, 2, 'level 1, raised by five headlines');
  assert.equal(at('CO')[0].headlines, 5);
  assert.equal(at('VN')[0].level, 1);
  assert.equal(at('RU')[0].level, 2, 'a WHO notice');
  assert.equal(at('RU')[0].family.id, 'respiratory');
  assert.equal(at('NE').length, 0, 'a WHO notice from January is not current');
  const card = diseaseCard('DR Congo', at('CD'));
  assert.match(card.kind, /SEVERE · OFFICIAL NOTICES/);
  assert.match(card.meta, /CDC level 4, CDC level 2/);
  assert.match(card.meta, /no case counts/);
});

test('diseases sort into families by how they spread', () => {
  assert.equal(diseaseFamily('Marburg virus disease').id, 'haemorrhagic');
  assert.equal(diseaseFamily('Chikungunya').id, 'mosquito');
  assert.equal(diseaseFamily('Cholera').id, 'water');
  assert.equal(diseaseFamily('Mpox').id, 'contact');
  assert.equal(diseaseFamily('Something new').id, 'other');
  assert.equal(diseaseKeyword('Ebola Bundibugyo Virus Disease'), 'ebola');
  assert.equal(diseaseKeyword('Yellow Fever'), 'yellow');
});

test('squares cover a country, and a tiny one still gets a square', () => {
  const box = [
    [0, 0],
    [6, 0],
    [6, 4],
    [0, 4],
    [0, 0],
  ];
  assert.equal(squaresOver([box], 2).length, 6);
  const speck = [
    [10.1, 10.1],
    [10.3, 10.1],
    [10.3, 10.3],
    [10.1, 10.3],
    [10.1, 10.1],
  ];
  assert.deepEqual(squaresOver([speck], 2), [[10, 10]]);
});

test('a launch path says where it comes from; the sides remember', () => {
  assert.match(PATH_NOTE.estimated, /ESTIMATED/);
  assert.match(PATH_NOTE['catalogued-orbit'], /catalogued/);
  assert.equal(PATH_NOTE.none, '');
  assert.deepEqual(readSides('{"rail":true}'), { rail: true, feed: false });
  assert.deepEqual(readSides('{broken'), { rail: false, feed: false });
});

test('a country’s name sits inside its outline, away from the edge', () => {
  // An L: its centroid-of-box is outside, in the notch.
  const ell = [
    [0, 0],
    [10, 0],
    [10, 2],
    [2, 2],
    [2, 10],
    [0, 10],
    [0, 0],
  ];
  const point = labelPoint([ell]);
  assert.ok(point.lon < 2.2 && point.lat < 2.2, JSON.stringify(point));
  assert.equal(labelPoint([]), null);
});

test('the Moon’s card gives its distance and says where the map is from', async () => {
  const { MOON_SOURCE, moonCard } = await import('./corantoMoon.js');
  const card = moonCard(384_400_000);
  assert.match(card.meta, /384,400 km from the centre of the Earth/);
  assert.match(card.meta, /worked out from the date, not observed/);
  assert.equal(card.url, MOON_SOURCE.url);
});
