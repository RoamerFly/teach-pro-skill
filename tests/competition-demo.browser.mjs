// Isolated showcase QA. Node + Playwright and Chromium/Edge; Python 3.11+ for the local server.
// Only synthetic answers are entered. No model connection, listing or chat requests.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'example/competition-demo-zhi-jian-agent');
const temp = await mkdtemp(path.join(tmpdir(), 'teach-pro-demo-qa-'));
const course = path.join(temp, path.basename(source));
const output = path.resolve(process.argv[2] || path.join(temp, 'screenshots'));
const browserPath = process.env.TEACH_PRO_BROWSER || (process.platform === 'win32'
  ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : 'chromium');
await cp(source, course, { recursive: true, filter: file => !['learner-submissions', 'learner-chats', '.tutor-settings.json', '__pycache__'].includes(path.basename(file)) });
await mkdir(output, { recursive: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const processes = [];
function launch(command, args, cwd) {
  const child = spawn(command, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  processes.push(child);
  child.spawnError = null;
  child.on('error', error => { child.spawnError = error; });
  return child;
}
async function until(check, label) {
  for (let i = 0; i < 100; i++) {
    const value = await check();
    if (value) return value;
    await sleep(100);
  }
  throw new Error('Timed out: ' + label);
}
let browser;
const report = { source: 'example/competition-demo-zhi-jian-agent', viewports: [], quizzes: [], service: {}, errors: [], externalRequests: [] };
try {
  browser = await chromium.launch({ headless: true, executablePath: browserPath });
  const context = await browser.newContext({ acceptDownloads: true });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (/^https?:/.test(url.protocol) && url.hostname !== '127.0.0.1') return route.abort();
    return route.continue();
  });
  const browserPage = await context.newPage();
  const cdp = await context.newCDPSession(browserPage);
  const send = (method, params = {}) => cdp.send(method, params);
  cdp.on('Runtime.exceptionThrown', event => report.errors.push(event.exceptionDetails.text));
  cdp.on('Network.requestWillBeSent', event => {
    const url = event.request.url;
    if (/^https?:/.test(url) && new URL(url).hostname !== '127.0.0.1') report.externalRequests.push(url);
  });
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  async function navigate(url, width = 1366) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width === 390 });
    await send('Page.navigate', { url });
    await until(() => evaluate(`location.href === ${JSON.stringify(url)} && document.readyState === 'complete'`), 'page load');
    await sleep(250);
  }
  async function screenshot(name) {
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(path.join(output, name + '.png'), Buffer.from(shot.data, 'base64'));
  }
  const pages = ['index.html', 'settings.html', 'practice/entry-assessment.html',
    'reference/teaching-decisions.html', 'reference/resource-learning-center.html',
    'lessons/0001-llm-to-agent-api-call.html', 'lessons/0002-trust-boundary-authorization.html', 'lessons/0003-tool-calling-dataflow.html'];
  for (const page of pages) {
    for (const width of [390, 1366]) {
      await navigate(pathToFileURL(path.join(course, page)).href, width);
      const view = await evaluate(`({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        themeControls: document.querySelectorAll('.theme-control').length,
        quizzes: document.querySelectorAll('[data-quiz]').length,
        fields: document.querySelectorAll('[data-save-key]').length,
        headings: document.querySelectorAll('h1').length })`);
      assert.ok(view.scrollWidth <= width, `${page} overflows at ${width}: ${JSON.stringify(view)}`);
      assert.equal(view.headings, 1, page); assert.equal(view.themeControls, 1, page);
      report.viewports.push({ page, requestedWidth: width, ...view });
      if (page === 'index.html' || page === 'practice/entry-assessment.html') await screenshot(page.replace(/\W/g, '-') + '-' + width);
    }
    const quizResults = await evaluate(`(() => [...document.querySelectorAll('[data-quiz]')].map(q => {
      function check(correct) {
        const radio = q.querySelector('input[data-correct="' + correct + '"]');
        radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true }));
        q.querySelector('[data-quiz-submit]').click();
        return q.querySelector('[data-quiz-feedback]').textContent.trim();
      }
      return { key: q.dataset.saveKey, wrong: check(false), right: check(true) };
    }))()`);
    for (const quiz of quizResults) { assert.ok(quiz.wrong && quiz.right && quiz.wrong !== quiz.right, quiz.key); }
    if (quizResults.length) {
      await send('Page.reload'); await sleep(500);
      assert.ok(await evaluate(`[...document.querySelectorAll('[data-quiz]')].every(q => q.querySelector('input:checked')?.dataset.correct === 'true')`), page + ' browser restore');
    }
    report.quizzes.push({ page, checked: quizResults.length, browserRestore: quizResults.length > 0 });
    if (page.startsWith('lessons/')) {
      const padding = await evaluate(`(() => {
        const d = document.querySelector('details.answer'); d.open = true;
        const p = d.querySelector('p');
        return p.getBoundingClientRect().left - d.getBoundingClientRect().left;
      })()`);
      assert.ok(padding >= 8, page + ' expanded answer inset');
      await evaluate(`document.documentElement.dataset.theme = 'dark'; document.querySelector('figure').scrollIntoView({ block: 'center', behavior: 'instant' })`);
      await screenshot(path.basename(page, '.html') + '-diagram-dark');
    }
  }
  await navigate(pathToFileURL(path.join(course, 'index.html')).href);
  const collapse = await evaluate(`(() => { const b = document.querySelector('.sidebar-collapse');
    const shell = document.querySelector('.page-shell');
    const a = shell.className; b.click(); const c = shell.className; b.click();
    return { changed: a !== c, restored: a === shell.className }; })()`);
  assert.ok(collapse.changed && collapse.restored); report.sidebar = collapse;

  const server = launch(process.env.TEACH_PRO_PYTHON || 'python', ['-u', '-X', 'utf8', 'serve_course.py', '--no-browser'], course);
  let serverLog = ''; server.stdout.on('data', data => { serverLog += data; }); server.stderr.resume();
  const base = await until(() => { if (server.spawnError) throw server.spawnError; return serverLog.match(/Course ready: (http:\/\/127\.0\.0\.1:\d+\/)/)?.[1]; }, 'local server');
  for (const page of pages) {
    const response = await context.request.get(base + page);
    assert.equal(response.status(), 200, 'served ' + page); await response.dispose();
  }
  report.service.servedPages = pages.length;
  await navigate(base + 'practice/entry-assessment.html');
  await until(() => evaluate(`document.querySelector('.sync-status')?.dataset.state === 'ready'`), 'sync ready');
  await evaluate(`(() => { for (const field of document.querySelectorAll('[data-save-key]')) {
    if (field.matches('[data-quiz]')) { const r = field.querySelector('input[data-correct="true"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
    else { field.value = '合成 QA 作答：' + field.dataset.saveKey; field.dispatchEvent(new Event('input', { bubbles: true })); }
  } })()`);
  const answerFile = path.join(course, 'learner-submissions/entry-assessment.json');
  await until(async () => { try { const s = JSON.parse(await readFile(answerFile, 'utf8')); return Object.values(s.fields).filter(Boolean).length === 6; } catch { return false; } }, 'six saved fields');
  await until(() => evaluate(`document.querySelector('.sync-status')?.dataset.state === 'saved'`), 'sync saved');
  await evaluate('localStorage.clear()'); await send('Page.reload');
  await until(() => evaluate(`document.querySelector('.sync-status')?.dataset.state === 'saved'`), 'file restore');
  assert.equal(await evaluate(`[...document.querySelectorAll('[data-save-key]')].filter(f => f.matches('[data-quiz]') ? f.querySelector('input:checked') : f.value).length`), 6);
  const downloadPromise = browserPage.waitForEvent('download');
  await evaluate(`document.querySelector('[data-save-export]').click()`);
  const download = await downloadPromise;
  const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(Object.keys(backup.fields).length, 6);
  await evaluate(`window.confirm = () => true; document.querySelector('[data-save-clear]').click()`);
  await until(async () => Object.values(JSON.parse(await readFile(answerFile, 'utf8')).fields).every(v => v === ''), 'cleared file');
  report.service.assessment = { autoSavedFields: 6, restoredFromFile: 6, backupFields: 6, clearSynced: true };

  await navigate(base + 'lessons/0003-tool-calling-dataflow.html');
  await until(() => evaluate(`document.querySelector('.sync-status')?.dataset.state === 'ready'`), 'lesson sync ready');
  await evaluate(`(() => { const f = document.querySelector('[data-save-key="lesson-0003-troubles"]'); f.value = '合成 QA 疑难：工具结果如何关联？'; f.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  const lessonFile = path.join(course, 'learner-submissions/0003-tool-calling-dataflow.json');
  await until(async () => { try { return JSON.parse(await readFile(lessonFile, 'utf8')).fields['lesson-0003-troubles']; } catch { return false; } }, 'lesson save');
  assert.ok(Object.values(JSON.parse(await readFile(answerFile, 'utf8')).fields).every(v => v === ''));
  report.service.lesson = { troublesAutoSaved: true, assessmentIsolated: true };
  await evaluate(`document.querySelector('.tutor-open').click()`);
  await until(() => evaluate(`document.querySelector('#tutor-dialog')?.open && document.querySelector('[data-tutor-model]')?.textContent === '未连接模型' && document.querySelector('.tutor-empty')`), 'optional tutor ready');
  const contextRecord = await evaluate(`(async () => { const bootstrap = await fetch('/api/tutor/bootstrap').then(r => r.json()); return fetch('/api/tutor/context/0003-tool-calling-dataflow', { headers: { 'X-Teach-Token': bootstrap.token } }).then(r => r.json()); })()`);
  const tutor = await evaluate(`({
    sendDisabled: document.querySelector('.tutor-question button[type="submit"]').disabled,
    previewAbsent: !document.querySelector('.tutor-context-text'),
    chatEmpty: !!document.querySelector('.tutor-empty'),
    settingsLink: !!document.querySelector('.tutor-empty a[href*="settings.html"]') })`);
  tutor.contextLoaded = contextRecord.text.includes('tool_calls');
  tutor.syntheticAnswerExcluded = !contextRecord.text.includes('合成 QA 疑难');
  assert.ok(tutor.sendDisabled && tutor.contextLoaded && tutor.syntheticAnswerExcluded && tutor.chatEmpty && tutor.previewAbsent && tutor.settingsLink);
  report.service.optionalTutor = tutor;

  await navigate(base + 'settings.html');
  await until(() => evaluate(`!document.querySelector('select[name="kind"]').disabled`), 'settings bootstrap');
  const settings = await evaluate(`(() => {
    const form = document.querySelector('.tutor-config'); const key = form.elements.api_key;
    form.elements.kind.value = 'deepseek'; form.elements.kind.dispatchEvent(new Event('change', { bubbles: true }));
    const initial = key.type; key.value = 'DEMO_KEY_NOT_VALID'; document.querySelector('[data-key-toggle]').click(); const shown = key.type;
    document.querySelector('[data-key-toggle]').click(); key.value = '';
    return { baseUrl: form.elements.base_url.value, initially: initial, revealed: shown, restored: key.type,
      consentAbsent: !document.querySelector('[data-settings-consent]'),
      modelsDisabled: document.querySelector('[data-settings-models]').disabled,
      testDisabled: document.querySelector('[data-settings-test]').disabled };
  })()`);
  assert.equal(settings.baseUrl, 'https://api.deepseek.com');
  assert.deepEqual([settings.initially, settings.revealed, settings.restored], ['password', 'text', 'password']);
  assert.ok(settings.consentAbsent && !settings.modelsDisabled && settings.testDisabled);
  report.service.settings = settings;
  await screenshot('settings-deepseek-no-key');
  assert.equal(report.errors.length, 0); assert.equal(report.externalRequests.length, 0);
  await writeFile(path.join(output, 'qa-report.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ ...report, screenshots: output, isolatedWorkspace: course }, null, 2) + '\n');
  await browser.close();
} finally {
  await browser?.close();
  for (const process of processes) process.kill();
  // Keep only this isolated temp workspace for inspectable evidence; never delete user courses.
}
