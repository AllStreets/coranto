/**
 * The analyst board, ported from AUSPEX's `js/analyst.js` and `index.html`
 * (Apache-2, Connor Evans): the full-screen overlay with its asset board,
 * entity network and intelligence brief, and the tools it opens: consensus,
 * adversary playbook, red team, narrative timeline, dead reckoning,
 * escalation matrix, saved boards, and the daily and conflict briefs.
 *
 * Markup, wording and behaviour follow AUSPEX. Differences, all deliberate:
 * every class has a `ca-` prefix; the accent is violet; icons stand where
 * AUSPEX used text symbols; text from the feed or a model is escaped before
 * it is placed; and what a model wrote says so underneath.
 */
import { iconImage } from '../data/corantoIcons.js';
import {
  ANALYST_PERSONAS,
  MARKINGS,
  MATRIX_COLOURS,
  MATRIX_DOMAINS,
  PROMPTS,
  articleToStory,
  boardTitleFor,
  briefBlocks,
  buildAssetContext,
  cardBadge,
  computeTrajectory,
  confidenceFor,
  conflictStories,
  consensusStats,
  deadReckoning,
  domainColour,
  domainLabel,
  esc,
  escalationColour,
  escalationMatrix,
  escalationOf,
  graphEdges,
  isPlaybookHeader,
  isRedTeamHeader,
  matrixRisk,
  parseAnalyst,
  replyLines,
  searchStories,
  stepGraph,
  storyPin,
  synthesisParts,
  timelineFor,
  toStory,
} from './corantoAnalystModel.js';

const VIOLET = '#b47cff';
const AI_NOTE =
  'WRITTEN BY A MODEL FROM THE ITEMS PINNED. IT IS ANALYSIS, NOT REPORTING, AND IS NOT CHECKED AGAINST ANY SOURCE.';
const MATRIX_HINT =
  '<div style="padding:8px 0 2px;font-family:var(--font-mono);font-size:7px;letter-spacing:.12em;color:var(--text-dim)">CLICK ANY CELL TO VIEW RELEVANT STORIES</div>';

const ic = (name, colour = VIOLET) =>
  `<img class="ca-ic" src="${iconImage(name, colour)}" alt="">`;

const SKELETON = `
<div id="ca-analyst-overlay">
  <div class="ca-am-bar">
    <span class="ca-am-wordmark">${ic('diamond')}CORANTO ANALYST</span>
    <span class="ca-am-status-line" data-ref="status"></span>
    <div class="ca-am-bar-acts">
      <button type="button" class="ca-am-save-btn" data-act="save">SAVE</button>
      <button type="button" class="ca-am-export-brief-btn" data-act="export-brief">EXPORT BRIEF</button>
      <button type="button" class="ca-am-synth-btn-bar" data-act="synthesize">SYNTHESIZE</button>
      <button type="button" class="ca-am-consensus-btn" data-act="consensus">CONSENSUS</button>
      <div class="ca-am-tools-wrap" data-ref="toolsWrap">
        <button type="button" class="ca-am-tools-btn" data-ref="toolsBtn" data-act="tools" aria-expanded="false">TOOLS</button>
        <div class="ca-am-tools-menu" data-ref="toolsMenu">
          <button type="button" data-act="playbook">${ic('chevronRight', '#9aa3c0')}ADVERSARY PLAYBOOK</button>
          <button type="button" data-act="redteam">${ic('hex', '#9aa3c0')}RED TEAM</button>
          <button type="button" data-act="timeline">${ic('clock', '#9aa3c0')}NARRATIVE TIMELINE</button>
          <button type="button" id="ca-dr-tools-btn" data-ref="drBtn" data-act="reckoning">${ic('target', '#9aa3c0')}DEAD RECKONING</button>
          <button type="button" data-act="matrix">${ic('grid', '#9aa3c0')}ESCALATION MATRIX</button>
          <button type="button" data-act="saved">${ic('diamond', '#9aa3c0')}SAVED BOARDS</button>
          <button type="button" data-act="daily">${ic('news', '#9aa3c0')}DAILY BRIEF</button>
        </div>
      </div>
      <div class="ca-am-bar-sep"></div>
      <button type="button" class="ca-am-act ca-danger" data-act="clear">CLEAR BOARD</button>
      <button type="button" class="ca-am-close-btn" data-act="exit">EXIT ANALYST</button>
    </div>
  </div>
  <div class="ca-am-body">
    <div class="ca-am-col">
      <div class="ca-am-col-hdr">
        <span class="ca-am-col-title">${ic('diamond')}ASSET BOARD</span>
        <span class="ca-am-col-meta" data-ref="colMeta">PIN STORIES FROM FEED</span>
      </div>
      <div class="ca-am-hist-bar">
        <input class="ca-am-hist-inp" data-ref="histInput" placeholder="Search the headlines held (7 days)…" aria-label="Search the headlines held">
        <select class="ca-am-hist-sel" data-ref="histCat" aria-label="Domain">
          <option value="">ALL DOMAINS</option>
          <option value="geo">GEO</option>
          <option value="military">MIL</option>
          <option value="finance">FIN</option>
          <option value="climate">CLM</option>
          <option value="tech">TECH</option>
        </select>
      </div>
      <div class="ca-am-hist-results" data-ref="histResults" style="display:none"></div>
      <div class="ca-am-asset-scroll" data-ref="assetScroll"></div>
    </div>
    <div class="ca-am-col" style="position:relative">
      <div class="ca-am-col-hdr">
        <span class="ca-am-col-title">${ic('diamond')}ENTITY NETWORK</span>
        <span class="ca-am-col-meta" data-ref="netMeta">NO CONNECTIONS</span>
      </div>
      <canvas id="ca-am-canvas" data-ref="canvas"></canvas>
      <div class="ca-am-net-empty" data-ref="netEmpty">PIN ASSETS TO REVEAL<br>ENTITY CONNECTIONS</div>
      <button type="button" id="ca-am-net-reset" data-ref="netReset" data-act="net-reset" title="Reset view">${ic('target')}RESET</button>
    </div>
    <div class="ca-am-col">
      <div class="ca-am-col-hdr">
        <span class="ca-am-col-title">${ic('diamond')}INTELLIGENCE BRIEF</span>
        <span class="ca-am-col-meta" data-ref="briefMeta">—</span>
      </div>
      <div class="ca-am-brief-scroll" data-ref="briefScroll"></div>
    </div>
  </div>
</div>

<div id="ca-playbook-modal">
  <div class="ca-pb-bar">
    <span class="ca-pb-wordmark">${ic('chevronRight')}ADVERSARY PLAYBOOK</span>
    <span id="ca-pb-status" data-ref="pbStatus">READY · SELECT ASSETS AND GENERATE</span>
    <button type="button" class="ca-pb-act" data-act="playbook-generate">GENERATE PLAYBOOK</button>
    <button type="button" class="ca-pb-act" data-ref="pbExport" data-act="playbook-export" style="display:none">EXPORT HTML</button>
    <button type="button" class="ca-pb-close-btn" data-act="playbook-exit">EXIT</button>
  </div>
  <div class="ca-pb-body"><div id="ca-pb-content" data-ref="pbContent"><div class="ca-pb-loading ca-pb-loading-anim">PIN ASSETS TO ANALYST BOARD · THEN GENERATE PLAYBOOK</div></div></div>
</div>

<div id="ca-sb-bd" data-ref="sbBd" data-act="saved-exit"></div>
<div id="ca-sb-modal" data-ref="sbModal">
  <div class="ca-sb-bar">
    <span class="ca-sb-wordmark">${ic('diamond')}SAVED ANALYST BOARDS</span>
    <button type="button" class="ca-sb-close-btn" data-act="saved-exit">EXIT</button>
  </div>
  <div class="ca-sb-body" data-ref="sbBody"></div>
</div>

<div id="ca-matrix-bd" data-ref="mxBd" data-act="matrix-exit"></div>
<div id="ca-matrix-modal" data-ref="mxModal">
  <div class="ca-mx-bar">
    <span class="ca-mx-wordmark">${ic('grid')}CROSS-DOMAIN ESCALATION MATRIX</span>
    <span data-ref="mxTs" style="font-family:var(--font-mono);font-size:7px;letter-spacing:.1em;color:var(--text-dim);flex:1"></span>
    <button type="button" class="ca-mx-act" data-ref="mxRecalc" data-act="matrix-recalc">RECALCULATE</button>
    <button type="button" class="ca-mx-close-btn" data-act="matrix-exit">EXIT</button>
  </div>
  <div class="ca-mx-body">
    <div data-ref="mxContent"></div>
    <div id="ca-mx-story-panel" data-ref="mxPanel"></div>
    <div class="ca-mx-legend">
      <span style="color:#FF2D55">${ic('square', '#FF2D55')}CRITICAL</span>
      <span style="color:#FF9F0A">${ic('square', '#FF9F0A')}HIGH</span>
      <span style="color:#B7950B">${ic('square', '#B7950B')}ELEVATED</span>
      <span style="color:rgba(100,100,140,.55)">${ic('square', '#64648c')}LOW</span>
      <span class="ca-mx-leg-note">· diagonal = within-domain intensity · off-diagonal = cross-domain coupling</span>
    </div>
  </div>
</div>

<div id="ca-timeline-bd" data-ref="tlBd" data-act="timeline-exit"></div>
<div id="ca-timeline-modal" data-ref="tlModal">
  <div class="ca-tl-bar">
    <span class="ca-tl-wordmark">${ic('clock')}NARRATIVE TIMELINE</span>
    <span id="ca-tl-status" data-ref="tlStatus">—</span>
    <button type="button" class="ca-tl-close-btn" data-act="timeline-exit">EXIT</button>
  </div>
  <div class="ca-tl-body"><div data-ref="tlContent"></div></div>
</div>

<div id="ca-redteam-modal" data-ref="rtModal">
  <div class="ca-rt-bar">
    <span class="ca-rt-wordmark">${ic('diamond', '#ff1744')}CORANTO RED TEAM</span>
    <span id="ca-rt-status" data-ref="rtStatus">READY · SELECT ASSETS AND GENERATE</span>
    <button type="button" class="ca-rt-act" data-act="redteam-generate">GENERATE BRIEF</button>
    <button type="button" class="ca-rt-act" data-ref="rtExport" data-act="redteam-export" style="display:none">EXPORT HTML</button>
    <button type="button" class="ca-rt-close-btn" data-act="redteam-exit">EXIT</button>
  </div>
  <div class="ca-rt-body">
    <div id="ca-rt-content" data-ref="rtContent">
      <div class="ca-rt-loading ca-rt-loading-anim">PIN ASSETS TO ANALYST BOARD · THEN CLICK GENERATE BRIEF</div>
    </div>
  </div>
</div>

<div id="ca-brief-bd" data-ref="bmBd" data-act="brief-exit"></div>
<div id="ca-brief-modal" data-ref="bmModal">
  <div class="ca-bm-hdr">
    <div class="ca-bm-title-block">
      <div class="ca-bm-eyebrow">CORANTO INTELLIGENCE NETWORK</div>
      <div class="ca-bm-title" data-ref="bmTitle">DAILY SITUATION REPORT</div>
      <div class="ca-bm-date" data-ref="bmDate"></div>
    </div>
    <button type="button" class="ca-bm-close" data-act="brief-exit" aria-label="Close">${ic('close', '#aab2cc')}</button>
  </div>
  <div class="ca-bm-body" data-ref="bmBody"><div class="ca-bm-loading">ASSEMBLING BRIEF…</div></div>
  <div class="ca-bm-footer">
    <span class="ca-bm-meta" data-ref="bmMeta"></span>
    <button type="button" class="ca-bm-export-btn" data-act="brief-export">EXPORT HTML</button>
  </div>
</div>`;

const BRIEF_EMPTY = `<div class="ca-am-brief-empty">PIN ASSETS AND CLICK SYNTHESIZE<br>TO GENERATE INTELLIGENCE BRIEF<button type="button" class="ca-am-synth-btn" data-act="synthesize">SYNTHESIZE NOW</button></div>`;

/**
 * @param {object} options
 * @param {Document} options.document
 * @param {Window} options.win
 * @param {ReturnType<import('./corantoBoardModel.js').createBoardStore>} options.store
 * @param {() => object[]} options.getArticles the headlines held now
 * @param {() => object[]} [options.getStories] the feed's stories, to pin by
 * @param {() => object[]} [options.getCountries] atlas countries, for dead reckoning
 * @param {(system: string, user: string, maxTokens: number) => Promise<string>} options.callModel
 * @param {(asset: object) => void} [options.onOpen] a card's title was clicked
 * @param {() => void} [options.onChange] the pins changed
 * @param {(tiers: object | null) => void} [options.onMomentum] dead reckoning tiers for the globe
 */
export function createAnalyst({
  document,
  win,
  store,
  getArticles,
  getStories = () => [],
  getCountries = () => [],
  callModel,
  onOpen = () => {},
  onChange = () => {},
  onMomentum = () => {},
}) {
  const element = document.createElement('div');
  element.id = 'coranto-analyst';
  element.innerHTML = SKELETON;
  const ref = {};
  for (const node of element.querySelectorAll('[data-ref]'))
    ref[node.dataset.ref] = node;
  const overlay = element.querySelector('#ca-analyst-overlay');
  const playbookModal = element.querySelector('#ca-playbook-modal');
  ref.briefScroll.innerHTML = BRIEF_EMPTY;

  let animId = 0;
  let net = { zoom: 1, panX: 0, panY: 0, drag: null };
  let statusTimer = 0;
  let histTimer = 0;
  let toolsOpen = false;
  let reckoningOn = false;
  let matrix = null;
  let briefTitle = 'Daily Situation Report';
  let runId = 0;

  // ── The headlines, in the shape the tools read ───────────────────
  let newsFrom = null;
  let newsCache = [];
  function news() {
    const articles = getArticles() ?? [];
    if (articles === newsFrom) return newsCache;
    const storyOf = new Map();
    for (const story of getStories() ?? [])
      for (const id of story.articleIds ?? []) storyOf.set(id, story.id);
    const now = Date.now();
    newsFrom = articles;
    newsCache = articles.map((article) =>
      articleToStory(article, now, storyOf.get(article.id) ?? null),
    );
    return newsCache;
  }
  function pinned() {
    const live = news();
    const keys = new Set();
    // A story's id changes when its cluster does; its headline does not.
    for (const s of live) {
      keys.add(s.id);
      keys.add(s.articleId);
      keys.add(s.title);
    }
    const now = Date.now();
    return store.list().map((asset) => {
      const story = toStory(asset, now, keys);
      if (story._hist && keys.has(asset.title)) story._hist = false;
      return story;
    });
  }

  // ── Status line ─────────────────────────────────────────────────
  function restStatus() {
    ref.status.innerHTML = `SYSTEM READY · <span>${store.list().length}</span> ASSETS PINNED`;
  }
  function setStatus(html, restoreAfter = 0) {
    win.clearTimeout(statusTimer);
    ref.status.innerHTML = html;
    if (restoreAfter) statusTimer = win.setTimeout(restStatus, restoreAfter);
  }
  function updateAnalystStatus() {
    const n = store.list().length;
    const count = ref.status.querySelector('span');
    if (count && !count.className) count.textContent = String(n);
    ref.colMeta.textContent = n ? `${n} ASSETS` : 'PIN STORIES FROM FEED';
  }

  // ── Asset board ─────────────────────────────────────────────────
  function renderAnalystBoard() {
    const list = pinned();
    if (!list.length) {
      ref.assetScroll.innerHTML =
        '<div class="ca-am-asset-empty">PIN STORIES FROM THE INTELLIGENCE FEED<br>OR SEARCH THE HEADLINES ABOVE</div>';
      return;
    }
    const live = news();
    ref.assetScroll.innerHTML = list
      .map((s) => {
        const badge = cardBadge(s);
        const badgeHtml = badge.geo
          ? `<span style="color:${s.color};opacity:.7;font-size:7px">${esc(badge.text)}</span>`
          : `${esc(badge.text)}${badge.breaking ? ' · <span style="color:#ff4d5e">BREAKING</span>' : ''}${badge.archive ? ' · <span style="color:#8A93C8;opacity:.6">ARCHIVE</span>' : ''}`;
        const traj = computeTrajectory(s, live);
        const trajIcon =
          traj.dir === 'up'
            ? ic('triUp', '#FF2D55')
            : traj.dir === 'mid'
              ? ic('minus', '#FF9F0A')
              : ic('triDown', '#566573');
        return `
    <div class="ca-am-card" style="--ac:${s.color}">
      <div class="ca-am-card-cat" style="color:${s.color}">${badgeHtml}<span class="ca-am-traj ca-am-traj-${traj.dir}" title="Activity trend: ${esc(traj.label)}">${trajIcon}</span></div>
      <div class="ca-am-card-title" data-act="card-open" data-key="${esc(s.id)}" title="Open">${esc(s.title)}</div>
      <div class="ca-am-card-meta"><span>${esc(s.src)}</span><span>${esc(s.time)}</span><span>${esc(s.region || '')}</span><button type="button" class="ca-am-card-tl" data-act="card-timeline" data-key="${esc(s.id)}" title="Narrative Timeline">${ic('clock')}</button></div>
      <button type="button" class="ca-am-card-rm" data-act="card-remove" data-key="${esc(s.id)}" aria-label="Remove">${ic('close', '#7a849f')}</button>
    </div>`;
      })
      .join('');
  }

  // ── History search ──────────────────────────────────────────────
  function runHistSearch() {
    const query = ref.histInput.value;
    const cat = ref.histCat.value;
    if (!query.trim() && !cat) {
      ref.histResults.style.display = 'none';
      return;
    }
    ref.histResults.style.display = 'block';
    const results = searchStories(query, cat, news());
    if (!results.length) {
      ref.histResults.innerHTML =
        '<div class="ca-am-hist-loading">NO RESULTS FOUND</div>';
      return;
    }
    ref.histResults.innerHTML = results
      .map((s) => {
        const on = store.has(s.id);
        return `<div class="ca-am-hist-item${on ? ' ca-pinned' : ''}">
      <div class="ca-am-hist-meta"><span style="color:${s.color}">${esc(domainLabel(s.cat))}</span><span>${esc(s.time)}</span></div>
      <div class="ca-am-hist-title">${esc(s.title)}</div>
      <button type="button" class="ca-am-hist-pin${on ? ' ca-on' : ''}" data-act="hist-pin" data-key="${esc(s.id)}">${on ? 'PINNED' : '+ PIN'}</button>
    </div>`;
      })
      .join('');
  }
  function debounceHistSearch() {
    win.clearTimeout(histTimer);
    ref.histResults.style.display = 'block';
    ref.histResults.innerHTML =
      '<div class="ca-am-hist-loading">SEARCHING THE HEADLINES…</div>';
    histTimer = win.setTimeout(runHistSearch, 400);
  }
  ref.histInput.addEventListener('input', debounceHistSearch);
  ref.histCat.addEventListener('change', debounceHistSearch);

  // ── Entity network ──────────────────────────────────────────────
  function resizeAnalystCanvas() {
    const parent = ref.canvas.parentElement;
    const w = parent.offsetWidth;
    const h = parent.offsetHeight;
    if (w > 0 && h > 0) {
      ref.canvas.width = w;
      ref.canvas.height = h;
    }
  }
  ref.canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      net.zoom = Math.max(
        0.3,
        Math.min(4, net.zoom * (event.deltaY > 0 ? 0.9 : 1.1)),
      );
    },
    { passive: false },
  );
  ref.canvas.addEventListener('mousedown', (event) => {
    net.drag = {
      sx: event.clientX,
      sy: event.clientY,
      px: net.panX,
      py: net.panY,
    };
  });
  ref.canvas.addEventListener('mousemove', (event) => {
    if (!net.drag) return;
    net.panX = net.drag.px + event.clientX - net.drag.sx;
    net.panY = net.drag.py + event.clientY - net.drag.sy;
  });
  const endDrag = () => {
    net.drag = null;
  };
  ref.canvas.addEventListener('mouseup', endDrag);
  ref.canvas.addEventListener('mouseleave', endDrag);

  function runAnalystGraph() {
    if (animId) {
      win.cancelAnimationFrame(animId);
      animId = 0;
    }
    const canvas = ref.canvas;
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return;
    const list = pinned();
    if (!list.length) {
      ref.netEmpty.style.display = 'flex';
      ref.netReset.style.display = 'none';
      ref.netMeta.textContent = 'NO CONNECTIONS';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    ref.netEmpty.style.display = 'none';
    ref.netReset.style.display = '';
    if (canvas.width < 10 || canvas.height < 10) resizeAnalystCanvas();
    const W = canvas.width || 400;
    const H = canvas.height || 300;
    net = { zoom: 1, panX: 0, panY: 0, drag: null };
    const nodes = list.map((s) => ({
      id: s.id,
      label: s.title.slice(0, 22),
      color: s.color,
      x: W / 2 + (Math.random() - 0.5) * W * 0.55,
      y: H / 2 + (Math.random() - 0.5) * H * 0.55,
      vx: 0,
      vy: 0,
    }));
    const edges = graphEdges(list);
    const hasCross = edges.some((e) => e.cross);
    ref.netMeta.textContent = `${list.length} NODES · ${edges.length} CONNECTIONS${hasCross ? ' · CROSS-DOMAIN' : ''}`;
    let frame = 0;
    function loop() {
      stepGraph(nodes, edges, W, H);
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2 + net.panX, H / 2 + net.panY);
      ctx.scale(net.zoom, net.zoom);
      ctx.translate(-W / 2, -H / 2);
      ctx.strokeStyle = 'rgba(10,16,32,.9)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      // Violet joins pins of one domain; amber joins pins across domains.
      for (const e of edges) {
        const pulse = 0.25 + Math.sin(frame * 0.025 + e.i) * 0.12;
        ctx.beginPath();
        ctx.moveTo(nodes[e.i].x, nodes[e.i].y);
        ctx.lineTo(nodes[e.j].x, nodes[e.j].y);
        ctx.strokeStyle = e.cross
          ? `rgba(255,159,10,${pulse + 0.1})`
          : `rgba(180,124,255,${pulse + 0.1})`;
        ctx.lineWidth = 0.5 + e.strength * 0.35;
        ctx.stroke();
        ctx.font = '7px "IBM Plex Mono"';
        ctx.fillStyle = e.cross
          ? 'rgba(255,159,10,.85)'
          : 'rgba(0,160,200,.75)';
        ctx.textAlign = 'center';
        ctx.fillText(
          e.label.toUpperCase(),
          (nodes[e.i].x + nodes[e.j].x) / 2,
          (nodes[e.i].y + nodes[e.j].y) / 2 - 5,
        );
      }
      for (const n of nodes) {
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 22);
        glow.addColorStop(0, `${n.color}55`);
        glow.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(n.x, n.y, 22, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(n.x, n.y, 9, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.25)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.font = '8px "IBM Plex Mono"';
        ctx.fillStyle = 'rgba(160,180,220,.9)';
        ctx.textAlign = 'center';
        ctx.fillText(n.label, n.x, n.y + 22);
      }
      ctx.restore();
      frame += 1;
      animId = win.requestAnimationFrame(loop);
    }
    loop();
  }

  // ── Synthesis brief ─────────────────────────────────────────────
  function postProcessBriefConfidence() {
    const live = news();
    for (const p of ref.briefScroll.querySelectorAll('.ca-am-brief-p')) {
      if (p.querySelector('.ca-am-conf')) continue;
      const conf = confidenceFor(p.textContent, live);
      const badge = document.createElement('span');
      badge.className = 'ca-am-conf';
      badge.style.cssText = `color:${conf.colour};border-color:${conf.colour}33`;
      badge.title = conf.title;
      badge.append(conf.level);
      p.prepend(badge);
    }
  }
  function synthesizeBrief() {
    const list = pinned();
    if (!list.length) return;
    runId += 1;
    reckoningOn = false;
    syncReckoning();
    const parts = synthesisParts(list);
    const now = new Date().toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    ref.briefScroll.innerHTML = `
    <div class="ca-am-classify">${MARKINGS.synthesis} · ${esc(now)}</div>
    <div class="ca-am-brief-sec">
      <div class="ca-am-brief-sh">EXECUTIVE SUMMARY</div>
      <p class="ca-am-brief-p">${esc(parts.before)}${parts.breaking ? `<strong style="color:#FF2D55">${esc(parts.breaking)}</strong>${esc(parts.breakingTail)}` : ''}${esc(parts.after)}</p>
    </div>
    <div class="ca-am-brief-sec">
      <div class="ca-am-brief-sh">KEY ENTITIES</div>
      <div class="ca-am-entities">${parts.entities.map((e) => `<span class="ca-am-ent ca-hi">${esc(e)}</span>`).join('')}${parts.regions.map((r) => `<span class="ca-am-ent">${esc(r)}</span>`).join('')}</div>
    </div>
    <div class="ca-am-brief-sec">
      <div class="ca-am-brief-sh">ASSET SUMMARIES</div>
      ${list.map((s) => `<p class="ca-am-brief-p" style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #0a0c18"><span style="color:${s.color};font-family:var(--font-mono);font-size:7.5px;letter-spacing:.1em">${esc(domainLabel(s.cat))} · ${esc(s.src)}${s._hist ? ' · ARCHIVE' : ''}</span><br>${esc(s.summary || s.title)}</p>`).join('')}
    </div>
    <div class="ca-am-brief-sec">
      <div class="ca-am-brief-sh">DOMAINS</div>
      <div class="ca-am-entities">${parts.cats.map((c) => `<span class="ca-am-ent ca-hi" style="border-color:${domainColour(c)}44;color:${domainColour(c)}">${esc(domainLabel(c))}</span>`).join('')}</div>
    </div>`;
    ref.briefScroll.scrollTop = 0;
    ref.briefMeta.textContent = `${list.length} ASSETS · ${now}`;
    postProcessBriefConfidence();
  }

  function download(html, name) {
    const url = win.URL.createObjectURL(
      new win.Blob([html], { type: 'text/html' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
  }

  function exportBrief() {
    const list = pinned();
    const now = new Date().toLocaleString();
    const assetRows = list
      .map(
        (s) => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #1a1f35;color:${s.color || '#8A93C8'};font-family:monospace;font-size:11px">${esc(domainLabel(s.cat).toUpperCase())}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #1a1f35;font-size:12px;color:#c8d0f0">${esc(s.title)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #1a1f35;font-family:monospace;font-size:10px;color:#5a6480">${esc(s.src)} · ${esc(s.time)}</td>
    </tr>`,
      )
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>CORANTO BRIEF — ${esc(now)}</title>
<style>
  body{background:#030409;color:#c8d0f0;font-family:'IBM Plex Mono',monospace;margin:0;padding:0}
  .banner{background:#C1121F;padding:10px 24px;font-size:9px;font-weight:700;letter-spacing:.3em;color:#fff;text-align:center}
  .hdr{padding:24px 32px 16px;border-bottom:1px solid #1a1f35}
  .wordmark{font-size:11px;letter-spacing:.32em;color:#b47cff;margin-bottom:6px}
  .title{font-size:22px;font-weight:800;letter-spacing:.1em;color:#f0f2ff;font-family:Georgia,serif;margin-bottom:4px}
  .meta{font-size:9px;color:#3C4470;letter-spacing:.12em}
  .section{padding:20px 32px}
  .sec-label{font-size:8px;letter-spacing:.22em;color:#3C4470;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #0d1020}
  table{width:100%;border-collapse:collapse}
  .brief-body{padding:0 32px 32px;font-size:12px;line-height:1.8;color:#8A93C8}
  .brief-body p{margin-bottom:10px}
  .brief-body img{width:11px;height:11px;margin-right:5px;vertical-align:-1px}
  .brief-body button{display:none}
  .ca-am-brief-sh,.ca-cb-round-hdr,.ca-cb-synthesis-hdr{font-size:9px;letter-spacing:.2em;color:#b47cff;margin:18px 0 8px}
  .ca-am-ent,.ca-cb-tag{display:inline-block;margin:0 6px 6px 0;padding:2px 7px;border:1px solid #1a1f35;font-size:10px}
  .ca-am-conf{display:inline-block;margin-right:6px;padding:0 4px;border:1px solid;font-size:9px}
  .ca-cb-name{color:#f0f2ff;margin-top:14px}
</style></head><body>
<div class="banner">${MARKINGS.system} — ${esc(now)}</div>
<div class="hdr">
  <div class="wordmark">CORANTO INTELLIGENCE BRIEF</div>
  <div class="title">INTELLIGENCE BRIEF</div>
  <div class="meta">${esc(ref.briefMeta.textContent)}</div>
</div>
${list.length ? `<div class="section"><div class="sec-label">INTELLIGENCE ASSETS (${list.length})</div><table>${assetRows}</table></div>` : ''}
<div class="section"><div class="sec-label">BRIEF</div></div>
<div class="brief-body">${ref.briefScroll.innerHTML}</div>
</body></html>`;
    download(html, `coranto-brief-${Date.now()}.html`);
  }

  // ── Consensus ───────────────────────────────────────────────────
  const personaIcon = (a) => ic(a.glyph, a.color);
  async function runConsensusBoard() {
    const list = pinned();
    const scroll = ref.briefScroll;
    if (!list.length) {
      scroll.innerHTML =
        '<div class="ca-am-brief-empty" style="display:flex"><div>PIN AT LEAST ONE STORY TO THE ASSET BOARD<br>THEN CLICK CONSENSUS</div></div>';
      return;
    }
    runId += 1;
    const run = runId;
    const stale = () => run !== runId;
    reckoningOn = false;
    syncReckoning();
    const context = buildAssetContext(list);

    setStatus('ROUND 1 · 5 SPECIALIST ANALYSTS ASSESSING IN PARALLEL…');
    scroll.innerHTML = `
    <div class="ca-am-classify" style="margin-bottom:0">AGENTIC CONSENSUS BOARD · ${esc(new Date().toLocaleString())}</div>
    <div class="ca-cb-stats">
      <div class="ca-cb-stat"><div class="ca-cb-stat-v" style="color:#3C4470">—%</div><div class="ca-cb-stat-l">ESCALATION</div></div>
      <div class="ca-cb-stat"><div class="ca-cb-stat-v" style="color:#3C4470">—%</div><div class="ca-cb-stat-l">AGREEMENT</div></div>
      <div class="ca-cb-stat"><div class="ca-cb-stat-v" style="color:#3C4470">—pt</div><div class="ca-cb-stat-l">DIVERGENCE</div></div>
    </div>
    <div class="ca-cb-round-hdr"><em>ROUND 1</em> — INDEPENDENT SPECIALIST ANALYSIS</div>
    <div class="ca-cb-bar-wrap">
      ${ANALYST_PERSONAS.map(
        (a) => `
        <div class="ca-cb-analyst ca-cb-anim" style="--ac:${a.color}">
          <div class="ca-cb-name"><span class="ca-cb-icon">${personaIcon(a)}</span>${a.name}</div>
          <div class="ca-cb-loading ca-rt-loading-anim">ANALYZING…</div>
        </div>`,
      ).join('')}
    </div>
    <div data-zone="r2"></div>
    <div data-zone="r3"></div>
    <div class="ca-ai-note">${AI_NOTE}</div>`;
    scroll.scrollTop = 0;
    const cards = scroll.querySelectorAll('.ca-cb-analyst');

    const analysts = await Promise.all(
      ANALYST_PERSONAS.map(async (a, i) => {
        const prompt = PROMPTS.round1(a, context);
        const result = await callModel(
          prompt.system,
          prompt.user,
          prompt.maxTokens,
        ).then(
          (text) => parseAnalyst(a, text),
          () => ({
            ...a,
            assessment: 'API unavailable.',
            escalation: 50,
            ok: false,
          }),
        );
        if (!stale() && cards[i]) {
          const value = escalationOf(result);
          const col = escalationColour(value);
          cards[i].innerHTML = `
          <div class="ca-cb-name"><span class="ca-cb-icon">${personaIcon(a)}</span>${a.name}</div>
          <div class="ca-cb-track"><div class="ca-cb-fill" style="width:${Math.max(0, Math.min(100, value))}%;background:${col}"></div><span class="ca-cb-pct" style="color:${col}">${esc(value)}%</span></div>
          <div class="ca-cb-text">${esc(result.assessment || '')}</div>
          ${result.keyFactor ? `<span class="ca-cb-tag">KEY: ${esc(result.keyFactor)}</span>` : ''}
          ${result.blindspot ? `<span class="ca-cb-tag ca-cb-blind">BLIND SPOT: ${esc(result.blindspot)}</span>` : ''}`;
        }
        return result;
      }),
    );
    if (stale()) return;

    const stats = consensusStats(analysts);
    const { hawk, dove } = stats;
    const statEl = scroll.querySelector('.ca-cb-stats');
    if (statEl)
      statEl.innerHTML = `
      <div class="ca-cb-stat"><div class="ca-cb-stat-v" style="color:${stats.meanColour}">${stats.mean}%</div><div class="ca-cb-stat-l">ESCALATION</div></div>
      <div class="ca-cb-stat"><div class="ca-cb-stat-v" style="color:${stats.agrColour}">${stats.agr}%</div><div class="ca-cb-stat-l">AGREEMENT</div></div>
      <div class="ca-cb-stat"><div class="ca-cb-stat-v">${stats.spread}pt</div><div class="ca-cb-stat-l">DIVERGENCE</div></div>`;

    setStatus(`ROUND 2 · CROSS-EXAMINATION: ${hawk.name} vs ${dove.name}`);
    const r2 = scroll.querySelector('[data-zone="r2"]');
    r2.innerHTML = `
    <div class="ca-cb-round-hdr"><em>ROUND 2</em> — CROSS-EXAMINATION · <span style="color:${hawk.color}">${personaIcon(hawk)}${hawk.name}</span> <span style="opacity:.4">vs</span> <span style="color:${dove.color}">${personaIcon(dove)}${dove.name}</span></div>
    <div class="ca-cb-debate-section">
      <div class="ca-cb-debate-msg ca-attacker" style="--ac-a:${hawk.color}">
        <div class="ca-cb-debate-who" style="color:${hawk.color}">${personaIcon(hawk)}${hawk.name} · CHALLENGING</div>
        <div class="ca-cb-debate-body ca-rt-loading-anim">Formulating challenge…</div>
      </div>
    </div>`;
    let hawkChallenge = '';
    let doveRebuttal = '';
    try {
      const prompt = PROMPTS.hawk(hawk, dove);
      hawkChallenge = await callModel(
        prompt.system,
        prompt.user,
        prompt.maxTokens,
      );
    } catch {
      hawkChallenge = '[API error]';
    }
    if (stale()) return;
    const debate = r2.querySelector('.ca-cb-debate-section');
    const first = debate.querySelector('.ca-cb-debate-body');
    first.textContent = hawkChallenge;
    first.classList.remove('ca-rt-loading-anim');
    debate.insertAdjacentHTML(
      'beforeend',
      `
      <div class="ca-cb-debate-msg ca-defender" style="--ac-d:${dove.color}">
        <div class="ca-cb-debate-who" style="color:${dove.color}">${personaIcon(dove)}${dove.name} · REBUTTAL</div>
        <div class="ca-cb-debate-body ca-rt-loading-anim" data-zone="dove">Formulating rebuttal…</div>
      </div>`,
    );
    try {
      const prompt = PROMPTS.dove(hawk, dove, hawkChallenge);
      doveRebuttal = await callModel(
        prompt.system,
        prompt.user,
        prompt.maxTokens,
      );
    } catch {
      doveRebuttal = '[API error]';
    }
    if (stale()) return;
    const doveEl = debate.querySelector('[data-zone="dove"]');
    doveEl.textContent = doveRebuttal;
    doveEl.classList.remove('ca-rt-loading-anim');

    setStatus('ROUND 3 · SENIOR ANALYST SYNTHESIZING ALL PERSPECTIVES…');
    const r3 = scroll.querySelector('[data-zone="r3"]');
    r3.innerHTML = `
    <div class="ca-cb-round-hdr"><em>ROUND 3</em> — SENIOR ANALYST SYNTHESIS</div>
    <div class="ca-cb-synthesis-section">
      <div class="ca-cb-synthesis-card">
        <div class="ca-cb-synthesis-hdr">${ic('diamond')}CONSOLIDATED INTELLIGENCE BRIEF</div>
        <div class="ca-cb-synthesis-body ca-rt-loading-anim">Synthesizing 5 specialist assessments and cross-examination findings…</div>
      </div>
    </div>`;
    let synthesis = '';
    try {
      const prompt = PROMPTS.synthesis(
        context,
        analysts,
        hawk,
        dove,
        hawkChallenge,
        doveRebuttal,
      );
      synthesis = await callModel(prompt.system, prompt.user, prompt.maxTokens);
    } catch {
      synthesis = 'Synthesis unavailable — check API key.';
    }
    if (stale()) return;
    const synthEl = r3.querySelector('.ca-cb-synthesis-body');
    synthEl.classList.remove('ca-rt-loading-anim');
    synthEl.innerHTML = replyLines(synthesis, () => false)
      .map((l) => `<p style="margin-bottom:10px">${esc(l.text)}</p>`)
      .join('');
    setStatus(
      `CONSENSUS COMPLETE · 3 ROUNDS · ${analysts.filter((a) => a.ok).length}/5 ANALYSTS · ${esc(new Date().toLocaleString())}`,
    );
    ref.briefMeta.textContent = `5 ANALYSTS + CROSS-EXAM + SYNTHESIS · ${new Date().toLocaleString()}`;
  }

  // ── Red team ────────────────────────────────────────────────────
  function openRedTeamBrief() {
    closeAnalystMode();
    ref.rtModal.classList.add('ca-on');
  }
  async function generateRedTeamBrief() {
    const list = pinned();
    if (!list.length) {
      ref.rtStatus.textContent = 'PIN ASSETS TO ANALYST BOARD FIRST';
      return;
    }
    ref.rtStatus.textContent = 'GENERATING ADVERSARIAL ASSESSMENT…';
    ref.rtExport.style.display = 'none';
    ref.rtContent.innerHTML =
      '<div class="ca-rt-loading ca-rt-loading-anim">ADVERSARY PERSPECTIVE LOADING…</div>';
    try {
      const prompt = PROMPTS.redTeam(buildAssetContext(list));
      const brief = await callModel(
        prompt.system,
        prompt.user,
        prompt.maxTokens,
      );
      ref.rtStatus.textContent = 'ADVERSARIAL BRIEF GENERATED';
      ref.rtExport.style.display = '';
      const now = new Date().toLocaleString();
      ref.rtContent.innerHTML = `
      <div class="ca-rt-classify">${MARKINGS.redTeam}</div>
      <div class="ca-rt-heading">ADVERSARIAL OPPORTUNITY ASSESSMENT</div>
      <div class="ca-rt-date">PREPARED: ${esc(now)} &nbsp;·&nbsp; ${MARKINGS.system} &nbsp;·&nbsp; NOT FOR DISTRIBUTION</div>
      <div>${replyLines(brief, isRedTeamHeader)
        .map((l) =>
          l.header
            ? `<div class="ca-rt-sec-hdr" style="font-family:var(--font-mono);font-size:8.5px;letter-spacing:.2em;color:rgba(255,100,100,.8);margin:16px 24px 4px;padding-top:12px;border-top:1px solid rgba(255,23,68,.2)">${esc(l.text)}</div>`
            : `<p class="ca-rt-para">${esc(l.text)}</p>`,
        )
        .join('')}</div>
      <div class="ca-ai-note">${AI_NOTE}</div>
      <div class="ca-rt-classify" style="margin-top:20px">${MARKINGS.redTeam}</div>`;
    } catch (error) {
      ref.rtStatus.textContent = 'GENERATION FAILED — CHECK API KEY';
      ref.rtContent.innerHTML = `<div class="ca-rt-loading" style="color:rgba(255,45,85,.5)">ERROR: ${esc(error.message)}</div>`;
    }
  }
  function exportRedTeam() {
    const now = new Date().toLocaleString();
    download(
      `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>CORANTO RED TEAM BRIEF — ${esc(now)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0a0a0a;color:#e8e8e8;font-family:'Courier New',monospace;font-size:11px;line-height:1.7}
  .rt-banner{background:#c1121f;color:#fff;font-family:'Courier New',monospace;font-size:9px;font-weight:700;letter-spacing:.25em;text-align:center;padding:10px 0;width:100%}
  .rt-body{max-width:860px;margin:0 auto;padding:40px 32px}
  .ca-rt-heading{font-size:15px;font-weight:700;letter-spacing:.2em;color:#ff1744;text-align:center;margin:28px 0 6px}
  .ca-rt-date{font-size:8px;letter-spacing:.12em;color:rgba(255,255,255,.4);text-align:center;margin-bottom:28px}
  .ca-rt-classify{background:#c1121f;color:#fff;font-family:'Courier New',monospace;font-size:9px;font-weight:700;letter-spacing:.25em;text-align:center;padding:10px 0}
  .ca-rt-para{font-size:10.5px;color:rgba(232,232,232,.9);line-height:1.75;margin:6px 0}
  .ca-rt-sec-hdr{color:rgba(255,100,100,.85) !important;margin:16px 0 4px !important}
  .ca-ai-note{margin-top:24px;font-size:8px;letter-spacing:.1em;color:rgba(255,255,255,.45)}
</style>
</head>
<body>
<div class="rt-banner">${MARKINGS.redTeam}</div>
<div class="rt-body">
${ref.rtContent.innerHTML}
</div>
<div class="rt-banner">${MARKINGS.redTeam}</div>
</body>
</html>`,
      `red-team-brief-${Date.now()}.html`,
    );
  }

  // ── Adversary playbook ──────────────────────────────────────────
  async function generatePlaybook() {
    playbookModal.classList.add('ca-on');
    const list = pinned();
    if (!list.length) {
      ref.pbStatus.textContent = 'PIN ASSETS TO ANALYST BOARD FIRST';
      ref.pbContent.innerHTML =
        '<div class="ca-pb-loading">NO ASSETS PINNED</div>';
      return;
    }
    ref.pbStatus.textContent = 'GENERATING ADVERSARY PLAYBOOK…';
    ref.pbContent.innerHTML =
      '<div class="ca-pb-loading ca-pb-loading-anim">ANALYZING ADVERSARY PATTERNS…</div>';
    ref.pbExport.style.display = 'none';
    try {
      const prompt = PROMPTS.playbook(list);
      const brief = await callModel(
        prompt.system,
        prompt.user,
        prompt.maxTokens,
      );
      ref.pbExport.style.display = '';
      ref.pbStatus.textContent = 'PLAYBOOK GENERATED';
      const now = new Date().toLocaleString();
      ref.pbContent.innerHTML = `
      <div class="ca-pb-classify">${MARKINGS.playbook}</div>
      <div class="ca-pb-heading">ADVERSARY PLAYBOOK</div>
      <div class="ca-pb-date">PREPARED: ${esc(now)} · ${MARKINGS.system} · NOT FOR DISTRIBUTION</div>
      <div>${replyLines(brief, isPlaybookHeader)
        .map((l) =>
          l.header
            ? `<div class="ca-pb-sec-hdr">${esc(l.text)}</div>`
            : `<p class="ca-pb-para">${esc(l.text)}</p>`,
        )
        .join('')}</div>
      <div class="ca-ai-note">${AI_NOTE}</div>
      <div class="ca-pb-classify" style="margin-top:20px">${MARKINGS.playbook}</div>`;
    } catch (error) {
      ref.pbStatus.textContent = 'GENERATION FAILED — CHECK API KEY';
      ref.pbContent.innerHTML = `<div class="ca-pb-loading" style="color:rgba(180,124,255,.5)">ERROR: ${esc(error.message)}</div>`;
    }
  }
  function exportPlaybook() {
    const now = new Date().toLocaleString();
    download(
      `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>ADVERSARY PLAYBOOK — ${esc(now)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0a0303;color:#e8e8e8;font-family:'Courier New',monospace;font-size:11px;line-height:1.7}.pb-banner{background:#3d0a0a;border-top:1px solid #FF3B30;border-bottom:1px solid #FF3B30;color:#FF3B30;font-family:'Courier New',monospace;font-size:9px;font-weight:700;letter-spacing:.25em;text-align:center;padding:10px}.pb-body{max-width:860px;margin:0 auto;padding:40px 32px}.ca-pb-heading{font-size:15px;font-weight:700;letter-spacing:.2em;color:#FF3B30;text-align:center;margin:28px 0 6px}.ca-pb-date{font-size:8px;letter-spacing:.12em;color:rgba(255,255,255,.4);text-align:center;margin-bottom:28px}.ca-pb-classify{background:#3d0a0a;border:1px solid rgba(255,59,48,.4);color:#FF3B30;font-family:'Courier New',monospace;font-size:9px;font-weight:700;letter-spacing:.25em;text-align:center;padding:10px}.ca-pb-sec-hdr{font-size:8.5px;letter-spacing:.2em;color:rgba(255,59,48,.85);margin:16px 0 4px;padding-top:12px;border-top:1px solid rgba(255,59,48,.2)}.ca-pb-para{font-size:10.5px;color:rgba(232,232,232,.9);line-height:1.75;margin:5px 0}.ca-ai-note{margin-top:24px;font-size:8px;letter-spacing:.1em;color:rgba(255,255,255,.45)}</style>
</head><body><div class="pb-banner">${MARKINGS.playbook}</div><div class="pb-body">${ref.pbContent.innerHTML}</div><div class="pb-banner">${MARKINGS.playbook}</div></body></html>`,
      `adversary-playbook-${Date.now()}.html`,
    );
  }

  // ── Escalation matrix ───────────────────────────────────────────
  const stampMatrix = () => {
    ref.mxTs.textContent = `LAST RUN: ${new Date().toLocaleTimeString()}`;
  };
  function buildEscalationMatrix() {
    const list = pinned();
    if (!list.length) {
      matrix = null;
      ref.mxContent.innerHTML =
        '<div style="padding:24px;text-align:center;color:var(--text-dim);font-family:var(--font-mono);font-size:9px;letter-spacing:.12em">PIN ASSETS TO ANALYST BOARD TO COMPUTE MATRIX</div>';
      ref.mxPanel.innerHTML = '';
      return;
    }
    matrix = escalationMatrix(list, news());
    const label = (d) => domainLabel(d);
    let html =
      '<div class="ca-mx-grid"><div class="ca-mx-cell ca-mx-corner"></div>';
    for (const c of MATRIX_DOMAINS)
      html += `<div class="ca-mx-cell ca-mx-hdr" style="color:${MATRIX_COLOURS[c]}">${label(c)}</div>`;
    for (const r of MATRIX_DOMAINS) {
      html += `<div class="ca-mx-cell ca-mx-hdr" style="color:${MATRIX_COLOURS[r]}">${label(r)}</div>`;
      for (const c of MATRIX_DOMAINS) {
        const { score } = matrix.cells[r][c];
        const risk = matrixRisk(score, matrix.max);
        html += `<button type="button" class="ca-mx-cell ca-mx-data${r === c ? ' ca-mx-diag' : ''}" style="background:${risk.colour};cursor:pointer" data-act="matrix-cell" data-row="${r}" data-col="${c}" title="Click to view ${label(r)}×${label(c)} stories"><div class="ca-mx-risk">${risk.label}</div><div class="ca-mx-score">${score}</div></button>`;
      }
    }
    ref.mxContent.innerHTML = `${html}</div>`;
    ref.mxPanel.innerHTML = MATRIX_HINT;
  }
  function showMatrixStories(row, col) {
    const stories = matrix?.cells[row]?.[col]?.stories;
    if (!stories) return;
    const header = `<div class="ca-mx-sp-hdr"><span style="color:${MATRIX_COLOURS[row]}">${domainLabel(row)}</span> <span style="opacity:.4">×</span> <span style="color:${MATRIX_COLOURS[col]}">${domainLabel(col)}</span> — ${stories.length} RELEVANT STOR${stories.length === 1 ? 'Y' : 'IES'}</div>`;
    if (!stories.length) {
      ref.mxPanel.innerHTML = `${header}<div class="ca-mx-sp-empty">NO STORIES MATCHED THIS DOMAIN PAIR</div>`;
      return;
    }
    ref.mxPanel.innerHTML = `${header}<div class="ca-mx-sp-list">${stories
      .map(
        (s) => `
    <div class="ca-mx-sp-item" data-act="matrix-pin" data-key="${esc(s.id)}" title="Pin to the board">
      <span class="ca-mx-sp-cat" style="color:${MATRIX_COLOURS[s.cat] || '#7B61FF'}">${esc((s.cat || '').toUpperCase().slice(0, 3))}</span>
      <span class="ca-mx-sp-title">${esc(s.title.slice(0, 90))}</span>
      <span class="ca-mx-sp-src">${esc(s.src || '')}</span>
    </div>`,
      )
      .join('')}</div>`;
  }
  function openEscalationMatrix() {
    ref.mxModal.classList.add('ca-on');
    ref.mxBd.classList.add('ca-on');
    buildEscalationMatrix();
    stampMatrix();
  }
  function recalculateMatrix() {
    ref.mxRecalc.replaceChildren('CALCULATING…');
    ref.mxRecalc.disabled = true;
    win.setTimeout(() => {
      buildEscalationMatrix();
      stampMatrix();
      ref.mxRecalc.replaceChildren('RECALCULATE');
      ref.mxRecalc.disabled = false;
    }, 80);
  }
  const closeMatrix = () => {
    ref.mxModal.classList.remove('ca-on');
    ref.mxBd.classList.remove('ca-on');
  };

  // ── Dead reckoning ──────────────────────────────────────────────
  function syncReckoning() {
    ref.drBtn.classList.toggle('ca-on', reckoningOn);
    if (!reckoningOn) {
      ref.briefScroll.querySelector('.ca-dr-board')?.remove();
      onMomentum(null);
    }
  }
  function renderDeadReckoning() {
    const result = deadReckoning(news(), getCountries() ?? []);
    onMomentum(result.tiers);
    ref.briefScroll.querySelector('.ca-dr-board')?.remove();
    const board = document.createElement('div');
    board.className = 'ca-dr-board';
    board.innerHTML = `
    <div class="ca-dr-hdr">${ic('target')}DEAD RECKONING · NEWS MENTION HEAT · ${esc(new Date().toLocaleTimeString())}</div>
    <div class="ca-dr-sub">Ranked by how often each country is named in the headlines held</div>
    <div class="ca-dr-rows">${
      result.rows
        .map(
          (c) => `<div class="ca-dr-row">
      <div class="ca-dr-country">${esc(c.name.toUpperCase())}</div>
      <div class="ca-dr-bar-wrap"><div class="ca-dr-bar" style="width:${c.pct}%;background:${c.colour}"></div></div>
      <div class="ca-dr-stats"><span class="ca-dr-tier" style="color:${c.colour}">${c.tier}</span><span class="ca-dr-n">${c.n}</span></div>
      <div class="ca-dr-domains">${c.domains.map((d) => `<span class="ca-dr-domain" style="color:${d.colour}">${d.label}:${d.n}</span>`).join('')}</div>
    </div>`,
        )
        .join('') ||
      '<div class="ca-dr-sub">No country is named in the headlines held.</div>'
    }</div>`;
    ref.briefScroll.prepend(board);
    ref.briefScroll.scrollTop = 0;
  }
  function toggleDeadReckoning() {
    reckoningOn = !reckoningOn;
    toggleToolsMenu(false);
    syncReckoning();
    if (reckoningOn) renderDeadReckoning();
  }

  // ── Narrative timeline ──────────────────────────────────────────
  function openNarrativeTimeline(key = null) {
    ref.tlModal.classList.add('ca-on');
    ref.tlBd.classList.add('ca-on');
    const list = pinned();
    const focal = key != null ? list.find((s) => s.id === key) : null;
    const subjects = focal ? [focal] : list;
    if (!subjects.length) {
      ref.tlContent.innerHTML =
        '<div class="ca-tl-empty">PIN ASSETS TO ANALYST BOARD TO VIEW TIMELINE</div>';
      ref.tlStatus.textContent = '—';
      return;
    }
    const timeline = timelineFor(subjects, news());
    ref.tlStatus.textContent = `${timeline.count} EVENTS · ${focal ? focal.title.slice(0, 40) : `${subjects.length} ASSETS`}`;
    if (!timeline.count) {
      ref.tlContent.innerHTML =
        '<div class="ca-tl-empty">NO RELATED EVENTS FOUND IN THE HEADLINES HELD</div>';
      return;
    }
    ref.tlContent.innerHTML = timeline.days
      .map(
        ({ day, stories }) => `
    <div class="ca-tl-day">
      <div class="ca-tl-day-lbl">${esc(day)}</div>
      ${stories
        .map(
          (s) => `
        <div class="ca-tl-item">
          <div class="ca-tl-dot" style="background:${s.color || '#566573'}"></div>
          <div class="ca-tl-item-body">
            <div class="ca-tl-item-cat" style="color:${s.color || '#566573'}">${esc(domainLabel(s.cat).toUpperCase())}${s.brk ? ' · <span style="color:#ff4d5e">BREAKING</span>' : ''}</div>
            <div class="ca-tl-item-title">${esc(s.title)}</div>
            <div class="ca-tl-item-meta">${esc(s.src || '')} · ${esc(s.time || '')}</div>
          </div>
        </div>`,
        )
        .join('')}
    </div>`,
      )
      .join('');
  }
  const closeTimeline = () => {
    ref.tlModal.classList.remove('ca-on');
    ref.tlBd.classList.remove('ca-on');
  };

  // ── Saved boards ────────────────────────────────────────────────
  function saveAnalystBoard() {
    const list = pinned();
    if (!list.length) {
      setStatus('NO ASSETS PINNED — NOTHING TO SAVE', 2500);
      return;
    }
    const board = store.save(boardTitleFor(list));
    if (board) setStatus(`BOARD SAVED · "${esc(board.title)}"`, 3000);
  }
  function renderSavedBoardsList() {
    const boards = store.saved();
    if (!boards.length) {
      ref.sbBody.innerHTML =
        '<div class="ca-sb-empty">NO SAVED BOARDS YET<br>PIN ASSETS AND USE SAVE</div>';
      return;
    }
    ref.sbBody.innerHTML = boards
      .map(
        (
          b,
        ) => `<div class="ca-sb-item" data-act="saved-load" data-key="${esc(b.id)}">
      <div class="ca-sb-item-info">
        <div class="ca-sb-item-title">${esc(b.title)}</div>
        <div class="ca-sb-item-meta">${esc(new Date(b.savedAt).toLocaleString())} · ${b.assets.length} ASSETS</div>
        <div class="ca-sb-item-stories">${b.assets
          .slice(0, 3)
          .map(
            (s) =>
              `<div class="ca-sb-story-preview">· ${esc(s.title.slice(0, 70))}</div>`,
          )
          .join('')}</div>
      </div>
      <button type="button" class="ca-sb-item-del" data-act="saved-delete" data-key="${esc(b.id)}">${ic('close', '#ff5a5a')}DELETE</button>
    </div>`,
      )
      .join('');
  }
  function openSavedBoards() {
    ref.sbModal.classList.add('ca-on');
    ref.sbBd.classList.add('ca-on');
    renderSavedBoardsList();
  }
  const closeSavedBoards = () => {
    ref.sbModal.classList.remove('ca-on');
    ref.sbBd.classList.remove('ca-on');
  };

  // ── Daily and conflict briefs ───────────────────────────────────
  function showBriefModal(title, loading) {
    ref.bmTitle.textContent = title;
    ref.bmDate.textContent = new Date()
      .toUTCString()
      .toUpperCase()
      .replace('GMT', 'UTC');
    ref.bmBody.innerHTML = `<div class="ca-bm-loading">${loading}</div>`;
    ref.bmMeta.textContent = '';
    ref.bmBd.classList.add('ca-on');
    ref.bmModal.classList.add('ca-on');
  }
  function fillBrief(html) {
    ref.bmBody.innerHTML = `${briefBlocks(html)
      .map((block) => `<${block.tag}>${esc(block.text)}</${block.tag}>`)
      .join(
        '',
      )}<div class="ca-ai-note">${AI_NOTE.replace('THE ITEMS PINNED', 'THE HEADLINES LISTED TO IT')}</div>`;
  }
  async function openDailyBrief() {
    const now = new Date();
    briefTitle = 'Daily Situation Report';
    showBriefModal('DAILY SITUATION REPORT', 'ASSEMBLING BRIEF…');
    const top = news().slice(0, 14);
    try {
      const prompt = PROMPTS.daily(top, now);
      fillBrief(await callModel(prompt.system, prompt.user, prompt.maxTokens));
      ref.bmMeta.textContent = `${top.length} SOURCES · GENERATED ${now.toLocaleTimeString()}`;
    } catch (error) {
      ref.bmBody.innerHTML = `<p class="ca-bm-error">ERROR: ${esc(error.message)}</p>`;
    }
  }
  async function openConflictBrief(country) {
    const name = country?.name || 'Unknown';
    const now = new Date();
    briefTitle = `${name} — Conflict Brief`;
    showBriefModal(
      `${name.toUpperCase()} — CONFLICT BRIEF`,
      'ASSESSING CONFLICT…',
    );
    const ctx = conflictStories(name, news());
    try {
      const prompt = PROMPTS.conflict(name, ctx, now);
      fillBrief(await callModel(prompt.system, prompt.user, prompt.maxTokens));
      ref.bmMeta.textContent = `${ctx.length} LIVE SOURCE${ctx.length === 1 ? '' : 'S'} · ${name.toUpperCase()} · GENERATED ${now.toLocaleTimeString()}`;
    } catch (error) {
      ref.bmBody.innerHTML = `<p class="ca-bm-error">BRIEF UNAVAILABLE — ${esc(error.message === 'API_KEY_MISSING' ? 'ADD OPENAI KEY' : error.message)}</p>`;
    }
  }
  const closeDailyBrief = () => {
    ref.bmBd.classList.remove('ca-on');
    ref.bmModal.classList.remove('ca-on');
  };
  function exportDailyBrief() {
    const date = new Date().toDateString();
    const slug =
      briefTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'brief';
    download(
      `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>CORANTO — ${esc(briefTitle)} — ${esc(date)}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,'Times New Roman',serif;max-width:740px;margin:60px auto;padding:0 28px;background:#fafaf8;color:#1c1c2e;line-height:1.75}.masthead{border-bottom:2px solid #1c1c2e;padding-bottom:14px;margin-bottom:28px}.org{font-family:'Courier New',monospace;font-size:10px;letter-spacing:.2em;color:#666;margin-bottom:6px;text-transform:uppercase}h1{font-size:22px;font-weight:normal;letter-spacing:.04em;margin-bottom:4px}.dateline{font-family:'Courier New',monospace;font-size:10px;color:#888;letter-spacing:.1em}h3{font-family:'Courier New',monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#555;margin:28px 0 10px;padding-bottom:5px;border-bottom:1px solid #e0e0d8}p{margin-bottom:15px;font-size:14.5px}.ca-ai-note,.footer{margin-top:40px;padding-top:12px;border-top:1px solid #e0e0d8;font-family:'Courier New',monospace;font-size:9px;color:#888;letter-spacing:.1em}</style></head><body><div class="masthead"><div class="org">Coranto Intelligence Network</div><h1>${esc(briefTitle)}</h1><div class="dateline">${esc(date)}</div></div>${ref.bmBody.innerHTML}<div class="footer">Generated by Coranto · ${esc(date)}</div></body></html>`,
      `coranto-${slug}-${new Date().toISOString().slice(0, 10)}.html`,
    );
  }

  // ── Tools menu, open and close ──────────────────────────────────
  function toggleToolsMenu(open = !toolsOpen) {
    toolsOpen = open;
    ref.toolsMenu.classList.toggle('ca-on', open);
    ref.toolsBtn.classList.toggle('ca-on', open);
    ref.toolsBtn.setAttribute('aria-expanded', String(open));
  }
  const onOutside = (event) => {
    if (toolsOpen && !ref.toolsWrap.contains(event.target))
      toggleToolsMenu(false);
  };
  document.addEventListener('click', onOutside);

  function openAnalystMode() {
    overlay.classList.add('ca-on');
    renderAnalystBoard();
    updateAnalystStatus();
    win.setTimeout(() => {
      resizeAnalystCanvas();
      runAnalystGraph();
    }, 60);
  }
  function closeAnalystMode() {
    overlay.classList.remove('ca-on');
    toggleToolsMenu(false);
    if (animId) {
      win.cancelAnimationFrame(animId);
      animId = 0;
    }
  }
  function clearAssets() {
    runId += 1;
    reckoningOn = false;
    syncReckoning();
    store.clear();
    restStatus();
    ref.briefScroll.innerHTML = BRIEF_EMPTY;
    ref.briefScroll.scrollTop = 0;
    ref.briefMeta.textContent = '—';
  }

  /** Closes whichever layer is on top. Returns false when nothing was open. */
  function closeTop() {
    if (ref.bmModal.classList.contains('ca-on')) closeDailyBrief();
    else if (playbookModal.classList.contains('ca-on'))
      playbookModal.classList.remove('ca-on');
    else if (ref.rtModal.classList.contains('ca-on')) {
      ref.rtModal.classList.remove('ca-on');
      openAnalystMode();
    } else if (ref.mxModal.classList.contains('ca-on')) closeMatrix();
    else if (ref.tlModal.classList.contains('ca-on')) closeTimeline();
    else if (ref.sbModal.classList.contains('ca-on')) closeSavedBoards();
    else if (toolsOpen) toggleToolsMenu(false);
    else if (overlay.classList.contains('ca-on')) closeAnalystMode();
    else return false;
    return true;
  }

  const pinLive = (key) => {
    const story = news().find((s) => s.id === key);
    if (story) store.toggle(storyPin(story));
  };
  const ACTIONS = {
    save: saveAnalystBoard,
    'export-brief': exportBrief,
    synthesize: synthesizeBrief,
    consensus: runConsensusBoard,
    tools: () => toggleToolsMenu(),
    playbook: () => {
      toggleToolsMenu(false);
      generatePlaybook();
    },
    'playbook-generate': generatePlaybook,
    'playbook-export': exportPlaybook,
    'playbook-exit': () => playbookModal.classList.remove('ca-on'),
    redteam: () => {
      toggleToolsMenu(false);
      openRedTeamBrief();
    },
    'redteam-generate': generateRedTeamBrief,
    'redteam-export': exportRedTeam,
    'redteam-exit': () => {
      ref.rtModal.classList.remove('ca-on');
      openAnalystMode();
    },
    timeline: () => {
      toggleToolsMenu(false);
      openNarrativeTimeline();
    },
    'timeline-exit': closeTimeline,
    reckoning: toggleDeadReckoning,
    matrix: () => {
      toggleToolsMenu(false);
      openEscalationMatrix();
    },
    'matrix-recalc': recalculateMatrix,
    'matrix-exit': closeMatrix,
    'matrix-cell': (node) =>
      showMatrixStories(node.dataset.row, node.dataset.col),
    'matrix-pin': (node) => {
      pinLive(node.dataset.key);
      ref.mxPanel.innerHTML = MATRIX_HINT;
    },
    saved: () => {
      toggleToolsMenu(false);
      openSavedBoards();
    },
    'saved-exit': closeSavedBoards,
    'saved-load': (node) => {
      if (!store.load(node.dataset.key)) return;
      closeSavedBoards();
      openAnalystMode();
    },
    'saved-delete': (node) => {
      store.deleteSaved(node.dataset.key);
      renderSavedBoardsList();
    },
    daily: () => {
      toggleToolsMenu(false);
      openDailyBrief();
    },
    'brief-exit': closeDailyBrief,
    'brief-export': exportDailyBrief,
    clear: clearAssets,
    exit: closeAnalystMode,
    'net-reset': () => {
      net.zoom = 1;
      net.panX = 0;
      net.panY = 0;
    },
    'card-open': (node) => {
      const asset = store.list().find((a) => a.key === node.dataset.key);
      if (asset) onOpen(asset);
    },
    'card-timeline': (node) => openNarrativeTimeline(node.dataset.key),
    'card-remove': (node) => store.remove(node.dataset.key),
    'hist-pin': (node) => {
      pinLive(node.dataset.key);
      runHistSearch();
    },
  };
  element.addEventListener('click', (event) => {
    const node = event.target.closest?.('[data-act]');
    if (!node || !element.contains(node)) return;
    // The innermost action wins: DELETE sits inside a row that loads.
    ACTIONS[node.dataset.act]?.(node);
  });

  const unsubscribe = store.subscribe(() => {
    renderAnalystBoard();
    updateAnalystStatus();
    if (overlay.classList.contains('ca-on')) runAnalystGraph();
    onChange();
  });
  const onResize = () => {
    if (!overlay.classList.contains('ca-on')) return;
    resizeAnalystCanvas();
    runAnalystGraph();
  };
  win.addEventListener('resize', onResize);
  restStatus();
  renderAnalystBoard();
  updateAnalystStatus();

  return {
    element,
    isOpen: () =>
      [
        overlay,
        playbookModal,
        ref.rtModal,
        ref.bmModal,
        ref.mxModal,
        ref.tlModal,
        ref.sbModal,
      ].some((layer) => layer.classList.contains('ca-on')),
    open: openAnalystMode,
    close() {
      while (closeTop());
    },
    closeTop,
    render: renderAnalystBoard,
    synthesize: () => {
      openAnalystMode();
      synthesizeBrief();
    },
    consensus: () => {
      openAnalystMode();
      return runConsensusBoard();
    },
    playbook: generatePlaybook,
    redTeam: openRedTeamBrief,
    timeline: () => openNarrativeTimeline(),
    matrix: openEscalationMatrix,
    savedBoards: openSavedBoards,
    deadReckoning: () => {
      openAnalystMode();
      if (!reckoningOn) toggleDeadReckoning();
    },
    openDailyBrief,
    openConflictBrief,
    /** A watched search has new matches while the board is open. */
    flashWatch(count) {
      if (!overlay.classList.contains('ca-on') || !count) return;
      setStatus(
        `<span class="ca-am-flash-alert">WATCHLIST — ${count} MONITORED STOR${count > 1 ? 'IES' : 'Y'} IN LIVE FEED</span>`,
        6000,
      );
    },
    destroy() {
      unsubscribe();
      document.removeEventListener('click', onOutside);
      win.removeEventListener('resize', onResize);
      if (animId) win.cancelAnimationFrame(animId);
      win.clearTimeout(statusTimer);
      win.clearTimeout(histTimer);
      element.remove();
    },
  };
}
