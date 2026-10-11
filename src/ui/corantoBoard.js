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

/**
 * AUSPEX's entity network, copied: a force-directed graph on a faint grid.
 * Every node drifts toward the centre, nodes push each other apart, and a
 * link pulls its two ends to a set distance, so connected items settle
 * together. Links pulse; each carries the name it rests on.
 *
 * The starting positions are fixed by each item's place in the list, so the
 * same board always settles the same way.
 */
export function networkNodes(assets, width, height) {
  return assets.map((asset, index) => {
    // A golden-angle spiral: spread out, never two on the same spot.
    const angle = index * 2.399963;
    const reach = 0.12 + 0.16 * Math.sqrt(index + 1);
    return {
      key: asset.key,
      label: asset.title.slice(0, 22),
      x: width / 2 + Math.cos(angle) * width * Math.min(0.42, reach),
      y: height / 2 + Math.sin(angle) * height * Math.min(0.42, reach),
      vx: 0,
      vy: 0,
    };
  });
}

/** One step of the simulation, with AUSPEX's constants. */
export function networkStep(nodes, edges, width, height) {
  for (const node of nodes) {
    node.vx *= 0.86;
    node.vy *= 0.86;
    node.vx += (width / 2 - node.x) * 0.003;
    node.vy += (height / 2 - node.y) * 0.003;
  }
  for (let a = 0; a < nodes.length; a++)
    for (let b = a + 1; b < nodes.length; b++) {
      const dx = nodes[b].x - nodes[a].x;
      const dy = nodes[b].y - nodes[a].y;
      const distance = Math.sqrt(dx * dx + dy * dy) + 0.1;
      const force = Math.min(5000 / (distance * distance), 10);
      nodes[a].vx -= (dx / distance) * force;
      nodes[a].vy -= (dy / distance) * force;
      nodes[b].vx += (dx / distance) * force;
      nodes[b].vy += (dy / distance) * force;
    }
  for (const edge of edges) {
    const dx = nodes[edge.j].x - nodes[edge.i].x;
    const dy = nodes[edge.j].y - nodes[edge.i].y;
    const distance = Math.sqrt(dx * dx + dy * dy) + 0.1;
    const force = (distance - 140) * 0.055;
    nodes[edge.i].vx += (dx / distance) * force;
    nodes[edge.i].vy += (dy / distance) * force;
    nodes[edge.j].vx -= (dx / distance) * force;
    nodes[edge.j].vy -= (dy / distance) * force;
  }
  for (const node of nodes) {
    node.x = Math.max(40, Math.min(width - 40, node.x + node.vx));
    node.y = Math.max(40, Math.min(height - 40, node.y + node.vy));
  }
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

  // The running graph: what is simulated, and the reader's zoom and pan.
  let graph = null;
  let frameId = null;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let drag = null;
  let touched = false;
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      touched = true;
      zoom = Math.max(0.3, Math.min(4, zoom * (event.deltaY > 0 ? 0.9 : 1.1)));
    },
    { passive: false },
  );
  canvas.addEventListener('mousedown', (event) => {
    touched = true;
    drag = { sx: event.clientX, sy: event.clientY, px: panX, py: panY };
  });
  canvas.addEventListener('mousemove', (event) => {
    if (!drag) return;
    panX = drag.px + event.clientX - drag.sx;
    panY = drag.py + event.clientY - drag.sy;
  });
  for (const type of ['mouseup', 'mouseleave'])
    canvas.addEventListener(type, () => {
      drag = null;
    });

  function stopNetwork() {
    if (frameId !== null) win?.cancelAnimationFrame?.(frameId);
    frameId = null;
  }

  function paintNetwork() {
    const { nodes, edges, assets, width, height, context, ratio } = graph;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    // Until the reader zooms or drags, the graph is fitted to the panel.
    if (!touched && nodes.length > 1) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const node of nodes) {
        minX = Math.min(minX, node.x);
        maxX = Math.max(maxX, node.x);
        minY = Math.min(minY, node.y);
        maxY = Math.max(maxY, node.y);
      }
      const fit = Math.min(
        2.4,
        (width - 150) / Math.max(60, maxX - minX),
        (height - 110) / Math.max(60, maxY - minY),
      );
      // Ease toward the fit so the view does not jump as the graph settles.
      zoom += (fit - zoom) * 0.08;
      panX += ((width / 2 - (minX + maxX) / 2) * zoom - panX) * 0.08;
      panY += ((height / 2 - (minY + maxY) / 2) * zoom - panY) * 0.08;
    }
    context.save();
    context.translate(width / 2 + panX, height / 2 + panY);
    context.scale(zoom, zoom);
    context.translate(-width / 2, -height / 2);

    context.strokeStyle = 'rgba(22,18,40,0.9)';
    context.lineWidth = 0.5;
    for (let x = 0; x < width; x += 40) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    for (const edge of edges) {
      const pulse = 0.3 + Math.sin(graph.frame * 0.025 + edge.i) * 0.14;
      const a = nodes[edge.i];
      const b = nodes[edge.j];
      const colour = edge.cross ? '255,159,10' : '180,124,255';
      // A soft wide stroke under a sharp one, so the link glows.
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.strokeStyle = `rgba(${colour},${pulse * 0.35})`;
      context.lineWidth = 5 + edge.strength * 1.2;
      context.stroke();
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.strokeStyle = `rgba(${colour},${pulse + (edge.cross ? 0.2 : 0.15)})`;
      context.lineWidth = 0.9 + edge.strength * 0.45;
      context.stroke();
      context.font = '600 8.5px "IBM Plex Mono", monospace';
      context.fillStyle = edge.cross
        ? 'rgba(255,190,90,0.95)'
        : 'rgba(212,186,255,0.95)';
      context.textAlign = 'center';
      context.fillText(
        edge.label.toUpperCase(),
        (a.x + b.x) / 2,
        (a.y + b.y) / 2 - 5,
      );
    }

    nodes.forEach((node, index) => {
      const colour = colourOf(assets[index]);
      const glow = context.createRadialGradient(
        node.x,
        node.y,
        0,
        node.x,
        node.y,
        24,
      );
      glow.addColorStop(0, `${colour}66`);
      glow.addColorStop(1, 'transparent');
      context.beginPath();
      context.arc(node.x, node.y, 24, 0, Math.PI * 2);
      context.fillStyle = glow;
      context.fill();
      context.beginPath();
      context.arc(node.x, node.y, 9.5, 0, Math.PI * 2);
      context.fillStyle = colour;
      context.fill();
      context.strokeStyle = 'rgba(255,255,255,0.3)';
      context.lineWidth = 1.2;
      context.stroke();
      context.font = '700 9px "IBM Plex Mono", monospace';
      context.fillStyle = '#07060c';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(String(index + 1), node.x, node.y + 0.5);
      context.textBaseline = 'alphabetic';
      context.font = '8.5px "IBM Plex Mono", monospace';
      context.fillStyle = 'rgba(200,192,226,0.92)';
      context.fillText(node.label, node.x, node.y + 24);
    });
    context.restore();
  }

  function drawNetwork(assets, links) {
    stopNetwork();
    const ratio = win?.devicePixelRatio || 1;
    const width = canvas.clientWidth || 320;
    const height = canvas.clientHeight || 320;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext?.('2d');
    if (!context) return;
    const index = new Map(assets.map((asset, i) => [asset.key, i]));
    // A different set of items is a new picture: fit it afresh.
    if (
      (graph?.assets ?? []).map((a) => a.key).join() !==
      assets.map((a) => a.key).join()
    ) {
      touched = false;
    }
    // Keep settled positions when the same items are redrawn.
    const before = new Map(
      (graph?.nodes ?? []).map((node) => [node.key, node]),
    );
    const nodes = networkNodes(assets, width, height).map((node) =>
      before.has(node.key)
        ? { ...node, x: before.get(node.key).x, y: before.get(node.key).y }
        : node,
    );
    graph = {
      assets,
      nodes,
      edges: links.map((link) => ({
        i: index.get(link.a),
        j: index.get(link.b),
        strength: link.terms.length,
        label: link.terms[0],
        cross: !link.sameTopic,
      })),
      width,
      height,
      context,
      ratio,
      frame: 0,
    };
    const still = win?.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    )?.matches;
    if (still || !win?.requestAnimationFrame) {
      // No motion: settle the layout at once and draw it a single time.
      for (let i = 0; i < 400; i++)
        networkStep(graph.nodes, graph.edges, width, height);
      paintNetwork();
      return;
    }
    const loop = () => {
      if (element.hidden || !graph) return;
      networkStep(graph.nodes, graph.edges, graph.width, graph.height);
      paintNetwork();
      graph.frame++;
      frameId = win.requestAnimationFrame(loop);
    };
    loop();
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
      stopNetwork();
    },
    render,
    destroy() {
      stopNetwork();
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
  const head = `${items} ${items === 1 ? 'NODE' : 'NODES'} · ${links} ${links === 1 ? 'CONNECTION' : 'CONNECTIONS'}`;
  if (!links)
    return `${head}. No two pinned items mention the same name, so nothing is linked yet.`;
  return `${head}. A line joins two items that mention the same name, shown on the line. Violet: same topic. Amber: across topics. Scroll to zoom, drag to move.`;
}
