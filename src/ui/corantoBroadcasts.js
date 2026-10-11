/**
 * Live television news channels, from AUSPEX's broadcaster list: one or two
 * for each inhabited continent. Coranto links to each channel's live page and
 * does not embed the player, so nothing is loaded from the video site until
 * the reader chooses to open it.
 */
export const BROADCASTERS = Object.freeze([
  [
    'Al Jazeera English',
    'Doha',
    'Middle East, Africa, Asia',
    'UCNye-wNBqNL5ZzHSJj3l8Bg',
  ],
  [
    'France 24 English',
    'Paris',
    'France, Africa, Europe',
    'UCQfwfsi5VrQ8yKZ-UWmAEFg',
  ],
  ['DW News', 'Berlin', 'Germany, Europe', 'UCknLrEdhRCp1aegoMqRaCZg'],
  ['Africanews', 'Pointe-Noire', 'Pan-African', 'UC1_E8NeF5QHY2dtdLRBCCLA'],
  ['CNA', 'Singapore', 'Asia and the Pacific', 'UC83jt4dlz1Gjl58fzQrrKZg'],
  [
    '9 News Australia',
    'Sydney',
    'Australia and the Pacific',
    'UCIYLOcEUX6TbBo7HQVF2PKA',
  ],
  ['CBS News', 'New York', 'United States', 'UC8p1vwvWtl6T73JiExfWs1g'],
  ['NBC News', 'New York', 'United States', 'UCeY0bbntWzzVIaj2z3QigXg'],
  [
    'DW Español',
    'Berlin',
    'Latin America, in Spanish',
    'UCT4Jg8h03dD0iN3Pb5L0PMA',
  ],
  [
    'Yahoo Finance',
    'New York',
    'Markets and business',
    'UCEAZeUIeJs0IjQiqTCdVSIg',
  ],
]);

/** The channel's live page on the video site. */
export const broadcastUrl = (channelId) =>
  `https://www.youtube.com/channel/${channelId}/live`;

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

/** The Live TV dialog. Returns `{ element, open, close }`. */
export function createBroadcastsDialog({ document }) {
  const close = el(document, 'button', {
    type: 'button',
    class: 'coranto-guide-close',
    text: 'Close',
  });
  const list = el(document, 'div', { class: 'coranto-tv-list' });
  for (const [name, city, covers, channelId] of BROADCASTERS)
    list.append(
      el(
        document,
        'a',
        {
          class: 'coranto-tv',
          href: broadcastUrl(channelId),
          target: '_blank',
          rel: 'noopener noreferrer',
        },
        el(document, 'strong', { text: name }),
        el(document, 'span', { text: `${city} · ${covers}` }),
        el(document, 'em', { text: 'Open live at youtube.com' }),
      ),
    );
  const element = el(
    document,
    'div',
    { id: 'coranto-tv', role: 'dialog', 'aria-label': 'Live television news' },
    el(
      document,
      'div',
      { class: 'coranto-guide-card' },
      el(document, 'div', {
        class: 'coranto-guide-kicker',
        text: 'CORANTO · LIVE TV',
      }),
      el(document, 'h2', { text: 'Watch the newsrooms live' }),
      el(document, 'p', {
        class: 'coranto-briefing-note',
        text: 'Each link opens the channel’s live stream on YouTube in a new tab. Coranto does not embed the player, so nothing loads from YouTube until you click.',
      }),
      list,
      close,
    ),
  );
  element.hidden = true;
  const api = {
    element,
    open() {
      element.hidden = false;
      close.focus({ preventScroll: true });
    },
    close() {
      element.hidden = true;
    },
  };
  close.addEventListener('click', api.close);
  element.addEventListener('click', (event) => {
    if (event.target === element) api.close();
  });
  return api;
}
