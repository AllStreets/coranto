/**
 * US federal campaign money, from the Federal Election Commission's public
 * API (api.open.fec.gov). These are the totals candidates' own committees
 * reported to the FEC, up to the filing date shown on each row. Nothing is
 * estimated, and a candidate with a missing figure is left out.
 */

/** Offices shown. Rows: [FEC office code, name]. */
export const FEC_OFFICES = Object.freeze([
  ['S', 'US Senate'],
  ['H', 'US House'],
]);
export const FEC_ROWS_PER_OFFICE = 15;

/** The two-year FEC cycle a date falls in: cycles end in even years. */
export function fecCycle(now) {
  const year = new Date(now).getUTCFullYear();
  return year % 2 === 0 ? year : year + 1;
}

const money = (value) => {
  const number = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(number) && number >= 0 ? number : null;
};

/** Parse one `/candidates/totals/` response for one office. */
export function parseFecTotals(data, office) {
  if (!FEC_OFFICES.some(([code]) => code === office)) return [];
  const out = [];
  const seen = new Set();
  for (const row of Array.isArray(data?.results) ? data.results : []) {
    const id = row?.candidate_id;
    const receipts = money(row?.receipts);
    const spent = money(row?.disbursements);
    const through = row?.coverage_end_date;
    if (
      typeof id !== 'string' ||
      !/^[A-Z0-9]{9}$/.test(id) ||
      seen.has(id) ||
      row.office !== office ||
      typeof row.name !== 'string' ||
      !row.name.trim() ||
      receipts === null ||
      spent === null ||
      typeof through !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}/.test(through)
    )
      continue;
    seen.add(id);
    const district =
      office === 'H' && /^\d{2}$/.test(row.district ?? '') ? row.district : '';
    out.push({
      id,
      office,
      name: row.name.trim(),
      party: typeof row.party_full === 'string' ? row.party_full : '',
      partyCode: typeof row.party === 'string' ? row.party : '',
      state: /^[A-Z]{2}$/.test(row.state ?? '') ? row.state : '',
      district,
      status:
        typeof row.incumbent_challenge_full === 'string'
          ? row.incumbent_challenge_full
          : '',
      receipts,
      spent,
      cash: money(row.cash_on_hand_end_period),
      through: through.slice(0, 10),
      url: `https://www.fec.gov/data/candidate/${id}/`,
    });
  }
  return out.sort(
    (a, b) => b.receipts - a.receipts || a.id.localeCompare(b.id),
  );
}

/** True when a candidate row carries everything it must show. */
export function isShowableCandidate(row) {
  return Boolean(
    row &&
    typeof row.id === 'string' &&
    typeof row.name === 'string' &&
    row.name &&
    Number.isFinite(row.receipts) &&
    Number.isFinite(row.spent) &&
    /^\d{4}-\d{2}-\d{2}$/.test(row.through ?? '') &&
    typeof row.url === 'string' &&
    row.url.startsWith('https://www.fec.gov/data/candidate/'),
  );
}

/** `$98.0M`, `$412K`, `$950`. Rounded for reading; the FEC page has cents. */
export function formatMoney(value) {
  if (!Number.isFinite(value)) return '';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${Math.round(value / 1e3)}K`;
  return `$${Math.round(value)}`;
}

/** `GA` for a Senate seat, `TX-07` for a House district. */
export function seatLabel(row) {
  if (!row.state) return '';
  return row.district ? `${row.state}-${row.district}` : row.state;
}
