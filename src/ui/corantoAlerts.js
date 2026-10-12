import { iconImage } from '../data/corantoIcons.js';

/**
 * Notices: Coranto telling you something arrived, so you do not have to keep
 * looking. Three things raise one, all of them something a source published:
 *
 *   - a saved watch has more new stories than when it was last checked;
 *   - the disaster trackers raise an Orange or Red alert not seen before;
 *   - the World Health Organization posts an outbreak notice not seen before.
 *
 * Nothing is raised the first time each is read: what is already there when
 * the page opens is not news to announce.
 */
export const ALERT_KEY = 'coranto.alerts.v1';
export const NOTICE_LIMIT = 4;
const SEEN_LIMIT = 500;

/** Watches whose count of new stories went up since the last check. */
export function watchAlerts(previous, current) {
  if (!previous) return [];
  const out = [];
  for (const watch of current ?? []) {
    const before = previous.get(watch.id);
    // A watch not seen before was just saved; that is not an arrival.
    if (before === undefined || watch.fresh <= before) continue;
    const more = watch.fresh - before;
    out.push({
      id: `watch:${watch.id}:${watch.fresh}`,
      kind: 'watch',
      icon: 'star',
      title: `Your watch ${watch.name}`,
      detail: `${more} more new ${more === 1 ? 'story' : 'stories'}, ${watch.fresh} in all`,
      watchId: watch.id,
    });
  }
  return out;
}

/**
 * Items not seen before. `seen` is null the first time, when everything is
 * recorded and nothing is announced.
 * @returns {{fresh: object[], seen: Set<string>}}
 */
export function unseen(seen, items) {
  const next = new Set(seen ?? []);
  const fresh = [];
  for (const item of items ?? []) {
    if (!item?.id || next.has(item.id)) continue;
    next.add(item.id);
    if (seen) fresh.push(item);
  }
  // Keep the newest ids only, so the record cannot grow without end.
  return { fresh, seen: new Set([...next].slice(-SEEN_LIMIT)) };
}

/** Orange and Red disaster alerts as notices. */
export function hazardNotices(events) {
  return (events ?? [])
    .filter((event) => event.alert === 'Orange' || event.alert === 'Red')
    .map((event) => ({
      id: `hazard:${event.id}`,
      kind: 'hazard',
      icon: 'hazard',
      title: `${event.alert} alert: ${event.title}`,
      detail: event.source ?? 'Disaster tracker',
      hazardId: event.id,
      lat: event.lat,
      lon: event.lon,
    }));
}

/** WHO outbreak notices as notices. */
export function outbreakNotices(outbreaks) {
  return (outbreaks ?? []).map((item) => ({
    id: `who:${item.id}`,
    kind: 'outbreak',
    icon: 'outbreak',
    title: `WHO outbreak notice: ${item.disease}`,
    detail: item.where || 'World Health Organization',
    url: item.url,
  }));
}

/**
 * The stack of notices over the globe, and the browser notification that
 * goes with one when the reader has asked for those and the tab is hidden.
 *
 * @param {object} options
 * @param {Document} options.document
 * @param {Window} options.win
 * @param {(notice: object) => void} options.onOpen
 * @param {() => boolean} options.outsideTab Whether to notify outside the tab.
 */
export function createNotices({ document, win, onOpen, outsideTab }) {
  const element = document.createElement('div');
  element.id = 'coranto-notices';
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');
  const shown = new Map();

  function dismiss(id) {
    const entry = shown.get(id);
    if (!entry) return;
    win.clearTimeout(entry.timer);
    entry.node.remove();
    shown.delete(id);
  }

  function show(notice) {
    if (shown.has(notice.id)) return;
    // Oldest out when the stack is full.
    while (shown.size >= NOTICE_LIMIT) dismiss(shown.keys().next().value);
    const node = document.createElement('div');
    node.className = 'coranto-notice';
    node.dataset.kind = notice.kind;
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'coranto-notice-open';
    open.title = 'Show it';
    const icon = document.createElement('img');
    icon.src = iconImage(notice.icon, '#e6e0f7');
    icon.alt = '';
    const text = document.createElement('span');
    text.className = 'coranto-notice-text';
    const title = document.createElement('span');
    title.className = 'coranto-notice-title';
    title.textContent = notice.title;
    const detail = document.createElement('span');
    detail.className = 'coranto-notice-detail';
    detail.textContent = notice.detail;
    text.append(title, detail);
    open.append(icon, text);
    open.addEventListener('click', () => {
      dismiss(notice.id);
      onOpen(notice);
    });
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'coranto-notice-close';
    close.setAttribute('aria-label', 'Dismiss');
    const closeIcon = document.createElement('img');
    closeIcon.src = iconImage('close', '#a9a2bf');
    closeIcon.alt = '';
    close.append(closeIcon);
    close.addEventListener('click', () => dismiss(notice.id));
    node.append(open, close);
    element.append(node);
    shown.set(notice.id, {
      node,
      timer: win.setTimeout(() => dismiss(notice.id), 30_000),
    });
    // Outside the tab, only when asked for and only while it is hidden.
    try {
      if (
        outsideTab() &&
        document.hidden &&
        win.Notification?.permission === 'granted'
      ) {
        const system = new win.Notification(notice.title, {
          body: notice.detail,
          tag: notice.id,
        });
        system.onclick = () => {
          win.focus?.();
          onOpen(notice);
        };
      }
    } catch {
      // A browser that refuses is simply not notified outside the tab.
    }
  }

  return {
    element,
    show,
    count: () => shown.size,
    clear() {
      for (const id of [...shown.keys()]) dismiss(id);
    },
  };
}
