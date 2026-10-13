/**
 * The rules behind Coranto's SILENCE and DISEASE layers: what a card says,
 * which country a notice is about, how an outbreak is graded, and which
 * squares cover a country. Nothing here draws.
 */

// ── SILENCE ──────────────────────────────────────────────────────────

/** AUSPEX's blackout mark: near-black inside a red line. */
export const SILENCE_STYLE = Object.freeze({
  blackout: { fill: 'rgba(0,0,0,0.85)', line: '#FF2D55', label: 'BLACKOUT' },
  major: { fill: 'rgba(0,0,0,0.55)', line: '#FF2D55', label: 'MAJOR OUTAGE' },
});

const percent = (share) => `${Math.round(share * 100)}%`;

/** The card for a place IODA measures far below its normal level. */
export function silenceCard(place) {
  const style = SILENCE_STYLE[place.tier] ?? SILENCE_STYLE.major;
  const since = Date.parse(place.since);
  return {
    kind: `INTERNET ${style.label} · MEASURED`,
    title: place.name,
    meta: [
      place.type === 'region' && place.iso2 ? `a region of ${place.iso2}` : '',
      ...place.measures.map(
        (measure) =>
          `${measure.label}: ${percent(measure.drop)} below normal (${measure.value} of ${measure.normal})`,
      ),
      Number.isFinite(since)
        ? `alert opened ${new Date(since).toISOString().slice(0, 16).replace('T', ' ')} UTC`
        : '',
      'IODA measures connectivity; it does not say why it fell',
    ]
      .filter(Boolean)
      .join(' · '),
    url: `https://ioda.inetintel.cc.gatech.edu/${place.type}/${encodeURIComponent(place.code)}`,
    linkText: 'Open the measurements at IODA',
  };
}

// ── DISEASE ──────────────────────────────────────────────────────────

/**
 * Disease families and their colours. A family is how a disease spreads,
 * which is what a reader acts on. The first match wins.
 */
export const DISEASE_FAMILIES = Object.freeze([
  {
    id: 'haemorrhagic',
    label: 'Haemorrhagic fever',
    colour: '#ff3d7f',
    match:
      /ebola|marburg|lassa|crimean|rift valley|hantavirus|haemorrhagic|hemorrhagic/i,
  },
  {
    id: 'mosquito',
    label: 'Carried by mosquitoes or ticks',
    colour: '#2dd4bf',
    match:
      /dengue|chikungunya|zika|yellow fever|malaria|oropouche|west nile|japanese encephalitis|spotted fever|tick|leishman/i,
  },
  {
    id: 'respiratory',
    label: 'Spread through the air',
    colour: '#5ab0ff',
    match:
      /influenza|avian|h5n1|h5n5|h7n9|h9n2|mers|coronavirus|covid|sars|diphtheria|pertussis|whooping|tuberculosis|measles|meningo|meningitis|nipah|pneumon|legionell/i,
  },
  {
    id: 'water',
    label: 'From water or food',
    colour: '#9a8cff',
    match:
      /cholera|typhoid|paratyphoid|hepatitis a|hepatitis e|polio|salmonell|listeri|botulism|diarrh|e\. coli|norovirus/i,
  },
  {
    id: 'contact',
    label: 'Spread by close contact or animals',
    colour: '#ff8a5c',
    match: /mpox|monkeypox|rabies|anthrax|plague|scabies|hiv|syphilis|leprosy/i,
  },
]);
export const DISEASE_OTHER = Object.freeze({
  id: 'other',
  label: 'Other outbreak',
  colour: '#c9c4d8',
});

export function diseaseFamily(name) {
  return (
    DISEASE_FAMILIES.find((family) => family.match.test(name ?? '')) ??
    DISEASE_OTHER
  );
}

/** How strong each of the three levels is drawn: lighter to darker. */
export const DISEASE_LEVEL_ALPHA = Object.freeze({ 1: 0.36, 2: 0.6, 3: 0.84 });
export const DISEASE_LEVEL_LABEL = Object.freeze({
  1: 'WATCH',
  2: 'OUTBREAK',
  3: 'SEVERE',
});

/** Names official notices use that differ from the atlas's. */
const COUNTRY_ALIASES = Object.freeze({
  CD: ['democratic republic of the congo', 'dr congo', 'drc'],
  CG: ['republic of the congo', 'congo-brazzaville'],
  CI: ["cote d'ivoire", 'côte d’ivoire', 'ivory coast'],
  RU: ['russian federation'],
  SY: ['syrian arab republic'],
  IR: ['islamic republic of iran'],
  KR: ['republic of korea'],
  KP: ["democratic people's republic of korea"],
  LA: ["lao people's democratic republic"],
  VN: ['viet nam'],
  TZ: ['united republic of tanzania'],
  MD: ['republic of moldova'],
  BO: ['plurinational state of bolivia'],
  VE: ['bolivarian republic of venezuela'],
  US: ['united states of america', 'the united states'],
  GB: ['united kingdom', 'great britain'],
  PS: ['occupied palestinian territory', 'palestinian territories', 'gaza'],
  CV: ['cabo verde'],
  TR: ['türkiye', 'turkiye', 'turkey'],
  MM: ['burma'],
  CZ: ['czechia', 'czech republic'],
  SZ: ['swaziland'],
  TL: ['east timor'],
});

/**
 * Finds the countries a place text names: "Nord-Kivu Provinces of the
 * Democratic Republic of the Congo and Uganda" names two. Longer names are
 * tried first, so "Niger" is not found inside "Nigeria", nor "Congo" inside
 * "Democratic Republic of the Congo".
 *
 * @param {string} text
 * @param {Array<{iso2: string, name: string}>} countries
 * @returns {string[]} ISO codes, in the order found
 */
export function countriesNamed(text, countries) {
  let rest = ` ${String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")} `;
  const names = [];
  for (const country of countries) {
    names.push([country.name, country.iso2]);
    for (const alias of COUNTRY_ALIASES[country.iso2] ?? [])
      names.push([alias, country.iso2]);
  }
  const plain = (name) =>
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[’`]/g, "'");
  const found = [];
  for (const [name, iso2] of names
    .map(([name, iso2]) => [plain(name), iso2])
    .filter(([name]) => name.length > 3)
    .sort((a, b) => b[0].length - a[0].length)) {
    let at = rest.indexOf(name);
    while (at >= 0) {
      const before = rest[at - 1];
      const after = rest[at + name.length];
      if (!/[a-z]/.test(before ?? '') && !/[a-z]/.test(after ?? '')) {
        found.push([at, iso2]);
        // Blank it so a shorter name inside it is not found again.
        rest =
          rest.slice(0, at) +
          ' '.repeat(name.length) +
          rest.slice(at + name.length);
      }
      at = rest.indexOf(name, at + name.length);
    }
  }
  return [
    ...new Set(found.sort((a, b) => a[0] - b[0]).map(([, iso2]) => iso2)),
  ];
}

/** The word a headline must carry to be about a disease: "ebola", "dengue". */
export function diseaseKeyword(disease) {
  const words = String(disease ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter(
      (word) =>
        word.length > 3 &&
        !/^(virus|disease|fever|infection|outbreak|human|cases?|with|caused|update|situation|global|avian|acute|syndrome)$/.test(
          word,
        ),
    );
  return words[0] ?? '';
}

const WHO_FRESH_MS = 75 * 24 * 60 * 60 * 1000;
const HEADLINES_FOR_A_STEP = 5;

/**
 * Where outbreaks are, from official notices, graded 1 to 3.
 *
 * The level is the CDC's own where it has given one (levels 3 and 4 both
 * draw as 3). A World Health Organization outbreak notice in the last 75
 * days is level 2. Five or more current headlines naming the disease and
 * the country raise the level by one. No source gives current case counts
 * by place, so none is used.
 *
 * @returns {Array<{iso2: string, country: string, disease: string, family: object, level: number, headlines: number, notices: Array<{source: string, title: string, url: string, level?: number}>}>}
 */
export function outbreakAreas({
  who = [],
  notices = [],
  articles = [],
  countries = [],
  now = Date.now(),
}) {
  const nameOf = new Map(countries.map((c) => [c.iso2, c.name]));
  const areas = new Map();
  const add = (iso2, disease, level, notice) => {
    const keyword = diseaseKeyword(disease) || disease.toLowerCase();
    const key = `${iso2}|${keyword}`;
    const area = areas.get(key) ?? {
      iso2,
      country: nameOf.get(iso2) ?? iso2,
      disease,
      keyword,
      family: diseaseFamily(disease),
      level: 0,
      headlines: 0,
      notices: [],
    };
    area.level = Math.max(area.level, level);
    area.notices.push(notice);
    areas.set(key, area);
  };
  for (const notice of notices)
    for (const iso2 of new Set(
      notice.places.flatMap((place) => countriesNamed(place, countries)),
    ))
      add(iso2, notice.disease, Math.min(3, notice.level), {
        source: 'CDC',
        title: notice.title,
        url: notice.url,
        level: notice.level,
      });
  for (const item of who) {
    if (!(now - Date.parse(item.publishedAt) < WHO_FRESH_MS)) continue;
    for (const iso2 of countriesNamed(item.where, countries))
      add(iso2, item.disease, 2, {
        source: 'WHO',
        title: item.title,
        url: item.url,
      });
  }
  const texts = articles.map((article) =>
    `${article.title ?? ''} ${article.summary ?? ''} ${article.place?.name ?? ''}`.toLowerCase(),
  );
  for (const area of areas.values()) {
    const country = area.country.toLowerCase();
    if (area.keyword)
      area.headlines = texts.filter(
        (text) => text.includes(area.keyword) && text.includes(country),
      ).length;
    if (area.headlines >= HEADLINES_FOR_A_STEP)
      area.level = Math.min(3, area.level + 1);
  }
  return [...areas.values()].sort(
    (a, b) => b.level - a.level || b.headlines - a.headlines,
  );
}

/** The card for the outbreaks in one country. */
export function diseaseCard(country, areas) {
  const top = areas[0];
  return {
    kind: `DISEASE · ${DISEASE_LEVEL_LABEL[top.level]} · OFFICIAL NOTICES`,
    title: country,
    meta: [
      ...areas.map(
        (area) =>
          `${area.disease}: ${DISEASE_LEVEL_LABEL[area.level].toLowerCase()} (${area.notices
            .map((notice) =>
              notice.level ? `CDC level ${notice.level}` : notice.source,
            )
            .filter((value, index, all) => all.indexOf(value) === index)
            .join(
              ', ',
            )}${area.headlines ? `, ${area.headlines} current ${area.headlines === 1 ? 'headline' : 'headlines'}` : ''})`,
      ),
      'the whole country is shaded; a notice may cover only part of it',
      'no case counts: none is published by place',
    ].join(' · '),
    url: top.notices[0].url,
    linkText:
      top.notices[0].source === 'CDC'
        ? 'Open the notice at cdc.gov'
        : 'Open the notice at who.int',
  };
}

// ── Squares over a country ───────────────────────────────────────────

function inside(lon, lat, ring) {
  let within = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    )
      within = !within;
  }
  return within;
}

/**
 * The grid squares that cover a country: every square of `step` degrees
 * whose centre is inside one of its outlines. A country smaller than one
 * square gets the square it sits in, so it is still seen from orbit.
 *
 * @param {number[][][]} rings outlines as [lon, lat] points
 * @param {number} step square size in degrees
 * @returns {Array<[number, number]>} south-west corners
 */
export function squaresOver(rings, step) {
  const cells = new Map();
  for (const ring of rings) {
    let west = Infinity;
    let east = -Infinity;
    let south = Infinity;
    let north = -Infinity;
    for (const [lon, lat] of ring) {
      west = Math.min(west, lon);
      east = Math.max(east, lon);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
    // An outline that crosses the date line is skipped, not smeared.
    if (east - west > 180) continue;
    const before = cells.size;
    for (let lat = Math.floor(south / step) * step; lat < north; lat += step)
      for (let lon = Math.floor(west / step) * step; lon < east; lon += step)
        if (inside(lon + step / 2, lat + step / 2, ring))
          cells.set(`${lon},${lat}`, [lon, lat]);
    if (cells.size === before && rings[0] === ring) {
      const lon = Math.floor((west + east) / 2 / step) * step;
      const lat = Math.floor((south + north) / 2 / step) * step;
      cells.set(`${lon},${lat}`, [lon, lat]);
    }
  }
  return [...cells.values()].filter(
    ([, lat]) => lat >= -85 && lat + step <= 85,
  );
}
