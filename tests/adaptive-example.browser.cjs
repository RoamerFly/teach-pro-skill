/* Synthetic learner interactions, not a model-generation or learning-outcome eval. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn, execFileSync} = require('node:child_process');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const repo = path.resolve(__dirname, '..');
const skill = process.env.EXAMPLE_SKILL_ROOT || path.join(repo, 'teach-pro');
const python = process.env.TEACH_PRO_PYTHON || 'C:/Users/浪客飞/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const qa = path.resolve(process.env.EXAMPLE_QA_DIR || '../competition-work/adaptive-example-browser-qa');
const names = ['0001-mean-and-median', '0001-s01-median-positions', '0002-spread-and-distance'];
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teach-adaptive-browser-'));
  const output = path.join(root, 'showcase');
  fs.mkdirSync(qa, {recursive: true});
  let browser, runtime;
  const stop = async () => {
    if (!runtime) return;
    const process = runtime; runtime = null;
    if (process.exitCode !== null) return;
    await new Promise(resolve => {process.once('exit', resolve); process.kill();});
  };
  const start = () => new Promise((resolve, reject) => {
    runtime = spawn(python, ['-X', 'utf8', '-B', '-u', 'serve_course.py', '--session-only', '--no-browser', '--port', '0'],
      {cwd: path.join(output, 'case-b'), windowsHide: true});
    runtime.stderr.resume(); let text = '';
    const timer = setTimeout(() => reject(new Error('runtime startup timeout')), 10000);
    runtime.once('error', e => {clearTimeout(timer); reject(e);});
    runtime.once('exit', () => {clearTimeout(timer); reject(new Error('runtime exited'));});
    runtime.stdout.on('data', chunk => {
      text += chunk; const match = text.match(/Course ready: (http:\/\/127\.0\.0\.1:\d+)\//);
      if (match) {clearTimeout(timer); resolve(match[1]);}
    });
  });
  try {
    execFileSync(python, ['-X', 'utf8', '-B', path.join(skill, 'scripts/build_adaptive_example.py'), output], {windowsHide: true});
    browser = await chromium.launch({headless: true, executablePath: process.env.TEACH_PRO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
    const context = await browser.newContext(); const errors = [], remote = [];
    const isolate = context => context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (['http:', 'https:'].includes(url.protocol) && url.hostname !== '127.0.0.1') {
        remote.push(url.href); return route.abort();
      }
      return route.continue();
    });
    await isolate(context);
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    let layoutChecks = 0;
    const layout = async label => {
      for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
        await page.setViewportSize({width, height: 900});
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: ${width}/${theme}`);
        layoutChecks++;
      }
      await page.setViewportSize({width: 1440, height: 900});
      await page.screenshot({path: path.join(qa, label + '-dark.png'), fullPage: true});
    };
    await page.goto(pathToFileURL(path.join(output, 'index.html')).href);
    for (const branch of ['start', 'case-a', 'case-b']) assert.equal(await page.locator(`a[href="./${branch}/index.html"]`).count(), 1);
    await layout('portal');
    const fixturePath = path.join(output, 'case-b/synthetic-inputs/0001-answer.json');
    const originalFixture = fs.readFileSync(fixturePath);
    const fixture = JSON.parse(originalFixture);
    let base = await start();
    await page.goto(base + '/lessons/' + names[0] + '.html');
    await page.locator('input[value="median-25"]').check();
    await page.locator('[data-quiz-submit]').click();
    assert.match(await page.locator('[data-quiz-feedback]').innerText(), /还需要调整/);
    await page.locator('input[value="median-30"]').check();
    assert.equal(await page.locator('[data-quiz-feedback]').innerText(), '');
    await page.locator('[data-quiz-submit]').click();
    assert.match(await page.locator('[data-quiz-feedback]').innerText(), /回答正确/);
    // Replay B's original misconception, not the corrected choice above.
    await page.locator('input[value="median-25"]').check();
    await page.locator('#lesson-evidence').fill(fixture.fields['lesson-0001-evidence']);
    await page.locator('#lesson-questions').fill(fixture.fields['lesson-0001-questions']);
    await page.waitForFunction(() => document.querySelector('.sync-status')?.dataset.state === 'saved');
    await layout('first-lesson');
    const answers = [fixture.fields['lesson-0001-evidence'], '合成复核：替换52为520，中位数13；新增520，人数6，中位数17。', '合成新课作答：12、16、20、24、28的均值20元，MAD4.8元。'];
    for (let index = 1; index < names.length; index++) {
      await page.goto(base + '/lessons/' + names[index] + '.html');
      const expectedKey = index === 1 ? 'lesson-0001-s01-evidence' : 'lesson-0002-evidence';
      assert.equal(await page.locator('#lesson-evidence').getAttribute('data-save-key'), expectedKey);
      assert.equal(await page.locator('#lesson-evidence').inputValue(), '');
      await page.locator('#lesson-evidence').fill(answers[index]);
      await page.waitForFunction(() => document.querySelector('.sync-status')?.dataset.state === 'saved');
      await layout(index === 1 ? 'supplement' : 'formal-second');
    }
    const records = names.map(name => path.join(output, 'case-b/learner-submissions/' + name + '.json'));
    const keys = ['lesson-0001-evidence', 'lesson-0001-s01-evidence', 'lesson-0002-evidence'];
    records.forEach((record, i) => assert.equal(JSON.parse(fs.readFileSync(record)).fields[keys[i]], answers[i]));
    assert.deepEqual(fs.readFileSync(fixturePath), originalFixture);
    await stop(); base = await start();
    const fresh = await browser.newContext(); await isolate(fresh);
    const restored = await fresh.newPage(); restored.on('pageerror', e => errors.push(e.message));
    for (let i = 0; i < names.length; i++) {
      await restored.goto(base + '/lessons/' + names[i] + '.html');
      await restored.waitForFunction(() => document.querySelector('.sync-status')?.dataset.state === 'saved');
      assert.equal(await restored.locator('#lesson-evidence').inputValue(), answers[i]);
    }
    await page.goto(pathToFileURL(path.join(output, 'case-a/lessons/' + names[2] + '.html')).href);
    assert.equal(await page.locator('#lesson-evidence').inputValue(), '');
    assert.equal(await page.locator('a[href*="s01-median"]').count(), 0);
    await page.goto(base + '/reference/decision-trace.html'); await layout('decision-trace');
    assert.deepEqual(errors, []); assert.deepEqual(remote, []);
    assert(!fs.existsSync(path.join(output, 'case-b/.tutor-settings.json')));
    const report = {synthetic: true, modelCalls: 0, checks: ['portal-three-snapshots', 'wrong-answer-feedback', 'edited-answer-feedback-reset', 'first-answer-file-save', 'supplement-independent-save', 'new-formal-independent-save', 'fixture-not-overwritten', 'restart-fresh-browser-restore-three-pages', 'branch-isolation', 'no-provider-configuration'], layoutChecks, pageErrors: errors, externalRequests: remote.length};
    fs.writeFileSync(path.join(qa, 'audit.json'), JSON.stringify(report, null, 2));
    console.log('PASS: ' + JSON.stringify(report));
  } finally {
    await browser?.close(); await stop();
    if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('teach-adaptive-browser-')) throw new Error('Unexpected cleanup target');
    fs.rmSync(root, {recursive: true, force: true});
  }
})().catch(e => {console.error(e); process.exitCode = 1;});
