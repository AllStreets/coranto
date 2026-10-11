import { NEWS_LANGUAGES } from '../sources/news/registry.js';
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
  fetchImpl = (...args) => globalThis.fetch(...args),
}) {
  if (!document?.createElement || !body) return null;

  const filters = {
    category: null,
    publisher: null,
    query: '',
    grouped: true,
  };
  const openStories = new Set();
  /** storyId -> { status: 'loading'|'done'|'off'|'error', data? } */
  const briefs = new Map();

  async function requestBrief(storyId) {
    briefs.set(storyId, { status: 'loading' });
    render();
    try {
      const response = await fetchImpl('/api/news/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) briefs.set(storyId, { status: 'error' });
      else if (data.available === false) briefs.set(storyId, { status: 'off' });
      else briefs.set(storyId, { status: 'done', data });
    } catch {
      briefs.set(storyId, { status: 'error' });
    }
    render();
  }

  function renderBrief(storyId) {
    const state = briefs.get(storyId);
    const box = el(document, 'div', 'news-brief');
    box.dataset.status = state.status;
    box.append(
      el(
        document,
        'div',
        'news-brief-label',
        'AI-WRITTEN · CHECKED AGAINST THE SOURCES',
      ),
    );
    if (state.status === 'loading') {
      box.append(
        el(document, 'p', 'news-brief-note', 'Reading the outlets’ headlines…'),
      );
      return box;
    }
    if (state.status === 'off') {
      box.append(
        el(
          document,
          'p',
          'news-brief-note',
          'AI briefs need an OpenAI key in .env. They are optional.',
        ),
      );
      return box;
    }
    if (state.status === 'error') {
      box.append(
        el(
          document,
          'p',
          'news-brief-note',
          'The brief could not be written. Nothing is shown.',
        ),
      );
      return box;
    }
    const { data } = state;
    const sourceByNumber = new Map(
      data.sources.map((source) => [source.n, source]),
    );
    const cite = (n) => {
      const source = sourceByNumber.get(n);
      const link = el(document, 'a', 'news-brief-cite', String(n));
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = `${source.publisher}: ${source.title}`;
      return link;
    };
    if (!data.supported) {
      box.append(
        el(
          document,
          'p',
          'news-brief-note',
          'Nothing the model wrote could be matched to the sources, so nothing is shown.',
        ),
      );
    }
    if (data.sentences.length) {
      const text = el(document, 'p', 'news-brief-text');
      for (const sentence of data.sentences) {
        text.append(`${sentence.text} `);
        for (const n of sentence.cites) text.append(cite(n));
        text.append(' ');
      }
      box.append(text);
    }
    if (data.claims.length) {
      const claims = el(document, 'ul', 'news-brief-claims');
      for (const claim of data.claims) {
        const row = el(document, 'li', 'news-brief-claim');
        row.dataset.outlets = claim.outlets > 1 ? 'several' : 'one';
        const tag = el(
          document,
          'span',
          'news-brief-count',
          claim.outlets > 1 ? `${claim.outlets} OUTLETS` : '1 OUTLET',
        );
        const body = el(
          document,
          'span',
          'news-brief-claim-text',
          `${claim.text} `,
        );
        for (const n of claim.cites) body.append(cite(n));
        row.append(tag, body);
        claims.append(row);
      }
      box.append(claims);
    }
    const removed =
      data.removed > 0
        ? `${data.removed} ${data.removed === 1 ? 'statement' : 'statements'} removed: not supported by the cited sources. `
        : '';
    box.append(
      el(
        document,
        'p',
        'news-brief-foot',
        `${removed}Written by ${data.model} from ${data.sources.length} headlines. Numbers link to the articles.`,
      ),
    );
    return box;
  }
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
  const languageSelect = el(document, 'select', 'news-select');
  languageSelect.setAttribute('aria-label', 'Language');
  languageSelect.title =
    'Headlines are shown in their original language; Coranto does not translate them.';
  filterRow.append(search, placeChip, languageSelect, publisherSelect);

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
    if (card.lang) {
      const langTag = el(
        document,
        'span',
        'news-card-lang',
        card.lang.toUpperCase(),
      );
      langTag.title = `In ${NEWS_LANGUAGES[card.lang] ?? card.lang}, as published`;
      meta.append(langTag);
    }
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

    if (card.outletsText) {
      const open = openStories.has(card.storyId);
      const more = el(
        document,
        'button',
        'news-card-outlets',
        `${card.outletsText} · ${card.others.length + 1} headlines`,
      );
      more.type = 'button';
      more.title =
        'Grouped automatically by shared headline words. Show every headline.';
      more.setAttribute('aria-expanded', String(open));
      more.addEventListener('click', () => {
        if (open) openStories.delete(card.storyId);
        else openStories.add(card.storyId);
        render();
      });
      for (const row of card.differing ?? []) {
        const note = el(document, 'p', 'news-card-differ');
        note.title =
          'Read from the headlines. Coranto does not judge which is right; later reports often carry higher counts.';
        note.append(
          el(
            document,
            'span',
            'news-card-differ-label',
            `FIGURES DIFFER · ${row.what.toUpperCase()}`,
          ),
          ` ${row.text}`,
        );
        item.append(note);
      }
      const actions = el(document, 'div', 'news-card-actions');
      actions.append(more);
      if (card.outlets > 1) {
        const briefButton = el(
          document,
          'button',
          'news-card-brief',
          briefs.has(card.storyId) ? 'HIDE BRIEF' : 'AI BRIEF',
        );
        briefButton.type = 'button';
        briefButton.title =
          'An AI summary of these outlets’ headlines. Every sentence cites its sources and unsupported sentences are removed.';
        briefButton.addEventListener('click', () => {
          if (briefs.has(card.storyId)) {
            briefs.delete(card.storyId);
            render();
          } else requestBrief(card.storyId);
        });
        actions.append(briefButton);
      }
      item.append(actions);
      if (briefs.has(card.storyId)) item.append(renderBrief(card.storyId));
      if (open) {
        if (card.coverage?.length) {
          const coverage = el(document, 'div', 'news-card-coverage');
          coverage.append(
            el(
              document,
              'span',
              'news-card-coverage-label',
              'OUTLETS BY REGION',
            ),
          );
          for (const row of card.coverage) {
            const chip = el(document, 'span', 'news-card-region', row.text);
            chip.dataset.state = row.state;
            chip.title = row.title;
            coverage.append(chip);
          }
          item.append(coverage);
        }
        const others = el(document, 'ul', 'news-card-others');
        for (const other of card.others) {
          const row = el(document, 'li', 'news-card-other');
          const otherLink = el(document, 'a', '', other.title);
          otherLink.href = other.url;
          otherLink.target = '_blank';
          otherLink.rel = 'noopener noreferrer';
          row.append(
            el(
              document,
              'span',
              'news-card-other-meta',
              `${other.publisher} · ${other.published}`,
            ),
            otherLink,
          );
          others.append(row);
        }
        item.append(others);
      }
    }

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
    const languageOptions = [new Option('All languages', '')];
    for (const { value, count } of model.languages)
      languageOptions.push(
        new Option(`${NEWS_LANGUAGES[value] ?? value} (${count})`, value),
      );
    languageSelect.replaceChildren(...languageOptions);
    languageSelect.value = model.language ?? '';
    languageSelect.hidden = model.languages.length < 2;
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
  languageSelect.addEventListener('change', () =>
    layer.setLanguage(languageSelect.value || null),
  );
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
    /** The feed's own filters: search words, topic and publisher. */
    getFilters() {
      return {
        query: filters.query,
        category: filters.category,
        publisher: filters.publisher,
      };
    },
    /** Replace the feed's own filters, as when a saved watch is opened. */
    setFilters({ query = '', category = null, publisher = null } = {}) {
      filters.query = query;
      filters.category = category;
      filters.publisher = publisher;
      search.value = query;
      render();
    },
    /** Keep stories carrying any of these words; an empty list clears it. */
    setAny(words = []) {
      filters.any = [...words];
      render();
    },
    /** Set only the search words. */
    setQuery(query = '') {
      filters.query = query;
      search.value = query;
      render();
    },
    /** Group headlines into stories, or list every headline. */
    setGrouped(grouped) {
      filters.grouped = Boolean(grouped);
      render();
    },
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
