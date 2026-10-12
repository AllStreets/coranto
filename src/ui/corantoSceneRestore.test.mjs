import assert from 'node:assert/strict';
import test from 'node:test';

import { lookChanges, sliderChanges } from './corantoSceneRestore.js';

const look = (style, on = []) => ({
  style,
  switches: {
    '#bloom-toggle': on.includes('bloom'),
    '#sharpen-toggle': on.includes('sharpen'),
    '#hud-toggle': on.includes('hud'),
    '#detection-toggle': on.includes('detection'),
  },
});

test('after a scene, only what it changed is pressed back', () => {
  assert.deepEqual(
    lookChanges(
      look('normal', ['sharpen', 'hud']),
      look('surveillance', ['bloom', 'hud']),
    ),
    [".style-btn[data-style='normal']", '#bloom-toggle', '#sharpen-toggle'],
  );
});

test('a scene that changed nothing presses nothing', () => {
  assert.deepEqual(
    lookChanges(look('noir', ['hud']), look('noir', ['hud'])),
    [],
  );
  assert.deepEqual(lookChanges(null, look('noir')), []);
});

test('sliders a scene moved are set back, and others are left alone', () => {
  const before = {
    sliders: {
      '#detection-density-slider': '75',
      '#bloom-intensity-slider': '0',
    },
  };
  const now = {
    sliders: {
      '#detection-density-slider': '25',
      '#bloom-intensity-slider': '0',
    },
  };
  assert.deepEqual(sliderChanges(before, now), [
    ['#detection-density-slider', '75'],
  ]);
  assert.deepEqual(sliderChanges(null, now), []);
});
