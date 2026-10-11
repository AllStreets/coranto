/**
 * Automatic topic tags by whole-word keyword scoring, ported from AUSPEX.
 * A tag is an inference and the interface labels it as one. A story that
 * matches nothing gets no tag; it is never given a default.
 */

const KEYWORDS = {
  geopolitics: [
    'diplomat',
    'diplomats',
    'diplomatic',
    'sanction',
    'sanctions',
    'treaty',
    'election',
    'elections',
    'president',
    'prime minister',
    'minister',
    'summit',
    'parliament',
    'nato',
    'ceasefire',
    'bilateral',
    'security council',
    'peace talks',
    'referendum',
    'coup',
  ],
  military: [
    'military',
    'troops',
    'missile',
    'missiles',
    'drone strike',
    'airstrike',
    'airstrikes',
    'navy',
    'army',
    'combat',
    'weapon',
    'weapons',
    'warship',
    'soldier',
    'soldiers',
    'artillery',
    'bombing',
    'shelling',
    'offensive',
  ],
  finance: [
    'market',
    'markets',
    'stock',
    'stocks',
    'gdp',
    'inflation',
    'rate cut',
    'rate hike',
    'central bank',
    'federal reserve',
    'ecb',
    'bonds',
    'bond yields',
    'earnings',
    'tariff',
    'tariffs',
    'trade war',
    'bitcoin',
    'recession',
    'ipo',
  ],
  climate: [
    'climate',
    'carbon',
    'deforestation',
    'wildfire',
    'wildfires',
    'flood',
    'floods',
    'flooding',
    'drought',
    'emissions',
    'renewable',
    'glacier',
    'heatwave',
    'hurricane',
    'typhoon',
    'cyclone',
    'net zero',
  ],
  technology: [
    'artificial intelligence',
    'ai',
    'chip',
    'chips',
    'semiconductor',
    'semiconductors',
    'robot',
    'robots',
    'cyberattack',
    'software',
    'quantum',
    'satellite',
    'satellites',
    'spacecraft',
    'rocket',
    'startup',
    'data breach',
  ],
};

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PATTERNS = Object.entries(KEYWORDS).map(([category, words]) => [
  category,
  new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${words
      .slice()
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join('|')})(?![\\p{L}\\p{N}])`,
    'giu',
  ),
]);

export const NEWS_CATEGORIES = Object.freeze(Object.keys(KEYWORDS));

/**
 * @param {string} text Headline and summary.
 * @returns {string|null} The highest-scoring category, or null when no
 * keyword matches. Ties go to the category listed first.
 */
export function detectCategory(text) {
  if (typeof text !== 'string' || !text) return null;
  let best = null;
  let bestScore = 0;
  for (const [category, pattern] of PATTERNS) {
    const score = text.match(pattern)?.length ?? 0;
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }
  return best;
}
