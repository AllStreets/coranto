import assert from 'node:assert/strict';
import test from 'node:test';

import { analystAiProxy } from '../server/providers/analystAi.js';
import { corantoHealthProxy } from '../server/providers/corantoHealth.js';

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

// ── /api/ai: the analyst board's model route ───────────────────────

async function ai({ method = 'POST', body, key = 'sk-test', reply } = {}) {
  let handler;
  const sent = [];
  analystAiProxy({
    gate: false,
    aiKey: () => key,
    aiModel: () => 'model-under-test',
    aiFetch: async (url, init) => {
      sent.push({ url, init, body: JSON.parse(init.body) });
      return (
        reply ?? {
          ok: true,
          json: async () => ({ choices: [{ message: { content: 'Reply.' } }] }),
        }
      );
    },
  }).configureServer({ middlewares: { use: (_path, fn) => (handler = fn) } });
  const out = {};
  const text = typeof body === 'string' ? body : JSON.stringify(body ?? {});
  const req = {
    method,
    headers: { 'content-type': 'application/json' },
    socket: { remoteAddress: '127.0.0.1' },
    on(event, listener) {
      if (event === 'data') listener(Buffer.from(text));
      if (event === 'end') listener();
      return req;
    },
    [Symbol.asyncIterator]: async function* iterate() {
      yield Buffer.from(text);
    },
  };
  await handler(req, {
    writeHead: (status) => (out.status = status),
    end: (value) => (out.body = JSON.parse(value)),
  });
  return { ...out, sent };
}

test('the analyst route sends the prompt as AUSPEX did and returns the text', async () => {
  const { status, body, sent } = await ai({
    body: { system: 'SYS', user: 'USER', maxTokens: 220, model: 'other-model' },
  });
  assert.equal(status, 200);
  assert.deepEqual(body, { content: 'Reply.' });
  assert.equal(sent[0].url, 'https://api.openai.com/v1/chat/completions');
  assert.deepEqual(sent[0].body, {
    model: 'model-under-test',
    max_completion_tokens: 220,
    temperature: 0.7,
    messages: [
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'USER' },
    ],
  });
  assert.equal(sent[0].init.headers.Authorization, 'Bearer sk-test');
});

test('the analyst route caps the reply and refuses what it should', async () => {
  const big = await ai({ body: { user: 'x', maxTokens: 99999 } });
  assert.equal(big.sent[0].body.max_completion_tokens, 2500);
  assert.equal((await ai({ method: 'GET' })).status, 405);
  assert.equal((await ai({ body: { user: 'x' }, key: '' })).status, 503);
  assert.equal((await ai({ body: '{not json' })).status, 400);
  assert.equal((await ai({ body: { system: 'only' } })).status, 400);
});

test('the analyst route never relays the provider’s own error text', async () => {
  const { status, body } = await ai({
    body: { user: 'x' },
    reply: {
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Incorrect API key sk-live' } }),
    },
  });
  assert.equal(status, 502);
  assert.deepEqual(body, { error: 'ai_failed' });
});
