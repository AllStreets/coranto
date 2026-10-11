/**
 * Coranto's colour identity, applied at build time.
 *
 * The upstream stylesheets hard-code their cyan accent in more than a hundred
 * rules. Editing each one would make every upstream merge conflict, so this
 * plugin rewrites those literals to AUSPEX's living green as the compiled CSS
 * leaves Vite. Variables, fonts and Coranto-only rules live in
 * `src/ui/styles/coranto.css`.
 */

const REPLACEMENTS = [
  [/\b0,\s*212,\s*255\b/g, '52, 224, 138'],
  [/#00d4ff\b/gi, '#34e08a'],
];

/** @param {string} css */
export function applyCorantoTheme(css) {
  let out = css;
  for (const [pattern, value] of REPLACEMENTS) out = out.replace(pattern, value);
  return out;
}

/** Vite plugin: retint compiled stylesheets. */
export function corantoThemePlugin() {
  return {
    name: 'coranto-theme',
    transform(code, id) {
      if (!/\.css(?:$|\?)/.test(id)) return null;
      const next = applyCorantoTheme(code);
      return next === code ? null : { code: next, map: null };
    },
  };
}
