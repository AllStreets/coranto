/**
 * Parsers that turn a publisher's feed into raw items:
 * `{ title, summary, url, publisher, publishedAt }`.
 *
 * They copy what the feed says. A field the feed does not carry is left
 * empty for `normalizeArticle` to reject; nothing is invented here.
 */

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
};

const codePoint = (value) => {
  try {
    return String.fromCodePoint(value);
  } catch {
    return '';
  }
};

const decodeEntities = (text) =>
  text
    .replace(/&#(\d+);/g, (_, n) => codePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => codePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (whole, name) => ENTITIES[name] ?? whole);

/** Plain text from feed markup: CDATA unwrapped, tags removed, entities decoded. */
export function feedText(value) {
  if (!value) return '';
  // Feeds escape HTML inside elements, so decode once to expose the tags,
  // strip them, then decode what the inner HTML itself had escaped.
  const unwrapped = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  const stripped = decodeEntities(unwrapped).replace(/<[^>]*>/g, ' ');
  return decodeEntities(stripped).replace(/\s+/g, ' ').trim();
}

function tag(block, name) {
  const match = block.match(
    new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'),
  );
  return match ? match[1] : '';
}

function link(block) {
  const plain = feedText(tag(block, 'link'));
  if (/^https?:/i.test(plain)) return plain;
  const alternate =
    block.match(
      /<link\b(?=[^>]*\brel=["']alternate["'])[^>]*\bhref=["']([^"']+)["']/i,
    ) || block.match(/<link\b[^>]*\bhref=["']([^"']+)["']/i);
  return alternate ? decodeEntities(alternate[1]) : '';
}

/**
 * Parse RSS 2.0, RDF and Atom.
 * @param {string} xml
 * @param {string} publisher The registry name of the feed's publisher.
 */
export function parseFeed(xml, publisher) {
  const items = [];
  for (const match of String(xml ?? '').matchAll(
    /<(item|entry)\b[\s\S]*?<\/\1>/gi,
  )) {
    const block = match[0];
    items.push({
      title: feedText(tag(block, 'title')),
      summary: feedText(
        tag(block, 'description') ||
          tag(block, 'summary') ||
          tag(block, 'content'),
      ),
      url: link(block),
      publisher,
      publishedAt: feedText(
        tag(block, 'pubDate') ||
          tag(block, 'published') ||
          tag(block, 'updated') ||
          tag(block, 'dc:date'),
      ),
    });
  }
  return items;
}

/** GDELT `seendate` (YYYYMMDDThhmmssZ) as ISO 8601, or '' if malformed. */
export function gdeltDate(value) {
  const match = String(value ?? '').match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
  );
  if (!match) return '';
  const [, y, mo, d, h, mi, s] = match;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
}

/**
 * Parse a GDELT DOC API ArtList response. The publisher is the article's own
 * domain. GDELT's `sourcecountry` is where the outlet is based, not where the
 * story happened, so it is not read.
 */
export function parseGdelt(data) {
  const articles = Array.isArray(data?.articles) ? data.articles : [];
  return articles.map((entry) => ({
    title: typeof entry?.title === 'string' ? entry.title : '',
    summary: '',
    url: typeof entry?.url === 'string' ? entry.url : '',
    publisher:
      typeof entry?.domain === 'string'
        ? entry.domain.replace(/^www\./, '')
        : '',
    publishedAt: gdeltDate(entry?.seendate),
  }));
}

/** Parse a NewsAPI v2 response. */
export function parseNewsApi(data) {
  const articles = Array.isArray(data?.articles) ? data.articles : [];
  return articles.map((entry) => ({
    title: typeof entry?.title === 'string' ? entry.title : '',
    summary: typeof entry?.description === 'string' ? entry.description : '',
    url: typeof entry?.url === 'string' ? entry.url : '',
    publisher: typeof entry?.source?.name === 'string' ? entry.source.name : '',
    publishedAt:
      typeof entry?.publishedAt === 'string' ? entry.publishedAt : '',
  }));
}
