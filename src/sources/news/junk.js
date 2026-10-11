/**
 * News junk filter, ported from AUSPEX (Apache-2.0, Connor Evans).
 *
 * Drops advertisements, PR copy and entertainment noise, and whole source
 * domains that are not news outlets. This is an editorial choice, so it is
 * kept visible: callers count what was dropped and the lists are documented
 * in DATA_SOURCES.md.
 *
 * PRIORITY_RE overrides JUNK_RE, so a story with a hard news signal is never
 * dropped. The junk list uses specific multi-word phrases so that ordinary
 * uses of "deal", "launch", "record" and "star" do not trigger it.
 */

// Hard-signal allowlist. If a story matches this, it is KEPT no matter what.
export const PRIORITY_RE =
  /\b(war|warfare|military|troops?|missile|drone strike|airstrike|nuclear|nato|sanctions?|election|coup|protest|invasion|ceasefire|parliament|president|prime minister|secretary of state|foreign minister|geopolit|diplomacy|terrorism|insurgency|conflict|crisis|threat|intelligence|espionage|submarine|aircraft carrier|destroyer|battalion|casualt|offensive|siege|blockade|escalat|deescalat|treaty|bilateral|summit|security council|un resolution|iaea|pentagon|kremlin|white house|state department|tariff|inflation|interest rate|recession|gdp|central bank|federal reserve|\bfed\b|supreme court|earthquake|hurricane|wildfire|flood|drought|famine|outbreak|pandemic|epidemic|vaccine|wildfire|tsunami|eruption|refinery|pipeline|oil price|gas price|rocket launch|space launch|satellite|spacex|nasa|cyberattack|data breach|genocide|refugee|humanitarian|aid convoy|hostage|drought|climate)\b/i;

// Junk denylist. Specific multi-word ad/PR/pop phrases.
export const JUNK_RE = new RegExp(
  [
    // ── Pop-culture / celebrity / entertainment ──
    '\\b(celebrit(y|ies)|kardashian|taylor swift|beyonc[eé]|grammy|box office|movie review|',
    'film review|album review|netflix series|hulu|disney\\+|spotify playlist|tiktok|',
    'viral video|social media trend|influencer|reality tv|reality show|bachelor|',
    "bachelorette|america'?s got talent|dancing with the stars|the voice|american idol|",
    'survivor cast|big brother|drag race|met gala|golden globe|emmys|oscars ceremony|',
    'red carpet|celebrity couple|celebrity death|actor arrested|pop star|royal family|',
    'meghan markle|prince harry|kardashians|kanye|kim kardashian|fans react|',
    'fan theory|first look|season finale|series finale|episode recap|show recap|',
    'streaming recap|horoscope|zodiac|astrology|red carpet|premiere|reunites?|',
    'reunion special|tour dates|sold[ -]out tour|new album|new single|music video|',
    "voice of (lilo|[a-z]+ in)|disney('?s| movie| film| channel)|pixar|",
    'hbo (max|series)|sitcom|tv host|talk show host|',
    'sequel (in the works|with|to)|spin[ -]?off series|',
    '(show|series|season \\d+) (renewed|cancell?ed|premiere|recap)|',
    'season \\d+ (premiere|finale|recap|trailer|episode)|',
    'questions (and demands )?we have for|jim carrey|jelly roll)\\b',
    // ── Gaming / consumer tech ──
    '|\\b(video game|game release|esport|fortnite|minecraft|roblox|playstation|xbox|',
    'nintendo|steam sale|gaming headset|twitch stream|call of duty|league of legends|',
    'overwatch|valorant|genshin|pokemon|zelda|mario|game review|gaming news|new game|',
    'rpg release|console launch|pc gaming|street fighter|dlc character|dlc pack|',
    'dlc release|game dlc|fighting game|jrpg|mmorpg|grand theft auto|gta online|',
    'gta vi|pre-?order date|cover art revealed|product review|unboxing|best buy|',
    'iphone 1[0-9]|macbook air|samsung galaxy s|new phone release|smartwatch review|',
    'gadget roundup|wearable tech review|home theater|soundbar|headphones review|',
    'earbuds|laptop review|tablet review|5g phone|best laptop|best phone|',
    'more color options)\\b|nintendo|buzzfeed',
    // ── Sports (scores / trades / results) ──
    '|\\b(nba (game|trade|dunk|mvp|draft|coach|championship|parade|finals?)|',
    'nfl (game|draft|trade|touchdown|coach|week)|mlb (game|trade|batting)|',
    'nhl (game|trade|goal)|premier league (goal|match|result|transfer)|la liga|',
    'bundesliga match|serie a match|cricket match|golf round|tennis match|',
    'f1 race result|superbowl ad|super bowl commercial|march madness|ncaa bracket|',
    'fantasy football|fantasy sports|sports betting odds|monday night football|',
    'college world series|world cup( \\d{4})? (match|win|loss|opener|group stage)|',
    'champions league (goal|match)|mock draft|',
    '(game|match) (analysis|recap|preview|highlights|report)|',
    'usmnt|uswnt|pochettino|pulisic|ronaldo|messi|lebron|',
    'transfer (rumou?r|window|news|deadline)|',
    'home run|touchdown|hat[ -]trick|playoff (win|loss|game))\\b',
    // ── Lifestyle listicle filler ──
    '|\\b(recipe|restaurant review|best restaurants|food trend|fashion week|',
    'beauty routine|skincare routine|home decor trend|interior design|travel tips|',
    'hotel review|vacation guide|celebrity diet|workout routine|fitness tips|',
    'meal prep|keto|intermittent fasting|abs workout|listicle|tier list|freakin|',
    'mind-blowing facts|cool facts|fun facts)\\b',
    // ── Advertisements / commerce ──
    '|\\b(deal of the day|deals? of the (week|year)|prime day|amazon sale|black friday|',
    'cyber monday|% off|\\d+ percent off|coupon code|promo code|discount code|',
    'shop now|buy now|on sale now|save up to|gift guide|best (gifts|deals|products) of \\d{4}|',
    'limited time offer|flash sale|clearance sale|affiliate link|sponsored content|',
    'sponsored post|advertorial|free shipping|lowest price|markdown|',
    "today'?s best deals|earn special rewards|exclusive offer)\\b",
    // ── PR / marketing fluff ──
    '|\\b(is proud to announce|are proud to announce|proudly announces|',
    'announces (a )?(new )?partnership|announces? collaboration|press release|',
    'ribbon[ -]cutting|unveils new (gadget|phone|app|product|lineup|collection)|',
    'named (a )?(top|best) (workplace|employer)|wins (award|recognition)|',
    'award[ -]winning|recognized as|honored (with|for)|',
    'celebrates? milestone|launches new product|new product launch|',
    'now available for purchase|product roadmap unveiled|',
    '[a-z]+preneur|solopreneur|introduces? a [a-z ]+ operating system|',
    'webinar series|free webinar|register (now |today )?for (our|the) webinar|',
    '(concert|album|gig|residency|setlist) review|turned [a-z ]+ into a [a-z ]+: review)\\b',
  ].join(''),
  'i',
);

// ═══════════════════════════════════════════
// SOURCE DENYLIST — domain-level filtering
// Some feeds are not real journalism regardless of the headline: auction /
// classifieds listings, code/package registries, PR/press-release wires, and
// tabloid / content-farm spam. We drop a story if its source DOMAIN (taken from
// the article URL host, or the `source` label) matches a denylisted substring.
// This is intentionally domain-based (not title-based) and is applied IN
// ADDITION to isJunk(). Wire services and real outlets (Reuters, AP, AFP, BBC,
// Guardian, NYT, WaPo, FT, Bloomberg, Al Jazeera, gcaptain, …) are NOT listed.
// ═══════════════════════════════════════════
export const SOURCE_DENYLIST = new Set([
  // ── Auctions / classifieds / shopping ──
  'bringatrailer.com',
  'carsandbids.com',
  'ebay.',
  'etsy.',
  'gumtree',
  'craigslist',
  'autotrader',
  'cars.com',
  'cargurus',
  'facebook marketplace',
  'marketplace.facebook',
  // ── Code / package registries / dev ──
  'pypi.org',
  'pypi.',
  'github.com',
  'gitlab.com',
  'npmjs.com',
  'sourceforge',
  'readthedocs',
  'news.ycombinator',
  'producthunt.com',
  'dev.to',
  // ── PR / press-release wires ──
  'globenewswire.com',
  'prnewswire.com',
  'businesswire.com',
  'einpresswire.com',
  'einnews.com',
  'openpr.com',
  'accesswire.com',
  'newswire.com',
  'prweb.com',
  '24-7pressrelease',
  'prlog',
  'marketscreener',
  // ── Tabloid / low-quality content farms ──
  'dailymail.co.uk',
  'dailymail.com',
  'thesun.co.uk',
  'nypost.com',
  'mirror.co.uk',
  'tmz.com',
  'buzzfeed.com',
  'distractify',
  'boredpanda',
  'msn.com/shopping',
  // ── Crypto-shill / niche blogspam ──
  'bitcoinist',
]);

// True when the article's SOURCE is a denylisted (non-news / low-quality)
// domain. Checks the URL host and the source label against SOURCE_DENYLIST.
export function isLowQualitySource(url, source) {
  let host = '';
  if (url) {
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      host = String(url).toLowerCase();
    }
  }
  const srcLabel = (
    typeof source === 'string' ? source : (source && source.name) || ''
  ).toLowerCase();
  const hay = `${host} ${srcLabel}`;
  for (const bad of SOURCE_DENYLIST) {
    if (hay.includes(bad)) return true;
  }
  return false;
}

// True when the story is junk (and not rescued by a priority signal).
// Pass the combined title + description + source string.
export function isJunk(text) {
  if (!text) return false;
  if (PRIORITY_RE.test(text)) return false; // legitimate news is never junk
  return JUNK_RE.test(text);
}

// Convenience for arrays of { title, description, source, url } articles.
// Drops both title-junk AND low-quality / non-news SOURCE domains.
export function filterJunkArticles(articles) {
  return (articles || []).filter((a) => {
    const src =
      typeof a.source === 'string'
        ? a.source
        : (a.source && a.source.name) || '';
    if (isLowQualitySource(a.url, a.source)) return false;
    return !isJunk(`${a.title || ''} ${a.description || ''} ${src}`);
  });
}
