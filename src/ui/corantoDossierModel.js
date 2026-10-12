import { currencyOf, iso3Of } from '../data/corantoCountryCodes.js';

/**
 * A country sheet: what every source Coranto already reads says about one
 * country, in one place. Each section names its source. A source that has
 * nothing for the country says so in a sentence; a source that is not
 * answering is named. Nothing is estimated and no section is written by a
 * model.
 */

const people = (value) =>
  !Number.isFinite(value)
    ? ''
    : value >= 1e6
      ? `${(value / 1e6).toFixed(1)} million`
      : value >= 1e3
        ? `${Math.round(value / 1e3)},000`
        : String(Math.round(value));

const day = (iso) => String(iso ?? '').slice(0, 10);

function ago(ms, now) {
  const hours = Math.max(0, (now - ms) / 3_600_000);
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min ago`;
  if (hours < 48) return `${Math.round(hours)} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/**
 * @param {object} input
 * @param {object} input.country Atlas row: iso2, name, lat, lng and flags.
 * @param {object[]} input.articles Current headlines, newest first.
 * @param {string[]} [input.cityNames] Names of the atlas cities in this country.
 * @param {{conflict?: Set<string>, activity?: Map<string, object>}} [input.signals]
 * @param {object|null} input.relief `/api/relief` payload, or null if down.
 * @param {object|null} input.elections `/api/elections` payload, or null.
 * @param {object|null} input.markets `/api/markets` payload, or null.
 * @param {{name: string, city: string, km: number, index: number}|null} input.channel
 * @param {number} input.now
 */
export function buildDossier({
  country,
  articles,
  cityNames = [],
  signals = {},
  relief,
  elections,
  markets,
  channel,
  now,
}) {
  const sections = [];
  const cities = new Set(cityNames);

  // In the news: headlines placed at the country or at one of its cities.
  const here = (articles ?? []).filter((article) => {
    const place = article?.place;
    if (!place) return false;
    return place.precision === 'country'
      ? place.name === country.name
      : place.precision === 'city' && cities.has(place.name);
  });
  const activity = signals.activity?.get?.(country.iso2);
  sections.push({
    id: 'news',
    heading: 'IN THE NEWS NOW',
    source:
      'Coranto’s feed: headlines placed at this country or one of its cities',
    summary: here.length
      ? `${here.length} ${here.length === 1 ? 'headline' : 'headlines'} in the range shown${activity?.level ? ` · headline activity ${activity.level}` : ''}`
      : 'No current headline is placed here.',
    rows: here.slice(0, 6).map((article) => ({
      kind: 'story',
      id: article.id,
      label: article.title,
      detail: [
        article.publisher,
        Number.isFinite(Date.parse(article.publishedAt))
          ? ago(Date.parse(article.publishedAt), now)
          : '',
      ]
        .filter(Boolean)
        .join(' · '),
    })),
  });

  // Standing facts, and the one live mark.
  const marks = [
    country.nuclear_armed && 'Nuclear-armed',
    country.un_p5 && 'Permanent member of the UN Security Council',
    country.nato_member && 'NATO member',
  ].filter(Boolean);
  if (signals.conflict?.has?.(country.iso2))
    marks.push('Named in current conflict headlines');
  if (marks.length)
    sections.push({
      id: 'status',
      heading: 'STATUS',
      source:
        'AUSPEX country table; the conflict mark is counted from current headlines',
      chips: marks,
      rows: [],
    });

  // People forced to flee, by country of origin (UNHCR).
  if (!relief)
    sections.push({
      id: 'displaced',
      heading: 'FORCED TO FLEE',
      source: 'UNHCR Refugee Data Finder',
      summary: 'UNHCR is not answering, so nothing can be shown.',
      rows: [],
    });
  else {
    const iso3 = iso3Of(country.iso2);
    const year = relief.displacement?.year;
    const row = (
      relief.displacement?.all ??
      relief.displacement?.rows ??
      []
    ).find((entry) => entry.iso3 === iso3);
    sections.push({
      id: 'displaced',
      heading: 'FORCED TO FLEE',
      source: `UNHCR Refugee Data Finder${year ? `, figures for ${year}` : ''}, by country of origin`,
      url: row?.url,
      summary: row
        ? `${people(row.total)} people from ${country.name}`
        : `UNHCR lists no figure for people from ${country.name}${year ? ` in ${year}` : ''}.`,
      rows: row
        ? [
            ['Refugees', row.refugees],
            ['Asylum-seekers', row.asylumSeekers],
            ['Displaced inside the country', row.displacedInside],
            ['Others in need of protection', row.othersInNeed],
          ]
            .filter(([, value]) => Number.isFinite(value))
            .map(([label, value]) => ({
              kind: 'figure',
              label,
              value: value.toLocaleString('en-GB'),
            }))
        : [],
    });
  }

  // Disease outbreak notices that name the country (WHO).
  if (relief) {
    const notices = (relief.outbreaks ?? []).filter(
      (item) => item.place?.name === country.name,
    );
    sections.push({
      id: 'outbreaks',
      heading: 'DISEASE OUTBREAKS',
      source:
        'World Health Organization, Disease Outbreak News (the latest 20 notices)',
      summary: notices.length
        ? ''
        : 'None of the latest WHO notices names this country.',
      rows: notices.map((item) => ({
        kind: 'link',
        label: item.disease,
        detail: day(item.publishedAt),
        url: item.url,
      })),
    });
  }

  // The next polling day (Wikidata).
  if (!elections)
    sections.push({
      id: 'election',
      heading: 'NEXT ELECTION',
      source: 'Wikidata',
      summary: 'The elections list is not answering, so nothing can be shown.',
      rows: [],
    });
  else {
    const next = (elections.groups ?? [])
      .filter((group) => group.iso2 === country.iso2 && group.daysUntil >= 0)
      .sort((a, b) => a.daysUntil - b.daysUntil)[0];
    sections.push({
      id: 'election',
      heading: 'NEXT ELECTION',
      source: 'Wikidata, edited by volunteers; it is not an election authority',
      summary: next
        ? `${next.date} · ${next.daysUntil === 0 ? 'today' : `in ${next.daysUntil} ${next.daysUntil === 1 ? 'day' : 'days'}`}`
        : 'No polling day in the next 120 days is listed.',
      rows: next
        ? (next.contests ?? []).slice(0, 4).map((contest) => ({
            kind: contest.wikidataUrl || contest.url ? 'link' : 'text',
            label: contest.title,
            url: contest.wikidataUrl ?? contest.url,
          }))
        : [],
    });
  }

  // Its currency against the dollar, when it is one Coranto already tracks.
  const currency = currencyOf(country.iso2);
  const quote = currency
    ? (markets?.quotes ?? []).find(
        (entry) =>
          typeof entry.label === 'string' && entry.label === `USD/${currency}`,
      )
    : null;
  if (quote)
    sections.push({
      id: 'currency',
      heading: 'CURRENCY',
      source: quote.source,
      url: quote.url,
      summary:
        `1 US dollar = ${Number(quote.value).toLocaleString('en-GB', { maximumFractionDigits: 4 })} ${currency} · ${quote.asOfText ?? ''}`.trim(),
      rows: [],
    });

  return {
    title: country.name,
    iso2: country.iso2,
    sections,
    stories: here.length,
    channel: channel
      ? {
          index: channel.index,
          label: `${channel.name}, ${channel.city}`,
          detail: `${channel.km.toLocaleString('en-GB')} km from its centre`,
        }
      : null,
  };
}
