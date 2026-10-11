import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  CampaignFinanceUnavailableError,
  createCampaignFinanceService,
} from '../../src/sources/campaignFinance/service.js';

/**
 * `/api/campaign-finance`: the biggest fundraisers for the US Senate and
 * House in the current cycle, as their committees reported to the Federal
 * Election Commission, each linked to its FEC page. The last good read is
 * kept on disk because the totals change only when candidates file. With the
 * FEC unreachable and nothing saved it returns 503 and no rows.
 *
 * `FEC_API_KEY` (a free api.data.gov key) is optional. Without it the FEC's
 * shared demonstration key is used. The key is never sent to the browser.
 */
export function campaignFinanceProxy({
  cachePath = path.join(
    process.cwd(),
    '.gev-cache',
    'campaign-finance-v1.json',
  ),
  apiKey = process.env.FEC_API_KEY ?? '',
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
      createCampaignFinanceService({ ...options, apiKey, initialState }),
    ));

  async function saveState(finance, payload) {
    if (!cachePath || payload.stale || payload.fetchedAt === savedAt) return;
    savedAt = payload.fetchedAt;
    try {
      await fsp.mkdir(path.dirname(cachePath), { recursive: true });
      await fsp.writeFile(cachePath, JSON.stringify(finance.exportState()));
    } catch {
      console.warn('[campaign-finance] cache write failed');
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
      return json(400, { error: 'invalid_campaign_finance_query' });
    const finance = await service();
    try {
      const payload = await finance.getPayload();
      void saveState(finance, payload);
      json(200, payload);
    } catch (error) {
      if (error instanceof CampaignFinanceUnavailableError)
        return json(503, { error: 'campaign_finance_unavailable' });
      console.warn('[campaign-finance] refresh failed');
      json(502, { error: 'campaign_finance_failed' });
    }
  }
  return {
    name: 'campaign-finance',
    configureServer({ middlewares }) {
      middlewares.use('/api/campaign-finance', handler);
    },
    configurePreviewServer({ middlewares }) {
      middlewares.use('/api/campaign-finance', handler);
    },
  };
}
