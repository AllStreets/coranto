import {
  formatMoney,
  isShowableCandidate,
  seatLabel,
} from '../sources/campaignFinance/records.js';

/**
 * Campaign money, shown in the Elections lens: the candidates who have raised
 * the most for the US Senate and House this cycle, as their committees
 * reported to the Federal Election Commission. Each row opens the candidate's
 * FEC page. With the FEC unreachable the section says so and shows no rows.
 */

/** Turn the route's state into what the section shows. */
export function buildMoneyModel(state, office) {
  if (state?.status === 'unavailable')
    return {
      rows: [],
      offices: [],
      note: 'The Federal Election Commission is not reachable. Nothing to show.',
      source: '',
    };
  if (state?.status !== 'ready')
    return { rows: [], offices: [], note: 'Reading FEC filings…', source: '' };
  const payload = state.payload ?? {};
  const offices = (payload.offices ?? []).map((entry) => ({
    office: entry.office,
    name: entry.name,
  }));
  const chosen =
    (payload.offices ?? []).find((entry) => entry.office === office) ??
    payload.offices?.[0];
  const candidates = (chosen?.candidates ?? []).filter(isShowableCandidate);
  const top = candidates[0]?.receipts ?? 0;
  const rows = candidates.map((row, index) => ({
    id: row.id,
    rank: String(index + 1),
    name: row.name,
    // Party and seat fit the row; the rest is in the hover text and at fec.gov.
    detail: [row.partyCode, seatLabel(row)].filter(Boolean).join(' · '),
    raised: formatMoney(row.receipts),
    share: top > 0 ? row.receipts / top : 0,
    title: [
      `${row.name}${row.party ? ` (${row.party})` : ''}`,
      row.status,
      `raised ${formatMoney(row.receipts)}`,
      `spent ${formatMoney(row.spent)}`,
      Number.isFinite(row.cash) ? `cash on hand ${formatMoney(row.cash)}` : '',
      `filings through ${row.through}`,
    ]
      .filter(Boolean)
      .join(' · '),
    url: row.url,
  }));
  const through = candidates
    .map((row) => row.through)
    .sort()
    .at(-1);
  return {
    rows,
    offices,
    office: chosen?.office ?? null,
    note: !rows.length
      ? `The FEC did not return ${chosen?.name ?? 'these'} totals.`
      : payload.stale
        ? `Showing figures saved ${String(payload.fetchedAt).slice(0, 10)}; the FEC is not answering now.`
        : '',
    source: rows.length
      ? `FEC · ${payload.cycle} cycle · filings through ${through}`
      : '',
  };
}

function el(document, tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.filter(Boolean));
  return node;
}

/**
 * @param {object} options
 * @param {Document} options.document
 * @param {typeof fetch} [options.fetchImpl]
 */
export function createCampaignMoney({
  document,
  fetchImpl = (...args) => globalThis.fetch(...args),
}) {
  let active = false;
  let office = 'S';
  let state = { status: 'loading' };
  const tabs = el(document, 'div', {
    class: 'coranto-money-tabs',
    role: 'group',
    'aria-label': 'Office',
  });
  const body = el(document, 'div', { class: 'coranto-money-body' });
  const element = el(
    document,
    'div',
    { class: 'coranto-money' },
    el(document, 'div', {
      class: 'coranto-rail-heading',
      text: 'US CAMPAIGN MONEY',
    }),
    el(document, 'p', {
      class: 'coranto-power-intro',
      text: 'Who has raised the most this cycle, from candidates’ own filings with the Federal Election Commission. Select a name to open the full record at fec.gov.',
    }),
    tabs,
    body,
  );

  function render() {
    const model = buildMoneyModel(state, office);
    tabs.replaceChildren(
      ...model.offices.map((entry) => {
        const button = el(document, 'button', {
          type: 'button',
          class: 'coranto-money-tab',
          'aria-pressed': String(entry.office === model.office),
          text: entry.name,
        });
        button.addEventListener('click', () => {
          office = entry.office;
          render();
        });
        return button;
      }),
    );
    tabs.hidden = model.offices.length < 2;
    const nodes = [];
    if (model.note)
      nodes.push(
        el(document, 'p', { class: 'coranto-power-none', text: model.note }),
      );
    if (model.rows.length) {
      const list = el(document, 'div', { class: 'coranto-money-list' });
      for (const row of model.rows) {
        const bar = el(document, 'span', { class: 'coranto-money-bar' });
        bar.style.width = `${Math.round(row.share * 100)}%`;
        list.append(
          el(
            document,
            'a',
            {
              class: 'coranto-money-row',
              href: row.url,
              target: '_blank',
              rel: 'noopener noreferrer',
              title: row.title,
            },
            el(document, 'span', {
              class: 'coranto-money-rank',
              text: row.rank,
            }),
            el(
              document,
              'span',
              { class: 'coranto-money-who' },
              el(document, 'span', {
                class: 'coranto-money-name',
                text: row.name,
              }),
              el(document, 'span', {
                class: 'coranto-money-detail',
                text: row.detail,
              }),
            ),
            el(document, 'span', {
              class: 'coranto-money-raised',
              text: row.raised,
            }),
            bar,
          ),
        );
      }
      nodes.push(
        list,
        el(document, 'p', {
          class: 'coranto-markets-source',
          text: model.source,
        }),
      );
    }
    body.replaceChildren(...nodes);
  }

  async function load() {
    try {
      const response = await fetchImpl('/api/campaign-finance', {
        headers: { Accept: 'application/json' },
      });
      if (response.status === 503) state = { status: 'unavailable' };
      else if (!response.ok) throw new Error('campaign-finance');
      else state = { status: 'ready', payload: await response.json() };
    } catch {
      if (state.status !== 'ready') state = { status: 'unavailable' };
    }
    if (active) render();
  }

  return {
    element,
    enter() {
      active = true;
      render();
      if (state.status !== 'ready') load();
    },
    leave() {
      active = false;
    },
  };
}
