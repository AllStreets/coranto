/**
 * Reading the US CDC's Travel Health Notices feed. Each notice names a
 * disease, the places it applies to and a level from 1 (practise usual
 * precautions) to 4 (avoid all travel). The level is the CDC's own.
 */

const decode = (text) =>
  String(text ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const tag = (item, name) =>
  decode(item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]);

/**
 * @param {string} xml the feed
 * @returns {Array<{id: string, level: number, disease: string, where: string, places: string[], title: string, url: string, publishedAt: string}>}
 */
export function parseTravelNotices(xml) {
  const out = [];
  const seen = new Set();
  for (const [, item] of String(xml ?? '').matchAll(
    /<item>([\s\S]*?)<\/item>/g,
  )) {
    const title = tag(item, 'title');
    const url = tag(item, 'link');
    const published = Date.parse(tag(item, 'pubDate'));
    const head = title.match(/^Level ([1-4]) - (.+)$/);
    if (
      !head ||
      !/^https:\/\/wwwnc\.cdc\.gov\/travel\/notices\//.test(url) ||
      !Number.isFinite(published) ||
      seen.has(url)
    )
      continue;
    seen.add(url);
    let disease = head[2];
    let where = '';
    let places = [];
    const worldwide = disease.match(/^Global (.+)$/);
    if (worldwide) {
      // A worldwide notice lists its countries in the description; the
      // list is repeated as it grew, so the longest copy is the full one.
      disease = worldwide[1];
      const lists = tag(item, 'description')
        .split(/Country List\s*:/)
        .slice(1)
        .sort((a, b) => b.length - a.length);
      places = (lists[0] ?? '')
        .split(',')
        .map((place) => place.trim())
        .filter((place) => place && !/^including\b/i.test(place));
      where = 'several countries';
    } else {
      const cut = disease.lastIndexOf(' in ');
      if (cut > 0) {
        where = disease.slice(cut + 4).trim();
        disease = disease.slice(0, cut).trim();
        places = [where];
      }
    }
    out.push({
      id: url.replace(/^.*\/notices\//, ''),
      level: Number(head[1]),
      disease,
      where,
      places,
      title,
      url,
      publishedAt: new Date(published).toISOString(),
    });
  }
  return out;
}
