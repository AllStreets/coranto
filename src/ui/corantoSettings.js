import { iconImage } from '../data/corantoIcons.js';
import { connectionRows } from './corantoSettingsModel.js';

const TABS = Object.freeze([
  [
    'general',
    'General',
    'gear',
    'How the header, the clock and the opening view behave',
  ],
  ['notices', 'Notices', 'bell', 'Which arrivals raise a notice'],
  [
    'connections',
    'Connections',
    'link',
    'The server, its keys and every live source',
  ],
  [
    'data',
    'Data and privacy',
    'lock',
    'What this browser keeps, and how to take it or clear it',
  ],
  [
    'about',
    'About',
    'info',
    'The application, its shortcuts and where it comes from',
  ],
]);

const SHORTCUTS = Object.freeze([
  ['Search everything', ['CTRL / CMD', 'K']],
  ['Search the headlines', ['/']],
  ['Close what is open, stop a tour or a replay', ['ESC']],
]);

/** What Coranto does with what it knows about you: very little. */
const PRIVACY = Object.freeze([
  [
    'No accounts, no tracking',
    'Coranto has no sign-in, no analytics, no advertising and no cookies of its own. It does not build a profile of you.',
  ],
  [
    'What stays in this browser',
    'Your watches, pins, saved analyst boards, settings and which notices you have seen are kept in this browser’s storage and nowhere else. Data and privacy, on the left, exports or clears them.',
  ],
  [
    'What the server sees',
    'The Coranto server you are connected to fetches the news and data on your behalf, so the publishers and data sources see the server, not you. Like any web server it can see your address while you are connected. It keeps no log of what you read.',
  ],
  [
    'What goes to a model',
    'Only when you ask for it: an AI brief, a translation, or one of the analyst board’s written tools sends the headlines or pins involved to OpenAI through the server. Voice control, when you switch it on, sends your microphone audio to OpenAI for as long as it is on.',
  ],
  [
    'What your browser fetches directly',
    'Map imagery, fonts, live TV and street-level photographs are loaded by your browser from their providers (for example Esri, Google Fonts, YouTube and Mapillary) when you use them, and those providers see your address as they would on any site.',
  ],
  [
    'Who to ask',
    'Coranto is open source. Questions and corrections go to the issue tracker linked below.',
  ],
]);

const LINKS = Object.freeze([
  ['Source code', 'https://github.com/AllStreets/coranto'],
  ['Report a problem', 'https://github.com/AllStreets/coranto/issues'],
  [
    'What changed',
    'https://github.com/AllStreets/coranto/blob/main/CHANGELOG.md',
  ],
]);

/**
 * The Settings page. Every control saves the moment it is changed; the
 * Connections tab reports what the server and the sources actually answered.
 *
 * @param {object} options
 * @param {Document} options.document
 * @param {Window} options.win
 * @param {ReturnType<import('./corantoSettingsModel.js').createSettingsStore>} options.store
 * @param {() => Array<{group: string, rows: Array<{name: string, state: string, detail?: string}>}> | Promise<any>} options.readSources
 * @param {() => object} options.exportData
 * @param {Array<{id: string, label: string, note: string, run: () => void}>} options.resets
 */
export function createSettings({
  document,
  win,
  store,
  readSources,
  exportData,
  resets = [],
  onClose = () => {},
}) {
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const image = (name, colour = '#cfc8e6') => {
    const node = make('img');
    node.src = iconImage(name, colour);
    node.alt = '';
    return node;
  };

  const element = make('div');
  element.id = 'coranto-settings';
  element.hidden = true;
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-modal', 'true');
  element.setAttribute('aria-label', 'Settings');
  const panel = make('div', 'coranto-settings-panel');
  const nav = make('nav', 'coranto-settings-nav');
  nav.setAttribute('aria-label', 'Settings sections');
  nav.append(make('div', 'coranto-settings-nav-title', 'SETTINGS'));
  const content = make('div', 'coranto-settings-content');
  const close = make('button', 'coranto-story-close coranto-settings-close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close settings');
  close.append(image('close', '#d5d0e2'));
  const saved = make('div', 'coranto-settings-saved', 'SAVED');
  saved.hidden = true;
  saved.setAttribute('role', 'status');
  panel.append(nav, content, close, saved);
  element.append(panel);

  let tab = 'general';
  let health = null;
  let healthState = 'checking';
  let sources = null;
  let savedTimer = 0;
  const tabButtons = new Map();
  for (const [id, label, icon] of TABS) {
    const button = make('button', 'coranto-settings-tab');
    button.type = 'button';
    button.append(image(icon), make('span', '', label));
    button.addEventListener('click', () => show(id));
    tabButtons.set(id, button);
    nav.append(button);
  }

  function flashSaved() {
    saved.hidden = false;
    win.clearTimeout(savedTimer);
    savedTimer = win.setTimeout(() => {
      saved.hidden = true;
    }, 1500);
  }
  function set(id, value) {
    if (store.set(id, value)) flashSaved();
  }

  // ── Pieces ──────────────────────────────────────────────────────
  function card(title, ...children) {
    const node = make('section', 'coranto-settings-card');
    node.append(make('h3', 'coranto-settings-card-title', title), ...children);
    return node;
  }
  function row(label, note, control) {
    const node = make('div', 'coranto-settings-row');
    const text = make('div', 'coranto-settings-row-text');
    text.append(make('div', 'coranto-settings-row-label', label));
    if (note) text.append(make('div', 'coranto-settings-row-note', note));
    node.append(text);
    if (control) node.append(control);
    return node;
  }
  function toggle(id, label) {
    const button = make('button', 'coranto-settings-toggle');
    button.type = 'button';
    button.setAttribute('role', 'switch');
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-checked', String(store.get(id) === true));
    button.append(make('span', 'coranto-settings-toggle-knob'));
    button.addEventListener('click', () => {
      const next = store.get(id) !== true;
      set(id, next);
      button.setAttribute('aria-checked', String(next));
    });
    return button;
  }
  function choice(id, options, label) {
    const group = make('div', 'coranto-settings-choice');
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', label);
    const sync = () => {
      for (const button of group.children)
        button.setAttribute(
          'aria-checked',
          String(button.dataset.value === String(store.get(id))),
        );
    };
    for (const [value, text] of options) {
      const button = make('button', '', text);
      button.type = 'button';
      button.setAttribute('role', 'radio');
      button.dataset.value = String(value);
      button.addEventListener('click', () => {
        set(id, value);
        sync();
      });
      group.append(button);
    }
    sync();
    return group;
  }
  function pill(state, text) {
    const node = make('span', 'coranto-settings-pill', text);
    node.dataset.state = state;
    return node;
  }
  function kv(label, value) {
    const node = make('div', 'coranto-settings-kv');
    node.append(make('span', '', label));
    if (typeof value === 'string') node.append(make('span', '', value));
    else node.append(value);
    return node;
  }
  /** A button that must be pressed twice: the first press asks. */
  function confirmButton(label, run) {
    const button = make('button', 'coranto-settings-danger', label);
    button.type = 'button';
    let armed = 0;
    button.addEventListener('click', () => {
      if (!armed) {
        button.textContent = 'CONFIRM?';
        button.dataset.armed = 'true';
        armed = win.setTimeout(() => {
          armed = 0;
          button.textContent = label;
          delete button.dataset.armed;
        }, 3000);
        return;
      }
      win.clearTimeout(armed);
      armed = 0;
      button.textContent = label;
      delete button.dataset.armed;
      run();
      flashSaved();
    });
    return button;
  }

  // ── Tabs ────────────────────────────────────────────────────────
  function general() {
    const layout = make('div', 'coranto-settings-layouts');
    const options = [
      [
        'menu',
        'LAYERS LIST',
        'One LAYERS button opens a list of every layer, each with what it is and a switch. The header stays short.',
      ],
      [
        'chips',
        'LAYER BUTTONS',
        'SEARCH sits beside LIVE and every layer is its own button in one row you scroll sideways: one click on, one click off.',
      ],
    ];
    const chipRow = (words, lit = []) => {
      const line = make('div');
      for (const word of words) {
        const chip = make('span', '', word);
        if (lit.includes(word)) chip.dataset.kind = 'layer';
        line.append(chip);
      }
      return line;
    };
    // Each card draws its own layout: a dropped list of switches, or a row
    // of buttons.
    const sampleFor = (value) => {
      const strip = make('div', 'coranto-settings-layout-sample');
      strip.dataset.kind = value;
      if (value === 'chips') {
        strip.append(
          ...chipRow(
            [
              'LIVE',
              'SEARCH',
              'HAZARDS',
              'FLIGHTS',
              'MILITARY',
              'SHIPS',
              'QUAKES',
              'FIRES',
            ],
            ['HAZARDS', 'MILITARY'],
          ).children,
        );
        return strip;
      }
      strip.append(chipRow(['LIVE', 'MENU', 'LAYERS', 'SEARCH'], ['LAYERS']));
      for (const [name, on] of [
        ['HAZARDS', true],
        ['FLIGHTS', false],
        ['MILITARY', true],
      ]) {
        const line = make('div');
        line.dataset.row = '';
        const knob = make('i');
        if (on) knob.dataset.on = '';
        line.append(make('span', '', name), knob);
        strip.append(line);
      }
      return strip;
    };
    const sync = () => {
      for (const button of layout.children)
        button.setAttribute(
          'aria-checked',
          String(button.dataset.value === store.get('headerLayout')),
        );
    };
    layout.setAttribute('role', 'radiogroup');
    layout.setAttribute('aria-label', 'Header layout');
    for (const [value, name, note] of options) {
      const button = make('button', 'coranto-settings-layout');
      button.type = 'button';
      button.setAttribute('role', 'radio');
      button.dataset.value = value;
      const strip = sampleFor(value);
      button.append(
        strip,
        make('div', 'coranto-settings-layout-name', name),
        make('div', 'coranto-settings-row-note', note),
      );
      button.addEventListener('click', () => {
        set('headerLayout', value);
        sync();
      });
      layout.append(button);
    }
    sync();
    return [
      card('HEADER', layout),
      card(
        'VIEW',
        row(
          'Open in',
          'The view Coranto starts in. Last used is where you left it.',
          choice(
            'startView',
            [
              ['last', 'LAST USED'],
              ['news', 'NEWS'],
              ['instruments', 'INSTRUMENTS'],
            ],
            'Opening view',
          ),
        ),
        row(
          'Clock',
          'The time in the header. Story times are unchanged.',
          choice(
            'clock',
            [
              ['utc', 'UTC'],
              ['local', 'LOCAL'],
            ],
            'Clock',
          ),
        ),
        row(
          'Sharp globe',
          'Draw the globe at this screen’s full resolution, so icons and names are crisp. Switch it off if the globe feels slow.',
          toggle('sharpGlobe', 'Sharp globe'),
        ),
        row(
          'Headline ticker',
          'The moving line of latest headlines under the header.',
          toggle('ticker', 'Headline ticker'),
        ),
      ),
    ];
  }

  function noticesTab() {
    return [
      card(
        'NOTICES',
        row(
          'Your watches',
          'When a place or term you watch gets new stories.',
          toggle('noticeWatches', 'Notices for your watches'),
        ),
        row(
          'Disaster alerts',
          'Orange and Red alerts from the disaster trackers.',
          toggle('noticeHazards', 'Notices for disaster alerts'),
        ),
        row(
          'Disease outbreaks',
          'New World Health Organization outbreak notices.',
          toggle('noticeOutbreaks', 'Notices for disease outbreaks'),
        ),
      ),
      make(
        'p',
        'coranto-settings-foot',
        'A notice is raised only by something a source reported. Switching one off stops the notice; the story, alert or outbreak is still shown where it belongs.',
      ),
    ];
  }

  function connections() {
    const dot = make('span', 'coranto-settings-dot');
    dot.dataset.state = healthState;
    const status = make('span', 'coranto-settings-status');
    status.append(
      dot,
      make(
        'span',
        '',
        healthState === 'ok'
          ? 'Online'
          : healthState === 'down'
            ? 'Unreachable'
            : 'Checking',
      ),
    );
    const test = make('button', 'coranto-settings-button', 'TEST CONNECTION');
    test.type = 'button';
    test.disabled = healthState === 'checking';
    test.addEventListener('click', check);
    const server = card(
      'SERVER',
      kv('Coranto server', status),
      kv('Version', health?.version ? `v${health.version}` : 'Not known'),
      kv(
        'Last checked',
        health?.checkedAt
          ? new Date(health.checkedAt).toLocaleTimeString()
          : 'Not yet',
      ),
      test,
    );
    const keys = card('KEYS ON THE SERVER');
    for (const entry of connectionRows(health)) {
      keys.append(
        row(
          entry.name,
          entry.unlocks,
          entry.set === null
            ? pill('unknown', 'NOT KNOWN')
            : entry.set
              ? pill('ok', 'CONFIGURED')
              : pill('off', 'NOT SET'),
        ),
      );
    }
    keys.append(
      make(
        'p',
        'coranto-settings-foot',
        'Keys live in the server’s .env file and are never sent to this page. This list shows only whether each one is set.',
      ),
    );
    const out = [server, keys];
    if (!sources)
      out.push(
        card(
          'LIVE SOURCES',
          make('p', 'coranto-settings-foot', 'Asking the sources…'),
        ),
      );
    else
      for (const group of sources) {
        const live = group.rows.filter((entry) => entry.state === 'ok').length;
        const node = card(
          `${group.group.toUpperCase()} · ${live} OF ${group.rows.length} ANSWERING`,
        );
        const list = make('div', 'coranto-settings-sources');
        for (const entry of group.rows) {
          const line = make('div', 'coranto-settings-source');
          line.dataset.state = entry.state;
          const mark = make('span', 'coranto-settings-dot');
          mark.dataset.state = entry.state;
          line.append(
            mark,
            make('span', 'coranto-settings-source-name', entry.name),
            make(
              'span',
              'coranto-settings-source-detail',
              entry.detail ??
                (entry.state === 'ok'
                  ? 'Answering'
                  : entry.state === 'off'
                    ? 'Not set up'
                    : 'Not answering'),
            ),
          );
          list.append(line);
        }
        if (!group.rows.length)
          list.append(
            make('p', 'coranto-settings-foot', 'This source did not answer.'),
          );
        node.append(list);
        out.push(node);
      }
    return out;
  }

  function dataTab() {
    const data = exportData();
    const names = Object.keys(data);
    const exportBtn = make(
      'button',
      'coranto-settings-button',
      'EXPORT AS JSON',
    );
    exportBtn.type = 'button';
    exportBtn.addEventListener('click', () => {
      const blob = new win.Blob(
        [
          JSON.stringify(
            { exportedAt: new Date().toISOString(), data: exportData() },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      );
      const url = win.URL.createObjectURL(blob);
      const link = make('a');
      link.href = url;
      link.download = `coranto-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
    });
    const danger = card('CLEAR');
    danger.classList.add('coranto-settings-card-danger');
    for (const reset of resets)
      danger.append(
        row(
          reset.label,
          reset.note,
          confirmButton(reset.button, () => {
            reset.run();
            render();
          }),
        ),
      );
    return [
      card(
        'WHAT IS KEPT',
        make(
          'p',
          'coranto-settings-foot',
          'Coranto has no accounts. Your watches, pins, analyst boards and these settings are kept in this browser only and are sent nowhere.',
        ),
        kv(
          'Kept in this browser',
          `${names.length} ${names.length === 1 ? 'record' : 'records'}`,
        ),
        row(
          'Take a copy',
          'One file with everything this browser keeps for Coranto.',
          exportBtn,
        ),
      ),
      danger,
    ];
  }

  function privacy() {
    const node = card('PRIVACY POLICY');
    for (const [heading, text] of PRIVACY)
      node.append(
        make('div', 'coranto-settings-row-label', heading),
        make('p', 'coranto-settings-foot coranto-settings-policy', text),
      );
    return node;
  }

  function about() {
    const keys = card('KEYBOARD');
    for (const [what, combo] of SHORTCUTS) {
      const chips = make('span', 'coranto-settings-keys');
      for (const key of combo) chips.append(make('kbd', '', key));
      keys.append(kv(what, chips));
    }
    const links = card('LINKS');
    for (const [label, href] of LINKS) {
      const link = make('a', 'coranto-settings-link');
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.append(make('span', '', label), image('external', '#b47cff'));
      links.append(link);
    }
    return [
      card(
        'APPLICATION',
        kv('Name', 'Coranto'),
        kv('Version', health?.version ? `v${health.version}` : 'Not known'),
        kv('Licence', 'Apache-2.0, with MIT parts from God’s Eye View'),
        kv('Globe', 'CesiumJS'),
        kv('Accounts', 'None'),
      ),
      card(
        'WHAT IT IS',
        make(
          'p',
          'coranto-settings-foot',
          'Coranto shows what public sources report, where they report it, and who said it. Nothing on the globe or in the feed is invented or simulated. Where a model wrote something, it is labelled as written by a model.',
        ),
      ),
      card(
        'ONE THING THAT IS STYLE, NOT FACT',
        make(
          'p',
          'coranto-settings-foot',
          'The analyst board stamps its briefs TOP SECRET, NOFORN and REL TO FVEY, as AUSPEX did. Those stamps are decoration. Nothing in Coranto is classified: every item comes from a public source, and the board’s written briefs come from a model. It is the only thing on screen that is not literally true, and it is kept for the look.',
        ),
      ),
      privacy(),
      keys,
      links,
    ];
  }

  const BUILD = {
    general,
    notices: noticesTab,
    connections,
    data: dataTab,
    about,
  };

  function render() {
    for (const [id, button] of tabButtons)
      button.setAttribute('aria-current', id === tab ? 'page' : 'false');
    const [, label, icon, subtitle] = TABS.find(([id]) => id === tab);
    const head = make('header', 'coranto-settings-head');
    const tile = make('span', 'coranto-settings-head-icon');
    tile.append(image(icon, '#b47cff'));
    const text = make('div');
    text.append(
      make('h2', 'coranto-settings-title', label),
      make('p', 'coranto-settings-subtitle', subtitle),
    );
    head.append(tile, text);
    const top = content.scrollTop;
    content.replaceChildren(head, ...BUILD[tab]());
    content.scrollTop = top;
  }

  async function check() {
    healthState = 'checking';
    if (tab === 'connections') render();
    try {
      const response = await win.fetch('/api/coranto/health', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('down');
      health = await response.json();
      healthState = 'ok';
    } catch {
      healthState = 'down';
      health = health ? { ...health, keys: null } : null;
    }
    try {
      sources = await readSources();
    } catch {
      sources = [];
    }
    if (!element.hidden) render();
  }

  function show(id) {
    tab = id;
    content.scrollTop = 0;
    render();
  }
  function open(id = tab) {
    element.hidden = false;
    show(id);
    check();
    tabButtons.get(tab)?.focus();
  }
  function closePanel() {
    if (element.hidden) return;
    element.hidden = true;
    onClose();
  }
  close.addEventListener('click', closePanel);
  element.addEventListener('pointerdown', (event) => {
    if (event.target === element) closePanel();
  });

  return {
    element,
    open,
    close: closePanel,
    isOpen: () => !element.hidden,
  };
}
