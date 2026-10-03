/* Synthetic SVG fixtures and local shared assets; no learner or provider requests. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const repo = path.resolve(__dirname, '..');

function contrast(a, b) {
  const luminance = color => {
    const rgb = color.match(/[\d.]+/g).slice(0, 3).map(x => Number(x) / 255)
      .map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test('diagram hints match scroll geometry and theme-aware SVG remains legible', { timeout: 60000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teach-diagram-'));
  const qa = process.env.DIAGRAM_QA_DIR || path.join(repo, '../competition-work/2026-10-03-diagram-qa');
  fs.mkdirSync(qa, { recursive: true }); fs.mkdirSync(path.join(root, 'assets'));
  for (const file of ['style.css', 'course.js']) fs.copyFileSync(path.join(repo, 'teach-pro/assets', file), path.join(root, 'assets', file));
  const svg = (width, label) => `<svg viewBox="0 0 ${width} 100" role="img" aria-label="${label}" style="display:block;height:auto"><rect x="5" y="5" width="${width - 10}" height="90" fill="var(--surface-2)" stroke="var(--border)"/><text x="20" y="56" font-size="16" fill="var(--text)">${label}</text></svg>`;
  const file = path.join(root, 'index.html');
  fs.writeFileSync(file, `<!doctype html><html lang="zh-CN" data-theme="light" data-visual-theme="systems"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="assets/style.css"><style>svg{width:100%;height:auto}</style><body><main style="max-width:800px;margin:auto;padding:12px"><h1>合成图解验收</h1><figure id="wide" class="visual-figure visual-figure--wide">${svg(720, '宽图标签')}<figcaption>宽图说明</figcaption></figure><figure id="fit" class="visual-figure">${svg(140, '适宽图')}<figcaption>适宽图说明</figcaption></figure></main><script src="assets/course.js"></script></body></html>`);
  const browser = await chromium.launch({ executablePath: process.env.TEACH_PRO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const errors = [], network = [], checks = [];
  try {
    const context = await browser.newContext();
    await context.route('**/*', route => { if (/^https?:/.test(route.request().url())) { network.push(route.request().url()); return route.abort(); } return route.continue(); });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(file).href);
    const measure = () => page.evaluate(() => {
      const figure = document.querySelector('#wide'), svg = figure.querySelector('svg'), text = svg.querySelector('text');
      const hint = id => getComputedStyle(document.querySelector(id + ' figcaption'), '::before').content;
      return { width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth,
        scrollable: figure.scrollWidth > figure.clientWidth + 1, marked: figure.classList.contains('is-scrollable'),
        wideHint: hint('#wide'), fitHint: hint('#fit'), color: getComputedStyle(text).fill,
        fill: getComputedStyle(svg.querySelector('rect')).fill,
        renderedText: parseFloat(getComputedStyle(text).fontSize) * svg.getBoundingClientRect().width / svg.viewBox.baseVal.width };
    });
    for (const [width, theme, visual] of [[1366, 'light', 'systems'], [390, 'light', 'systems'], [390, 'dark', 'systems'], [320, 'dark', 'reading'], [390, 'auto', 'field']]) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.evaluate(({ theme, visual }) => { document.documentElement.dataset.theme = theme; document.documentElement.dataset.visualTheme = visual; }, { theme, visual });
      await page.waitForFunction(() => { const f = document.querySelector('#wide'); return f.classList.contains('is-scrollable') === (f.scrollWidth > f.clientWidth + 1); });
      const m = await measure(); assert.equal(m.overflow, false); assert.equal(m.marked, m.scrollable);
      assert.equal(m.wideHint.includes('可左右滑动'), width <= 560); assert.equal(m.fitHint.includes('可左右滑动'), false);
      assert.ok(m.renderedText >= 12); assert.ok(contrast(m.color, m.fill) >= 4.5, JSON.stringify(m));
      checks.push({ theme, visual, ...m, contrast: contrast(m.color, m.fill) });
      await page.screenshot({ path: path.join(qa, `${width}-${theme}-${visual}.png`) });
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.evaluate(() => { document.querySelector('#wide').scrollLeft = 100; });
    assert.ok(await page.locator('#wide').evaluate(el => el.scrollLeft > 0));
    await page.evaluate(() => { const svg = document.querySelector('#fit svg'); svg.style.width = '900px'; svg.style.maxWidth = 'none'; });
    await page.waitForFunction(() => document.querySelector('#fit').classList.contains('is-scrollable'));
    await page.evaluate(() => { const svg = document.querySelector('#fit svg'); svg.style.width = '100%'; svg.style.maxWidth = ''; });
    await page.waitForFunction(() => !document.querySelector('#fit').classList.contains('is-scrollable'));
    await page.emulateMedia({ media: 'print' }); assert.equal((await measure()).wideHint.includes('可左右滑动'), false);
    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
    const staticPage = await noJs.newPage(); await staticPage.goto(pathToFileURL(file).href);
    assert.equal(await staticPage.locator('#wide').evaluate(el => el.scrollWidth > el.clientWidth), true);
    assert.equal(await staticPage.locator('#fit figcaption').evaluate(el => getComputedStyle(el, '::before').content.includes('可左右滑动')), false);
    await noJs.close(); assert.deepEqual(errors, []); assert.deepEqual(network, []);
    fs.writeFileSync(path.join(qa, 'summary.json'), JSON.stringify({ synthetic: true, root, checks, client_errors: errors, network_requests: 0,
      additional: ['real-scroll', 'media-resize-add-and-remove', 'print-no-hint', 'no-js-readable'] }, null, 2));
  } finally { await browser.close(); }
});
