import { iconImage } from '../data/corantoIcons.js';
import { isAmbiguous, rankCommands } from './corantoCommandModel.js';

/**
 * The command palette: one box that reaches everything in NEWS and
 * INSTRUMENTS. It runs the app's own actions and nothing else; a result says
 * what it will do before it is chosen.
 *
 * @param {object} options
 * @param {Document} options.document
 * @param {(query: string) => object[]} options.getCommands Called on every
 * keystroke with the text typed, so stories and places can be searched.
 */
export function createCommandPalette({ document, getCommands }) {
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const element = make('div');
  element.id = 'coranto-palette';
  element.hidden = true;
  const panel = make('div', 'coranto-palette-panel coranto-bracket');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Search everything Coranto can do');
  const input = make('input', 'coranto-palette-input');
  input.type = 'search';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = 'Type what you want: a place, a story, a layer, a tool…';
  input.setAttribute('aria-label', 'What do you want to do or find?');
  input.setAttribute('aria-controls', 'coranto-palette-list');
  const note = make('p', 'coranto-palette-note');
  const list = make('div', 'coranto-palette-list');
  list.id = 'coranto-palette-list';
  list.setAttribute('role', 'listbox');
  const foot = make(
    'p',
    'coranto-palette-foot',
    'ARROWS to move · ENTER to run · ESC to close',
  );
  // The title is the header's SEARCH button again: the glass, then the word.
  const title = make('div', 'coranto-palette-head');
  const titleIcon = make('img');
  titleIcon.src = iconImage('search', '#e9e4f5');
  titleIcon.alt = '';
  title.append(titleIcon, make('span', '', 'SEARCH'));
  panel.append(title, input, note, list, foot);
  element.append(panel);

  let results = [];
  let active = 0;
  let lastFocus = null;

  function mark() {
    [...list.children].forEach((row, index) => {
      const on = index === active;
      row.setAttribute('aria-selected', String(on));
      if (on) row.scrollIntoView?.({ block: 'nearest' });
    });
  }

  function render() {
    const query = input.value;
    results = rankCommands(getCommands(query), query);
    active = 0;
    note.hidden = false;
    if (!results.length)
      note.textContent = 'Nothing matches. Try a place, a topic or a layer.';
    else if (isAmbiguous(results, query))
      note.textContent =
        'More than one thing fits that. Each says what it does on the right; pick the one you mean.';
    else if (!query.trim())
      note.textContent = 'Start typing, or pick something to begin.';
    else note.hidden = true;
    list.replaceChildren(
      ...results.map((command, index) => {
        const row = make('button', 'coranto-palette-row');
        row.type = 'button';
        row.setAttribute('role', 'option');
        const icon = make('img');
        icon.src = iconImage(command.icon ?? 'target', '#cfc8e6');
        icon.alt = '';
        const text = make('span', 'coranto-palette-text');
        text.append(make('span', 'coranto-palette-title', command.title));
        if (command.detail)
          text.append(make('span', 'coranto-palette-detail', command.detail));
        row.append(
          icon,
          text,
          make('span', 'coranto-palette-kind', command.kind),
        );
        row.addEventListener('click', () => run(index));
        row.addEventListener('pointermove', () => {
          if (active === index) return;
          active = index;
          mark();
        });
        return row;
      }),
    );
    mark();
  }

  function run(index) {
    const command = results[index];
    if (!command) return;
    api.close({ restoreFocus: false });
    try {
      command.run();
    } catch {
      // A command that cannot run does nothing; the app is left as it was.
    }
  }

  input.addEventListener('input', render);
  element.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!results.length) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      active = (active + step + results.length) % results.length;
      mark();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      api.close();
    }
  });
  element.addEventListener('pointerdown', (event) => {
    if (event.target === element) api.close();
  });

  const api = {
    element,
    get isOpen() {
      return !element.hidden;
    },
    open(text = '') {
      if (!element.hidden) return;
      lastFocus = document.activeElement;
      element.hidden = false;
      input.value = text;
      render();
      input.focus();
    },
    close({ restoreFocus = true } = {}) {
      if (element.hidden) return;
      element.hidden = true;
      if (restoreFocus) lastFocus?.focus?.();
    },
    toggle() {
      if (element.hidden) api.open();
      else api.close();
    },
  };
  return api;
}
