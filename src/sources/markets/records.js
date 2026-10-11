/**
 * Market figures from two keyless public sources, each kept with its own
 * timestamp and link:
 *   - exchange rates: European Central Bank reference rates, served by
 *     Frankfurter. They are set once per working day, not live quotes.
 *   - crypto prices: CoinGecko.
 * A change is computed only from two figures the source itself gave.
 */

export const FX_BASE = 'USD';
export const FX_CURRENCIES = Object.freeze([
  ['EUR', 'Euro'],
  ['GBP', 'British pound'],
  ['JPY', 'Japanese yen'],
  ['CNY', 'Chinese yuan'],
  ['INR', 'Indian rupee'],
  ['BRL', 'Brazilian real'],
  ['CHF', 'Swiss franc'],
  ['CAD', 'Canadian dollar'],
]);
export const CRYPTO_COINS = Object.freeze([
  ['bitcoin', 'Bitcoin', 'BTC'],
  ['ethereum', 'Ethereum', 'ETH'],
  ['solana', 'Solana', 'SOL'],
]);

const ECB_URL =
  'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html';

const percent = (now, before) =>
  Number.isFinite(now) && Number.isFinite(before) && before !== 0
    ? ((now - before) / before) * 100
    : null;

/**
 * Parse a Frankfurter time-series response into one quote per currency:
 * the latest reference rate, and its change from the previous published day.
 */
export function parseFx(data) {
  const days = Object.keys(data?.rates ?? {})
    .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day))
    .sort();
  if (!days.length || data?.base !== FX_BASE) return [];
  const latestDay = days.at(-1);
  const previousDay = days.at(-2) ?? null;
  const out = [];
  for (const [code, name] of FX_CURRENCIES) {
    const value = data.rates[latestDay]?.[code];
    if (!Number.isFinite(value) || value <= 0) continue;
    const before = previousDay ? data.rates[previousDay]?.[code] : null;
    out.push({
      id: `fx:${code}`,
      group: 'Exchange rates',
      name,
      label: `${FX_BASE}/${code}`,
      meaning: `1 US dollar in ${name}`,
      value,
      unit: code,
      change: percent(value, before),
      changeBasis: previousDay ? `since ${previousDay}` : null,
      asOf: `${latestDay}T00:00:00.000Z`,
      asOfText: latestDay,
      source: 'European Central Bank reference rates, via Frankfurter',
      url: ECB_URL,
    });
  }
  return out;
}

/** Parse a CoinGecko simple-price response. */
export function parseCrypto(data) {
  const out = [];
  for (const [id, name, symbol] of CRYPTO_COINS) {
    const row = data?.[id];
    const value = row?.usd;
    const updated = row?.last_updated_at;
    if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(updated))
      continue;
    const asOf = new Date(updated * 1000).toISOString();
    out.push({
      id: `crypto:${symbol}`,
      group: 'Crypto',
      name,
      label: `${symbol}/USD`,
      meaning: `1 ${name} in US dollars`,
      value,
      unit: 'USD',
      change: Number.isFinite(row.usd_24h_change) ? row.usd_24h_change : null,
      changeBasis: Number.isFinite(row.usd_24h_change) ? 'in 24 hours' : null,
      asOf,
      asOfText: asOf.slice(0, 16).replace('T', ' ') + ' UTC',
      source: 'CoinGecko',
      url: `https://www.coingecko.com/en/coins/${id}`,
    });
  }
  return out;
}

/** True when a quote has every field it must carry to be shown. */
export function isShowableQuote(quote) {
  let link = false;
  try {
    link = new URL(quote?.url).protocol === 'https:';
  } catch {
    link = false;
  }
  return Boolean(
    quote &&
    typeof quote.id === 'string' &&
    typeof quote.group === 'string' &&
    typeof quote.name === 'string' &&
    typeof quote.label === 'string' &&
    Number.isFinite(quote.value) &&
    typeof quote.unit === 'string' &&
    (quote.change === null || Number.isFinite(quote.change)) &&
    Number.isFinite(Date.parse(quote.asOf)) &&
    typeof quote.asOfText === 'string' &&
    typeof quote.source === 'string' &&
    quote.source &&
    link,
  );
}

/** `0.8924`, `158.25`, `82,942` — more decimals for small numbers. */
export function formatQuoteValue(value) {
  const digits = value >= 1000 ? 0 : value >= 20 ? 2 : 4;
  return value.toLocaleString('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** `+0.25%`, `−1.10%`, or '' when the source gave no earlier figure. */
export function formatQuoteChange(change) {
  if (!Number.isFinite(change)) return '';
  const sign = change > 0 ? '+' : change < 0 ? '−' : '';
  return `${sign}${Math.abs(change).toFixed(2)}%`;
}
