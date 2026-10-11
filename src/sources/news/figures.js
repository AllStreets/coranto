/**
 * Finds counted figures in headlines ("kills 20", "300 injured",
 * "7.7-magnitude") so a story can show where outlets give different numbers.
 * It reads headlines only and reports what each outlet wrote; it does not
 * decide which figure is right. Later reports often carry higher counts.
 */

const NUMBER_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  dozen: 12,
};
const NUMBER = `(\\d[\\d,]*(?:\\.\\d+)?|${Object.keys(NUMBER_WORDS).join('|')})`;
const SCALE = '(?:\\s+(thousand|million|billion))?';
const FILLER = '(?:\\s+(?:people|more|others|civilians|soldiers|children))?';

// Each kind: verbs that precede a number ("kills 20") and states that follow
// one ("20 dead").
const KINDS = [
  ['killed', 'kills?|killed|killing', 'killed|dead|die|dies|died|deaths?'],
  [
    'injured',
    'injures?|injured|injuring|wounds?|wounded|wounding|hurts?',
    'injured|wounded|hurt',
  ],
  ['missing', '', 'missing'],
  ['arrested', 'arrests?|arrested|detains?|detained', 'arrested|detained|held'],
  [
    'displaced',
    'displaces?|displaced|displacing',
    'displaced|evacuated|homeless',
  ],
];

const PATTERNS = KINDS.flatMap(([what, before, after]) => [
  ...(before
    ? [
        [
          what,
          new RegExp(
            `\\b(?:${before})\\s+(?:at least\\s+|about\\s+|over\\s+|more than\\s+|nearly\\s+|some\\s+)?${NUMBER}${SCALE}\\b`,
            'gi',
          ),
        ],
      ]
    : []),
  [what, new RegExp(`\\b${NUMBER}${SCALE}${FILLER}\\s+(?:${after})\\b`, 'gi')],
]);
const MAGNITUDE = [
  /\bmagnitude[- ](\d(?:\.\d)?)\b/gi,
  /\b(\d(?:\.\d)?)[- ]?magnitude\b/gi,
  /\bM(\d\.\d)\b/g,
];
const SCALES = { thousand: 1e3, million: 1e6, billion: 1e9 };

function toNumber(text, scale) {
  const lower = text.toLowerCase();
  const base =
    lower in NUMBER_WORDS
      ? NUMBER_WORDS[lower]
      : Number(lower.replace(/,/g, ''));
  if (!Number.isFinite(base)) return null;
  return base * (scale ? SCALES[scale.toLowerCase()] : 1);
}

/**
 * @param {string} title A headline.
 * @returns {Array<{what: string, value: number}>} At most one figure per kind.
 */
export function extractFigures(title) {
  const text = String(title ?? '');
  const found = new Map();
  for (const [what, pattern] of PATTERNS)
    for (const match of text.matchAll(pattern)) {
      const value = toNumber(match[1], match[2]);
      if (value !== null && !found.has(what)) found.set(what, value);
    }
  for (const pattern of MAGNITUDE)
    for (const match of text.matchAll(pattern)) {
      const value = Number(match[1]);
      if (value >= 2 && value <= 10 && !found.has('magnitude'))
        found.set('magnitude', value);
    }
  return [...found].map(([what, value]) => ({ what, value }));
}

/**
 * Where the outlets in one story give different figures for the same thing.
 * @param {Array<{title: string, publisher: string}>} articles
 * @returns {Array<{what: string, values: Array<{value: number, publishers: string[]}>}>}
 */
export function differingFigures(articles) {
  const byKind = new Map();
  for (const article of articles ?? [])
    for (const { what, value } of extractFigures(article.title)) {
      if (!byKind.has(what)) byKind.set(what, new Map());
      const values = byKind.get(what);
      if (!values.has(value)) values.set(value, new Set());
      values.get(value).add(article.publisher);
    }
  const out = [];
  for (const [what, values] of byKind) {
    if (values.size < 2) continue;
    out.push({
      what,
      values: [...values]
        .sort((a, b) => a[0] - b[0])
        .map(([value, publishers]) => ({
          value,
          publishers: [...publishers].sort(),
        })),
    });
  }
  return out;
}
