/* Real browser, local static files only; no provider or learner-data requests. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const repo = path.resolve(__dirname, '..');
const qa = process.env.TOOLBAR_QA_DIR || path.resolve(repo, '../competition-work/2026-10-03-toolbar-qa');

test('lesson toolbar stays in the content column and preserves reading, modal and legacy layouts', { timeout: 90000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teach-toolbar-'));
  fs.mkdirSync(qa, { recursive: true });
  fs.cpSync(path.join(repo, 'example/competition-demo-zhi-jian-agent'), root, { recursive: true });
  const source = fs.readFileSync(path.join(repo, 'teach-pro/templates/lesson.html'), 'utf8');
  const longTitle = '理解智能体的工具调用、信任边界与跨步骤状态：一个足够长的课题标题';
  const values = { LESSON_NUMBER: '0001', LESSON_TITLE: longTitle, COURSE_TITLE: '模板测试课程', COURSE_SLUG: 'toolbar-template-test',
    LESSON_DESCRIPTION: '沿着数据流理解每一步，区分模型提议与应用授权，再用一个小例子检查边界。'.repeat(3), COURSE_PHASE: '基础阶段', ESTIMATED_TIME: '30 分钟', PROGRESS_LABEL: '等待本课作答',
    CURRENT_PAGE_NAV: '<li><a href="#toolbar-target">目标章节</a></li>',
    LESSON_CONTENT_HTML: '<p>阅读测试段落。</p>'.repeat(40) + '<section id="toolbar-target"><h2>目标章节</h2><p>冻结栏不应挡住这个标题。</p></section>' + '<p>后续测试段落。</p>'.repeat(40) };
  const html = source.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => values[key] || '');
  const fixture = path.join(root, 'lessons/0001-toolbar-template.html'); fs.writeFileSync(fixture, html);
  const legacy = path.join(root, 'lessons/0002-toolbar-legacy.html');
  fs.writeFileSync(legacy, html.replace(/<header[\s\S]*?<\/header>/, '<header id="old-hero" class="lesson-hero"><div><span class="eyebrow">旧版课</span><h1>第 2 课 · 旧课标题</h1><p class="lead">旧课说明保持原样。</p></div></header>'));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const network = [], errors = [], screenshots = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', reducedMotion: 'reduce' });
    await context.route('**/*', route => { if (/^https?:/.test(route.request().url())) { network.push(route.request().url()); return route.abort(); } return route.continue(); });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(fixture).href); await page.locator('.tutor-open:not(:disabled)').waitFor();
    const geometry = () => page.evaluate(() => {
      const bar = document.querySelector('.lesson-toolbar'), button = bar.querySelector('.tutor-open'), title = bar.querySelector('h1');
      const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, height: r.height }; };
      return { bar: rect(bar), button: rect(button), title: rect(title), main: rect(document.querySelector('main')), width: innerWidth,
        sticky: getComputedStyle(bar).position, background: getComputedStyle(bar).backgroundImage,
        separator: getComputedStyle(bar).borderBottomWidth, overflow: document.documentElement.scrollWidth > innerWidth,
        buttons: document.querySelectorAll('.tutor-open').length, h1: document.querySelectorAll('h1').length };
    });
    const check = async () => {
      const g = await geometry(); assert.equal(g.sticky, 'sticky'); assert.equal(g.buttons, 1); assert.equal(g.h1, 1);
      assert.ok(g.background.startsWith('linear-gradient(')); assert.equal(g.separator, '2px');
      assert.ok(g.bar.x >= g.main.x - 1 && g.bar.right <= g.main.right + 1);
      assert.ok(g.button.right < g.title.x && g.button.x >= g.bar.x && g.button.bottom <= g.bar.bottom);
      assert.ok(g.bar.height <= 90 && !g.overflow, JSON.stringify(g)); assert.ok(Math.abs(g.bar.y) < 2, JSON.stringify(g));
      return g;
    };
    await check();
    assert.equal(await page.locator('h1').textContent(), '第 1 课 · ' + longTitle);
    await page.evaluate(() => window.scrollTo(0, 1800)); await check();
    await page.screenshot({ path: path.join(qa, '01-template-scrolled.png'), animations: 'disabled' }); screenshots.push('01-template-scrolled');
    const expanded = (await geometry()).bar.x;
    await page.locator('.sidebar-collapse').click(); const collapsed = await check();
    assert.ok(collapsed.bar.x < expanded - 50); await page.screenshot({ path: path.join(qa, '02-sidebar-collapsed.png'), animations: 'disabled' }); screenshots.push('02-sidebar-collapsed');
    await page.locator('.sidebar-collapse').click();
    await page.evaluate(() => { document.querySelector('#toolbar-target').scrollIntoView({ behavior: 'instant' }); });
    const g = await geometry(), target = await page.locator('#toolbar-target').boundingBox(); assert.ok(target.y >= g.bar.bottom + 5);
    const before = await page.evaluate(() => scrollY); await page.locator('.tutor-open').click();
    assert.equal(await page.locator('#tutor-dialog').evaluate(el => el.open), true);
    await page.keyboard.press('Escape'); assert.equal(await page.locator('.tutor-open').evaluate(el => el === document.activeElement), true);
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - before) < 2);
    for (const [label, width, height, theme, visual] of [['03-dark', 1440, 900, 'dark', 'systems'], ['04-medium', 1280, 720, 'light', 'reading'], ['05-mobile', 390, 844, 'dark', 'field'], ['06-small', 320, 640, 'light', 'studio']]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(({ theme, visual }) => { document.documentElement.dataset.theme = theme; document.documentElement.dataset.visualTheme = visual; }, { theme, visual });
      await check(); await page.screenshot({ path: path.join(qa, label + '.png'), animations: 'disabled' }); screenshots.push(label);
    }
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('.lesson-toolbar-actions').isVisible(), false);
    assert.equal(await page.locator('h1').textContent(), '第 1 课 · ' + longTitle);
    assert.equal(await page.locator('.lesson-toolbar').evaluate(el => getComputedStyle(el).position), 'static');
    assert.equal(await page.locator('h1').evaluate(el => getComputedStyle(el).whiteSpace), 'normal');
    await page.emulateMedia({ media: 'screen' }); await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pathToFileURL(legacy).href); await page.locator('.tutor-open:not(:disabled)').waitFor(); await check();
    assert.equal(await page.locator('h1').textContent(), '第 2 课 · 旧课标题'); assert.equal(await page.locator('.lesson-toolbar .lead').textContent(), '旧课说明保持原样。');
    assert.equal(await page.locator('#old-hero').count(), 1); assert.equal(await page.locator('#lesson-tutor .tutor-open').count(), 1);
    await page.evaluate(() => window.scrollTo(0, 1800)); await check();
    await page.screenshot({ path: path.join(qa, '07-legacy.png'), animations: 'disabled' }); screenshots.push('07-legacy');
    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const staticPage = await noJs.newPage(); await staticPage.goto(pathToFileURL(fixture).href);
    assert.equal(await staticPage.locator('.tutor-open').isDisabled(), true); assert.equal(await staticPage.locator('h1').textContent(), '第 0001 课 · ' + longTitle);
    await staticPage.screenshot({ path: path.join(qa, '08-no-js.png'), animations: 'disabled' }); screenshots.push('08-no-js');
    const demoFile = fs.readdirSync(path.join(root, 'lessons')).find(file => file.includes('llm-to-agent'));
    await page.goto(pathToFileURL(path.join(root, 'lessons', demoFile)).href); await page.locator('.tutor-open:not(:disabled)').waitFor();
    await page.evaluate(() => window.scrollTo(0, 1500)); await check();
    await page.screenshot({ path: path.join(qa, '09-demo.png'), animations: 'disabled' }); screenshots.push('09-demo');
    assert.deepEqual(network, []); assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(qa, 'summary.json'), JSON.stringify({ root, network_requests: 0, client_errors: errors, screenshots, cases: ['template', 'legacy', 'scroll', 'left-button', 'one-h1', 'sidebar-collapse', 'anchor-offset', 'focus-return', 'dark', 'reading-theme', 'field-theme', '390px', '320px', 'print', 'no-js', 'Demo'] }, null, 2));
  } finally { await browser.close(); }
});
