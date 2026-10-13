import { readRequestBody } from './common/request.js';
import { sameSiteGated } from './common/same-site.js';
import { enforceRateLimit, openAiRateLimiter } from './openai/rate-limit.js';

/** The model the analyst board's tools use, as AUSPEX did. */
export const ANALYST_MODEL_DEFAULT = 'gpt-5.4-mini';
/** The largest reply any analyst tool asks for (the daily brief). */
export const ANALYST_MAX_TOKENS = 2500;
const MAX_PROMPT_CHARS = 60_000;
const UPSTREAM_TIMEOUT_MS = 55_000;

/**
 * `POST /api/ai` with `{ system, user, maxTokens }`, answering `{ content }`:
 * the route AUSPEX's analyst tools call. What comes back is written by a
 * model and is not checked against any source; the board labels it so.
 *
 * The key stays on the server. A caller cannot choose the model, the reply is
 * capped, callers from other sites are refused, and requests are rate
 * limited per address.
 *
 * @param {object} [options]
 * @param {typeof fetch} [options.aiFetch]
 * @param {() => string} [options.aiKey]
 * @param {boolean} [options.gate]
 */
export function analystAiProxy({
  aiFetch = fetch,
  aiKey = () => process.env.OPENAI_API_KEY ?? '',
  aiModel = () => process.env.CORANTO_ANALYST_MODEL || ANALYST_MODEL_DEFAULT,
  gate = true,
} = {}) {
  async function handler(req, res) {
    const json = (status, value) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(value));
    };
    if (req.method !== 'POST')
      return json(405, { error: 'Method not allowed' });
    const apiKey = aiKey();
    if (!apiKey) return json(503, { error: 'AI not configured' });
    if (gate && !enforceRateLimit(openAiRateLimiter(), req, res)) return;
    let body;
    try {
      body = JSON.parse((await readRequestBody(req, 96 * 1024)) || '{}');
    } catch {
      return json(400, { error: 'Invalid JSON body' });
    }
    const system = typeof body?.system === 'string' ? body.system : '';
    const user = typeof body?.user === 'string' ? body.user : '';
    if (!user.trim() || system.length + user.length > MAX_PROMPT_CHARS)
      return json(400, { error: 'Invalid request' });
    const asked = Number(body.maxTokens);
    const maxTokens = Number.isFinite(asked)
      ? Math.max(1, Math.min(ANALYST_MAX_TOKENS, Math.round(asked)))
      : 420;
    try {
      const response = await aiFetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: aiModel(),
            max_completion_tokens: maxTokens,
            temperature: 0.7,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          }),
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        },
      );
      if (!response.ok) {
        // Never relay the provider's own error text.
        console.warn(`[analyst] upstream HTTP ${response.status}`);
        return json(502, { error: 'ai_failed' });
      }
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      return json(200, { content: typeof content === 'string' ? content : '' });
    } catch {
      console.warn('[analyst] request failed');
      return json(502, { error: 'ai_failed' });
    }
  }
  const route = gate ? sameSiteGated(handler) : handler;
  return {
    name: 'coranto-analyst-ai',
    configureServer({ middlewares }) {
      middlewares.use('/api/ai', route);
    },
    configurePreviewServer({ middlewares }) {
      middlewares.use('/api/ai', route);
    },
  };
}
