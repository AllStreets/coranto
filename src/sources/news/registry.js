/**
 * The news sources Coranto reads. Every upstream URL is a constant here; the
 * server never fetches an address supplied by a client.
 *
 * `kind` selects the parser: `feed` (RSS, RDF or Atom), `gdelt`, `newsapi`.
 */

const GDELT_QUERY =
  'sourcelang:english (conflict OR diplomacy OR economy OR election OR ' +
  'disaster OR military OR climate OR sanctions OR protest OR summit OR ' +
  'vaccine OR fusion OR quantum OR discovery OR breakthrough OR Nobel)';

export const NEWS_SOURCES = Object.freeze([
  {
    id: 'bbc',
    name: 'BBC',
    kind: 'feed',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    homepage: 'https://www.bbc.co.uk/news',
  },
  {
    id: 'guardian',
    name: 'The Guardian',
    kind: 'feed',
    url: 'https://www.theguardian.com/world/rss',
    homepage: 'https://www.theguardian.com',
  },
  {
    id: 'aljazeera',
    name: 'Al Jazeera',
    kind: 'feed',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    homepage: 'https://www.aljazeera.com',
  },
  {
    id: 'npr',
    name: 'NPR',
    kind: 'feed',
    url: 'https://feeds.npr.org/1004/rss.xml',
    homepage: 'https://www.npr.org',
  },
  {
    id: 'dw',
    name: 'DW',
    kind: 'feed',
    url: 'https://rss.dw.com/rdf/rss-en-all',
    homepage: 'https://www.dw.com',
  },
  {
    id: 'france24',
    name: 'France 24',
    kind: 'feed',
    url: 'https://www.france24.com/en/rss',
    homepage: 'https://www.france24.com',
  },
  {
    id: 'un',
    name: 'UN News',
    kind: 'feed',
    url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml',
    homepage: 'https://news.un.org',
  },
  {
    id: 'reliefweb',
    name: 'ReliefWeb',
    kind: 'feed',
    url: 'https://reliefweb.int/updates/rss.xml',
    homepage: 'https://reliefweb.int',
  },
  {
    id: 'sciencedaily',
    name: 'ScienceDaily',
    kind: 'feed',
    url: 'https://www.sciencedaily.com/rss/top/science.xml',
    homepage: 'https://www.sciencedaily.com',
  },
  {
    id: 'ars',
    name: 'Ars Technica',
    kind: 'feed',
    url: 'https://feeds.arstechnica.com/arstechnica/science',
    homepage: 'https://arstechnica.com',
  },
  {
    id: 'gdelt',
    name: 'GDELT',
    kind: 'gdelt',
    url:
      'https://api.gdeltproject.org/api/v2/doc/doc?query=' +
      encodeURIComponent(GDELT_QUERY) +
      '&mode=ArtList&format=json&maxrecords=75&timespan=24h&sort=DateDesc',
    homepage: 'https://www.gdeltproject.org',
  },
  {
    id: 'newsapi',
    name: 'NewsAPI',
    kind: 'newsapi',
    url: 'https://newsapi.org/v2/top-headlines?language=en&pageSize=100',
    homepage: 'https://newsapi.org',
    requiresKey: 'NEWS_API_KEY',
  },
]);

/** Fixed vocabulary for why a source failed. Upstream text is never relayed. */
export const NEWS_FAILURE_REASONS = Object.freeze([
  'timeout',
  'http-error',
  'rate-limited',
  'parse-error',
  'empty',
  'not-configured',
]);
