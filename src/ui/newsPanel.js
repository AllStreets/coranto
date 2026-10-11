import { TOPIC_COLOURS, iconImage, markerImage } from '../data/corantoIcons.js';
import { NEWS_LANGUAGES } from '../sources/news/registry.js';
import { buildNewsPanelModel } from './newsPanelModel.js';

/** Cards drawn at once; the rest are one click away. */
const PAGE_SIZE = 60;

/** Time ranges offered in the feed. */
const RANGE_LABELS = [
  [24, 'Last 24 hours'],
  [72, 'Last 3 days'],
  [168, 'Last 7 days'],
];

export const CATEGORY_CODE = {
  geopolitics: 'GEO',
  technology: 'TEC',
  military: 'MIL',
  finance: 'FIN',
  climate: 'CLM',
};

/** The strip at the top of a story: what it is and where it was placed. */
function storyWhere(place) {
  if (!place) return 'STORY // NO LOCATION';
  return `STORY // ${place.name.toUpperCase()} · ${place.precision.toUpperCase()}`;
}

/** Coordinates and the reason for the placement, or that there is none. */
function storyPlaced(card, place) {
  if (!place) return card.place;
  const part = (value, pos, neg) =>
    `${Math.abs(value).toFixed(3)}°${value >= 0 ? pos : neg}`;
  return `${part(place.lat, 'N', 'S')} ${part(place.lon, 'E', 'W')} · ${card.place}`;
}

/** Why a brief shows nothing, in one sentence. */
function emptyBriefText(data) {
  if (data.reason === 'unreadable')
    return 'The model’s reply could not be read, so nothing is shown.';
  const n = data.removed;
  return n > 0
    ? `The model wrote ${n} ${n === 1 ? 'statement' : 'statements'}, and each had a name or figure that is not in the headlines it cited. None is shown.`
    : 'The model wrote nothing that could be checked against the headlines, so nothing is shown.';
}

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
    const retry = () => {
      const button = el(document, 'button', 'news-brief-retry', 'Try again');
      button.type = 'button';
      button.addEventListener('click', () => requestBrief(storyId));
      return button;
    };
    if (state.status === 'error') {
      box.append(
        el(
          document,
          'p',
          'news-brief-note',
          'The brief could not be written. Nothing is shown.',
        ),
        retry(),
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
        el(document, 'p', 'news-brief-note', emptyBriefText(data)),
        retry(),
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
  const rangeSelect = el(document, 'select', 'news-select');
  rangeSelect.setAttribute('aria-label', 'Time range');
  rangeSelect.title =
    'How far back to show. Coranto keeps a week of headlines from every source.';
  for (const [hours, label] of RANGE_LABELS)
    rangeSelect.append(new Option(label, String(hours)));
  rangeSelect.addEventListener('change', () =>
    layer.setRangeHours?.(Number(rangeSelect.value)),
  );
  filterRow.append(
    search,
    placeChip,
    rangeSelect,
    languageSelect,
    publisherSelect,
  );

  const more = el(document, 'button', 'news-more');
  more.type = 'button';
  let shownLimit = PAGE_SIZE;
  const empty = el(document, 'p', 'news-empty');
  const list = el(document, 'ol', 'news-list');
  list.setAttribute('aria-label', 'Headlines');
  body.replaceChildren(status, filterRow, empty, list, more);

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
    title.title = 'Open this story here';
    // A plain click opens the story in the app. The link itself still
    // works for a new tab, and the publisher link stays in the card's foot.
    title.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button)
        return;
      event.preventDefault();
      openStory(card.storyId ?? card.id);
    });
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

  // ── Story pop-up ─────────────────────────────────────────────────
  // One story, opened in the app: what the publisher said, where it was
  // placed, and the tools that work on it. The publisher's link is inside.
  const story = el(document, 'aside', 'coranto-story');
  story.id = 'coranto-story';
  story.setAttribute('aria-label', 'Story');
  story.hidden = true;
  document.body.append(story);
  /** storyId or article id of the open story, and which sections are open. */
  let storyKey = null;
  let lastPlaceKey = null;
  let storyCard = null;
  const storyOpen = new Set();
  let speaking = false;
  const speech = () => document.defaultView?.speechSynthesis ?? null;

  function stopSpeaking() {
    speech()?.cancel();
    speaking = false;
  }

  function closeStory() {
    storyKey = null;
    storyCard = null;
    storyOpen.clear();
    stopSpeaking();
    story.hidden = true;
  }

  function openStory(key) {
    if (storyKey !== key) {
      storyOpen.clear();
      stopSpeaking();
    }
    storyKey = key;
    render();
  }

  function toolButton(icon, label, { active = false, title = '' } = {}) {
    const button = el(document, 'button', 'coranto-story-tool');
    button.type = 'button';
    if (title) button.title = title;
    button.setAttribute('aria-pressed', String(active));
    const image = el(document, 'img');
    image.src = iconImage(icon, active ? '#b47cff' : '#cfc8e6');
    image.alt = '';
    button.append(image, el(document, 'span', '', label));
    return button;
  }

  function renderStory(cards) {
    if (!storyKey) return;
    // The story may have left the feed (a filter, a refresh); keep showing
    // what was opened rather than closing under the reader.
    storyCard =
      cards.find((card) => (card.storyId ?? card.id) === storyKey) ?? storyCard;
    const card = storyCard;
    if (!card) return closeStory();
    const topic = card.goodNews ? 'good' : card.categoryId || 'news';
    const colour = TOPIC_COLOURS[topic] ?? TOPIC_COLOURS.news;
    const place = card.placeKey
      ? (layer.getView().places ?? []).find((p) => p.key === card.placeKey)
      : null;

    const head = el(document, 'div', 'coranto-story-head');
    const mark = el(document, 'img');
    mark.src = markerImage({
      icon: topic,
      colour,
      approximate: Boolean(place && place.precision !== 'city'),
    });
    mark.alt = '';
    const close = el(document, 'button', 'coranto-story-close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close this story');
    const closeIcon = el(document, 'img');
    closeIcon.src = iconImage('close', '#d5d0e2');
    closeIcon.alt = '';
    close.append(closeIcon);
    close.addEventListener('click', closeStory);
    head.append(
      mark,
      el(document, 'span', 'coranto-story-where', storyWhere(place)),
      el(document, 'span', 'coranto-story-count', card.outletsText ?? ''),
      close,
    );

    const body = el(document, 'div', 'coranto-story-body');
    const meta = el(document, 'div', 'news-card-meta');
    const code = el(
      document,
      'span',
      'news-card-code',
      card.goodNews ? 'GOOD' : (CATEGORY_CODE[card.categoryId] ?? 'NEWS'),
    );
    code.style.color = colour;
    const time = el(document, 'time', 'news-card-time', card.published);
    time.dateTime = card.publishedIso;
    meta.append(
      code,
      el(document, 'span', 'news-card-publisher', card.publisher),
      time,
    );
    body.append(meta, el(document, 'h3', 'coranto-story-title', card.title));
    if (card.summary)
      body.append(el(document, 'p', 'coranto-story-summary', card.summary));

    const tools = el(document, 'div', 'coranto-story-tools');
    const toggle = (name) => () => {
      if (storyOpen.has(name)) storyOpen.delete(name);
      else storyOpen.add(name);
      render();
    };
    if (card.outlets > 1) {
      const brief = toolButton('news', 'AI BRIEF', {
        active: briefs.has(card.storyId),
        title:
          'An AI summary of these outlets’ headlines. Every sentence cites its sources and unsupported sentences are removed.',
      });
      brief.addEventListener('click', () => {
        if (briefs.has(card.storyId)) {
          briefs.delete(card.storyId);
          render();
        } else requestBrief(card.storyId);
      });
      const who = toolButton('outlets', 'WHO COVERED', {
        active: storyOpen.has('who'),
        title:
          'Every outlet’s own headline for this story, and which regions carried it',
      });
      who.addEventListener('click', toggle('who'));
      tools.append(brief, who);
    }
    if (card.differing?.length) {
      const figures = toolButton('figures', 'FIGURES', {
        active: storyOpen.has('figures'),
        title: 'Where the outlets’ headline figures differ',
      });
      figures.addEventListener('click', toggle('figures'));
      tools.append(figures);
    }
    if (card.placeKey) {
      const fly = toolButton('target', 'FLY TO', {
        title: 'Move the globe to where this story was placed',
      });
      fly.addEventListener('click', () =>
        layer.selectPlace(card.placeKey, { focus: true }),
      );
      tools.append(fly);
    }
    if (speech()) {
      const listen = toolButton('speaker', speaking ? 'STOP' : 'LISTEN', {
        active: speaking,
        title:
          'Read the headline and summary aloud with your device’s own voice',
      });
      listen.addEventListener('click', () => {
        if (speaking) stopSpeaking();
        else {
          const Utterance = document.defaultView.SpeechSynthesisUtterance;
          const utterance = new Utterance(
            `${card.publisher}. ${card.title}. ${card.summary ?? ''}`,
          );
          if (card.lang) utterance.lang = card.lang;
          utterance.onend = () => {
            speaking = false;
            render();
          };
          speaking = true;
          speech().speak(utterance);
        }
        render();
      });
      tools.append(listen);
    }
    if (tools.childElementCount) body.append(tools);

    if (card.storyId && briefs.has(card.storyId))
      body.append(renderBrief(card.storyId));
    if (storyOpen.has('figures'))
      for (const row of card.differing ?? []) {
        const note = el(document, 'p', 'news-card-differ');
        note.append(
          el(
            document,
            'span',
            'news-card-differ-label',
            `FIGURES DIFFER · ${row.what.toUpperCase()}`,
          ),
          ` ${row.text}`,
        );
        body.append(note);
      }
    if (storyOpen.has('who')) {
      if (card.coverage?.length) {
        const coverage = el(document, 'div', 'news-card-coverage');
        coverage.append(
          el(document, 'span', 'news-card-coverage-label', 'OUTLETS BY REGION'),
        );
        for (const row of card.coverage) {
          const chip = el(document, 'span', 'news-card-region', row.text);
          chip.dataset.state = row.state;
          chip.title = row.title;
          coverage.append(chip);
        }
        body.append(coverage);
      }
      const others = el(document, 'ul', 'news-card-others');
      for (const other of card.others ?? []) {
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
      body.append(others);
    }

    const foot = el(document, 'div', 'coranto-story-foot');
    const read = el(document, 'a', 'coranto-story-read');
    read.href = card.url;
    read.target = '_blank';
    read.rel = 'noopener noreferrer';
    const readIcon = el(document, 'img');
    readIcon.src = iconImage('link', '#b47cff');
    readIcon.alt = '';
    read.append(
      el(document, 'span', '', card.linkText.replace(/^Open/, 'Read')),
      readIcon,
    );
    foot.append(el(document, 'span', '', storyPlaced(card, place)), read);
    body.append(foot);

    story.replaceChildren(head, body);
    story.hidden = false;
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
    rangeSelect.value = String(
      layer.getView().rangeHours ?? RANGE_LABELS[0][0],
    );
    languageSelect.hidden = model.languages.length < 2;
    filterRow.hidden = model.total === 0;

    empty.hidden = !model.empty;
    empty.textContent = model.empty;
    // Draw a page at a time: hundreds of cards on every keystroke is slow.
    const visible = model.cards.slice(0, shownLimit);
    list.replaceChildren(...visible.map(renderCard));
    const remaining = model.cards.length - visible.length;
    more.hidden = remaining <= 0;
    more.textContent = `Show ${Math.min(PAGE_SIZE, remaining)} more of ${remaining}`;
    onModel(model);
    // Selecting a place that has a single story opens that story.
    const placeKey = layer.getView().selectedPlaceKey ?? null;
    if (placeKey !== lastPlaceKey) {
      lastPlaceKey = placeKey;
      if (placeKey && model.cards?.length === 1)
        storyKey = model.cards[0].storyId ?? model.cards[0].id;
    }
    renderStory(model.cards ?? []);
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
    shownLimit = PAGE_SIZE;
    render();
  });
  search.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !search.value) return;
    event.stopPropagation();
    search.value = '';
    filters.query = '';
    render();
  });
  more.addEventListener('click', () => {
    shownLimit += PAGE_SIZE;
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
    /** Open one story in the app, by story id or article id. */
    openStory,
    closeStory,
    /** True while a story is open. */
    get storyOpen() {
      return storyKey !== null;
    },
    /** Put the cursor in the search box. */
    focusSearch() {
      search.focus();
      search.select();
    },
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
      closeStory();
      story.remove();
      unsubscribe();
      clearInterval(timer);
      body.replaceChildren();
    },
  };
}
