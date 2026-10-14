import { makeRateLimiter } from '../../../src/sources/rateLimit.js';
export { makeRateLimiter } from '../../../src/sources/rateLimit.js';

/**
 * Resolve the per-IP, per-minute cap for a cost-bearing proxy from its env var.
 *
 * The default is ON. An unset or blank value takes `defaultPerMin`; a positive
 * integer overrides it; an explicit `0` disables the limiter for deployments
 * that genuinely want no throttle.
 *
 * A value that cannot be read as a number — a typo, a stray unit, a negative —
 * also takes the default rather than disabling the guard. That asymmetry is the
 * point: `GEV_RATELIMIT_OPENAI_PER_MIN=3O` should not quietly hand an exposed
 * server's API key to whoever asks. Removing the throttle stays possible, but
 * only by saying `0`, which cannot be typed by accident.
 *
 * @param {string|number|undefined|null} envValue - Raw env value (requests/min/IP).
 * @param {number} defaultPerMin - Cap to apply when the value is absent or unreadable.
 * @returns {number} Requests/min/IP; `0` means unlimited.
 */
export function resolvePerMinuteCap(envValue, defaultPerMin) {
  const raw = typeof envValue === 'string' ? envValue.trim() : envValue;
  if (raw === undefined || raw === null || raw === '') return defaultPerMin;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return defaultPerMin;
  // Only an explicit 0 disables the guard: a positive fraction such as 0.5
  // would floor to 0, so it takes the strictest real cap instead.
  if (parsed > 0 && parsed < 1) return 1;
  return Math.floor(parsed); // includes the explicit 0 = unlimited opt-out
}

/**
 * Per-IP rate limiter for the cost-bearing API proxies (OpenAI / Google).
 * Returns `null` only when the cap resolves to `0` (the explicit opt-out), in
 * which case the caller skips the check entirely. Otherwise a fixed 60s window
 * of N requests/IP, built lazily once and reused so its per-IP window state
 * persists across requests. The global backstop is a generous multiple of the
 * per-IP cap so a single host can't starve the rest.
 *
 * @param {string|number|undefined|null} envValue - Raw env value (requests/min/IP).
 * @param {number} defaultPerMin - Cap to apply when the value is absent or unreadable.
 * @returns {((key:string)=>boolean)|null} An `allow(key)` fn, or null when unlimited.
 */
export function makeCostRateLimiter(envValue, defaultPerMin) {
  const max = resolvePerMinuteCap(envValue, defaultPerMin);
  if (max <= 0) return null; // explicit opt-out
  return makeRateLimiter({
    windowMs: 60_000,
    max,
    globalMax: max * 20,
  });
}

/**
 * Client key for rate limiting. Locally this is the real socket peer address
 * only: X-Forwarded-For is client-controlled there, and a rotating value would
 * mint fresh quota and grow the limiter map.
 *
 * A public deployment (CORANTO_PUBLIC_ORIGIN, or Railway's own domain) is
 * reached only through its host's proxy, so the socket peer is the proxy for
 * everyone. There the visitor is the address the proxy reports: `X-Real-IP`,
 * else the last (proxy-appended) entry of `X-Forwarded-For`. Earlier entries
 * of that list are whatever the caller sent and are never used.
 */
export function clientKey(req) {
  const socket = String(req.socket?.remoteAddress || 'local');
  if (
    !String(process.env.CORANTO_PUBLIC_ORIGIN ?? '').trim() &&
    !String(process.env.RAILWAY_PUBLIC_DOMAIN ?? '').trim()
  )
    return socket;
  const real = String(req.headers?.['x-real-ip'] ?? '').trim();
  const forwarded = String(req.headers?.['x-forwarded-for'] ?? '')
    .split(',')
    .pop()
    .trim();
  return (real || forwarded || socket).slice(0, 64);
}
