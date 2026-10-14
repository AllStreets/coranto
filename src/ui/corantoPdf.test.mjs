import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPdf, pdfText, textWidth, wrapText } from './corantoPdf.js';

const text = (bytes) => Buffer.from(bytes).toString('latin1');

test('text is written in the characters the PDF fonts hold', () => {
  assert.equal(pdfText('  Plain   text\n'), 'Plain text');
  assert.equal(pdfText('café'), 'café');
  assert.equal(pdfText('“quote” — it’s'), '\x93quote\x94 \x97 it\x92s');
  assert.equal(
    pdfText('Łódź'),
    '?ódz',
    'accents are dropped when the letter is not held',
  );
  assert.equal(pdfText('中文'), '??');
  for (const char of pdfText('中 € ü 😀')) assert.ok(char.charCodeAt(0) < 256);
});

test('lines are wrapped to the width, and a long word is cut', () => {
  const lines = wrapText('one two three four five six seven', 'F1', 10, 60);
  assert.ok(lines.length > 1);
  for (const line of lines) assert.ok(textWidth(line, 'F1', 10) <= 60);
  assert.equal(lines.join(' '), 'one two three four five six seven');
  const cut = wrapText('x'.repeat(200), 'F3', 10, 100);
  assert.ok(cut.length > 1);
  assert.equal(cut.join(''), 'x'.repeat(200));
  assert.equal(
    textWidth('abc', 'F3', 10),
    18,
    'Courier is 600 units a character',
  );
});

test('a PDF has a correct cross-reference table and grows by pages', () => {
  const doc = (count) =>
    buildPdf({
      title: 'A (test) \\ brief',
      meta: 'made in a test',
      marking: 'MARK',
      blocks: [
        { type: 'heading', text: 'Section', count: '3' },
        {
          type: 'chips',
          items: [{ text: 'one' }, { text: 'two', colour: '#ff0000' }],
        },
        { type: 'stats', items: [{ value: '31%', label: 'Escalation' }] },
        { type: 'meter', label: 'Analyst', value: 140 },
        ...Array.from({ length: count }, (_, i) => ({
          type: 'card',
          colour: '#e23b3f',
          strip: [
            { text: 'MIL' },
            { text: 'a very long key factor '.repeat(12) },
          ],
          text: `Card ${i} `.repeat(30),
        })),
        { type: 'para', text: 'Closing paragraph.' },
        { type: 'note', text: 'A note.' },
      ],
    });
  const small = text(doc(1));
  const large = text(doc(40));
  for (const file of [small, large]) {
    assert.ok(file.startsWith('%PDF-1.4\n'));
    assert.ok(file.endsWith('%%EOF\n'));
    const start = Number(file.match(/startxref\n(\d+)\n%%EOF/)[1]);
    assert.equal(file.slice(start, start + 4), 'xref');
    const rows = [...file.slice(start).matchAll(/^(\d{10}) 00000 n $/gm)];
    rows.forEach((row, i) =>
      assert.ok(
        file.slice(Number(row[1])).startsWith(`${i + 1} 0 obj\n`),
        `object ${i + 1} is where the table says`,
      ),
    );
    for (const stream of file.matchAll(/\/Length (\d+) >>\nstream\n/g)) {
      const from = stream.index + stream[0].length;
      assert.equal(
        file.slice(from + Number(stream[1]), from + Number(stream[1]) + 10),
        '\nendstream',
      );
    }
  }
  const pages = (file) => Number(file.match(/\/Count (\d+)/)[1]);
  assert.equal(pages(small), 1);
  assert.ok(pages(large) > 3);
  assert.ok(
    small.includes('(A \\(test\\) \\\\ brief)'),
    'brackets are escaped',
  );
});
