/**
 * AUSPEX's atlas data for the globe, copied as it was: city icons and
 * colours, country status colours, border and line colours. Apache-2.0,
 * Connor Evans. The icons are on a 12-unit grid and use `currentColor`.
 */

// prettier-ignore
export const CITY_ICONS = Object.freeze({
  "capital": "<polygon points=\"6,0.6 7.36,4.18 11.2,4.3 8.15,6.66 9.25,10.4 6,8.2 2.75,10.4 3.85,6.66 0.8,4.3 4.64,4.18\" fill=\"currentColor\"/>",
  "financial": "<line x1=\"1\" y1=\"10.4\" x2=\"11\" y2=\"10.4\" stroke=\"currentColor\" stroke-width=\"0.9\" opacity=\".55\"/><rect x=\"1.7\" y=\"6.6\" width=\"1.7\" height=\"3.6\" rx=\"0.4\" fill=\"currentColor\"/><rect x=\"4.4\" y=\"4.4\" width=\"1.7\" height=\"5.8\" rx=\"0.4\" fill=\"currentColor\"/><rect x=\"7.1\" y=\"2.2\" width=\"1.7\" height=\"8\" rx=\"0.4\" fill=\"currentColor\"/><path d=\"M2.4 6 L5 4 L7.8 5 L10.4 1.8\" stroke=\"currentColor\" stroke-width=\"0.85\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\".9\"/>",
  "tech": "<rect x=\"3\" y=\"3\" width=\"6\" height=\"6\" rx=\"1\" stroke=\"currentColor\" stroke-width=\"1\" fill=\"none\"/><rect x=\"4.9\" y=\"4.9\" width=\"2.2\" height=\"2.2\" rx=\"0.4\" fill=\"currentColor\"/><g stroke=\"currentColor\" stroke-width=\"0.95\" stroke-linecap=\"round\"><line x1=\"4.5\" y1=\"3\" x2=\"4.5\" y2=\"1.4\"/><line x1=\"6\" y1=\"3\" x2=\"6\" y2=\"1.4\"/><line x1=\"7.5\" y1=\"3\" x2=\"7.5\" y2=\"1.4\"/><line x1=\"4.5\" y1=\"9\" x2=\"4.5\" y2=\"10.6\"/><line x1=\"6\" y1=\"9\" x2=\"6\" y2=\"10.6\"/><line x1=\"7.5\" y1=\"9\" x2=\"7.5\" y2=\"10.6\"/><line x1=\"3\" y1=\"4.5\" x2=\"1.4\" y2=\"4.5\"/><line x1=\"3\" y1=\"6\" x2=\"1.4\" y2=\"6\"/><line x1=\"3\" y1=\"7.5\" x2=\"1.4\" y2=\"7.5\"/><line x1=\"9\" y1=\"4.5\" x2=\"10.6\" y2=\"4.5\"/><line x1=\"9\" y1=\"6\" x2=\"10.6\" y2=\"6\"/><line x1=\"9\" y1=\"7.5\" x2=\"10.6\" y2=\"7.5\"/></g>",
  "tourism": "<path d=\"M6 0.8 L10.3 3.6 H1.7 Z\" fill=\"currentColor\"/><rect x=\"2.2\" y=\"3.9\" width=\"7.6\" height=\"0.9\" rx=\"0.3\" fill=\"currentColor\"/><g fill=\"currentColor\"><rect x=\"2.9\" y=\"5\" width=\"1.1\" height=\"4.2\"/><rect x=\"5.45\" y=\"5\" width=\"1.1\" height=\"4.2\"/><rect x=\"8\" y=\"5\" width=\"1.1\" height=\"4.2\"/></g><rect x=\"1.7\" y=\"9.4\" width=\"8.6\" height=\"1\" rx=\"0.3\" fill=\"currentColor\"/>",
  "port": "<circle cx=\"6\" cy=\"2.4\" r=\"1.3\" stroke=\"currentColor\" stroke-width=\"1.05\" fill=\"none\"/><line x1=\"6\" y1=\"3.7\" x2=\"6\" y2=\"10.1\" stroke=\"currentColor\" stroke-width=\"1.15\" stroke-linecap=\"round\"/><line x1=\"3.7\" y1=\"5.2\" x2=\"8.3\" y2=\"5.2\" stroke=\"currentColor\" stroke-width=\"1.05\" stroke-linecap=\"round\"/><path d=\"M2.3 7.3 c0.5 2.2 2.1 3.1 3.7 3.1 s3.2-0.9 3.7-3.1\" stroke=\"currentColor\" stroke-width=\"1.15\" fill=\"none\" stroke-linecap=\"round\"/><line x1=\"1.9\" y1=\"7.3\" x2=\"3\" y2=\"6.9\" stroke=\"currentColor\" stroke-width=\"1.05\" stroke-linecap=\"round\"/><line x1=\"10.1\" y1=\"7.3\" x2=\"9\" y2=\"6.9\" stroke=\"currentColor\" stroke-width=\"1.05\" stroke-linecap=\"round\"/>",
  "energy": "<polygon points=\"6.9,0.8 2.8,6.7 5.7,6.7 4.7,11.2 9.3,4.9 6.2,4.9\" fill=\"currentColor\"/>",
  "megacity": "<g fill=\"currentColor\"><rect x=\"1.2\" y=\"6.2\" width=\"2\" height=\"4.6\" rx=\"0.3\"/><rect x=\"3.6\" y=\"3.6\" width=\"2.1\" height=\"7.2\" rx=\"0.3\"/><rect x=\"6.2\" y=\"1.6\" width=\"2.2\" height=\"9.2\" rx=\"0.3\"/><rect x=\"8.9\" y=\"4.8\" width=\"1.9\" height=\"6\" rx=\"0.3\"/></g><path d=\"M7.3 1.6 V0.6\" stroke=\"currentColor\" stroke-width=\"0.8\" stroke-linecap=\"round\"/><g fill=\"#0a0c1e\" opacity=\".55\"><rect x=\"6.8\" y=\"3\" width=\"0.6\" height=\"0.8\"/><rect x=\"7.7\" y=\"3\" width=\"0.6\" height=\"0.8\"/><rect x=\"6.8\" y=\"4.6\" width=\"0.6\" height=\"0.8\"/><rect x=\"7.7\" y=\"4.6\" width=\"0.6\" height=\"0.8\"/></g>",
  "city": "<circle cx=\"6\" cy=\"6\" r=\"4.4\" stroke=\"currentColor\" stroke-width=\"1.1\" fill=\"none\" opacity=\".7\"/><circle cx=\"6\" cy=\"6\" r=\"1.9\" fill=\"currentColor\"/>"
});

export const CITY_COLOURS = Object.freeze({
  capital: '#E8D5A3',
  financial: '#FFD60A',
  tech: '#9D8CFF',
  tourism: '#FF8FA3',
  port: '#2DD4BF',
  energy: '#FFB02E',
  megacity: '#9FB3C8',
  city: '#8FA0E8',
});

export const CITY_LABELS = Object.freeze({
  capital: 'Capital',
  financial: 'Financial centre',
  tech: 'Technology hub',
  tourism: 'Tourism centre',
  port: 'Port',
  energy: 'Energy hub',
  megacity: 'Megacity',
  city: 'City',
});

/** Country status marks: [flag on the country row, icon, colour, label]. */
export const COUNTRY_MARKS = Object.freeze([
  ['nuclear_armed', 'nuclear', '#FF9F0A', 'Nuclear-armed'],
  ['conflict_active', 'conflict', '#FF2D55', 'Active conflict'],
  ['sanctions_subject', 'sanction', '#2979FF', 'Under sanctions'],
  ['un_p5', 'star', '#B7950B', 'UN Security Council permanent member'],
]);
export const COUNTRY_NAME_COLOUR = '#7fb6cf';

/** Border colours, as AUSPEX drew them. */
export const BORDER_COLOURS = Object.freeze({
  conflictCoast: [255, 45, 85, 0.6],
  conflictShared: [255, 45, 85, 0.55],
  coast: [100, 180, 255, 0.85],
  shared: [100, 180, 255, 0.7],
});
export const LINE_COLOURS = Object.freeze({
  conflict: ['#FF2D55', '#330000'],
  disputed: ['#FF9F0A', '#1a1000'],
});
