import assert from 'node:assert/strict';
import test from 'node:test';

import { PanelPositionControls } from './panelPositionControls.js';

function withPage(inset, run) {
  const saved = { window: globalThis.window, document: globalThis.document };
  globalThis.document = { body: {} };
  globalThis.window = {
    innerWidth: 1280,
    innerHeight: 720,
    getComputedStyle: () => ({
      getPropertyValue: (name) => (name === '--ui-top-inset' ? inset : ''),
    }),
  };
  try {
    return run();
  } finally {
    globalThis.window = saved.window;
    globalThis.document = saved.document;
  }
}

const panel = (height = 200) => ({
  getBoundingClientRect: () => ({ width: 300, height }),
});
const clampTop = (top, height) =>
  PanelPositionControls.prototype._clampToViewport.call(
    {},
    400,
    top,
    panel(height),
  ).top;

test('a panel cannot be moved under a bar the page keeps at the top', () => {
  withPage('92px', () => {
    assert.equal(clampTop(-50), 98, 'held below the bar');
    assert.equal(clampTop(300), 300, 'free below it');
    assert.equal(clampTop(9999), 514, 'still held above the bottom edge');
    // A panel taller than the room left keeps to the bottom limit.
    assert.equal(clampTop(-50, 700), 14);
  });
});

test('with no bar declared the window top is the limit, as before', () => {
  withPage('', () => assert.equal(clampTop(-50), 6));
  withPage('not a length', () => assert.equal(clampTop(-50), 6));
});
