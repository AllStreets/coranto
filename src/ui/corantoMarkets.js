import {
  formatQuoteChange,
  formatQuoteValue,
  isShowableQuote,
} from '../sources/markets/records.js';

/**
 * The Markets lens: exchange rates and crypto prices beside the finance news.
 * Every figure shows the time its source gave it and links to that source.
 * When a source is down its figures are absent and the lens names it.
 */

const REFRESH_MS = 5 * 60 * 1000;

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

/** What the lens shows for a payload, an outage, or the wait before either. */
export function buildMarketsModel(state) {
  if (state.status === 'loading')
    return { groups: [], note: 'Reading market figures…', down: [] };
  if (state.status === 'unavailable')
    return {
      groups: [],
      note: 'No market source is reachable. Nothing to show.',
      down: [],
    };
  const quotes = (state.payload?.quotes ?? []).filter(isShowableQuote);
  const groups = [];
  for (const quote of quotes) {
    let group = groups.find((entry) => entry.name === quote.group);
    if (!group) {
      group = {
        name: quote.group,
        source: quote.source,
        asOf: quote.asOfText,
        rows: [],
      };
      groups.push(group);
    }
    group.rows.push({
      id: quote.id,
      label: quote.label,
      title: `${quote.meaning ?? quote.name} · ${quote.source} · ${quote.asOfText}`,
      value: formatQuoteValue(quote.value),
      change: formatQuoteChange(quote.change),
      direction:
        !Number.isFinite(quote.change) || quote.change === 0
          ? 'flat'
          : quote.change > 0
            ? 'up'
            : 'down',
      basis: quote.changeBasis ?? '',
      url: quote.url,
    });
  }
  return {
    groups,
    note: state.payload?.stale
      ? 'Showing saved figures. No market source is reachable right now.'
      : '',
    down: (state.payload?.sources ?? [])
      .filter((source) => !source.ok)
      .map((source) => source.name),
  };
}

/**
 * @param {object} options
 * @param {Document} options.document
 * @param {typeof fetch} [options.fetchImpl]
 */
export function createMarketsLens({
  document,
  fetchImpl = (...args) => globalThis.fetch(...args),
}) {
  let active = false;
  let timer = null;
  let state = { status: 'loading' };
  const body = el(document, 'div', { class: 'coranto-markets-body' });
  const element = el(
    document,
    'div',
    { class: 'coranto-power coranto-markets' },
    el(document, 'p', {
      class: 'coranto-power-intro',
      text: 'Exchange rates and crypto prices, with finance news beside them. Exchange rates are the European Central Bank’s reference rates, set once each working day. They are not live trading prices.',
    }),
    body,
    el(document, 'p', {
      class: 'coranto-power-foot',
      text: 'Stock indices and commodity prices are not shown: no keyless public source for them is available.',
    }),
  );
  element.hidden = true;

  function render() {
    const model = buildMarketsModel(state);
    const nodes = [];
    if (model.note)
      nodes.push(
        el(document, 'p', { class: 'coranto-power-none', text: model.note }),
      );
    for (const group of model.groups) {
      nodes.push(
        el(document, 'div', {
          class: 'coranto-rail-heading',
          text: group.name.toUpperCase(),
        }),
      );
      const list = el(document, 'div', { class: 'coranto-markets-list' });
      for (const row of group.rows) {
        const link = el(
          document,
          'a',
          {
            class: 'coranto-quote',
            href: row.url,
            target: '_blank',
            rel: 'noopener noreferrer',
            title: row.title,
            'data-direction': row.direction,
          },
          el(document, 'span', {
            class: 'coranto-quote-label',
            text: row.label,
          }),
          el(document, 'span', {
            class: 'coranto-quote-value',
            text: row.value,
          }),
          el(document, 'span', {
            class: 'coranto-quote-change',
            text: row.change,
            title: row.basis,
          }),
        );
        list.append(link);
      }
      nodes.push(
        list,
        el(document, 'p', {
          class: 'coranto-markets-source',
          text: `${group.source} · ${group.asOf}`,
        }),
      );
    }
    for (const name of model.down)
      nodes.push(
        el(document, 'p', {
          class: 'coranto-markets-down',
          text: `${name} is not answering.`,
        }),
      );
    body.replaceChildren(...nodes);
  }

  async function load() {
    try {
      const response = await fetchImpl('/api/markets', {
        headers: { Accept: 'application/json' },
      });
      if (response.status === 503) state = { status: 'unavailable' };
      else if (!response.ok) throw new Error('markets');
      else state = { status: 'ready', payload: await response.json() };
    } catch {
      // Keep figures already shown; otherwise say nothing is reachable.
      if (state.status !== 'ready') state = { status: 'unavailable' };
    }
    if (active) render();
  }

  return {
    element,
    enter() {
      active = true;
      element.hidden = false;
      render();
      load();
      timer = setInterval(load, REFRESH_MS);
    },
    leave() {
      active = false;
      element.hidden = true;
      clearInterval(timer);
      timer = null;
    },
  };
}
