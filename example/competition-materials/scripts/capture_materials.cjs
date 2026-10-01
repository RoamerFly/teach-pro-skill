// Requires the workspace's bundled Node packages, or an existing Playwright installation.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const sharp = require('sharp');

const materials = path.resolve(__dirname, '..');
const source = path.resolve(materials, '../competition-demo-zhi-jian-agent');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'teach-pro-doc-shots-'));
  const course = path.join(temp, path.basename(source));
  await fs.cp(source, course, { recursive: true, filter: file => !['learner-submissions', 'learner-chats', '.tutor-settings.json', '__pycache__'].includes(path.basename(file)) });
  const server = spawn(process.env.TEACH_PRO_PYTHON || 'python', ['-u', '-X', 'utf8', 'serve_course.py', '--no-browser'], { cwd: course, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '', spawnError;
  server.on('error', error => { spawnError = error; });
  server.stdout.on('data', data => { log += data; }); server.stderr.resume();
  let browser;
  try {
    let base;
    for (let i = 0; i < 100; i++) {
      if (spawnError) throw spawnError;
      base = log.match(/Course ready: (http:\/\/127\.0\.0\.1:\d+\/)/)?.[1];
      if (base) break;
      await sleep(100);
    }
    assert.ok(base, 'Local course did not start');
    browser = await chromium.launch({ executablePath: process.env.TEACH_PRO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    const page = await browser.newPage({ viewport: { width: 1000, height: 1000 }, deviceScaleFactor: 2 });
    const external = [];
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1') { external.push(url.href); return route.abort(); }
      return route.continue();
    });
    const assets = path.join(materials, 'assets');
    await fs.mkdir(assets, { recursive: true });
    await page.goto(base);
    await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
    await page.locator('.course-hero').screenshot({ path: path.join(assets, 'course-home.png') });
    await page.goto(base + 'practice/entry-assessment.html');
    await page.waitForFunction(() => document.querySelector('.sync-status')?.dataset.state === 'ready');
    assert.equal(await page.locator('input:checked').count(), 0);
    await page.locator('#q1').screenshot({ path: path.join(assets, 'assessment.png') });
    await page.goto(base + 'settings.html');
    await page.waitForFunction(() => !document.querySelector('select[name="kind"]').disabled);
    await page.locator('select[name="kind"]').selectOption('deepseek');
    const key = page.locator('input[name="api_key"]');
    await key.fill('DEMO_KEY_NOT_VALID');
    await key.evaluate(input => input.blur());
    assert.equal(await key.getAttribute('type'), 'password');
    assert.equal(await page.locator('input[name="base_url"]').inputValue(), 'https://api.deepseek.com');
    assert.equal(await page.locator('select[name="model"]').inputValue(), '');
    assert.equal(await page.locator('[data-settings-consent]').count(), 0);
    await page.locator('[data-tutor-settings-page]').screenshot({ path: path.join(assets, 'deepseek-settings.png'), animations: 'disabled' });
    assert.equal(external.length, 0);
    await sharp(path.join(assets, 'architecture.svg'), { density: 180 }).png().toFile(path.join(assets, 'architecture.png'));
    await page.setViewportSize({ width: 1440, height: 810 });
    await page.setContent('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>body{margin:0;padding:50px 75px;background:#eef3f9;color:#17344e;font:22px/1.6 Microsoft YaHei}h1{font-size:34px}img{max-width:100%;max-height:490px;object-fit:contain}p{color:#536c7e}</style><p>学途智伴 · 重邮FFBond</p><h1>学途智伴——大学生长期自适应学习智能体</h1><p>了解基础 → 学懂一课 → 真实答疑 → 本地保存 → 动态续课</p><img alt="教学与文件连续性架构"></html>');
    await page.locator('img').evaluate((img, data) => { img.src = data; }, 'data:image/png;base64,' + (await fs.readFile(path.join(assets, 'architecture.png'))).toString('base64'));
    await page.waitForFunction(() => document.querySelector('img').complete && document.querySelector('img').naturalWidth > 0);
    await page.screenshot({ path: path.join(assets, 'ui-closing.png'), animations: 'disabled', scale: 'css' });
    console.log('PASS: three clean screenshots, architecture raster and closing card; no external model requests');
  } finally {
    await browser?.close(); server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
