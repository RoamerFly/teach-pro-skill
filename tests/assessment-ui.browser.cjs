// Isolated browser regression. Requires Playwright, a browser and Python 3.11+.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

async function until(check) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('File sync did not complete');
}

async function main() {
  if (!process.argv[2]) throw new Error('Usage: node tests/assessment-ui.browser.cjs COURSE [SCREENSHOTS]');
  const course = path.resolve(process.argv[2]);
  const output = process.argv[3] ? path.resolve(process.argv[3]) : null;
  if (output) fs.mkdirSync(output, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'teach-pro-assessment-'));
  const isolatedCourse = path.join(temporary, path.basename(course));
  let server, browser;
  try {
    fs.cpSync(course, isolatedCourse, { recursive: true, filter: (file) => !/(?:^|[\\/])(?:learner-submissions|learner-chats|__pycache__|\.git|\.tutor-settings\.json|\.env(?:\.[^\\/]*)?)(?:[\\/]|$)/.test(file) });
    const python = process.env.TEACH_PRO_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
    server = spawn(python, ['-X', 'utf8', path.join(isolatedCourse, 'serve_course.py'), '--no-browser'], { cwd: isolatedCourse, windowsHide: true });
    server.stderr.on('data', () => {});
    const base = await new Promise((resolve, reject) => {
      let text = '';
      const timeout = setTimeout(() => reject(new Error('Course server startup timeout')), 10000);
      server.on('error', (error) => { clearTimeout(timeout); reject(error); });
      server.on('exit', () => { clearTimeout(timeout); reject(new Error('Course server exited before startup')); });
      server.stdout.on('data', (chunk) => {
        text += chunk;
        const match = text.match(/http:\/\/127\.0\.0\.1:\d+\//);
        if (match) { clearTimeout(timeout); resolve(match[0]); }
      });
    });
    browser = await chromium.launch({ headless: true, ...(process.env.TEACH_PRO_BROWSER ? { executablePath: process.env.TEACH_PRO_BROWSER } : {}) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', colorScheme: 'dark', acceptDownloads: true });
    const remote = [], errors = [];
    await context.route('**/*', (route) => {
      if (new URL(route.request().url()).hostname !== '127.0.0.1') { remote.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base + 'practice/entry-assessment.html');
    await page.waitForFunction(() => document.querySelector('.sync-status')?.dataset.state === 'ready');
    const groups = page.locator('[data-quiz][data-save-key]');
    const opened = page.locator('textarea[data-save-key]');
    assert.equal(await groups.count(), 4);
    assert.equal(await opened.count(), 3);
    const first = groups.first();
    const button = first.locator('[data-quiz-submit]');
    await button.click();
    assert((await first.locator('[data-quiz-feedback]').innerText()).includes('请先选择'));
    await first.locator('input[type=radio]:not([data-correct=true])').first().check();
    await button.click();
    assert((await first.locator('[data-quiz-feedback]').getAttribute('class')).includes('is-wrong'));
    await first.locator('input[data-correct=true]').check(); await button.click();
    assert((await first.locator('[data-quiz-feedback]').getAttribute('class')).includes('is-correct'));

    const layout = () => first.evaluate((el) => {
      const labels = [...el.querySelectorAll('label')];
      const button = el.querySelector('[data-quiz-submit]');
      const css = (node) => getComputedStyle(node);
      return { labels: labels.map((node) => ({ display: css(node).display, top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom, height: node.getBoundingClientRect().height })),
        button: { height: button.getBoundingClientRect().height, radius: parseFloat(css(button).borderRadius), background: css(button).backgroundColor, border: css(button).borderColor },
        radioShrink: css(labels[0].querySelector('input')).flexShrink,
        selected: css(labels.find((node) => node.querySelector('input:checked'))).backgroundColor,
        unselected: css(labels.find((node) => !node.querySelector('input:checked'))).backgroundColor };
    });
    const verifyLayout = async () => {
      const result = await layout();
      assert(result.labels.every((label) => label.display === 'flex' && label.height >= 40));
      for (let i = 1; i < result.labels.length; i++) assert(result.labels[i].top >= result.labels[i - 1].bottom, 'options do not share a line');
      assert(result.button.height >= 40 && result.button.radius >= 6);
      assert.equal(result.button.background, result.button.border);
      assert.equal(result.radioShrink, '0');
      assert.notEqual(result.selected, result.unselected);
      return result;
    };
    const shot = async (name) => { if (output) await first.locator('..').screenshot({ path: path.join(output, name + '.png'), animations: 'disabled' }); };
    await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
    const light = await verifyLayout();
    assert.equal(await page.locator('html').evaluate((el) => getComputedStyle(el).colorScheme), 'light');
    await first.locator('input:checked').focus();
    assert.equal(await first.locator('label:focus-within').evaluate((el) => getComputedStyle(el).outlineStyle), 'solid');
    await shot('choice-light');
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    const dark = await verifyLayout();
    assert.notEqual(light.button.background, dark.button.background);
    assert.equal(await page.locator('html').evaluate((el) => getComputedStyle(el).colorScheme), 'dark');
    await shot('choice-dark');
    await page.setViewportSize({ width: 390, height: 844 });
    await verifyLayout();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await shot('choice-mobile');

    // Reproduce a generated page that omitted all quiz layout classes.
    await first.evaluate((el) => {
      el.querySelector('.quiz-options')?.replaceWith(...el.querySelector('.quiz-options').childNodes);
      el.querySelectorAll('label').forEach((label) => { label.className = ''; });
      el.querySelector('[data-quiz-submit]').className = '';
    });
    await verifyLayout(); await shot('choice-classless-fallback');
    await button.evaluate((el) => { el.disabled = true; });
    assert(parseFloat(await button.evaluate((el) => getComputedStyle(el).opacity)) < 1);
    await button.evaluate((el) => { el.disabled = false; });

    const expected = {};
    for (let i = 0; i < await groups.count(); i++) {
      const group = groups.nth(i);
      const choice = group.locator('input[type=radio]').nth(i % 4);
      await choice.check();
      expected[await group.getAttribute('data-save-key')] = await choice.getAttribute('value');
    }
    for (let i = 0; i < await opened.count(); i++) {
      const field = opened.nth(i);
      const text = `合成浏览器回归字段 ${i + 1}，不是学员能力证据。`;
      expected[await field.getAttribute('data-save-key')] = text;
      await field.fill(text);
    }
    const saved = path.join(isolatedCourse, 'learner-submissions/entry-assessment.json');
    await until(() => fs.existsSync(saved) && Object.entries(expected).every(([key, value]) => JSON.parse(fs.readFileSync(saved, 'utf8')).fields[key] === value));
    const payload = JSON.parse(fs.readFileSync(saved, 'utf8'));
    assert.equal(Object.keys(payload.fields).length, 7);
    assert.equal(payload.course, 'zhi-jian-agent');
    await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.waitForFunction(() => document.querySelector('.sync-status')?.dataset.state === 'saved');
    for (let i = 0; i < await groups.count(); i++) {
      const group = groups.nth(i);
      assert.equal(await group.locator('input:checked').getAttribute('value'), expected[await group.getAttribute('data-save-key')]);
    }
    for (let i = 0; i < await opened.count(); i++) assert.equal(await opened.nth(i).inputValue(), expected[await opened.nth(i).getAttribute('data-save-key')]);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('[data-save-export]').click();
    const download = await downloadPromise;
    const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.deepEqual(exported.fields, expected);
    assert.deepEqual(remote, []); assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, choice_fields: 4, open_fields: 3, checks: ['uniform-option-layout', 'primary-check-button', 'selected-focus-disabled-states', 'light-dark-native-controls', 'mobile-no-overflow', 'classless-fallback', 'feedback', 'seven-field-file-sync', 'restore-with-empty-browser-storage', 'export', 'no-remote-request'], screenshots: output }));
  } finally {
    if (browser) await browser.close();
    if (server && server.exitCode === null) { server.kill(); await new Promise((resolve) => server.once('exit', resolve)); }
    const absolute = path.resolve(temporary);
    if (path.dirname(absolute) === path.resolve(os.tmpdir()) && path.basename(absolute).startsWith('teach-pro-assessment-')) fs.rmSync(absolute, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
