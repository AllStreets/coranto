import { buildNewsPanelModel } from './newsPanelModel.js';

const CATEGORY_CODE = {
  geopolitics: 'GEO',
  technology: 'TEC',
  military: 'MIL',
  finance: 'FIN',
  climate: 'CLM',
};

function el(document, tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * The headline feed. It renders exactly what `buildNewsPanelModel` returns:
 * publisher headlines with their links, the source-health line, and one
 * sentence when there is nothing to show.
 *
 * @param {object} options
 * @param {Document} options.document
 * @param {HTMLElement} options.body Element the feed renders into.
 * @param {{getView: Function, subscribe: Function, selectPlace: Function, setGoodNewsOnly: Function}} options.layer
 * @param {(model: object) => void} [options.onModel] Called after each render.
 * @param {() => number} [options.now]
 */
export function createNewsFeed({
  document,
  body,
  layer,
  onModel = () => {},
  now = () => Date.now(),
}) {
  if (!document?.createElement || !body) return null;

  const filters = { category: null, publisher: null, query: '' };
  let sourcesOpen = false;
  let droppedOpen = false;

  const status = el(document, 'div', 'news-status');
  const healthBtn = el(document, 'button', 'news-health');
  healthBtn.type = 'button';
  healthBtn.title = 'Show every source and whether it answered';
  const healthDot = el(document, 'span', 'news-health-dot');
  const healthText = el(document, 'span', 'news-health-text');
  healthBtn.append(healthDot, healthText);
  const sourceList = el(document, 'ul', 'news-source-list');
  const staleNote = el(document, 'p', 'news-stale');
  const droppedBtn = el(document, 'button', 'news-dropped');
  droppedBtn.type = 'button';
  const droppedList = el(document, 'ul', 'news-dropped-list');
  status.append(healthBtn, sourceList, staleNote, droppedBtn, droppedList);

  const search = el(document, 'input', 'news-search');
  search.type = 'search';
  search.placeholder = 'Search the feed';
  search.setAttribute('aria-label', 'Search the feed');
  search.autocomplete = 'off';
  search.spellcheck = false;
  const filterRow = el(document, 'div', 'news-filters');
  const placeChip = el(document, 'button', 'news-chip news-chip-place');
  placeChip.type = 'button';
  placeChip.title = 'Clear the place filter';
  const publisherSelect = el(document, 'select', 'news-select');
  publisherSelect.setAttribute('aria-label', 'Filter by publisher');
  filterRow.append(search, placeChip, publisherSelect);

  const empty = el(document, 'p', 'news-empty');
  const list = el(document, 'ol', 'news-list');
  list.setAttribute('aria-label', 'Headlines');
  body.replaceChildren(status, filterRow, empty, list);

  function fillSelect(select, label, options, selected) {
    const nodes = [new Option(label, '')];
    for (const { value, count } of options)
      nodes.push(new Option(`${value} (${count})`, value));
    select.replaceChildren(...nodes);
    select.value = selected ?? '';
    select.hidden = options.length === 0;
  }

  /** Sources grouped by whether they answered, the failures first. */
  function renderSources(sources) {
    const groups = [
      ['down', 'NOT ANSWERING'],
      ['ok', 'ANSWERING'],
      ['off', 'OPTIONAL, NOT SET UP'],
    ];
    const nodes = [];
    for (const [state, heading] of groups) {
      const rows = sources.filter((source) => source.state === state);
      if (!rows.length) continue;
      const group = el(document, 'li', 'news-source-group');
      group.dataset.state = state;
      const list = el(document, 'ul', 'news-source-rows');
      for (const source of rows) {
        const row = el(document, 'li', 'news-source');
        row.dataset.state = source.state;
        row.append(
          el(document, 'span', 'news-source-dot'),
          el(document, 'span', 'news-source-name', source.name),
        );
        if (source.count !== null)
          row.append(
            el(document, 'span', 'news-source-count', String(source.count)),
          );
        else
          row.append(el(document, 'span', 'news-source-detail', source.detail));
        list.append(row);
      }
      group.append(
        el(
          document,
          'div',
          'news-source-heading',
          `${heading} · ${rows.length}`,
        ),
        list,
      );
      nodes.push(group);
    }
    return nodes;
  }

  function renderCard(card) {
    const item = el(document, 'li', 'news-card');
    item.dataset.articleId = card.id;
    if (card.categoryId) item.dataset.category = card.categoryId;
    if (card.goodNews) item.classList.add('news-card-good');

    const meta = el(document, 'div', 'news-card-meta');
    const code = card.goodNews
      ? 'GOOD'
      : (CATEGORY_CODE[card.categoryId] ?? 'NEWS');
    const tag = el(document, 'span', 'news-card-code', code);
    tag.title = card.goodNews || card.category || 'No automatic tag';
    meta.append(
      tag,
      el(document, 'span', 'news-card-publisher', card.publisher),
    );
    const time = el(document, 'time', 'news-card-time', card.published);
    time.dateTime = card.publishedIso;
    meta.append(time);

    const title = el(document, 'a', 'news-card-title', card.title);
    title.href = card.url;
    title.target = '_blank';
    title.rel = 'noopener noreferrer';
    title.title = card.linkText;
    item.append(meta, title);
    if (card.summary)
      item.append(el(document, 'p', 'news-card-summary', card.summary));

    const foot = el(document, 'div', 'news-card-foot');
    const place = el(
      document,
      card.placeKey ? 'button' : 'span',
      'news-card-place',
      card.place,
    );
    if (card.placeKey) {
      place.type = 'button';
      place.title = 'Show this place on the globe';
      place.addEventListener('click', () =>
        layer.selectPlace(card.placeKey, { focus: true }),
      );
    }
    const link = el(document, 'a', 'news-card-link', card.linkText);
    link.href = card.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    foot.append(place, link);
    item.append(foot);
    return item;
  }

  function render() {
    const model = buildNewsPanelModel(layer.getView(), filters, now());

    healthBtn.hidden = !model.health;
    healthBtn.dataset.state = model.healthState;
    healthBtn.setAttribute('aria-expanded', String(sourcesOpen));
    healthText.textContent = model.health;
    sourceList.hidden = !sourcesOpen || !model.sources.length;
    sourceList.replaceChildren(...renderSources(model.sources));
    staleNote.hidden = !model.stale;
    staleNote.textContent = model.stale;
    droppedBtn.hidden = model.droppedTotal === 0;
    droppedBtn.textContent = `${model.droppedTotal} items left out`;
    droppedBtn.setAttribute('aria-expanded', String(droppedOpen));
    droppedList.hidden = !droppedOpen || model.droppedTotal === 0;
    droppedList.replaceChildren(
      ...model.dropped.map(({ count, text }) =>
        el(document, 'li', 'news-dropped-row', `${count} · ${text}`),
      ),
    );

    placeChip.hidden = !model.place;
    placeChip.textContent = model.place ? `${model.place.name} ✕` : '';
    fillSelect(
      publisherSelect,
      'All publishers',
      model.publishers,
      filters.publisher,
    );
    filterRow.hidden = model.total === 0;

    empty.hidden = !model.empty;
    empty.textContent = model.empty;
    list.replaceChildren(...model.cards.map(renderCard));
    onModel(model);
  }

  healthBtn.addEventListener('click', () => {
    sourcesOpen = !sourcesOpen;
    render();
  });
  droppedBtn.addEventListener('click', () => {
    droppedOpen = !droppedOpen;
    render();
  });
  placeChip.addEventListener('click', () => layer.selectPlace(null));
  search.addEventListener('input', () => {
    filters.query = search.value;
    render();
  });
  publisherSelect.addEventListener('change', () => {
    filters.publisher = publisherSelect.value || null;
    render();
  });

  const unsubscribe = layer.subscribe(render);
  // Relative times ("3 min ago") stay true while the feed is open.
  const timer = setInterval(render, 60_000);
  render();

  return {
    render,
    /** Narrow to one automatic tag, or null for every story. */
    setCategory(category) {
      filters.category = category || null;
      render();
    },
    /** Open or close the per-source list. */
    showSources(open = true) {
      sourcesOpen = open;
      render();
    },
    destroy() {
      unsubscribe();
      clearInterval(timer);
      body.replaceChildren();
    },
  };
}
