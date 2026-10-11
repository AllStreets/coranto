/** `9.1M`, `940K`, `512`. Rounded for reading; UNHCR has the exact figure. */
export function formatPeople(value) {
  if (!Number.isFinite(value)) return '';
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${Math.round(value / 1e3)}K`;
  return String(Math.round(value));
}
