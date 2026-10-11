import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  ElectionsUnavailableError,
  createElectionService,
} from '../../src/sources/elections/service.js';

/**
 * `/api/elections`: elections dated in the next 120 days as Wikidata records
 * them, grouped by country and day, each contest linked to its Wikidata item.
 * The last good read is kept on disk, because the public endpoint is uneven;
 * a saved calendar is served marked stale with its real fetch time. With
 * Wikidata unreachable and nothing saved it returns 503 and no entries.
 */
export function electionsProxy({
  cachePath = path.join(process.cwd(), '.gev-cache', 'elections-v1.json'),
  ...options
} = {}) {
  let servicePromise = null;
  let savedAt = null;

  async function loadState() {
    if (!cachePath) return null;
    try {
      const parsed = JSON.parse(await fsp.readFile(cachePath, 'utf8'));
      return parsed?.version === 1 ? parsed : null;
    } catch {
      return null;
    }
  }
  const service = () =>
    (servicePromise ??= loadState().then((initialState) =>
      createElectionService({ ...options, initialState }),
    ));

  async function saveState(elections, payload) {
    if (!cachePath || payload.stale || payload.fetchedAt === savedAt) return;
    savedAt = payload.fetchedAt;
    try {
      await fsp.mkdir(path.dirname(cachePath), { recursive: true });
      await fsp.writeFile(cachePath, JSON.stringify(elections.exportState()));
    } catch {
      console.warn('[elections] cache write failed');
    }
  }

  async function handler(req, res) {
    const json = (status, value) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(value));
    };
    if (req.method !== 'GET') return json(405, { error: 'method_not_allowed' });
    if (req.url !== '/' && req.url !== '')
      return json(400, { error: 'invalid_elections_query' });
    const elections = await service();
    try {
      const payload = await elections.getPayload();
      void saveState(elections, payload);
      json(200, payload);
    } catch (error) {
      if (error instanceof ElectionsUnavailableError)
        return json(503, { error: 'elections_unavailable' });
      console.warn('[elections] refresh failed');
      json(502, { error: 'elections_failed' });
    }
  }
  return {
    name: 'elections',
    configureServer({ middlewares }) {
      middlewares.use('/api/elections', handler);
    },
    configurePreviewServer({ middlewares }) {
      middlewares.use('/api/elections', handler);
    },
  };
}
