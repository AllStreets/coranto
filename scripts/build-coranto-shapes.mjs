#!/usr/bin/env node
/**
 * Builds the fillable outlines Coranto's SILENCE and DISEASE layers draw:
 * `public/coranto-atlas/shapes-countries.json` (by ISO code) and
 * `shapes-regions.json` (by IODA region id).
 *
 * The geometry is Natural Earth 10m (public domain), read from the copies
 * the IODA project serves with its own region ids attached, then simplified:
 * a filled area on a globe does not need a coastline's every turn.
 *
 *   node scripts/build-coranto-shapes.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const API = 'https://api.ioda.inetintel.cc.gatech.edu/v2/topo';
const OUT = path.resolve('public/coranto-atlas');

async function topology(kind) {
  const response = await fetch(`${API}/${kind}`);
  if (!response.ok) throw new Error(`${kind}: HTTP ${response.status}`);
  let bytes = Buffer.from(await response.arrayBuffer());
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = zlib.gunzipSync(bytes);
  return JSON.parse(bytes.toString('utf8')).data.topology;
}

function decoder(topo) {
  let arcs = topo.arcs;
  if (topo.transform) {
    const { scale, translate } = topo.transform;
    arcs = arcs.map((arc) => {
      let x = 0;
      let y = 0;
      return arc.map(([dx, dy]) => {
        x += dx;
        y += dy;
        return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
      });
    });
  }
  const ring = (indexes) => {
    const points = [];
    for (const index of indexes) {
      const arc = index < 0 ? [...arcs[~index]].reverse() : arcs[index];
      for (let i = points.length ? 1 : 0; i < arc.length; i += 1)
        points.push(arc[i]);
    }
    return points;
  };
  return (geometry) => {
    if (geometry.type === 'Polygon') return [geometry.arcs.map(ring)];
    if (geometry.type === 'MultiPolygon')
      return geometry.arcs.map((polygon) => polygon.map(ring));
    return [];
  };
}

/** Douglas-Peucker on a closed ring, in degrees. */
function simplify(points, tolerance) {
  if (points.length < 5) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    const [ax, ay] = points[first];
    const [bx, by] = points[last];
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    let worst = 0;
    let at = -1;
    for (let i = first + 1; i < last; i += 1) {
      const [px, py] = points[i];
      const t = length
        ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length))
        : 0;
      const distance = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
      if (distance > worst) {
        worst = distance;
        at = i;
      }
    }
    if (worst > tolerance * tolerance) {
      keep[at] = 1;
      stack.push([first, at], [at, last]);
    }
  }
  return points.filter((_, index) => keep[index]);
}

function area(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1)
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(sum / 2);
}

/** Outer rings only, simplified; islands too small to see are dropped. */
function outline(polygons, tolerance, minArea) {
  const rings = polygons
    .map((polygon) => polygon[0])
    .filter((ring) => ring?.length >= 4)
    .map((ring) => ({ ring, size: area(ring) }))
    .sort((a, b) => b.size - a.size);
  if (!rings.length) return [];
  const kept = rings.filter(
    (entry, index) => index === 0 || entry.size >= minArea,
  );
  return kept
    .map(({ ring }) =>
      simplify(ring, tolerance).map(([lon, lat]) => [
        Math.round(lon * 100) / 100,
        Math.round(lat * 100) / 100,
      ]),
    )
    .filter((ring) => ring.length >= 4);
}

async function build(kind, { tolerance, minArea, code, meta }) {
  const topo = await topology(kind);
  const decode = decoder(topo);
  const shapes = {};
  for (const object of Object.values(topo.objects))
    for (const geometry of object.geometries) {
      const id = code(geometry.properties ?? {});
      if (!id || !geometry.type) continue;
      const rings = outline(decode(geometry), tolerance, minArea);
      if (rings.length) shapes[id] = { ...meta(geometry.properties), rings };
    }
  const file = path.join(
    OUT,
    `shapes-${kind === 'country' ? 'countries' : 'regions'}.json`,
  );
  await fs.writeFile(
    file,
    JSON.stringify({
      source:
        'Natural Earth 10m (public domain), simplified; region ids as used by IODA',
      shapes,
    }),
  );
  const { size } = await fs.stat(file);
  console.log(
    `${file}: ${Object.keys(shapes).length} shapes, ${Math.round(size / 1024)} KB`,
  );
}

await build('country', {
  tolerance: 0.08,
  minArea: 0.25,
  code: (p) => (/^[A-Z]{2}$/.test(p.usercode ?? '') ? p.usercode : null),
  meta: (p) => ({ name: p.name }),
});
await build('region', {
  tolerance: 0.06,
  minArea: 0.08,
  code: (p) => (p.id != null ? String(p.id) : null),
  meta: (p) => ({ name: p.name, iso2: p.iso2cc }),
});
