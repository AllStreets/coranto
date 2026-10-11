/**
 * The checks an article must pass to be shown. Kept free of the gazetteer and
 * filter tables so the browser can validate what the server sent without
 * loading them.
 */

const TRACKING_PARAM =
  /^(?:utm_[a-z]+|at_[a-z]+|fbclid|gclid|ref|cmpid|ocid)$/i;

/** The URL without fragment or tracking parameters, or null if not http(s). */
export function canonicalNewsUrl(value) {
  let url;
  try {
    url = new URL(String(value ?? '').trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  url.hash = '';
  for (const key of [...url.searchParams.keys()])
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  return url.href;
}

/** The feed's own date as epoch milliseconds, or null. Never the clock. */
export function parsePublishedAt(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value.trim());
  return Number.isFinite(ms) ? ms : null;
}

const PRECISIONS = new Set(['city', 'region', 'country']);

/** True when a value has every field an article must carry to be shown. */
export function isShowableArticle(article) {
  if (!article || typeof article !== 'object') return false;
  const { id, title, url, publisher, publishedAt, fetchedAt, place } = article;
  if (![id, title, url, publisher].every((v) => typeof v === 'string' && v))
    return false;
  if (!canonicalNewsUrl(url)) return false;
  if (parsePublishedAt(publishedAt) === null) return false;
  if (parsePublishedAt(fetchedAt) === null) return false;
  if (place === null || place === undefined) return true;
  return (
    typeof place === 'object' &&
    typeof place.name === 'string' &&
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lon) &&
    Math.abs(place.lat) <= 90 &&
    Math.abs(place.lon) <= 180 &&
    PRECISIONS.has(place.precision)
  );
}
