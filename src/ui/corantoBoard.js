import { TOPIC_COLOURS, iconImage, markerImage } from '../data/corantoIcons.js';
import {
  boardLinks,
  boardText,
  buildSynthesis,
  buildTimeline,
} from './corantoBoardModel.js';

/**
 * The analyst board's panel: what is pinned, how the items connect, and the
 * brief and timeline computed from them. See corantoBoardModel.js for the
 * rules; this file only draws.
 */

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

const KIND_ICON = { country: 'geopolitics', city: 'target' };
const LEVEL_TEXT = {
  high: 'much written',
  medium: 'some written',
  low: 'little written',
};
const topicOf = (asset) =>
  asset.kind === 'story' ? asset.category || 'news' : KIND_ICON[asset.kind];
const colourOf = (asset) =>
  asset.kind === 'story'
    ? (TOPIC_COLOURS[asset.category] ?? TOPIC_COLOURS.news)
    : '#7fb6cf';

/** Lay the items out on a ring, linked ones pulled a little together. */
export function networkLayout(assets, links, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.max(20, Math.min(width, height) / 2 - 46);
  const nodes = assets.map((asset, index) => {
    const angle =
      (index / Math.max(1, assets.length)) * Math.PI * 2 - Math.PI / 2;
    return {
      key: asset.key,
      x: assets.length === 1 ? cx : cx + Math.cos(angle) * radius,
      y: assets.length === 1 ? cy : cy + Math.sin(angle) * radius,
    };
  });
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  // A fixed number of small steps: the same board always draws the same way.
  for (let step = 0; step < 60; step++)
    for (const link of links) {
      const a = byKey.get(link.a);
      const b = byKey.get(link.b);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance < 110) continue;
      const pull = 0.012;
      a.x += dx * pull;
      a.y += dy * pull;
      b.x -= dx * pull;
      b.y -= dy * pull;
    }
  return nodes;
}

/**
 * @param {object} options
 * @param {Document} options.document
 * @param {object} options.store From `createBoardStore`.
 * @param {() => object[]} options.getArticles Current headlines.
 * @param {(asset: object) => void} options.onOpen Open a pinned item.
 * @param {() => void} options.onChange Called when the board changes.
 */
export function createBoard({
  document,
  store,
  getArticles,
  onOpen,
  onChange,
}) {
  const win = document.defaultView;
  let tab = 'brief';
  let showSaved = false;
  let note = '';

  const count = el(document, 'span', { class: 'coranto-story-count' });
  const closeButton = el(
    document,
    'button',
    {
      type: 'button',
      class: 'coranto-story-close',
      'aria-label': 'Close the board',
    },
    el(document, 'img', { src: iconImage('close', '#d5d0e2'), alt: '' }),
  );
  const actions = el(document, 'div', { class: 'coranto-board-actions' });
  const noteLine = el(document, 'p', {
    class: 'coranto-board-note',
    role: 'status',
  });
  const pinned = el(document, 'div', { class: 'coranto-board-list' });
  const canvas = el(document, 'canvas', {
    class: 'coranto-board-canvas',
    'aria-label': 'How the pinned items connect',
  });
  const legend = el(document, 'p', { class: 'coranto-board-legend' });
  const tabs = el(document, 'div', {
    class: 'coranto-money-tabs',
    role: 'group',
  });
  const output = el(document, 'div', { class: 'coranto-board-output' });
  const column = (label, ...children) =>
    el(
      document,
      'section',
      { class: 'coranto-board-col' },
      el(document, 'div', { class: 'coranto-strip', text: label }),
      ...children,
    );
  const element = el(
    document,
    'div',
    { id: 'coranto-board', role: 'dialog', 'aria-label': 'Analyst board' },
    el(
      document,
      'div',
      { class: 'coranto-board-card' },
      el(
        document,
        'div',
        { class: 'coranto-story-head' },
        el(document, 'img', { src: iconImage('key', '#b47cff'), alt: '' }),
        el(document, 'span', {
          class: 'coranto-story-where',
          text: 'ANALYST BOARD // PINNED ITEMS',
        }),
        count,
        closeButton,
      ),
      actions,
      noteLine,
      el(
        document,
        'div',
        { class: 'coranto-board-cols' },
        column('PINNED', pinned),
        column('CONNECTIONS', canvas, legend),
        column('WORKED OUT FROM THE PINS', tabs, output),
      ),
    ),
  );
  element.hidden = true;

  const button = (label, onClick, { disabled = false, title = '' } = {}) => {
    const node = el(document, 'button', {
      type: 'button',
      class: 'coranto-board-btn',
      text: label,
      ...(title ? { title } : {}),
    });
    if (disabled) node.dataset.empty = 'true';
    node.addEventListener('click', onClick);
    return node;
  };

  function drawNetwork(assets, links) {
    const ratio = win?.devicePixelRatio || 1;
    const width = canvas.clientWidth || 320;
    const height = canvas.clientHeight || 320;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext?.('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const nodes = networkLayout(assets, links, width, height);
    const at = new Map(nodes.map((node) => [node.key, node]));
    for (const link of links) {
      const a = at.get(link.a);
      const b = at.get(link.b);
      context.strokeStyle = link.sameTopic
        ? 'rgba(180,124,255,0.75)'
        : 'rgba(255,159,10,0.7)';
      context.lineWidth = Math.min(3, 0.8 + link.terms.length * 0.6);
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
      context.fillStyle = 'rgba(207,200,230,0.85)';
      context.font = '600 9px "IBM Plex Mono", monospace';
      context.textAlign = 'center';
      context.fillText(
        link.terms.slice(0, 2).join(' · '),
        (a.x + b.x) / 2,
        (a.y + b.y) / 2 - 3,
      );
    }
    assets.forEach((asset, index) => {
      const node = at.get(asset.key);
      context.fillStyle = '#07060c';
      context.strokeStyle = colourOf(asset);
      context.lineWidth = 2;
      context.beginPath();
      context.arc(node.x, node.y, 11, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = colourOf(asset);
      context.font = '700 10px "IBM Plex Mono", monospace';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(String(index + 1), node.x, node.y + 0.5);
      context.textBaseline = 'alphabetic';
    });
  }

  function render() {
    if (element.hidden) return;
    const assets = store.list();
    const articles = getArticles();
    const links = boardLinks(assets);
    count.textContent = `${assets.length} PINNED`;

    actions.replaceChildren(
      button('Save this board', () => {
        const board = store.save();
        note = saveNote(board);
        showSaved = Boolean(board);
        render();
      }),
      button(
        showSaved
          ? 'Hide saved boards'
          : `Saved boards · ${store.saved().length}`,
        () => {
          showSaved = !showSaved;
          render();
        },
      ),
      button('Copy as text', async () => {
        let ok = false;
        try {
          await win.navigator.clipboard.writeText(
            boardText(assets, articles, Date.now()),
          );
          ok = true;
        } catch {
          ok = false;
        }
        note = copyNote(ok, assets.length);
        render();
      }),
      button('Clear the board', () => {
        store.clear();
        note = '';
        render();
      }),
    );
    noteLine.textContent = note;
    noteLine.hidden = !note;

    const rows = [];
    if (showSaved) {
      const saved = store.saved();
      rows.push(
        el(document, 'div', {
          class: 'coranto-rail-heading',
          text: saved.length ? 'SAVED BOARDS' : 'NO SAVED BOARDS YET',
        }),
      );
      for (const board of saved) {
        const open = el(document, 'button', {
          type: 'button',
          class: 'coranto-watch',
          title: 'Replace the board with this saved one',
        });
        open.append(
          el(document, 'span', {
            class: 'coranto-watch-name',
            text: board.title,
          }),
          el(document, 'span', {
            class: 'coranto-watch-count',
            text: `${board.assets.length} · ${new Date(board.savedAt).toISOString().slice(0, 10)}`,
          }),
        );
        open.addEventListener('click', () => {
          store.load(board.id);
          showSaved = false;
          note = loadedNote(board.title);
          render();
        });
        const remove = el(
          document,
          'button',
          {
            type: 'button',
            class: 'coranto-watch-remove',
            'aria-label': `Delete the saved board ${board.title}`,
          },
          el(document, 'img', { src: iconImage('close', '#a9a2bf'), alt: '' }),
        );
        remove.addEventListener('click', () => {
          store.deleteSaved(board.id);
          render();
        });
        rows.push(
          el(document, 'div', { class: 'coranto-watch-row' }, open, remove),
        );
      }
    }
    const brief = buildSynthesis(assets, articles);
    brief.items.forEach(({ asset, count: related, level }, index) => {
      const open = el(document, 'button', {
        type: 'button',
        class: 'coranto-board-item',
        title: asset.kind === 'story' ? 'Open this story' : 'Show this place',
      });
      open.style.setProperty('--tag', colourOf(asset));
      open.append(
        el(document, 'span', {
          class: 'coranto-board-num',
          text: String(index + 1),
        }),
        el(document, 'img', {
          src: markerImage({ icon: topicOf(asset), colour: colourOf(asset) }),
          alt: '',
        }),
        el(
          document,
          'span',
          { class: 'coranto-board-body' },
          el(document, 'span', {
            class: 'coranto-board-title',
            text: asset.title,
          }),
          el(document, 'span', {
            class: 'coranto-board-meta',
            text: [
              asset.kind === 'story' ? asset.publisher : asset.kind,
              asset.place,
              `${related} related · ${LEVEL_TEXT[level]}`,
            ]
              .filter(Boolean)
              .join(' · '),
          }),
        ),
      );
      open.addEventListener('click', () => onOpen(asset));
      const remove = el(
        document,
        'button',
        {
          type: 'button',
          class: 'coranto-watch-remove',
          'aria-label': `Unpin ${asset.title}`,
        },
        el(document, 'img', { src: iconImage('close', '#a9a2bf'), alt: '' }),
      );
      remove.addEventListener('click', () => store.remove(asset.key));
      rows.push(
        el(document, 'div', { class: 'coranto-watch-row' }, open, remove),
      );
    });
    if (!assets.length)
      rows.push(
        el(document, 'p', {
          class: 'coranto-power-none',
          text: 'Nothing is pinned. Open a story and press PIN TO BOARD, or switch on Countries or Cities under MAP OVERLAYS, select one and pin it.',
        }),
      );
    pinned.replaceChildren(...rows);

    drawNetwork(assets, links);
    legend.textContent = networkLegend(assets.length, links.length);

    tabs.replaceChildren(
      ...[
        ['brief', 'Brief'],
        ['timeline', 'Timeline'],
      ].map(([id, label]) => {
        const node = el(document, 'button', {
          type: 'button',
          class: 'coranto-money-tab',
          'aria-pressed': String(tab === id),
          text: label,
        });
        node.addEventListener('click', () => {
          tab = id;
          render();
        });
        return node;
      }),
    );
    const out = [];
    if (!assets.length)
      out.push(
        el(document, 'p', {
          class: 'coranto-power-none',
          text: 'Pin something to see a brief.',
        }),
      );
    else if (tab === 'brief') {
      out.push(
        el(document, 'p', {
          class: 'coranto-board-summary',
          text: brief.summary,
        }),
      );
      const chips = (label, values) => {
        if (!values.length) return;
        const row = el(document, 'div', { class: 'coranto-board-chips' });
        row.append(
          el(document, 'span', { class: 'coranto-rail-heading', text: label }),
        );
        for (const value of values)
          row.append(
            el(document, 'span', { class: 'coranto-board-chip', text: value }),
          );
        out.push(row);
      };
      chips('ENTITIES IN COMMON LIST', brief.entities);
      chips('PLACES', brief.places);
      chips(
        'TOPICS',
        brief.topics.map((topic) => topic.toUpperCase()),
      );
      out.push(
        el(document, 'p', {
          class: 'coranto-power-foot',
          text: 'Worked out from the pinned items and current headlines by fixed rules; not written by a model. "Related" counts other headlines sharing three or more long words: it shows how much is being written, not whether a story is true.',
        }),
      );
    } else {
      const days = buildTimeline(assets, articles);
      if (!days.length)
        out.push(
          el(document, 'p', {
            class: 'coranto-power-none',
            text: 'No current headline shares two or more key words with the pinned items.',
          }),
        );
      for (const { day, items } of days) {
        out.push(
          el(document, 'div', { class: 'coranto-rail-heading', text: day }),
        );
        for (const item of items) {
          const link = el(document, 'a', {
            class: 'coranto-board-line',
            href: item.url,
            target: '_blank',
            rel: 'noopener noreferrer',
          });
          link.style.setProperty(
            '--tag',
            TOPIC_COLOURS[item.category] ?? TOPIC_COLOURS.news,
          );
          link.append(
            el(document, 'span', { text: item.title }),
            el(document, 'small', {
              text: `${item.publisher} · ${String(item.publishedAt).slice(11, 16)} UTC`,
            }),
          );
          out.push(link);
        }
      }
    }
    output.replaceChildren(...out);
  }

  const unsubscribe = store.subscribe(() => {
    onChange();
    render();
  });
  const api = {
    element,
    get isOpen() {
      return !element.hidden;
    },
    open() {
      element.hidden = false;
      note = '';
      render();
      closeButton.focus({ preventScroll: true });
    },
    close() {
      element.hidden = true;
    },
    render,
    destroy() {
      unsubscribe();
      element.remove();
    },
  };
  closeButton.addEventListener('click', api.close);
  element.addEventListener('click', (event) => {
    if (event.target === element) api.close();
  });
  return api;
}

function saveNote(board) {
  return board
    ? `Saved as ${board.title}. It is kept in this browser.`
    : 'There is nothing pinned to save.';
}
function copyNote(ok, n) {
  if (!n) return 'There is nothing pinned to copy.';
  return ok
    ? 'Copied the board as text.'
    : 'Copying was blocked by the browser.';
}
function loadedNote(title) {
  return `Loaded ${title}.`;
}
function networkLegend(items, links) {
  if (!items) return '';
  if (!links)
    return 'No two pinned items mention the same entity from the common list, so nothing is linked.';
  return 'A line joins two items that mention the same entity. Violet: same topic. Amber: different topics. Numbers match the pinned list.';
}
