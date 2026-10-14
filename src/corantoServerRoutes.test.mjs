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

// ── The archive ────────────────────────────────────────────────────

test('the archive is off without its keys, and never pretends otherwise', async () => {
  const { createArchive } = await import('./sources/archive/service.js');
  const off = createArchive({ url: '', key: '' });
  assert.equal(off.configured, false);
  assert.equal(await off.store([{ id: 'a' }]), 0);
  assert.deepEqual(await off.search({ query: 'ukraine' }), []);
});

test('the archive stores valid rows once and searches by whole words', async () => {
  const { createArchive, searchTerms, toRow } =
    await import('./sources/archive/service.js');
  const calls = [];
  const archive = createArchive({
    url: 'https://example.supabase.co',
    key: 'secret-key-that-is-long-enough',
    now: () => Date.UTC(2026, 9, 13),
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: url.includes('select=') ? 200 : 204,
        json: async () => [
          {
            id: 'x',
            title: 'Old headline',
            publisher: 'BBC',
            url: 'https://bbc.co.uk/x',
            published_at: '2026-09-20T00:00:00Z',
            place_name: 'Kyiv',
            place_lat: 50.4,
            place_lon: 30.5,
            place_precision: 'city',
          },
        ],
      };
    },
  });
  const article = {
    id: 'a1',
    title: 'Headline',
    publisher: 'BBC',
    url: 'https://bbc.co.uk/a1',
    publishedAt: '2026-10-12T10:00:00Z',
    category: 'geopolitics',
    place: { name: 'Kyiv', lat: 50.4, lon: 30.5, precision: 'city' },
  };
  assert.equal(toRow({ ...article, url: 'javascript:alert(1)' }), null);
  assert.equal(await archive.store([article, { id: 'bad' }]), 1);
  assert.equal(await archive.store([article]), 0, 'not sent twice');
  const write = calls.find((call) => call.init.method === 'POST');
  assert.match(write.url, /\/rest\/v1\/articles\?on_conflict=id$/);
  assert.equal(write.init.headers.apikey, 'secret-key-that-is-long-enough');
  assert.equal(JSON.parse(write.init.body)[0].place_name, 'Kyiv');

  assert.deepEqual(searchTerms("Ukraine's grid; DROP TABLE"), [
    'ukraine',
    'grid',
    'drop',
    'table',
  ]);
  const found = await archive.search({
    query: 'ukraine grid',
    category: 'x;y',
  });
  const read = calls.at(-1).url;
  assert.match(read, /fts=plfts\(simple\)\.ukraine%20grid/);
  assert.doesNotMatch(read, /category=/, 'a malformed topic is not passed on');
  assert.equal(found[0].archived, true);
  assert.equal(found[0].place.name, 'Kyiv');
});
