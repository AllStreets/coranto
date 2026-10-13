import puppeteer from 'puppeteer';
const out = process.argv[2];
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(hash = '', store = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 860, deviceScaleFactor: 1.5 });
  await page.evaluateOnNewDocument((store) => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    localStorage.setItem('coranto.welcomed.v1', '1');
    for (const [k, v] of Object.entries(store)) localStorage.setItem(k, JSON.stringify(v));
  }, store);
  page.on('pageerror', (e) => console.log('ERR', String(e).slice(0, 160)));
  await page.goto('http://localhost:4173/' + hash, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#coranto-settings-btn', { timeout: 60000 });
  return page;
}
const shot = async (page, name, clip) => { try { await page.screenshot({ path: `${out}/${name}.png`, ...(clip ? { clip } : {}), captureBeyondViewport: false }); console.log('ok', name); } catch (e) { console.log('FAIL', name, String(e).slice(0, 100)); } };
const chips = { 'coranto.settings.v1': { headerLayout: 'chips' } };

// 1. hero
let page = await open('', chips);
await sleep(30000);
await shot(page, 'hero');
// 2. story with AI brief
try {
  await page.evaluate(() => { const c = [...document.querySelectorAll('.news-card')].find((n) => n.querySelector('.news-card-outlets')); (c ?? document.querySelector('.news-card')).querySelector('.news-card-title').click(); });
  await sleep(1500);
  await page.evaluate(() => [...document.querySelectorAll('.coranto-story-tool')].find((b) => /AI BRIEF/.test(b.textContent))?.click());
  await sleep(14000);
  await shot(page, 'story');
  await page.keyboard.press('Escape');
} catch (e) { console.log('story fail', e.message); }
// 3. search
await page.click('#coranto-search-all'); await sleep(400); await page.keyboard.type('ukr', { delay: 60 }); await sleep(1200);
await shot(page, 'search');
await page.keyboard.press('Escape');
// 4. sources (LIVE list)
await page.click('#coranto-live'); await sleep(500);
await shot(page, 'sources');
await page.click('#coranto-live');
// 5. settings
await page.click('#coranto-settings-btn'); await sleep(400);
await page.evaluate(() => document.querySelectorAll('.coranto-settings-tab')[2].click()); await sleep(5000);
await shot(page, 'settings');
await page.keyboard.press('Escape');
// 6. relief lens
await page.click('.coranto-lens-switch button[data-lens="relief"]'); await sleep(6000);
await shot(page, 'relief');
// 7. power lens
await page.click('.coranto-lens-switch button[data-lens="power"]'); await sleep(14000);
await shot(page, 'watch-power');
// 8. votes, markets
await page.click('.coranto-lens-switch button[data-lens="elections"]'); await sleep(8000);
await shot(page, 'elections');
await page.click('.coranto-lens-switch button[data-lens="markets"]'); await sleep(7000);
await shot(page, 'markets');
await page.click('.coranto-lens-switch button[data-lens="news"]'); await sleep(1500);
// 9. moon
await page.evaluate(() => window.__corantoRunCommand?.('the moon')); await sleep(9000);
await shot(page, 'moon');
await page.close();
await browser.close();
