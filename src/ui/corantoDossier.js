import { iconImage } from '../data/corantoIcons.js';

/**
 * The country sheet's panel. It draws whatever `buildDossier` returns; the
 * shell supplies the data and the actions.
 *
 * @param {object} options
 * @param {Document} options.document
 * @param {(articleId: string) => void} options.openStory
 * @param {(model: object) => void} options.showStories
 * @param {(model: object) => void} options.flyTo
 * @param {(index: number) => void} options.watch
 */
export function createDossier({
  document,
  openStory,
  showStories,
  flyTo,
  watch,
  pin = null,
  conflictBrief = null,
}) {
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const element = make('aside', 'coranto-dossier');
  element.id = 'coranto-dossier';
  element.hidden = true;
  element.setAttribute('aria-label', 'Country sheet');
  const title = make('span', 'coranto-dossier-title');
  const close = make('button', 'coranto-story-close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  const closeIcon = make('img');
  closeIcon.src = iconImage('close', '#d5d0e2');
  closeIcon.alt = '';
  close.append(closeIcon);
  const headIcon = make('img');
  headIcon.src = iconImage('geopolitics', '#b47cff');
  headIcon.alt = '';
  const head = make('div', 'coranto-story-head');
  head.append(headIcon, title, close);
  const body = make('div', 'coranto-story-body coranto-dossier-body');
  element.append(head, body);
  let current = null;

  function tool(icon, label, hint, run) {
    const button = make('button', 'coranto-story-tool');
    button.type = 'button';
    button.title = hint;
    const image = make('img');
    image.src = iconImage(icon, '#cfc8e6');
    image.alt = '';
    button.append(image, make('span', '', label));
    button.addEventListener('click', run);
    return button;
  }

  function render(model, loading) {
    current = model;
    title.textContent = `COUNTRY // ${model.title.toUpperCase()}`;
    const nodes = [];
    const tools = make('div', 'coranto-story-tools');
    if (model.stories)
      tools.append(
        tool(
          'news',
          'ITS STORIES',
          'Show this country’s stories in the feed',
          () => showStories(model),
        ),
      );
    tools.append(
      tool('target', 'FLY TO', 'Move the globe to this country', () =>
        flyTo(model),
      ),
    );
    if (model.channel)
      tools.append(
        tool(
          'broadcast',
          'NEAREST LIVE TV',
          `Open ${model.channel.label} live, here. Its newsroom is the nearest, ${model.channel.detail}. It shows that channel’s own output.`,
          () => watch(model.channel.index),
        ),
      );
    if (pin) {
      const pinned = pin.has(model);
      tools.append(
        tool(
          'plus',
          pinned ? 'PINNED' : 'PIN TO ANALYST',
          'Keep this country on the analyst board',
          () => {
            pin.toggle(model);
            render(model, loading);
          },
        ),
      );
    }
    if (conflictBrief?.has(model))
      tools.append(
        tool(
          'conflict',
          'CONFLICT BRIEF',
          'A model writes a brief of the conflict from current headlines naming this country. It is analysis, not reporting.',
          () => conflictBrief.run(model),
        ),
      );
    tools.style.setProperty('--cols', String(tools.childElementCount));
    nodes.push(tools);
    if (loading)
      nodes.push(
        make(
          'p',
          'coranto-dossier-note',
          'Reading UNHCR, the World Health Organization, the elections list and the markets…',
        ),
      );
    for (const section of model.sections) {
      const box = make('section', 'coranto-dossier-section');
      box.append(make('h3', 'coranto-dossier-heading', section.heading));
      if (section.summary)
        box.append(make('p', 'coranto-dossier-summary', section.summary));
      if (section.chips?.length) {
        const chips = make('div', 'coranto-dossier-chips');
        for (const chip of section.chips)
          chips.append(make('span', 'coranto-dossier-chip', chip));
        box.append(chips);
      }
      for (const row of section.rows ?? []) {
        let line;
        if (row.kind === 'story') {
          line = make('button', 'coranto-dossier-row coranto-dossier-story');
          line.type = 'button';
          line.title = 'Open this story';
          line.addEventListener('click', () => openStory(row.id));
        } else if (row.kind === 'link' && row.url) {
          line = make('a', 'coranto-dossier-row coranto-dossier-link');
          line.href = row.url;
          line.target = '_blank';
          line.rel = 'noopener noreferrer';
        } else line = make('div', 'coranto-dossier-row');
        line.append(make('span', 'coranto-dossier-label', row.label));
        const side = row.value ?? row.detail;
        if (side) line.append(make('span', 'coranto-dossier-value', side));
        box.append(line);
      }
      const source = section.url
        ? make('a', 'coranto-dossier-source')
        : make('p', 'coranto-dossier-source');
      source.textContent = section.source;
      if (section.url) {
        source.href = section.url;
        source.target = '_blank';
        source.rel = 'noopener noreferrer';
      }
      box.append(source);
      nodes.push(box);
    }
    body.replaceChildren(...nodes);
  }

  const api = {
    element,
    get isOpen() {
      return !element.hidden;
    },
    get current() {
      return current;
    },
    show(model, { loading = false } = {}) {
      const fresh = element.hidden || current?.iso2 !== model.iso2;
      element.hidden = false;
      render(model, loading);
      if (fresh) body.scrollTop = 0;
    },
    close() {
      element.hidden = true;
      current = null;
    },
  };
  close.addEventListener('click', api.close);
  return api;
}
