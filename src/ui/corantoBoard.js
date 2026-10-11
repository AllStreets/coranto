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
 * AUSPEX's entity network, in three dimensions. The forces are AUSPEX's:
 * every node drifts toward the centre, nodes push each other apart, and a
 * link pulls its two ends to a set distance, so connected items settle
 * together. Here they act in depth as well, and the graph can be turned,
 * zoomed, and pulled about by its nodes.
 *
 * The starting positions are fixed by each item's place in the list, so the
 * same board always settles the same way.
 */
export function networkNodes(assets) {
  return assets.map((asset, index) => {
    // Points spread evenly over a sphere (a Fibonacci lattice).
    const n = Math.max(1, assets.length);
    const y = n === 1 ? 0 : 1 - (2 * (index + 0.5)) / n;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = index * 2.399963;
    const radius = 60 + 22 * Math.sqrt(n);
    return {
      key: asset.key,
      label: asset.title.slice(0, 22),
      x: Math.cos(angle) * ring * radius,
      y: y * radius,
      z: Math.sin(angle) * ring * radius,
      vx: 0,
      vy: 0,
      vz: 0,
      held: false,
    };
  });
}

/** How far a node may drift from the centre. */
export const NETWORK_REACH = 420;

/** One step of the simulation, with AUSPEX's constants, about the origin. */
export function networkStep(nodes, edges) {
  for (const node of nodes) {
    node.vx = node.vx * 0.86 - node.x * 0.003;
    node.vy = node.vy * 0.86 - node.y * 0.003;
    node.vz = node.vz * 0.86 - node.z * 0.003;
  }
  for (let a = 0; a < nodes.length; a++)
    for (let b = a + 1; b < nodes.length; b++) {
      const dx = nodes[b].x - nodes[a].x;
      const dy = nodes[b].y - nodes[a].y;
      const dz = nodes[b].z - nodes[a].z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.1;
      const force = Math.min(5000 / (distance * distance), 10) / distance;
      nodes[a].vx -= dx * force;
      nodes[a].vy -= dy * force;
      nodes[a].vz -= dz * force;
      nodes[b].vx += dx * force;
      nodes[b].vy += dy * force;
      nodes[b].vz += dz * force;
    }
  for (const edge of edges) {
    const a = nodes[edge.i];
    const b = nodes[edge.j];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.1;
    const force = ((distance - 140) * 0.055) / distance;
    a.vx += dx * force;
    a.vy += dy * force;
    a.vz += dz * force;
    b.vx -= dx * force;
    b.vy -= dy * force;
    b.vz -= dz * force;
  }
  for (const node of nodes) {
    // A node being held stays where the hand put it; the rest respond.
    if (node.held) {
      node.vx = node.vy = node.vz = 0;
      continue;
    }
    node.x += node.vx;
    node.y += node.vy;
    node.z += node.vz;
    const far = Math.sqrt(node.x * node.x + node.y * node.y + node.z * node.z);
    if (far > NETWORK_REACH) {
      const pull = NETWORK_REACH / far;
      node.x *= pull;
      node.y *= pull;
      node.z *= pull;
    }
  }
}

const FOCAL = 620;
/** Up to this many links, every line carries its name. */
const LABEL_ALL_UP_TO = 9;

/** Turn a point by the view's yaw and pitch. */
export function networkRotate(point, yaw, pitch) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const x = point.x * cy + point.z * sy;
  const z1 = -point.x * sy + point.z * cy;
  return { x, y: point.y * cp - z1 * sp, z: point.y * sp + z1 * cp };
}

/** The reverse turn: a movement on the screen back into the graph's space. */
export function networkUnrotate(point, yaw, pitch) {
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const y = point.y * cp + point.z * sp;
  const z1 = -point.y * sp + point.z * cp;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  return { x: point.x * cy - z1 * sy, y, z: point.x * sy + z1 * cy };
}

/** Where a point lands on the canvas, and how large things there appear. */
export function networkProject(point, view, width, height) {
  const turned = networkRotate(point, view.yaw, view.pitch);
  const scale = (FOCAL / (FOCAL + turned.z)) * view.zoom;
  return {
    x: width / 2 + turned.x * scale,
    y: height / 2 + turned.y * scale,
    scale,
    depth: turned.z,
  };
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

  // The running graph, and how the reader is looking at it.
  let graph = null;
  let frameId = null;
  const view = { yaw: 0.5, pitch: -0.28, zoom: 1 };
  let fitted = false; // the reader has set the zoom
  let pointer = null;
  let hovered = null;

  const spot = (event) => {
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  const nodeAt = (at) => {
    if (!graph) return null;
    let best = null;
    let bestDistance = 18;
    for (const node of graph.nodes) {
      const p = networkProject(node, view, graph.width, graph.height);
      const distance = Math.hypot(p.x - at.x, p.y - at.y);
      if (distance < Math.max(bestDistance, 0) && distance < 12 * p.scale + 8) {
        best = node;
        bestDistance = distance;
      }
    }
    return best;
  };
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      fitted = true;
      view.zoom = Math.max(
        0.3,
        Math.min(5, view.zoom * (event.deltaY > 0 ? 0.9 : 1.1)),
      );
    },
    { passive: false },
  );
  canvas.addEventListener('pointerdown', (event) => {
    const at = spot(event);
    const node = nodeAt(at);
    pointer = { last: at, node };
    if (node) node.held = true;
    canvas.setPointerCapture?.(event.pointerId);
    canvas.style.cursor = node ? 'grabbing' : 'move';
    event.preventDefault();
  });
  canvas.addEventListener('pointermove', (event) => {
    const at = spot(event);
    if (!pointer) {
      hovered = nodeAt(at);
      canvas.style.cursor = hovered ? 'grab' : 'move';
      return;
    }
    const dx = at.x - pointer.last.x;
    const dy = at.y - pointer.last.y;
    pointer.last = at;
    if (pointer.node) {
      // Move the held node in the plane facing the reader, at its own depth.
      const p = networkProject(pointer.node, view, graph.width, graph.height);
      const shift = networkUnrotate(
        { x: dx / p.scale, y: dy / p.scale, z: 0 },
        view.yaw,
        view.pitch,
      );
      pointer.node.x += shift.x;
      pointer.node.y += shift.y;
      pointer.node.z += shift.z;
    } else {
      view.yaw += dx * 0.008;
      view.pitch = Math.max(-1.45, Math.min(1.45, view.pitch - dy * 0.008));
    }
  });
  const release = () => {
    if (pointer?.node) pointer.node.held = false;
    pointer = null;
    canvas.style.cursor = 'move';
  };
  for (const type of ['pointerup', 'pointercancel', 'pointerleave'])
    canvas.addEventListener(type, release);

  function stopNetwork() {
    if (frameId !== null) win?.cancelAnimationFrame?.(frameId);
    frameId = null;
  }

  function paintNetwork() {
    const { nodes, edges, assets, width, height, context, ratio } = graph;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    // Until the reader zooms, the graph is fitted to the panel.
    if (!fitted && nodes.length > 1) {
      let wide = 40;
      let tall = 40;
      for (const node of nodes) {
        const p = networkProject(node, { ...view, zoom: 1 }, 0, 0);
        wide = Math.max(wide, Math.abs(p.x));
        tall = Math.max(tall, Math.abs(p.y));
      }
      const fit = Math.min(
        3.2,
        (width / 2 - 58) / wide,
        (height / 2 - 46) / tall,
      );
      view.zoom += (fit - view.zoom) * 0.06;
    }

    // A floor grid under the graph, so depth and turning are easy to read.
    const floor = 190;
    context.lineWidth = 0.6;
    for (let k = -4; k <= 4; k++) {
      const fade = 0.34 - Math.abs(k) * 0.05;
      context.strokeStyle = `rgba(120,96,190,${Math.max(0.06, fade)})`;
      for (const [from, to] of [
        [
          { x: k * 80, y: floor, z: -320 },
          { x: k * 80, y: floor, z: 320 },
        ],
        [
          { x: -320, y: floor, z: k * 80 },
          { x: 320, y: floor, z: k * 80 },
        ],
      ]) {
        const a = networkProject(from, view, width, height);
        const b = networkProject(to, view, width, height);
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
      }
    }

    const at = nodes.map((node) => networkProject(node, view, width, height));
    // Nearer things are brighter; farther ones fade.
    const near = (depth) => Math.max(0.28, Math.min(1, 1 - depth / 620));

    const order = edges
      .map((edge) => ({
        edge,
        depth: (at[edge.i].depth + at[edge.j].depth) / 2,
      }))
      .sort((a, b) => b.depth - a.depth);
    for (const { edge, depth } of order) {
      const a = at[edge.i];
      const b = at[edge.j];
      const light = near(depth);
      const pulse =
        (0.32 + Math.sin(graph.frame * 0.025 + edge.i) * 0.14) * light;
      const colour = edge.cross ? '255,159,10' : '180,124,255';
      const scale = (a.scale + b.scale) / 2;
      // A soft wide stroke under a sharp one, so the link glows.
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.strokeStyle = `rgba(${colour},${pulse * 0.35})`;
      context.lineWidth = (5 + edge.strength * 1.2) * scale;
      context.stroke();
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.strokeStyle = `rgba(${colour},${pulse + 0.18 * light})`;
      context.lineWidth = (0.9 + edge.strength * 0.45) * scale;
      context.stroke();
      // With many links, a name on every line is unreadable: name only the
      // lines of the node under the pointer.
      const focus = pointer?.node ?? hovered;
      if (
        edges.length <= LABEL_ALL_UP_TO ||
        (focus && (nodes[edge.i] === focus || nodes[edge.j] === focus))
      ) {
        context.font = `600 ${Math.max(7.5, 8.5 * Math.min(1.5, scale))}px "IBM Plex Mono", monospace`;
        context.fillStyle = edge.cross
          ? `rgba(255,190,90,${0.95 * light})`
          : `rgba(212,186,255,${0.95 * light})`;
        context.textAlign = 'center';
        context.fillText(
          edge.label.toUpperCase(),
          (a.x + b.x) / 2,
          (a.y + b.y) / 2 - 5,
        );
      }
    }

    const drawOrder = nodes
      .map((node, index) => index)
      .sort((a, b) => at[b].depth - at[a].depth);
    for (const index of drawOrder) {
      const node = nodes[index];
      const p = at[index];
      const light = near(p.depth);
      const colour = colourOf(assets[index]);
      const radius = 9.5 * p.scale * (node.held ? 1.25 : 1);
      // A stem down to the floor shows where the node is in depth.
      const foot = networkProject(
        { x: node.x, y: floor, z: node.z },
        view,
        width,
        height,
      );
      context.beginPath();
      context.moveTo(p.x, p.y);
      context.lineTo(foot.x, foot.y);
      context.strokeStyle = `rgba(160,140,220,${0.16 * light})`;
      context.lineWidth = 0.8;
      context.stroke();
      const glow = context.createRadialGradient(
        p.x,
        p.y,
        0,
        p.x,
        p.y,
        radius * 2.6,
      );
      glow.addColorStop(0, `${colour}${node.held ? 'aa' : '66'}`);
      glow.addColorStop(1, 'transparent');
      context.globalAlpha = light;
      context.beginPath();
      context.arc(p.x, p.y, radius * 2.6, 0, Math.PI * 2);
      context.fillStyle = glow;
      context.fill();
      // A lit sphere: lighter toward the upper left.
      const ball = context.createRadialGradient(
        p.x - radius * 0.35,
        p.y - radius * 0.4,
        radius * 0.1,
        p.x,
        p.y,
        radius,
      );
      ball.addColorStop(0, '#ffffff');
      ball.addColorStop(0.28, colour);
      ball.addColorStop(1, `${colour}cc`);
      context.beginPath();
      context.arc(p.x, p.y, radius, 0, Math.PI * 2);
      context.fillStyle = ball;
      context.fill();
      context.strokeStyle = 'rgba(255,255,255,0.3)';
      context.lineWidth = 1.2;
      context.stroke();
      context.font = `700 ${Math.max(7, 9 * p.scale)}px "IBM Plex Mono", monospace`;
      context.fillStyle = '#07060c';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(String(index + 1), p.x, p.y + 0.5);
      context.textBaseline = 'alphabetic';
      context.font = `${Math.max(7.5, 8.5 * Math.min(1.4, p.scale))}px "IBM Plex Mono", monospace`;
      context.fillStyle = 'rgba(200,192,226,0.92)';
      context.fillText(node.label, p.x, p.y + radius + 13);
      context.globalAlpha = 1;
    }
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
    const same =
      (graph?.assets ?? []).map((a) => a.key).join() ===
      assets.map((a) => a.key).join();
    // A different set of items is a new picture: fit it afresh.
    if (!same) fitted = false;
    // Keep settled positions when the same items are redrawn.
    const before = new Map(
      (graph?.nodes ?? []).map((node) => [node.key, node]),
    );
    const nodes = networkNodes(assets).map((node) =>
      before.has(node.key)
        ? {
            ...node,
            x: before.get(node.key).x,
            y: before.get(node.key).y,
            z: before.get(node.key).z,
          }
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
      for (let i = 0; i < 400; i++) networkStep(graph.nodes, graph.edges);
      fitted = false;
      for (let i = 0; i < 80; i++) paintNetwork();
      return;
    }
    const loop = () => {
      if (element.hidden || !graph) return;
      networkStep(graph.nodes, graph.edges);
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
  return `${head}. A line joins two items that mention the same name, shown on the line. Violet: same topic. Amber: across topics. Drag the space to turn it, scroll to zoom, and drag a node to pull it: the ones linked to it stretch and follow. Point at a node to name its links.`;
}
