import { matchPlace } from '../news/gazetteer.js';

/**
 * Relief: official humanitarian figures, never estimates of Coranto's own.
 *
 *   - Forced displacement by country of origin, from UNHCR's Refugee Data
 *     Finder (api.unhcr.org). The figures are UNHCR's, for the year shown.
 *   - Disease outbreak notices, from the World Health Organization's Disease
 *     Outbreak News. Each links to WHO's own notice.
 *
 * A figure UNHCR does not publish is left blank, not counted as zero.
 */
export const UNHCR_HOME = 'https://www.unhcr.org/refugee-statistics/';
export const DISPLACEMENT_ROWS = 20;
export const OUTBREAK_ROWS = 20;

const count = (value) => {
  const number = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(number) && number >= 0 ? number : null;
};

/** Parse one year of UNHCR population figures by country of origin. */
export function parseDisplacement(data, year) {
  const rows = [];
  for (const item of Array.isArray(data?.items) ? data.items : []) {
    const iso3 = typeof item?.coo_iso === 'string' ? item.coo_iso : '';
    const name = typeof item?.coo_name === 'string' ? item.coo_name.trim() : '';
    if (!/^[A-Z]{3}$/.test(iso3) || !name || item.year !== year) continue;
    const parts = {
      refugees: count(item.refugees),
      asylumSeekers: count(item.asylum_seekers),
      displacedInside: count(item.idps),
      othersInNeed: count(item.oip),
    };
    const known = Object.values(parts).filter((value) => value !== null);
    if (!known.length) continue;
    const total = known.reduce((sum, value) => sum + value, 0);
    if (total <= 0) continue;
    rows.push({ iso3, name, year, ...parts, total, url: UNHCR_HOME });
  }
  return rows
    .sort((a, b) => b.total - a.total || a.iso3.localeCompare(b.iso3))
    .slice(0, DISPLACEMENT_ROWS);
}

/** Parse WHO Disease Outbreak News. Notices without a date or id are dropped. */
export function parseOutbreaks(data) {
  const out = [];
  const seen = new Set();
  for (const item of Array.isArray(data?.value) ? data.value : []) {
    const id = typeof item?.DonId === 'string' ? item.DonId.trim() : '';
    const title = typeof item?.Title === 'string' ? item.Title.trim() : '';
    const slug = typeof item?.UrlName === 'string' ? item.UrlName.trim() : '';
    const published = Date.parse(item?.PublicationDate);
    if (
      !/^\d{4}-DON\d+$/.test(id) ||
      !title ||
      !/^[\w-]+$/.test(slug) ||
      !Number.isFinite(published) ||
      seen.has(id)
    )
      continue;
    seen.add(id);
    // WHO titles read "Disease - Place"; the place is whatever follows the
    // last dash. It is located only if it matches a known place name.
    const cut = title.search(/\s[-–—]\s(?!.*\s[-–—]\s)/);
    const where = cut > 0 ? title.slice(cut).replace(/^\s[-–—]\s/, '') : '';
    const place = where ? matchPlace(where, '') : null;
    out.push({
      id,
      title,
      disease: cut > 0 ? title.slice(0, cut).trim() : title,
      where,
      publishedAt: new Date(published).toISOString(),
      url: `https://www.who.int/emergencies/disease-outbreak-news/item/${slug}`,
      place: place
        ? {
            name: place.name,
            lat: place.lat,
            lon: place.lon,
            precision: place.precision,
          }
        : null,
    });
  }
  return out
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, OUTBREAK_ROWS);
}

export { formatPeople } from './format.js';
