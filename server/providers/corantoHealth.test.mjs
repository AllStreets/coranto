import assert from 'node:assert/strict';
import test from 'node:test';

import { corantoHealthProxy } from './corantoHealth.js';

function call(env, method = 'GET') {
  let handler;
  corantoHealthProxy({ env, now: () => Date.UTC(2026, 9, 12) }).configureServer(
    { middlewares: { use: (_path, fn) => (handler = fn) } },
  );
  const out = {};
  handler(
    { method },
    {
      writeHead: (status) => (out.status = status),
      end: (text) => (out.text = text),
    },
  );
  return { status: out.status, text: out.text, body: JSON.parse(out.text) };
}

test('health says which keys are set and never what they are', () => {
  const secret = 'sk-test-do-not-print-1234567890';
  const { status, text, body } = call({
    OPENAI_API_KEY: secret,
    OPENSKY_CLIENT_ID: 'only-half',
    FEC_API_KEY: '   ',
  });
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.keys.openai, true);
  assert.equal(body.keys.opensky, false, 'both halves are needed');
  assert.equal(body.keys.fec, false, 'blank is not set');
  assert.equal(body.checkedAt, '2026-10-12T00:00:00.000Z');
  assert.match(body.version, /^\d+\.\d+\.\d+/);
  assert.ok(!text.includes(secret) && !text.includes('only-half'));
});

test('health refuses anything but GET', () => {
  assert.equal(call({}, 'POST').status, 405);
});
