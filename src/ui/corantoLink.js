import { normalizeCriteria } from './watches.js';

/**
 * A link that reopens the news view as it is now: the lens, the search, the
 * topic, the place and the language. It rides in the query string beside the
 * engine's own camera link in the fragment, and carries only the filter, never
 * any news content.
 */

export const VIEW_PARAM = 'c';
const LENSES = new Set(['news', 'power', 'elections', 'markets']);

/** Encode a view as a compact query value such as `l=elections&q=brazil`. */
export function encodeView({ lens = 'news', criteria = {} } = {}) {
  const c = normalizeCriteria(criteria);
  const params = new URLSearchParams();
  if (LENSES.has(lens) && lens !== 'news') params.set('l', lens);
  if (c.query) params.set('q', c.query);
  if (c.category) params.set('t', c.category);
  if (c.placeKey) params.set('p', c.placeKey);
  if (c.publisher) params.set('o', c.publisher);
  if (c.language !== 'en') params.set('g', c.language ?? 'all');
  if (c.goodNews) params.set('n', '1');
  return params.toString();
}

/** Decode a query value. Unknown or malformed parts are ignored. */
export function decodeView(value) {
  if (typeof value !== 'string' || !value || value.length > 600) return null;
  const params = new URLSearchParams(value);
  const lens = params.get('l');
  const language = params.get('g');
  return {
    lens: LENSES.has(lens) ? lens : 'news',
    criteria: normalizeCriteria({
      query: params.get('q') ?? '',
      category: params.get('t'),
      placeKey: params.get('p'),
      publisher: params.get('o'),
      language: language === 'all' ? null : (language ?? 'en'),
      goodNews: params.get('n') === '1',
    }),
  };
}

/** The view in a page address, or null when it carries none. */
export function readViewFromSearch(search) {
  const value = new URLSearchParams(search ?? '').get(VIEW_PARAM);
  return value === null ? null : decodeView(value);
}

/** The current address with the view added and the camera fragment kept. */
export function buildViewUrl(location, view) {
  const url = new URL(location.href);
  const encoded = encodeView(view);
  if (encoded) url.searchParams.set(VIEW_PARAM, encoded);
  else url.searchParams.set(VIEW_PARAM, 'l=news');
  return url.href;
}
