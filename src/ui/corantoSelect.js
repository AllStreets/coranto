import { iconImage } from '../data/corantoIcons.js';

/**
 * Coranto's own drop-down, in place of the browser's. The real `<select>`
 * stays in the page as the value everything else reads and listens to; this
 * draws a button in the shared style and a list that opens directly under
 * it, at the same width and in the interface's own type.
 *
 * @param {HTMLSelectElement} select
 * @param {object} options
 * @param {Document} options.document
 * @param {Window} options.win
 * @returns {{element: HTMLElement, refresh: () => void, close: () => void, destroy: () => void}}
 */
export function enhanceSelect(select, { document, win }) {
  const make = (tag, className) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  };
  const wrap = make('div', 'coranto-select');
  const button = make('button', 'coranto-select-button');
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  const label = make('span', 'coranto-select-label');
  const chevron = make('img');
  chevron.src = iconImage('chevronDown', '#8d86a3');
  chevron.alt = '';
  button.append(label, chevron);
  const menu = make('div', 'coranto-select-menu');
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  select.before(wrap);
  wrap.append(button, select);
  // The list hangs off the page, not the feed, so the feed cannot clip it.
  document.body.append(menu);
  select.classList.add('coranto-select-native');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  function refresh() {
    wrap.hidden = select.hidden;
    button.disabled = select.disabled;
    const chosen = select.options[select.selectedIndex];
    label.replaceChildren(chosen?.textContent ?? '');
    const name = select.getAttribute('aria-label') ?? '';
    button.setAttribute('aria-label', name);
    menu.setAttribute('aria-label', name);
    button.title = select.title;
    if (!menu.hidden) build();
  }
  function build() {
    menu.replaceChildren(
      ...[...select.options].map((option) => {
        const row = make('button', 'coranto-select-option');
        row.type = 'button';
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', String(option.selected));
        row.dataset.value = option.value;
        row.append(option.textContent);
        row.addEventListener('click', () => choose(option.value));
        return row;
      }),
    );
  }
  function place() {
    const box = button.getBoundingClientRect();
    const below = win.innerHeight - box.bottom - 12;
    const above = box.top - 12;
    // Directly under the button; above it only where there is no room below.
    const up = below < 140 && above > below;
    menu.style.left = `${Math.round(box.left)}px`;
    menu.style.width = `${Math.round(box.width)}px`;
    menu.style.maxHeight = `${Math.round(Math.max(120, Math.min(320, up ? above : below)))}px`;
    menu.style.top = up ? '' : `${Math.round(box.bottom + 4)}px`;
    menu.style.bottom = up
      ? `${Math.round(win.innerHeight - box.top + 4)}px`
      : '';
  }
  function open() {
    if (!menu.hidden) return;
    build();
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    place();
    (
      menu.querySelector('[aria-selected="true"]') ?? menu.firstElementChild
    )?.focus({ preventScroll: true });
    // Bring the chosen row into the list's own view, moving nothing else.
    const chosen = menu.querySelector('[aria-selected="true"]');
    if (chosen)
      menu.scrollTop = Math.max(
        0,
        chosen.offsetTop - menu.clientHeight / 2 + chosen.offsetHeight / 2,
      );
  }
  function close({ focus = false } = {}) {
    if (menu.hidden) return;
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (focus) button.focus({ preventScroll: true });
  }
  function choose(value) {
    const changed = select.value !== value;
    select.value = value;
    close({ focus: true });
    refresh();
    if (changed)
      select.dispatchEvent(new win.Event('change', { bubbles: true }));
  }
  button.addEventListener('click', () => (menu.hidden ? open() : close()));
  button.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open();
    }
  });
  menu.addEventListener('keydown', (event) => {
    const rows = [...menu.children];
    const at = rows.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      rows[Math.max(0, Math.min(rows.length - 1, at + step))]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      rows[event.key === 'Home' ? 0 : rows.length - 1]?.focus();
    } else if (event.key === 'Escape') {
      // Close this list only; whatever else is open stays as it is.
      event.preventDefault();
      event.stopPropagation();
      close({ focus: true });
    } else if (event.key === 'Tab') close();
  });
  const onOutside = (event) => {
    if (menu.hidden) return;
    if (wrap.contains(event.target) || menu.contains(event.target)) return;
    close();
  };
  // The feed scrolling under an open list would leave it hanging.
  const onScroll = (event) => {
    if (!menu.hidden && !menu.contains(event.target)) close();
  };
  document.addEventListener('pointerdown', onOutside);
  document.addEventListener('scroll', onScroll, true);
  win.addEventListener('resize', close);
  // The options change as the feed does (publishers, languages).
  const observer = win.MutationObserver
    ? new win.MutationObserver(refresh)
    : null;
  observer?.observe(select, {
    childList: true,
    attributes: true,
    attributeFilter: ['hidden', 'title', 'aria-label', 'disabled'],
  });
  refresh();

  return {
    element: wrap,
    select,
    /** The label, when code has set the value without a change event. */
    sync() {
      const chosen = select.options[select.selectedIndex];
      const text = chosen?.textContent ?? '';
      if (label.textContent !== text || wrap.hidden !== select.hidden)
        refresh();
    },
    refresh,
    close,
    destroy() {
      observer?.disconnect();
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('scroll', onScroll, true);
      win.removeEventListener('resize', close);
      menu.remove();
    },
  };
}

/**
 * Every drop-down on the page, now and later, in Coranto's style: the news
 * view's, the analyst board's and the control room's alike. The engine
 * builds and rebuilds its panels as it goes, so new ones are picked up as
 * they appear and ones that have gone are cleaned up.
 *
 * @param {object} options
 * @param {Document} options.document
 * @param {Window} options.win
 * @returns {() => void} Stop, and put nothing back.
 */
export function enhanceAllSelects({ document, win }) {
  if (!win.MutationObserver) return () => {};
  const live = new Map();
  const adopt = (root) => {
    const found =
      root.tagName === 'SELECT'
        ? [root]
        : [...(root.querySelectorAll?.('select') ?? [])];
    for (const select of found) {
      // A list box (several rows shown, or several choices) is left alone.
      if (live.has(select) || select.multiple || select.size > 1) continue;
      live.set(select, enhanceSelect(select, { document, win }));
    }
  };
  adopt(document.body);
  const observer = new win.MutationObserver((records) => {
    for (const record of records)
      for (const node of record.addedNodes)
        if (node.nodeType === 1 && !node.classList?.contains('coranto-select'))
          adopt(node);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  // Code sets a select's value without telling anyone; keep labels true, and
  // let go of selects the page has thrown away.
  const timer = win.setInterval(() => {
    for (const [select, entry] of live) {
      if (!select.isConnected) {
        entry.destroy();
        live.delete(select);
      } else entry.sync();
    }
  }, 600);
  return () => {
    observer.disconnect();
    win.clearInterval(timer);
    for (const entry of live.values()) entry.destroy();
    live.clear();
  };
}
