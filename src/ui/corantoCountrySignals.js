/**
 * What current headlines say about countries, by AUSPEX's two rules. Both
 * are counts over the headlines Coranto holds; neither is a judgement.
 *
 *   - Live conflict: a country is marked when at least three military-topic
 *     headlines name it in the headline itself and use fighting vocabulary.
 *   - Headline activity ("dead reckoning" in AUSPEX): how often a country is
 *     named, relative to the most-named country.
 */

/** AUSPEX's fighting vocabulary. Generic words (strike, battle, war) are left
 * out on purpose: they also mean labour strikes, sport and trade wars. */
export const CONFLICT_WORDS = Object.freeze([
  'airstrike',
  'air strike',
  'shelling',
  'offensive',
  'militant',
  'insurgen',
  'rebel',
  'troops',
  'invasion',
  'militia',
  'warfare',
  'combat',
  'frontline',
  'front line',
  'bombard',
  'gunmen',
  'jihad',
  'ceasefire',
  'paramilitary',
  'armed group',
  'missile',
  'drone strike',
  'soldiers',
  'war crime',
  'besieged',
  'artillery',
  'mortar',
  'separatist',
]);
export const CONFLICT_MIN_HEADLINES = 3;

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whole-word matchers for country names longer than three letters. */
function matchers(countries) {
  return (countries ?? [])
    .filter((country) => (country.name ?? '').length > 3 && country.iso2)
    .map((country) => ({
      code: country.iso2,
      test: new RegExp(
        `(?<![\\p{L}\\p{N}])${escape(country.name.toLowerCase())}(?![\\p{L}\\p{N}])`,
        'u',
      ),
    }));
}

/** ISO codes of countries with a live conflict signal in the headlines. */
export function liveConflictCodes(countries, articles) {
  const names = matchers(countries);
  const counts = new Map();
  for (const article of articles ?? []) {
    if (article.category !== 'military') continue;
    const body = `${article.title} ${article.summary ?? ''}`.toLowerCase();
    if (!CONFLICT_WORDS.some((word) => body.includes(word))) continue;
    // The country must be the headline's subject, not a passing mention.
    const title = String(article.title ?? '').toLowerCase();
    for (const { code, test } of names)
      if (test.test(title)) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return new Set(
    [...counts]
      .filter(([, n]) => n >= CONFLICT_MIN_HEADLINES)
      .map(([code]) => code),
  );
}

/**
 * How often each country is named in the headlines and summaries.
 * @returns {Map<string, {count: number, level: 'high'|'medium'|'low'}>}
 * `high` is more than half as often as the most-named country, `medium` more
 * than a fifth. Countries not named at all are absent.
 */
export function headlineActivity(countries, articles) {
  const names = matchers(countries);
  const counts = new Map();
  for (const article of articles ?? []) {
    const body = `${article.title} ${article.summary ?? ''}`.toLowerCase();
    for (const { code, test } of names)
      if (test.test(body)) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  const most = Math.max(1, ...counts.values());
  return new Map(
    [...counts].map(([code, count]) => [
      code,
      {
        count,
        level:
          count / most > 0.5 ? 'high' : count / most > 0.2 ? 'medium' : 'low',
      },
    ]),
  );
}

export const ACTIVITY_COLOURS = Object.freeze({
  high: '#ff6b81',
  medium: '#ffb84d',
});
