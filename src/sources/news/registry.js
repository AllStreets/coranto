/**
 * The news sources Coranto reads. Every upstream URL is a constant here; the
 * server never fetches an address supplied by a client.
 *
 * `kind` selects the parser: `feed` (RSS, RDF or Atom), `gdelt`, `newsapi`.
 * `region` is where the outlet is based, used to compare who covered a story.
 * `lang` is the feed's language when it is not English. Headlines are shown
 * in their original language; Coranto does not translate them.
 */

/** Names for the language codes used by the registry. */
export const NEWS_LANGUAGES = Object.freeze({
  en: 'English',
  fr: 'Français',
  es: 'Español',
  de: 'Deutsch',
  pt: 'Português',
  ar: 'العربية',
});

/** Regions compared when showing who covered a story. */
export const NEWS_COVERAGE_REGIONS = Object.freeze([
  'Europe',
  'Middle East',
  'Asia-Pacific',
  'Africa',
  'Americas',
]);

const GDELT_QUERY =
  'sourcelang:english (conflict OR diplomacy OR economy OR election OR ' +
  'disaster OR military OR climate OR sanctions OR protest OR summit OR ' +
  'vaccine OR fusion OR quantum OR discovery OR breakthrough OR Nobel)';

export const NEWS_SOURCES = Object.freeze([
  {
    id: 'bbc',
    region: 'Europe',
    name: 'BBC',
    kind: 'feed',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    homepage: 'https://www.bbc.co.uk/news',
  },
  {
    id: 'guardian',
    region: 'Europe',
    name: 'The Guardian',
    kind: 'feed',
    url: 'https://www.theguardian.com/world/rss',
    homepage: 'https://www.theguardian.com',
  },
  {
    id: 'aljazeera',
    region: 'Middle East',
    name: 'Al Jazeera',
    kind: 'feed',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    homepage: 'https://www.aljazeera.com',
  },
  {
    id: 'npr',
    region: 'Americas',
    name: 'NPR',
    kind: 'feed',
    url: 'https://feeds.npr.org/1004/rss.xml',
    homepage: 'https://www.npr.org',
  },
  {
    id: 'dw',
    region: 'Europe',
    name: 'DW',
    kind: 'feed',
    url: 'https://rss.dw.com/rdf/rss-en-all',
    homepage: 'https://www.dw.com',
  },
  {
    id: 'france24',
    region: 'Europe',
    name: 'France 24',
    kind: 'feed',
    url: 'https://www.france24.com/en/rss',
    homepage: 'https://www.france24.com',
  },
  {
    id: 'un',
    region: 'International',
    name: 'UN News',
    kind: 'feed',
    url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml',
    homepage: 'https://news.un.org',
  },
  {
    id: 'reliefweb',
    region: 'International',
    name: 'ReliefWeb',
    kind: 'feed',
    url: 'https://reliefweb.int/updates/rss.xml',
    homepage: 'https://reliefweb.int',
  },
  {
    id: 'sciencedaily',
    region: 'Science',
    name: 'ScienceDaily',
    kind: 'feed',
    url: 'https://www.sciencedaily.com/rss/top/science.xml',
    homepage: 'https://www.sciencedaily.com',
  },
  {
    id: 'ars',
    region: 'Science',
    name: 'Ars Technica',
    kind: 'feed',
    url: 'https://feeds.arstechnica.com/arstechnica/science',
    homepage: 'https://arstechnica.com',
  },
  {
    id: 'euronews',
    region: 'Europe',
    name: 'Euronews',
    kind: 'feed',
    url: 'https://www.euronews.com/rss?level=theme&name=news',
    homepage: 'https://www.euronews.com',
  },
  {
    id: 'scmp',
    region: 'Asia-Pacific',
    name: 'South China Morning Post',
    kind: 'feed',
    url: 'https://www.scmp.com/rss/91/feed',
    homepage: 'https://www.scmp.com',
  },
  {
    id: 'straitstimes',
    region: 'Asia-Pacific',
    name: 'The Straits Times',
    kind: 'feed',
    url: 'https://www.straitstimes.com/news/world/rss.xml',
    homepage: 'https://www.straitstimes.com',
  },
  {
    id: 'cna',
    region: 'Asia-Pacific',
    name: 'CNA',
    kind: 'feed',
    url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6311',
    homepage: 'https://www.channelnewsasia.com',
  },
  {
    id: 'japantimes',
    region: 'Asia-Pacific',
    name: 'The Japan Times',
    kind: 'feed',
    url: 'https://www.japantimes.co.jp/feed/',
    homepage: 'https://www.japantimes.co.jp',
  },
  {
    id: 'thehindu',
    region: 'Asia-Pacific',
    name: 'The Hindu',
    kind: 'feed',
    url: 'https://www.thehindu.com/news/international/feeder/default.rss',
    homepage: 'https://www.thehindu.com',
  },
  {
    id: 'timesofindia',
    region: 'Asia-Pacific',
    name: 'The Times of India',
    kind: 'feed',
    url: 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms',
    homepage: 'https://timesofindia.indiatimes.com',
  },
  {
    id: 'abc-au',
    region: 'Asia-Pacific',
    name: 'ABC News (Australia)',
    kind: 'feed',
    url: 'https://www.abc.net.au/news/feed/51120/rss.xml',
    homepage: 'https://www.abc.net.au/news',
  },
  {
    id: 'africanews',
    region: 'Africa',
    name: 'Africanews',
    kind: 'feed',
    url: 'https://www.africanews.com/feed/rss',
    homepage: 'https://www.africanews.com',
  },
  {
    id: 'allafrica',
    region: 'Africa',
    name: 'AllAfrica',
    kind: 'feed',
    url: 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf',
    homepage: 'https://allafrica.com',
  },
  {
    id: 'premiumtimes',
    region: 'Africa',
    name: 'Premium Times',
    kind: 'feed',
    url: 'https://www.premiumtimesng.com/feed',
    homepage: 'https://www.premiumtimesng.com',
  },
  {
    id: 'batimes',
    region: 'Americas',
    name: 'Buenos Aires Times',
    kind: 'feed',
    url: 'https://www.batimes.com.ar/feed',
    homepage: 'https://www.batimes.com.ar',
  },
  {
    id: 'propublica',
    region: 'Americas',
    name: 'ProPublica',
    kind: 'feed',
    url: 'https://www.propublica.org/feeds/propublica/main',
    homepage: 'https://www.propublica.org',
  },
  {
    id: 'nature',
    region: 'Science',
    name: 'Nature',
    kind: 'feed',
    url: 'https://www.nature.com/nature.rss',
    homepage: 'https://www.nature.com',
  },
  {
    id: 'who',
    region: 'International',
    name: 'WHO',
    kind: 'feed',
    url: 'https://www.who.int/rss-feeds/news-english.xml',
    homepage: 'https://www.who.int',
  },
  {
    id: 'nasa',
    region: 'Science',
    name: 'NASA',
    kind: 'feed',
    url: 'https://www.nasa.gov/news-release/feed/',
    homepage: 'https://www.nasa.gov',
  },
  {
    id: 'lemonde',
    region: 'Europe',
    lang: 'fr',
    name: 'Le Monde',
    kind: 'feed',
    url: 'https://www.lemonde.fr/international/rss_full.xml',
    homepage: 'https://www.lemonde.fr',
  },
  {
    id: 'elpais',
    region: 'Europe',
    lang: 'es',
    name: 'El País',
    kind: 'feed',
    url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada',
    homepage: 'https://elpais.com',
  },
  {
    id: 'bbcmundo',
    region: 'Europe',
    lang: 'es',
    name: 'BBC Mundo',
    kind: 'feed',
    url: 'https://www.bbc.com/mundo/index.xml',
    homepage: 'https://www.bbc.com/mundo',
  },
  {
    id: 'spiegel',
    region: 'Europe',
    lang: 'de',
    name: 'Der Spiegel',
    kind: 'feed',
    url: 'https://www.spiegel.de/ausland/index.rss',
    homepage: 'https://www.spiegel.de',
  },
  {
    id: 'tagesschau',
    region: 'Europe',
    lang: 'de',
    name: 'Tagesschau',
    kind: 'feed',
    url: 'https://www.tagesschau.de/ausland/index~rss2.xml',
    homepage: 'https://www.tagesschau.de',
  },
  {
    id: 'g1',
    region: 'Americas',
    lang: 'pt',
    name: 'G1 Globo',
    kind: 'feed',
    url: 'https://g1.globo.com/rss/g1/mundo/',
    homepage: 'https://g1.globo.com',
  },
  {
    id: 'aljazeera-ar',
    region: 'Middle East',
    lang: 'ar',
    name: 'Al Jazeera Arabic',
    kind: 'feed',
    url: 'https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/73d0e1b4-532f-45ef-b135-bfdff8b8cab9',
    homepage: 'https://www.aljazeera.net',
  },
  {
    id: 'gdelt',
    region: 'Index',
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
    region: 'Index',
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
