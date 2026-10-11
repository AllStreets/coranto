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
    id: 'euronews',
    name: 'Euronews',
    kind: 'feed',
    url: 'https://www.euronews.com/rss?level=theme&name=news',
    homepage: 'https://www.euronews.com',
  },
  {
    id: 'scmp',
    name: 'South China Morning Post',
    kind: 'feed',
    url: 'https://www.scmp.com/rss/91/feed',
    homepage: 'https://www.scmp.com',
  },
  {
    id: 'straitstimes',
    name: 'The Straits Times',
    kind: 'feed',
    url: 'https://www.straitstimes.com/news/world/rss.xml',
    homepage: 'https://www.straitstimes.com',
  },
  {
    id: 'cna',
    name: 'CNA',
    kind: 'feed',
    url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6311',
    homepage: 'https://www.channelnewsasia.com',
  },
  {
    id: 'japantimes',
    name: 'The Japan Times',
    kind: 'feed',
    url: 'https://www.japantimes.co.jp/feed/',
    homepage: 'https://www.japantimes.co.jp',
  },
  {
    id: 'thehindu',
    name: 'The Hindu',
    kind: 'feed',
    url: 'https://www.thehindu.com/news/international/feeder/default.rss',
    homepage: 'https://www.thehindu.com',
  },
  {
    id: 'timesofindia',
    name: 'The Times of India',
    kind: 'feed',
    url: 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms',
    homepage: 'https://timesofindia.indiatimes.com',
  },
  {
    id: 'abc-au',
    name: 'ABC News (Australia)',
    kind: 'feed',
    url: 'https://www.abc.net.au/news/feed/51120/rss.xml',
    homepage: 'https://www.abc.net.au/news',
  },
  {
    id: 'africanews',
    name: 'Africanews',
    kind: 'feed',
    url: 'https://www.africanews.com/feed/rss',
    homepage: 'https://www.africanews.com',
  },
  {
    id: 'allafrica',
    name: 'AllAfrica',
    kind: 'feed',
    url: 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf',
    homepage: 'https://allafrica.com',
  },
  {
    id: 'premiumtimes',
    name: 'Premium Times',
    kind: 'feed',
    url: 'https://www.premiumtimesng.com/feed',
    homepage: 'https://www.premiumtimesng.com',
  },
  {
    id: 'batimes',
    name: 'Buenos Aires Times',
    kind: 'feed',
    url: 'https://www.batimes.com.ar/feed',
    homepage: 'https://www.batimes.com.ar',
  },
  {
    id: 'propublica',
    name: 'ProPublica',
    kind: 'feed',
    url: 'https://www.propublica.org/feeds/propublica/main',
    homepage: 'https://www.propublica.org',
  },
  {
    id: 'nature',
    name: 'Nature',
    kind: 'feed',
    url: 'https://www.nature.com/nature.rss',
    homepage: 'https://www.nature.com',
  },
  {
    id: 'who',
    name: 'WHO',
    kind: 'feed',
    url: 'https://www.who.int/rss-feeds/news-english.xml',
    homepage: 'https://www.who.int',
  },
  {
    id: 'nasa',
    name: 'NASA',
    kind: 'feed',
    url: 'https://www.nasa.gov/news-release/feed/',
    homepage: 'https://www.nasa.gov',
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
