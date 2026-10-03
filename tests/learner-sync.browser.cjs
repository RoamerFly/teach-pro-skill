/* Synthetic learner input, isolated copy and loopback server only. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const repo = path.resolve(__dirname, '..');
test('learner records survive delayed restore, outages and cancelled clear', { timeout: 90000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teach-sync-'));
  const source = path.join(repo, 'example/competition-demo-zhi-jian-agent');
  fs.cpSync(source, root, { recursive: true, filter: file => !['learner-submissions', 'learner-chats', '.tutor-settings.json', '__pycache__'].includes(path.relative(source, file).split(path.sep)[0]) });
  const qa = process.env.SYNC_QA_DIR || path.join(repo, '../competition-work/2026-10-03-sync-qa');
  fs.mkdirSync(qa, { recursive: true });
  const runtime = spawn(process.env.TEACH_PRO_PYTHON || 'C:/Users/浪客飞/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe', ['-B', '-u', 'serve_course.py', '--no-browser'], { cwd: root, windowsHide: true });
  runtime.stderr.resume();
  let browser, release;
  try {
    const base = await new Promise((resolve, reject) => {
      let output = ''; const timer = setTimeout(() => reject(new Error('runtime timeout')), 10000);
      runtime.on('error', error => { clearTimeout(timer); reject(error); });
      runtime.stdout.on('data', chunk => { output += chunk; const url = output.match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0]; if (url) { clearTimeout(timer); resolve(url); } });
    });
    browser = await chromium.launch({ executablePath: process.env.TEACH_PRO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    await context.route('**/*', route => /^https?:/.test(route.request().url()) && !route.request().url().startsWith(base) ? route.abort() : route.continue());
    const page = await context.newPage(), errors = [], posts = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/api/submissions/')) posts.push(request.postDataJSON()); });
    const file = 'lessons/0001-llm-to-agent-api-call.html', slug = path.basename(file, '.html');
    const recordPath = path.join(root, 'learner-submissions', slug + '.json');
    const endpoint = '**/api/submissions/' + slug;
    const fields = page.locator('textarea[data-save-key]');
    const saved = () => page.waitForFunction(() => document.querySelector('.sync-status')?.dataset.state === 'saved');
    const value = async index => JSON.parse(fs.readFileSync(recordPath, 'utf8')).fields[await fields.nth(index).getAttribute('data-save-key')];
    await page.goto(base + file); await page.waitForFunction(() => document.querySelector('.sync-status')?.dataset.state === 'ready');
    await fields.nth(0).fill('合成：第一项旧答案'); await fields.nth(1).fill('合成：必须保留的第二项'); await saved();

    const gate = new Promise(resolve => { release = resolve; });
    await page.route(endpoint, async route => { if (route.request().method() === 'GET') await gate; await route.continue(); });
    await page.evaluate(() => localStorage.clear()); await page.reload();
    await fields.nth(0).fill('合成：恢复前的新答案'); release(); await saved();
    assert.equal(await value(0), '合成：恢复前的新答案'); assert.equal(await value(1), '合成：必须保留的第二项');
    await page.unroute(endpoint);

    let failRead = true;
    await page.route(endpoint, route => route.request().method() === 'GET' && failRead ? route.fulfill({ status: 503, body: '{}' }) : route.continue());
    await page.reload(); await page.waitForFunction(() => document.querySelector('.sync-status')?.dataset.state === 'offline');
    failRead = false; await fields.nth(0).fill('合成：断线恢复后的答案'); await saved();
    assert.equal(await value(0), '合成：断线恢复后的答案'); assert.equal(await value(1), '合成：必须保留的第二项');
    await page.unroute(endpoint);

    let failWrite = true;
    await page.route(endpoint, route => route.request().method() === 'POST' && failWrite ? route.fulfill({ status: 503, body: '{}' }) : route.continue());
    await fields.nth(0).fill('合成：写入失败也不丢'); await page.waitForFunction(() => document.querySelector('.sync-status')?.dataset.state === 'offline');
    failWrite = false; await saved(); assert.equal(await value(0), '合成：写入失败也不丢'); await page.unroute(endpoint);

    const quiz = page.locator('[data-quiz]').first(), feedback = quiz.locator('[data-quiz-feedback]');
    await quiz.locator('input[data-correct=true]').check(); await quiz.locator('[data-quiz-submit]').click();
    assert.match(await feedback.innerText(), /回答正确/);
    await quiz.locator('input:not([data-correct=true])').first().check(); assert.equal(await feedback.innerText(), '');
    await quiz.locator('[data-quiz-submit]').click(); assert.match(await feedback.innerText(), /还需要调整/); await saved();
    const bytes = fs.readFileSync(recordPath), before = posts.length;
    page.once('dialog', dialog => { assert.equal(dialog.type(), 'confirm'); assert.equal(dialog.message(), '确定清空本页答案与疑难记录吗？'); dialog.dismiss(); });
    await page.locator('[data-save-clear]').click(); await page.waitForTimeout(450);
    assert.equal(posts.length, before); assert.deepEqual(fs.readFileSync(recordPath), bytes);
    assert.equal(await fields.nth(0).inputValue(), '合成：写入失败也不丢'); assert.match(await feedback.innerText(), /还需要调整/);
    page.once('dialog', dialog => dialog.accept()); await page.locator('[data-save-clear]').click(); await saved();
    assert.ok(Object.values(JSON.parse(fs.readFileSync(recordPath, 'utf8')).fields).every(value => value === ''));
    assert.equal(await feedback.innerText(), ''); await page.reload(); await saved();
    assert.equal(await fields.nth(0).inputValue(), ''); assert.equal(await fields.nth(1).inputValue(), '');
    await page.screenshot({ path: path.join(qa, 'confirmed-clear.png') });

    // Clearing in an outage must not resurrect the old file on refresh.
    await fields.nth(0).fill('合成：清空前记录'); await saved(); failWrite = true;
    await page.route(endpoint, route => route.request().method() === 'POST' && failWrite ? route.fulfill({ status: 503, body: '{}' }) : route.continue());
    page.once('dialog', dialog => dialog.accept()); await page.locator('[data-save-clear]').click();
    await page.waitForFunction(() => document.querySelector('.sync-status')?.dataset.state === 'offline');
    failWrite = false; await page.reload(); await saved(); assert.equal(await value(0), '');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(qa, 'summary.json'), JSON.stringify({ root, client_errors: errors, synthetic: true,
      checks: ['restore-race-merge', 'GET-recovery', 'POST-recovery', 'quiz-change-reset', 'cancel-no-write', 'confirm-clear', 'refresh-cleared', 'offline-clear-refresh'] }, null, 2));
  } finally { release?.(); await browser?.close(); runtime.kill(); }
});
