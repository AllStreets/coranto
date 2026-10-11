import { buildNewsPanelModel } from './newsPanelModel.js';

const PANEL_ID = 'news-panel';

function el(document, tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * The News panel in the right rail. It renders exactly what
 * `buildNewsPanelModel` returns: publisher headlines with their links, the
 * source-health line, and one sentence when there is nothing to show.
 *
 * @param {object} options
 * @param {Document} options.document
 * @param {{getView: Function, subscribe: Function, selectPlace: Function}} options.layer
 * @param {() => number} [options.now]
 */
export function createNewsPanel({ document, layer, now = () => Date.now() }) {
  const panel = document?.getElementById?.(PANEL_ID);
  const body = document?.getElementById?.('news-panel-body');
  const countEl = document?.getElementById?.('news-panel-count');
  if (!panel || !body) return null;

  const filters = { category: null, publisher: null };
  let appeared = false;
  let sourcesOpen = false;
  let droppedOpen = false;

  const status = el(document, 'div', 'news-status');
  const healthBtn = el(document, 'button', 'news-health');
  healthBtn.type = 'button';
  const healthDot = el(document, 'span', 'news-health-dot');
  const healthText = el(document, 'span', 'news-health-text');
  healthBtn.append(healthDot, healthText);
  const sourceList = el(document, 'ul', 'news-source-list');
  const staleNote = el(document, 'p', 'news-stale');
  const droppedBtn = el(document, 'button', 'news-dropped');
  droppedBtn.type = 'button';
  const droppedList = el(document, 'ul', 'news-dropped-list');
  status.append(healthBtn, sourceList, staleNote, droppedBtn, droppedList);

  const filterRow = el(document, 'div', 'news-filters');
  const placeChip = el(document, 'button', 'news-chip news-chip-place');
  placeChip.type = 'button';
  const categorySelect = el(document, 'select', 'news-select');
  categorySelect.setAttribute('aria-label', 'Filter by automatic tag');
  const publisherSelect = el(document, 'select', 'news-select');
  publisherSelect.setAttribute('aria-label', 'Filter by publisher');
  filterRow.append(placeChip, categorySelect, publisherSelect);

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

  function renderCard(card) {
    const item = el(document, 'li', 'news-card');
    item.dataset.articleId = card.id;
    const meta = el(document, 'div', 'news-card-meta');
    meta.append(el(document, 'span', 'news-card-publisher', card.publisher));
    const time = el(document, 'time', 'news-card-time', card.published);
    time.dateTime = card.publishedIso;
    meta.append(time);
    const title = el(document, 'h4', 'news-card-title', card.title);
    item.append(meta, title);
    if (card.summary)
      item.append(el(document, 'p', 'news-card-summary', card.summary));
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
    item.append(place);
    const foot = el(document, 'div', 'news-card-foot');
    if (card.category)
      foot.append(el(document, 'span', 'news-card-tag', card.category));
    const link = el(document, 'a', 'news-card-link', card.linkText);
    link.href = card.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    foot.append(link);
    item.append(foot);
    return item;
  }

  function render() {
    const model = buildNewsPanelModel(layer.getView(), filters, now());
    panel.hidden = !model.visible;
    if (!model.visible) return;
    if (!appeared) {
      appeared = true;
      const preference = panel.dataset?.collapsedPreference;
      if (
        panel.classList.contains('collapsed') &&
        (preference === undefined || preference === 'default')
      )
        panel
          .querySelector(`[data-collapse-target="${PANEL_ID}"]`)
          ?.click();
    }
    if (countEl) countEl.textContent = model.total ? String(model.total) : '';

    healthBtn.hidden = !model.health;
    healthBtn.dataset.state = model.healthState;
    healthBtn.setAttribute('aria-expanded', String(sourcesOpen));
    healthText.textContent = model.health;
    sourceList.hidden = !sourcesOpen || !model.sources.length;
    sourceList.replaceChildren(
      ...model.sources.map((source) => {
        const row = el(document, 'li', 'news-source');
        row.dataset.state = source.state;
        row.append(
          el(document, 'span', 'news-source-name', source.name),
          el(document, 'span', 'news-source-detail', source.detail),
        );
        return row;
      }),
    );
    staleNote.hidden = !model.stale;
    staleNote.textContent = model.stale;
    droppedBtn.hidden = model.droppedTotal === 0;
    droppedBtn.textContent = `${model.droppedTotal} items filtered out`;
    droppedBtn.setAttribute('aria-expanded', String(droppedOpen));
    droppedList.hidden = !droppedOpen || model.droppedTotal === 0;
    droppedList.replaceChildren(
      ...model.dropped.map(({ count, text }) =>
        el(document, 'li', 'news-dropped-row', `${count} · ${text}`),
      ),
    );

    placeChip.hidden = !model.place;
    placeChip.textContent = model.place ? `${model.place.name} ✕` : '';
    placeChip.title = 'Clear the place filter';
    fillSelect(categorySelect, 'All tags', model.categories, filters.category);
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
  categorySelect.addEventListener('change', () => {
    filters.category = categorySelect.value || null;
    render();
  });
  publisherSelect.addEventListener('change', () => {
    filters.publisher = publisherSelect.value || null;
    render();
  });

  const unsubscribe = layer.subscribe(render);
  // Relative times ("3 min ago") stay true while the panel is open.
  const timer = setInterval(() => {
    if (!panel.hidden) render();
  }, 60_000);
  render();

  return {
    render,
    destroy() {
      unsubscribe();
      clearInterval(timer);
      body.replaceChildren();
      panel.hidden = true;
    },
  };
}
