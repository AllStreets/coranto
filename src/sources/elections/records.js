import { NEWS_COUNTRIES } from '../news/countries.js';

/**
 * Upcoming elections from Wikidata, the public structured database behind
 * Wikipedia. Wikidata is edited by volunteers and is not an election
 * authority: a date here is what Wikidata currently records, and every entry
 * links to its Wikidata item so it can be checked. Coranto adds nothing to it.
 */

export const ELECTION_WINDOW_DAYS = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

const COUNTRY = new Map(
  NEWS_COUNTRIES.map(([iso2, name, lat, lon]) => [iso2, { name, lat, lon }]),
);
const COUNTRY_NAMES = {
  US: 'United States',
  GB: 'United Kingdom',
  AE: 'United Arab Emirates',
  CD: 'Democratic Republic of the Congo',
  DO: 'Dominican Republic',
  BA: 'Bosnia and Herzegovina',
  MK: 'North Macedonia',
  CF: 'Central African Republic',
  TT: 'Trinidad and Tobago',
};

/** The SPARQL query for elections dated within the window from `now`. */
export function electionQuery(now) {
  const day = (ms) => new Date(ms).toISOString().slice(0, 10);
  const from = day(now);
  const to = day(now + ELECTION_WINDOW_DAYS * DAY_MS);
  // The country is OPTIONAL on purpose: making it a required join times the
  // public endpoint out. Rows without one are dropped when parsing.
  return `SELECT ?e ?eLabel ?date ?iso ?article WHERE {
  ?e wdt:P31/wdt:P279* wd:Q40231 ;
     wdt:P585 ?date .
  FILTER(?date >= "${from}T00:00:00Z"^^xsd:dateTime && ?date <= "${to}T00:00:00Z"^^xsd:dateTime)
  OPTIONAL { ?e wdt:P17 ?country . ?country wdt:P297 ?iso . }
  OPTIONAL { ?article schema:about ?e ; schema:isPartOf <https://en.wikipedia.org/> . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY ?date LIMIT 1500`;
}

const httpsUrl = (value, host) => {
  try {
    const url = new URL(String(value ?? ''));
    return url.protocol === 'https:' && url.hostname === host ? url.href : null;
  } catch {
    return null;
  }
};

/**
 * Parse a Wikidata SPARQL JSON result into election records. Entries with no
 * English name, no country, or no usable date are dropped.
 */
export function parseElections(data) {
  const seen = new Set();
  const out = [];
  for (const row of data?.results?.bindings ?? []) {
    const item = httpsUrl(
      String(row?.e?.value ?? '').replace(/^http:/, 'https:'),
      'www.wikidata.org',
    );
    const id = item?.match(/\/(Q\d+)$/)?.[1];
    const title = String(row?.eLabel?.value ?? '').trim();
    const date = String(row?.date?.value ?? '').slice(0, 10);
    const iso2 = String(row?.iso?.value ?? '').toUpperCase();
    if (!id || seen.has(id)) continue;
    // An item with no English label comes back named by its own id.
    if (!title || /^Q\d+$/.test(title)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)))
      continue;
    // Wikidata stores a year-only date as 1 January, and names unscheduled
    // contests "next ... election". Neither is a known polling day.
    if (date.endsWith('-01-01') || /^next\b/i.test(title)) continue;
    if (!COUNTRY.has(iso2)) continue;
    seen.add(id);
    out.push({
      id,
      title,
      date,
      iso2,
      wikidata: `https://www.wikidata.org/wiki/${id}`,
      wikipedia: httpsUrl(row?.article?.value, 'en.wikipedia.org'),
    });
  }
  return out;
}

/** Whole days from `now` to an election date, by calendar day in UTC. */
export function daysUntil(date, now) {
  const today = Date.parse(new Date(now).toISOString().slice(0, 10));
  return Math.round((Date.parse(date) - today) / DAY_MS);
}

/**
 * Group elections by country and day. A country often holds many contests on
 * one day (every district of a legislature); the group lists those with an
 * English Wikipedia article first and counts the rest.
 */
export function groupElections(elections, now) {
  const groups = new Map();
  for (const election of elections ?? []) {
    const days = daysUntil(election.date, now);
    if (days < 0 || days > ELECTION_WINDOW_DAYS) continue;
    const key = `${election.iso2}:${election.date}`;
    let group = groups.get(key);
    if (!group) {
      const country = COUNTRY.get(election.iso2);
      group = {
        key,
        iso2: election.iso2,
        country: COUNTRY_NAMES[election.iso2] ?? country.name,
        lat: country.lat,
        lon: country.lon,
        date: election.date,
        daysUntil: days,
        contests: [],
      };
      groups.set(key, group);
    }
    group.contests.push({
      id: election.id,
      title: election.title,
      wikidata: election.wikidata,
      wikipedia: election.wikipedia,
    });
  }
  const out = [...groups.values()];
  for (const group of out) {
    group.contests.sort(
      (a, b) =>
        Number(Boolean(b.wikipedia)) - Number(Boolean(a.wikipedia)) ||
        a.title.length - b.title.length ||
        a.title.localeCompare(b.title),
    );
    group.count = group.contests.length;
    group.lead = group.contests[0];
    group.contests = group.contests.slice(0, 8);
  }
  return out.sort(
    (a, b) => a.daysUntil - b.daysUntil || a.country.localeCompare(b.country),
  );
}

/** True when a group has every field it must carry to be shown. */
export function isShowableElectionGroup(group) {
  return Boolean(
    group &&
    typeof group.key === 'string' &&
    typeof group.country === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(group.date ?? '') &&
    Number.isFinite(group.daysUntil) &&
    Number.isFinite(group.lat) &&
    Number.isFinite(group.lon) &&
    Number.isFinite(group.count) &&
    Array.isArray(group.contests) &&
    group.contests.length &&
    group.contests.every(
      (contest) =>
        typeof contest?.title === 'string' &&
        httpsUrl(contest.wikidata, 'www.wikidata.org') &&
        (contest.wikipedia === null ||
          httpsUrl(contest.wikipedia, 'en.wikipedia.org')),
    ),
  );
}
