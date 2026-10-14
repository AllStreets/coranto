/**
 * A small PDF writer for the analyst board's exports.
 *
 * It writes real, text-selectable PDF pages in Coranto's look from a list of
 * blocks (headings, paragraphs, cards, chips, meters). It uses the fonts every
 * PDF reader carries (Helvetica and Courier), so nothing is fetched and
 * nothing is embedded. Those fonts cover Western European text; a letter
 * outside them is written without its accent where that is possible and as
 * `?` otherwise, so a headline in another script will not read correctly.
 *
 * Pure: no DOM, no I/O. `buildPdf` returns the file's bytes.
 */

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 50;
const BANNER_H = 20;
const TOP = BANNER_H + 30;
const BOTTOM = PAGE_H - BANNER_H - 34;
const WIDTH = PAGE_W - MARGIN * 2;

const INK = {
  page: '#06070f',
  card: '#0c0e1a',
  text: '#c9d2ea',
  bright: '#f0f2ff',
  dim: '#6b7797',
  rule: '#1a2240',
  violet: '#b47cff',
  banner: '#c1121f',
};

const FONT = { sans: 'F1', bold: 'F2', mono: 'F3', monoBold: 'F4' };

// Helvetica advance widths for the characters 32 to 126, in 1/1000 em.
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
  584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222,
  500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
  500, 334, 260, 334, 584,
];
const HELVETICA_HIGH = new Map([
  [0x85, 1000],
  [0x91, 222],
  [0x92, 222],
  [0x93, 333],
  [0x94, 333],
  [0x95, 350],
  [0x96, 556],
  [0x97, 1000],
]);

// Windows-1252 code points for the punctuation it adds to Latin-1.
const CP1252 = new Map([
  ['€', 0x80],
  ['‚', 0x82],
  ['„', 0x84],
  ['…', 0x85],
  ['‘', 0x91],
  ['’', 0x92],
  ['“', 0x93],
  ['”', 0x94],
  ['•', 0x95],
  ['–', 0x96],
  ['—', 0x97],
  ['™', 0x99],
  ['−', 0x2d],
  [' ', 0x20],
]);

/**
 * Text as the single-byte characters the PDF's fonts hold (WinAnsi).
 * @param {unknown} value
 * @returns {string} Every character is below 256.
 */
export function pdfText(value) {
  let out = '';
  for (const char of String(value ?? '').replace(/\s+/g, ' ')) {
    const code = char.codePointAt(0);
    if (code >= 32 && code <= 126) out += char;
    else if (code >= 0xa1 && code <= 0xff) out += char;
    else if (CP1252.has(char)) out += String.fromCharCode(CP1252.get(char));
    else {
      const plain = char.normalize('NFD').replace(/[̀-ͯ]/g, '');
      const first = plain.codePointAt(0);
      out += plain.length === 1 && first >= 32 && first <= 126 ? plain : '?';
    }
  }
  return out.trim();
}

function charWidth(code, font) {
  if (font === FONT.mono || font === FONT.monoBold) return 600;
  let width;
  if (code >= 32 && code <= 126) width = HELVETICA[code - 32];
  else if (HELVETICA_HIGH.has(code)) width = HELVETICA_HIGH.get(code);
  else width = code >= 0xc0 && code <= 0xde ? 667 : 556;
  return font === FONT.bold ? width * 1.1 : width;
}

/** The width of already-encoded text, in points. */
export function textWidth(text, font, size, spacing = 0) {
  let units = 0;
  for (let i = 0; i < text.length; i++)
    units += charWidth(text.charCodeAt(i), font);
  return (units / 1000) * size + spacing * text.length;
}

/** Break encoded text into lines no wider than `max` points. */
export function wrapText(text, font, size, max, spacing = 0) {
  const lines = [];
  let line = '';
  const fits = (candidate) => textWidth(candidate, font, size, spacing) <= max;
  for (let word of text.split(' ').filter(Boolean)) {
    // A single word wider than the line is cut where it stops fitting.
    while (!fits(word)) {
      let cut = word.length - 1;
      while (cut > 1 && !fits(word.slice(0, cut))) cut -= 1;
      if (line) lines.push(line);
      lines.push(word.slice(0, cut));
      line = '';
      word = word.slice(cut);
    }
    const next = line ? `${line} ${word}` : word;
    if (fits(next)) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function rgb(hex) {
  const value = /^#[0-9a-f]{6}$/i.test(String(hex)) ? hex : INK.text;
  return [1, 3, 5]
    .map((at) => (parseInt(value.slice(at, at + 2), 16) / 255).toFixed(3))
    .join(' ');
}
const literal = (text) => text.replace(/[\\()]/g, (char) => `\\${char}`);
const num = (value) => Number(value.toFixed(2));

/**
 * Build a PDF.
 *
 * @param {object} doc
 * @param {string} doc.title The document's title, on the first page.
 * @param {string} [doc.kicker] The small line above the title.
 * @param {string} [doc.meta] The small line under the title.
 * @param {string} [doc.marking] The banner at the top and bottom of each page.
 * @param {string} [doc.bannerColour]
 * @param {Array<object>} doc.blocks What the document holds, in order:
 *   `{ type: 'heading', text, count? }`
 *   `{ type: 'para', text, colour? }`
 *   `{ type: 'card', strip: [{ text, colour? }], text, colour? }`
 *   `{ type: 'chips', items: [{ text, colour? }] }`
 *   `{ type: 'stats', items: [{ value, label, colour? }] }`
 *   `{ type: 'meter', label, value, colour? }` (value 0 to 100)
 *   `{ type: 'note', text }`
 * @returns {Uint8Array}
 */
export function buildPdf({
  title,
  kicker = 'CORANTO',
  meta = '',
  marking = '',
  bannerColour = INK.banner,
  blocks = [],
}) {
  const pages = [];
  let ops = null;
  let y = 0;

  const rect = (x, top, w, h, colour) =>
    ops.push(
      `${rgb(colour)} rg ${num(x)} ${num(PAGE_H - top - h)} ${num(w)} ${num(h)} re f`,
    );
  /** Draw encoded text with its baseline `baseline` points from the top. */
  const draw = (text, x, baseline, font, size, colour, spacing = 0) =>
    ops.push(
      `BT /${font} ${size} Tf ${rgb(colour)} rg ${num(spacing)} Tc ${num(x)} ${num(PAGE_H - baseline)} Td (${literal(text)}) Tj ET`,
    );
  function newPage() {
    ops = [];
    pages.push(ops);
    rect(0, 0, PAGE_W, PAGE_H, INK.page);
    y = TOP;
  }
  const room = (height) => {
    if (y + height > BOTTOM) newPage();
  };
  /** Wrapped text, one line at a time, moving to a new page when needed. */
  function flow(
    text,
    { font, size, colour, lead, x, width, spacing = 0, back },
  ) {
    for (const line of wrapText(text, font, size, width, spacing)) {
      room(lead);
      if (back) back(y, lead);
      draw(line, x, y + lead * 0.72, font, size, colour, spacing);
      y += lead;
    }
  }
  const label = (text) => pdfText(text).toUpperCase();

  newPage();
  draw(label(kicker), MARGIN, y + 8, FONT.monoBold, 8, INK.violet, 3);
  y += 20;
  flow(pdfText(title), {
    font: FONT.bold,
    size: 20,
    colour: INK.bright,
    lead: 25,
    x: MARGIN,
    width: WIDTH,
  });
  if (meta) {
    y += 2;
    flow(label(meta), {
      font: FONT.mono,
      size: 7.5,
      colour: INK.dim,
      lead: 12,
      x: MARGIN,
      width: WIDTH,
      spacing: 1,
    });
  }
  y += 8;
  rect(MARGIN, y, WIDTH, 0.6, INK.rule);
  rect(MARGIN, y, 40, 0.6, INK.violet);
  y += 16;

  for (const block of blocks) {
    if (block.type === 'heading') {
      y += 8;
      room(44);
      draw(label(block.text), MARGIN, y + 8, FONT.monoBold, 8, INK.bright, 2);
      if (block.count) {
        const count = label(block.count);
        draw(
          count,
          MARGIN + WIDTH - textWidth(count, FONT.mono, 7, 1),
          y + 8,
          FONT.mono,
          7,
          INK.dim,
          1,
        );
      }
      y += 14;
      rect(MARGIN, y, WIDTH, 0.6, INK.rule);
      rect(MARGIN, y, 28, 0.6, INK.violet);
      y += 10;
    } else if (block.type === 'para') {
      flow(pdfText(block.text), {
        font: FONT.sans,
        size: 10,
        colour: block.colour ?? INK.text,
        lead: 15,
        x: MARGIN,
        width: WIDTH,
      });
      y += 7;
    } else if (block.type === 'note') {
      y += 4;
      flow(label(block.text), {
        font: FONT.mono,
        size: 6.5,
        colour: INK.dim,
        lead: 10,
        x: MARGIN,
        width: WIDTH,
        spacing: 0.8,
      });
      y += 8;
    } else if (block.type === 'card') {
      const edge = block.colour ?? INK.violet;
      // Each line draws its own slice of the card, so a card can cross pages.
      const back = (top, height) => {
        rect(MARGIN, top, WIDTH, height + 0.3, INK.card);
        rect(MARGIN, top, 2, height + 0.3, edge);
      };
      room(40);
      back(y, 6);
      y += 6;
      const strip = (block.strip ?? []).filter((part) => pdfText(part.text));
      if (strip.length) {
        room(12);
        back(y, 12);
        let x = MARGIN + 12;
        const inner = WIDTH - 24;
        for (const part of strip) {
          const colour = part.colour ?? INK.dim;
          // A part too long for one line (a sentence, not a tag) is wrapped
          // on lines of its own.
          const pieces = wrapText(label(part.text), FONT.mono, 6.5, inner, 0.8);
          if (pieces.length > 1) {
            if (x > MARGIN + 12) {
              y += 12;
              room(12);
              back(y, 12);
            }
            pieces.forEach((piece, i) => {
              if (i) {
                y += 10;
                room(12);
                back(y, 12);
              }
              draw(piece, MARGIN + 12, y + 8, FONT.mono, 6.5, colour, 0.8);
            });
            x = MARGIN + 12 + inner;
            continue;
          }
          const text = pieces[0] ?? '';
          const width = textWidth(text, FONT.mono, 6.5, 0.8);
          if (x + width > MARGIN + 12 + inner && x > MARGIN + 12) {
            y += 12;
            room(12);
            back(y, 12);
            x = MARGIN + 12;
          }
          draw(text, x, y + 8, FONT.mono, 6.5, colour, 0.8);
          x += width + 10;
        }
        y += 12;
      }
      flow(pdfText(block.text), {
        font: FONT.sans,
        size: 9.5,
        colour: INK.text,
        lead: 14,
        x: MARGIN + 12,
        width: WIDTH - 24,
        back,
      });
      back(y, 6);
      y += 12;
    } else if (block.type === 'chips') {
      let x = MARGIN;
      room(18);
      for (const item of block.items ?? []) {
        const text = label(item.text);
        if (!text) continue;
        const width = textWidth(text, FONT.mono, 6.5, 0.8) + 14;
        if (x + width > MARGIN + WIDTH && x > MARGIN) {
          x = MARGIN;
          y += 18;
          room(18);
        }
        const colour = item.colour ?? INK.violet;
        rect(x, y, width, 13, INK.card);
        rect(x, y + 12.4, width, 0.6, colour);
        draw(text, x + 7, y + 9, FONT.mono, 6.5, colour, 0.8);
        x += width + 6;
      }
      y += 24;
    } else if (block.type === 'stats') {
      const items = block.items ?? [];
      const each = (WIDTH - 8 * (items.length - 1)) / Math.max(1, items.length);
      room(52);
      items.forEach((item, i) => {
        const x = MARGIN + i * (each + 8);
        rect(x, y, each, 44, INK.card);
        rect(x, y + 43.4, each, 0.6, item.colour ?? INK.violet);
        draw(
          pdfText(item.value),
          x + 10,
          y + 23,
          FONT.bold,
          17,
          item.colour ?? INK.bright,
        );
        draw(label(item.label), x + 10, y + 36, FONT.mono, 6.5, INK.dim, 1.2);
      });
      y += 56;
    } else if (block.type === 'meter') {
      const value = Math.max(0, Math.min(100, Number(block.value) || 0));
      const colour = block.colour ?? INK.violet;
      const figure = `${Math.round(value)}%`;
      room(24);
      draw(label(block.label), MARGIN, y + 8, FONT.monoBold, 7, colour, 1.2);
      draw(
        figure,
        MARGIN + WIDTH - textWidth(figure, FONT.monoBold, 8),
        y + 8,
        FONT.monoBold,
        8,
        colour,
      );
      y += 13;
      rect(MARGIN, y, WIDTH, 3, INK.rule);
      rect(MARGIN, y, (WIDTH * value) / 100, 3, colour);
      y += 10;
    }
  }

  // Banners and page numbers, now that the page count is known.
  const foot = label(`${kicker} · ${title}`).slice(0, 80);
  pages.forEach((page, i) => {
    ops = page;
    const mark = label(marking);
    for (const top of [0, PAGE_H - BANNER_H]) {
      rect(0, top, PAGE_W, BANNER_H, marking ? bannerColour : INK.card);
      if (mark)
        draw(
          mark,
          (PAGE_W - textWidth(mark, FONT.monoBold, 7, 2)) / 2,
          top + 13,
          FONT.monoBold,
          7,
          '#ffffff',
          2,
        );
    }
    const at = `${i + 1} / ${pages.length}`;
    const base = PAGE_H - BANNER_H - 12;
    draw(foot, MARGIN, base, FONT.mono, 6.5, INK.dim, 0.8);
    draw(
      at,
      MARGIN + WIDTH - textWidth(at, FONT.mono, 6.5, 0.8),
      base,
      FONT.mono,
      6.5,
      INK.dim,
      0.8,
    );
  });

  // The file: catalog, page tree, four fonts, then a page and its drawing.
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '',
    ...['Helvetica', 'Helvetica-Bold', 'Courier', 'Courier-Bold'].map(
      (name) =>
        `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`,
    ),
  ];
  const kids = [];
  for (const page of pages) {
    const stream = page.join('\n');
    kids.push(`${objects.length + 1} 0 R`);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> /Contents ${objects.length + 2} 0 R >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
  let file = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets = objects.map((body, i) => {
    const at = file.length;
    file += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = file.length;
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .map((at) => `${String(at).padStart(10, '0')} 00000 n \n`)
    .join(
      '',
    )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info << /Title (${literal(pdfText(title))}) /Producer (Coranto) >> >>\nstartxref\n${xref}\n%%EOF\n`;
  // Every character written is below 256, so one character is one byte.
  const bytes = new Uint8Array(file.length);
  for (let i = 0; i < file.length; i++) bytes[i] = file.charCodeAt(i) & 0xff;
  return bytes;
}
