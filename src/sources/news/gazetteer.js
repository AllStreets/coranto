import { NEWS_CITIES } from './cities.js';
import { NEWS_COUNTRIES } from './countries.js';
import { FOREIGN_CITY_NAMES, FOREIGN_COUNTRY_NAMES } from './placeNames.js';
import { NEWS_US_STATES } from './usStates.js';

/**
 * Names that are ordinary English words, common personal names, or shared by
 * several well-known places. A story naming one of these stays unplaced
 * instead of being pinned somewhere it may not be about. Add to this list
 * whenever a misplacement is found, with a test.
 */
export const REMOVED_PLACE_NAMES = new Set([
  // Countries and states that read as personal names or other things.
  'Georgia',
  'Jordan',
  'Chad',
  'Congo',
  'Washington State',
  // Cities.
  'Aba',
  'Alexandria',
  'Austin',
  'Birmingham',
  'Budta',
  'Cali',
  'Charlotte',
  'Columbus',
  'Cordoba',
  'Douglas',
  'George Town',
  'Georgetown',
  'Golfe',
  'Guadalupe',
  'Hamilton',
  'Heshan',
  'Honcho',
  'Hue',
  'Jamestown',
  'Jos',
  'Kennedy',
  'Kobe',
  'Kota',
  'Male',
  'Merida',
  'Natal',
  'Ota',
  'Oyo',
  'Perm',
  'Pest',
  'Phoenix',
  'Pimpri',
  'Plymouth',
  'Portland',
  'Road Town',
  'Rohini',
  'Rosario',
  'Saint-Denis',
  'Saint-Pierre',
  'Sale',
  'Salem',
  'Salvador',
  'San Jose',
  'Stanley',
  'Sultanah',
  'Takeo',
  'Teni',
  'The Valley',
  'Trujillo',
  'Valencia',
  'Viana',
  'Victoria',
  'Vinh',
  'West Island',
]);

/**
 * Text that contains a place name but is not that place. A match here
 * consumes the text and yields no location.
 */
const NON_PLACE_PHRASES = [
  'New Mexico',
  'New England',
  'New South Wales',
  'Paris Hilton',
  'Paris Agreement',
  'Paris Saint-Germain',
  'Sydney Sweeney',
  'Rome Statute',
  'Geneva Conventions',
  'Geneva Convention',
  'Dublin Core',
  'Lima beans',
  'Turkey Day',
  'Air India',
  'Air China',
  'Air France',
  'Air Canada',
  'China Sea',
  'Bank of America',
  'Bank of England',
  'Bank of Japan',
  'Bank of Canada',
  'West Virginia University',
  'Indiana Jones',
  'New Guinea',
  'Manchester United',
  'Manchester City',
  'Real Madrid',
  'Atletico Madrid',
  'Bayern Munich',
  'Inter Milan',
  'AC Milan',
  'Niger Delta',
  'Niger River',
];

/** Cities missing from the generated table. Rows: [name, lat, lon]. */
const EXTRA_CITIES = [
  ['Geneva', 46.2044, 6.1432],
  ['Zurich', 47.3769, 8.5417],
  ['The Hague', 52.0705, 4.3007],
  ['Tel Aviv', 32.0853, 34.7818],
  ['Miami', 25.7617, -80.1918],
  ['Atlanta', 33.749, -84.388],
  ['Edinburgh', 55.9533, -3.1883],
  ['Manchester', 53.4808, -2.2426],
  ['Strasbourg', 48.5734, 7.7521],
  ['Davos', 46.8027, 9.836],
];

/** Alternative spellings. Rows: [alias, canonical city name in the table]. */
const CITY_ALIASES = [
  ['New York', 'New York City'],
  ['Frankfurt', 'Frankfurt am Main'],
  ['Bangalore', 'Bengaluru'],
  ['Ulaanbaatar', 'Ulan Bator'],
  ['Naypyidaw', 'Nay Pyi Taw'],
  ['St Petersburg', 'Saint Petersburg'],
  ['St. Petersburg', 'Saint Petersburg'],
  ['Cologne', 'Koeln'],
  ['Seville', 'Sevilla'],
  ['Mecca', 'Makkah'],
  ['Medina', 'Madinah'],
  ['Zaporizhzhia', 'Zaporizhzhya'],
  ['Kiev', 'Kyiv'],
  ['Bogotá', 'Bogota'],
  ['São Paulo', 'Sao Paulo'],
  ['Brasília', 'Brasilia'],
];

/** Country aliases and demonyms. Rows: [text, ISO 3166-1 alpha-2]. */
const COUNTRY_ALIASES = [
  ['US', 'US'],
  ['U.S.', 'US'],
  ['USA', 'US'],
  ['UK', 'GB'],
  ['U.K.', 'GB'],
  ['Britain', 'GB'],
  ['Great Britain', 'GB'],
  ['British', 'GB'],
  ['United Arab Emirates', 'AE'],
  ['Emirati', 'AE'],
  ['Dominican Republic', 'DO'],
  ['Trinidad and Tobago', 'TT'],
  ['Bosnia and Herzegovina', 'BA'],
  ['Bosnia', 'BA'],
  ['North Macedonia', 'MK'],
  ['Central African Republic', 'CF'],
  ['Democratic Republic of Congo', 'CD'],
  ['Democratic Republic of the Congo', 'CD'],
  ['DRC', 'CD'],
  ['Ivory Coast', 'CI'],
  ['Czech Republic', 'CZ'],
  ['Czech', 'CZ'],
  ['Burma', 'MM'],
  ['Burmese', 'MM'],
  ['Türkiye', 'TR'],
  ['Turkish', 'TR'],
  ['East Timor', 'TL'],
  ['Ukrainian', 'UA'],
  ['Russian', 'RU'],
  ['Chinese', 'CN'],
  ['Israeli', 'IL'],
  ['Palestinian', 'PS'],
  ['Iranian', 'IR'],
  ['Iraqi', 'IQ'],
  ['Syrian', 'SY'],
  ['Lebanese', 'LB'],
  ['Afghan', 'AF'],
  ['Pakistani', 'PK'],
  ['Japanese', 'JP'],
  ['South Korean', 'KR'],
  ['North Korean', 'KP'],
  ['Taiwanese', 'TW'],
  ['French', 'FR'],
  ['German', 'DE'],
  ['Italian', 'IT'],
  ['Spanish', 'ES'],
  ['Portuguese', 'PT'],
  ['Dutch', 'NL'],
  ['Belgian', 'BE'],
  ['Swiss', 'CH'],
  ['Austrian', 'AT'],
  ['Irish', 'IE'],
  ['Swedish', 'SE'],
  ['Norwegian', 'NO'],
  ['Danish', 'DK'],
  ['Finnish', 'FI'],
  ['Hungarian', 'HU'],
  ['Romanian', 'RO'],
  ['Bulgarian', 'BG'],
  ['Serbian', 'RS'],
  ['Croatian', 'HR'],
  ['Greek', 'GR'],
  ['Belarusian', 'BY'],
  ['Armenian', 'AM'],
  ['Azerbaijani', 'AZ'],
  ['Saudi', 'SA'],
  ['Yemeni', 'YE'],
  ['Qatari', 'QA'],
  ['Egyptian', 'EG'],
  ['Libyan', 'LY'],
  ['Tunisian', 'TN'],
  ['Algerian', 'DZ'],
  ['Moroccan', 'MA'],
  ['Sudanese', 'SD'],
  ['Ethiopian', 'ET'],
  ['Somali', 'SO'],
  ['Kenyan', 'KE'],
  ['Ugandan', 'UG'],
  ['Rwandan', 'RW'],
  ['Nigerian', 'NG'],
  ['Ghanaian', 'GH'],
  ['Senegalese', 'SN'],
  ['Malian', 'ML'],
  ['South African', 'ZA'],
  ['Zimbabwean', 'ZW'],
  ['Canadian', 'CA'],
  ['Mexican', 'MX'],
  ['Cuban', 'CU'],
  ['Haitian', 'HT'],
  ['Venezuelan', 'VE'],
  ['Colombian', 'CO'],
  ['Brazilian', 'BR'],
  ['Argentine', 'AR'],
  ['Chilean', 'CL'],
  ['Peruvian', 'PE'],
  ['Ecuadorian', 'EC'],
  ['Bolivian', 'BO'],
  ['Australian', 'AU'],
  ['Indonesian', 'ID'],
  ['Filipino', 'PH'],
  ['Vietnamese', 'VN'],
  ['Thai', 'TH'],
  ['Cambodian', 'KH'],
  ['Malaysian', 'MY'],
  ['Bangladeshi', 'BD'],
  ['Sri Lankan', 'LK'],
  ['Nepali', 'NP'],
  ['Nepalese', 'NP'],
  ['Kazakh', 'KZ'],
  ['Uzbek', 'UZ'],
  ['Mongolian', 'MN'],
];

/**
 * Named areas that are not countries, states or cities.
 * Rows: [name, lat, lon]. Shown at region precision.
 */
const REGIONS = [
  ['Gaza', 31.42, 34.38],
  ['Gaza Strip', 31.42, 34.38],
  ['West Bank', 31.95, 35.25],
  ['Crimea', 45.3, 34.4],
  ['Donbas', 48.0, 37.8],
  ['Kashmir', 34.0, 76.0],
  ['Darfur', 13.0, 24.5],
  ['Tigray', 14.0, 38.8],
  ['Red Sea', 20.0, 38.5],
  ['Black Sea', 43.4, 34.3],
  ['South China Sea', 12.0, 114.0],
  ['Taiwan Strait', 24.5, 119.5],
  ['Strait of Hormuz', 26.57, 56.25],
  ['Persian Gulf', 26.9, 51.6],
  ['Arctic', 87.0, 0.0],
  ['Antarctica', -82.0, 0.0],
];

/** Display names for abbreviated rows in the country table. */
const COUNTRY_DISPLAY = new Map([
  ['Dominican Rep.', 'Dominican Republic'],
  ['Trinidad & Tobago', 'Trinidad and Tobago'],
  ['St. Lucia', 'Saint Lucia'],
  ['St. Vincent', 'Saint Vincent and the Grenadines'],
  ['Antigua & Barbuda', 'Antigua and Barbuda'],
  ['St. Kitts & Nevis', 'Saint Kitts and Nevis'],
  ['Bosnia & Herz.', 'Bosnia and Herzegovina'],
  ['N. Macedonia', 'North Macedonia'],
  ['UAE', 'United Arab Emirates'],
  ['C. African Rep.', 'Central African Republic'],
  ['São Tomé & Príncipe', 'São Tomé and Príncipe'],
  ['DR Congo', 'Democratic Republic of the Congo'],
]);

function buildIndex() {
  /** @type {Map<string, {name: string, lat: number, lon: number, precision: string}>} */
  const index = new Map();
  const add = (text, place) => {
    if (!text || REMOVED_PLACE_NAMES.has(text) || index.has(text)) return;
    index.set(text, place);
  };
  const cityByName = new Map();
  for (const [name, , lat, lon] of NEWS_CITIES) {
    const place = { name, lat, lon, precision: 'city' };
    if (!cityByName.has(name)) cityByName.set(name, place);
    add(name, place);
  }
  for (const [name, lat, lon] of EXTRA_CITIES)
    add(name, { name, lat, lon, precision: 'city' });
  for (const [name, lat, lon] of EXTRA_CITIES)
    if (!cityByName.has(name))
      cityByName.set(name, { name, lat, lon, precision: 'city' });
  for (const [alias, canonical] of [...CITY_ALIASES, ...FOREIGN_CITY_NAMES]) {
    const place = cityByName.get(canonical);
    if (place && !REMOVED_PLACE_NAMES.has(canonical)) add(alias, place);
  }
  const countryByIso = new Map();
  for (const [iso2, rawName, lat, lon] of NEWS_COUNTRIES) {
    const name = COUNTRY_DISPLAY.get(rawName) ?? rawName;
    const place = { name, lat, lon, precision: 'country' };
    countryByIso.set(iso2, place);
    if (REMOVED_PLACE_NAMES.has(name)) continue;
    add(name, place);
    if (rawName !== name && !rawName.includes('.')) add(rawName, place);
  }
  for (const [text, iso2] of [...COUNTRY_ALIASES, ...FOREIGN_COUNTRY_NAMES]) {
    const place = countryByIso.get(iso2);
    if (place && !REMOVED_PLACE_NAMES.has(place.name)) add(text, place);
  }
  for (const [name, lat, lon] of NEWS_US_STATES)
    add(name, { name, lat, lon, precision: 'region' });
  for (const [name, lat, lon] of REGIONS)
    add(name, { name, lat, lon, precision: 'region' });
  return index;
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const INDEX = buildIndex();
const BLOCKED = new Set(NON_PLACE_PHRASES);
// Longest alternatives first, so "Guinea-Bissau" wins over "Guinea" and a
// blocked phrase such as "New Mexico" wins over "Mexico". Case-sensitive:
// lower-case "turkey" and "china" are not places. A name followed by "$" is a
// currency ("US$100 million"), not a place.
const PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${[...INDEX.keys(), ...BLOCKED]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|')})(?![\\p{L}\\p{N}$])`,
  'gu',
);

const PRECISION_ORDER = ['city', 'region', 'country'];

function matchField(text, field) {
  if (typeof text !== 'string' || !text) return null;
  const found = [];
  for (const match of text.matchAll(PATTERN)) {
    if (BLOCKED.has(match[0])) continue;
    found.push({ place: INDEX.get(match[0]), matched: match[0] });
  }
  // The most precise kind present wins; within it, the earliest mention.
  for (const precision of PRECISION_ORDER) {
    const hit = found.find((entry) => entry.place.precision === precision);
    if (hit) return { ...hit.place, matched: hit.matched, field };
  }
  return null;
}

/**
 * Place a story by a place name in its own text. The headline is searched
 * before the summary. Returns the gazetteer coordinate unaltered, the
 * precision of the match, and the exact text that matched, or null.
 * @param {string} title
 * @param {string} [summary]
 * @returns {{name: string, lat: number, lon: number, precision: 'city'|'region'|'country', matched: string, field: 'title'|'summary'}|null}
 */
export function matchPlace(title, summary = '') {
  return matchField(title, 'title') ?? matchField(summary, 'summary');
}

/** Number of distinct match strings, for diagnostics and tests. */
export const GAZETTEER_SIZE = INDEX.size;
