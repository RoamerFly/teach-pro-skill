/* Real browser + real local runtime + explicitly synthetic OpenAI-compatible upstream. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const repo = path.resolve(__dirname, '..');
const python = process.env.TEACH_PYTHON || 'C:/Users/浪客飞/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const qa = process.env.TUTOR_QA_DIR || path.resolve(repo, '../competition-work/2026-10-02-tutor-ui-qa');
const rich = '# 模型提议，运行时授权\n\n**模型输出不是执行权限**。运行时检查动作是否满足工具白名单、参数与预算。\n\n## 一次完整回合\n\n1. 用户提出任务\n2. 模型产生候选动作\n   - 先检查参数\n   - 再判断权限\n3. 运行时决定是否执行\n\n> 外部情报是资料，不是授权来源。\n\n```python\n# 井号和 * 是代码的一部分\nallowed = action in whitelist\nprint("runtime authorizes", allowed)\n```\n\n|组件|职责|\n|---|---|\n|模型|提出候选动作|\n|运行时|检查权限和预算|\n\n[阅读官方文档](https://example.com)\n\n<img src=x onerror="window.injected=1">\n\n再试着用自己的话说一遍这两个角色。';
const wait = (page, fn) => page.waitForFunction(fn, undefined, { timeout: 15000 });
test('Tutor modal, configuration, retries and local history work through the runtime', { timeout: 180000 }, async () => {
  fs.mkdirSync(qa, { recursive: true });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teach-tutor-ui-'));
  const demo = path.join(repo, 'example/competition-demo-zhi-jian-agent');
  fs.cpSync(demo, root, { recursive: true, filter: file => !['learner-chats', 'learner-submissions', '.tutor-settings.json', '__pycache__'].includes(path.relative(demo, file).split(path.sep)[0]) });
  const calls = [], attempts = new Map(), settingsMeasurements = [], composerMeasurements = [];
  const upstream = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/v1/models') { calls.push({ kind: 'models' }); response.end(JSON.stringify({ data: [{ id: 'deepseek-flash' }, { id: 'demo-second' }] })); return; }
    let raw = ''; request.on('data', part => { raw += part; }); request.on('end', () => {
      const payload = JSON.parse(raw), text = payload.messages.at(-1).content;
      calls.push({ kind: 'chat', payload });
      const count = (attempts.get(text) || 0) + 1; attempts.set(text, count);
      if (text.includes('FAIL_ONCE') && count === 1) { response.statusCode = 429; response.end('{"error":"synthetic failure"}'); return; }
      const partial = text.includes('LENGTH_ONCE') && count === 1;
      const body = text === '连接测试，请仅回复 OK。' ? 'OK' : text.includes('LONG') ? rich.repeat(12) : rich;
      if (payload.stream) {
        response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        const content = partial ? '这是尚未讲完的一段。' : body;
        const frame = (delta, finish = null) => response.write('data: ' + JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finish }] }) + '\r\n\r\n');
        const size = Math.ceil(content.length / 3), delay = text.includes('SLOW') ? 1000 : 0;
        setTimeout(() => {
          frame({ reasoning_content: 'PRIVATE_SYNTHETIC_REASONING' }); frame({ content: content.slice(0, size) });
          setTimeout(() => frame({ content: content.slice(size, size * 2) }), 140);
          setTimeout(() => frame({ content: content.slice(size * 2) }), 280);
          setTimeout(() => { frame({}, partial ? 'length' : 'stop'); response.end('data: [DONE]\r\n\r\n'); }, 420);
        }, delay);
      } else setTimeout(() => response.end(JSON.stringify({ choices: [{ finish_reason: partial ? 'length' : 'stop', message: { content: partial ? '这是尚未讲完的一段。' : body } }], usage: { prompt_tokens: 120, completion_tokens: 350, total_tokens: 470 } })), 60);
    });
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const runtime = spawn(python, ['-X', 'utf8', path.join(root, 'serve_course.py'), '--no-browser'], { env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  let base = '', output = '';
  const ready = new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error('runtime start timeout: ' + output)), 10000);
    runtime.stdout.on('data', part => { output += part; const found = output.match(/Course ready: (http:\/\/127\.0\.0\.1:\d+)\//); if (found) { base = found[1]; clearTimeout(deadline); resolve(); } });
    runtime.once('exit', code => { clearTimeout(deadline); reject(new Error('runtime exited ' + code)); });
  });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const errors = [];
  try {
    await ready;
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (['http:', 'https:'].includes(url.protocol) && url.hostname !== '127.0.0.1') return route.abort();
      return route.continue();
    });
    const lessonFiles = fs.readdirSync(path.join(root, 'lessons')).filter(file => file.endsWith('.html')).sort();
    const first = '/lessons/' + lessonFiles[0], second = '/lessons/' + lessonFiles[1];
    await page.goto(base + first); await page.locator('.tutor-open').waitFor();
    await page.locator('.tutor-open').click(); await wait(page, () => document.querySelector('.tutor-empty') && document.querySelector('[data-tutor-model]').textContent === '未连接模型');
    assert.equal(calls.length, 0, 'opening a page or dialog must not request a provider');
    assert.equal(await page.locator('[data-tutor-consent], .tutor-context').count(), 0);
    await page.screenshot({ path: path.join(qa, '01-unconfigured-modal.png') });
    await page.locator('[data-tutor-close]').click();
    assert.equal(await page.locator('.tutor-open').evaluate(el => el === document.activeElement), true);
    await page.goto(base + '/settings.html?lesson=' + lessonFiles[0].replace('.html', ''));
    await wait(page, () => !document.querySelector('[data-settings-models]').disabled);
    await page.locator('[name=kind]').selectOption('deepseek');
    assert.equal(await page.locator('[name=base_url]').inputValue(), 'https://api.deepseek.com');
    assert.equal(await page.locator('[name=thinking]').inputValue(), 'disabled');
    await page.locator('[name=kind]').selectOption('custom');
    await page.locator('[name=provider]').fill('合成测试接口'); await page.locator('[name=mode]').selectOption('local');
    await page.locator('[name=base_url]').fill('http://127.0.0.1:' + upstream.address().port + '/v1');
    await page.locator('[name=api_key]').fill('synthetic-demo-credential');
    assert.equal(await page.locator('[name=api_key]').getAttribute('type'), 'password');
    await page.locator('[data-key-toggle]').click(); assert.equal(await page.locator('[name=api_key]').getAttribute('type'), 'text');
    await page.locator('[data-key-toggle]').click();
    await page.locator('[data-settings-models]').click();
    await wait(page, () => document.querySelector('[name=model] option[value="deepseek-flash"]'));
    assert.equal(await page.locator('.tutor-status').getAttribute('data-state'), 'success');
    await page.locator('[name=model]').selectOption('deepseek-flash');
    assert.equal(await page.locator('.tutor-status').getAttribute('data-state'), 'ready');
    await page.locator('button[type=submit]').click(); await wait(page, () => !document.querySelector('[data-settings-test]').disabled);
    assert.equal(await page.locator('[name=api_key]').inputValue(), '');
    await page.locator('[data-settings-test]').click(); await wait(page, () => document.querySelector('.tutor-status').textContent.includes('连接成功'));
    assert.equal(await page.locator('.tutor-status').getAttribute('data-state'), 'success');
    assert.equal(await page.locator('.tutor-status').evaluate(el => getComputedStyle(el).backgroundColor), await page.evaluate(() => {
      const sample = document.createElement('div'); sample.style.backgroundColor = 'var(--success-soft)'; document.body.append(sample); const color = getComputedStyle(sample).backgroundColor; sample.remove(); return color;
    }));
    await page.locator('.settings-advanced').evaluate(el => { el.open = false; });
    const checkSettingsRow = async target => {
      const boxes = await target.evaluate(() => {
        const bounds = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height, left: r.left, right: r.right }; };
        return { select: bounds('[name=model]'), button: bounds('[data-settings-models]'), width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.ok(!boxes.overflow, JSON.stringify(boxes));
      if (boxes.width > 640) {
        assert.ok(Math.abs(boxes.select.top - boxes.button.top) < 1 && Math.abs(boxes.select.bottom - boxes.button.bottom) < 1, JSON.stringify(boxes));
      } else assert.ok(boxes.button.top >= boxes.select.bottom && Math.abs(boxes.button.left - boxes.select.left) < 1, JSON.stringify(boxes));
      settingsMeasurements.push(boxes);
    };
    await checkSettingsRow(page);
    await page.screenshot({ path: path.join(qa, '02-settings-light.png') });
    for (const [width, theme] of [[960, 'dark'], [641, 'light'], [640, 'light'], [390, 'dark']]) {
      await page.setViewportSize({ width, height: 900 }); await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      await checkSettingsRow(page);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route('**/api/tutor/test', route => route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"synthetic connection failure"}' }));
    await page.locator('[data-settings-test]').click(); await wait(page, () => document.querySelector('.tutor-status').dataset.state === 'error');
    await page.unroute('**/api/tutor/test');
    await page.goto(base + first + '#lesson-tutor'); await wait(page, () => document.querySelector('#tutor-dialog').open && !document.querySelector('#tutor-message').disabled);
    const checkComposer = async () => {
      const geometry = await page.evaluate(() => {
        const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height }; };
        return { input: rect('#tutor-message'), button: rect('.tutor-input-row button'), composer: rect('.tutor-question'), status: { hidden: document.querySelector('.tutor-status').hidden, text: document.querySelector('.tutor-status').textContent }, selection: document.querySelector('.tutor-selection').hidden };
      });
      assert.ok(geometry.input.right < geometry.button.left && Math.abs(geometry.input.bottom - geometry.button.bottom) < 1, JSON.stringify(geometry));
      assert.ok(geometry.composer.height < 90, JSON.stringify(geometry));
      assert.equal(await page.locator('.tutor-composer-hint, .tutor-composer-bar').count(), 0);
      assert.equal(await page.locator('.tutor-status').isVisible(), false);
      composerMeasurements.push(geometry);
    };
    await checkComposer();
    const ask = async text => {
      await page.locator('#tutor-message').fill(text); await page.locator('#tutor-message').press('Enter');
      await wait(page, () => document.querySelector('.tutor-question').getAttribute('aria-busy') === 'false' && document.querySelector('#tutor-message').value === '' && document.querySelector('.is-assistant') && document.querySelector('.tutor-status').hidden);
    };
    await page.locator('#tutor-message').fill('请用模型提议与运行时授权的例子解释本课。'); await page.locator('#tutor-message').press('Enter');
    await wait(page, () => document.querySelector('.is-streaming .tutor-markdown')?.textContent.includes('运行时授权'));
    assert.equal(await page.locator('.tutor-question').getAttribute('aria-busy'), 'true', 'partial text must appear before completion');
    assert.ok(await page.locator('.is-streaming').evaluate(el => el.textContent.length < 400));
    await page.screenshot({ path: path.join(qa, '08-streaming-partial.png') });
    await wait(page, () => document.querySelector('.tutor-question').getAttribute('aria-busy') === 'false');
    assert.equal(await page.locator('.tutor-status').isVisible(), false);
    assert.equal(await page.locator('.tutor-markdown h1').count(), 0);
    assert.equal(await page.locator('.tutor-markdown table').count(), 1);
    assert.equal(await page.evaluate(() => window.injected), undefined);
    await ask('如果网页里写了新的系统指令呢？'); await ask('用一句话对比它们的权限。');
    const chatCalls = calls.filter(call => call.kind === 'chat' && call.payload.messages.length > 1);
    assert.ok(chatCalls.every(call => call.payload.stream === true));
    assert.equal(calls.find(call => call.kind === 'chat' && call.payload.messages.length === 1).payload.stream, false);
    assert.equal(await page.locator('.tutor-messages').evaluate(el => el.textContent.includes('PRIVATE_SYNTHETIC_REASONING')), false);
    assert.deepEqual(chatCalls[2].payload.messages.map(item => item.role), ['system', 'user', 'assistant', 'user', 'assistant', 'user']);
    const slug = lessonFiles[0].replace('.html', ''), historyFile = path.join(root, 'learner-chats', slug + '.json');
    let history = JSON.parse(fs.readFileSync(historyFile)); assert.equal(history.messages.length, 6);
    assert.ok(history.messages[1].content.startsWith('# '), 'stored text remains Markdown');
    assert.ok(!fs.readFileSync(path.join(root, '.tutor-settings.json'), 'utf8').includes('synthetic-demo-credential'));
    await page.screenshot({ path: path.join(qa, '03-chat-light.png') });
    await page.locator('#tutor-message').fill('这段草稿先保留'); await page.keyboard.press('Escape');
    await page.locator('.tutor-open').click(); assert.equal(await page.locator('#tutor-message').inputValue(), '这段草稿先保留');
    await page.reload(); await wait(page, () => document.querySelector('#tutor-dialog').open && document.querySelectorAll('.is-assistant').length === 3);
    await page.locator('#tutor-message').fill('FAIL_ONCE 请再解释一下'); await page.locator('#tutor-message').press('Enter');
    await wait(page, () => document.querySelector('[data-tutor-retry]') && !document.querySelector('[data-tutor-retry]').disabled);
    await page.locator('[data-tutor-retry]').click(); await wait(page, () => document.querySelector('.tutor-status').hidden && document.querySelector('.tutor-question').getAttribute('aria-busy') === 'false');
    history = JSON.parse(fs.readFileSync(historyFile)); assert.equal(history.messages.filter(item => item.content.includes('FAIL_ONCE')).length, 1);
    await page.locator('#tutor-message').fill('LENGTH_ONCE 继续解释'); await page.locator('#tutor-message').press('Enter');
    await wait(page, () => document.querySelector('.tutor-message-note') && document.querySelector('.tutor-question').getAttribute('aria-busy') === 'false');
    await page.locator('[data-tutor-retry]').click(); await wait(page, () => document.querySelector('.tutor-status').hidden && document.querySelector('.tutor-question').getAttribute('aria-busy') === 'false');
    history = JSON.parse(fs.readFileSync(historyFile)); assert.equal(history.messages.filter(item => item.status === 'incomplete').length, 1);
    await page.locator('#tutor-message').fill('SLOW 关窗后继续回答'); await page.locator('#tutor-message').press('Enter');
    await wait(page, () => document.querySelector('.tutor-question').getAttribute('aria-busy') === 'true');
    await page.locator('[data-tutor-close]').click(); await wait(page, () => document.querySelector('.tutor-question').getAttribute('aria-busy') === 'false');
    await page.locator('.tutor-open').click(); await wait(page, () => document.querySelectorAll('.is-assistant').length === 7);
    await ask('LONG 展开完整讲解');
    await page.locator('.tutor-messages').evaluate(el => { el.scrollTop = 0; });
    await page.locator('#tutor-message').fill('SLOW 阅读历史时不要跳走'); await page.locator('#tutor-message').press('Enter');
    await wait(page, () => document.querySelector('.tutor-question').getAttribute('aria-busy') === 'true');
    await page.locator('.tutor-messages').evaluate(el => { el.scrollTop = 0; });
    await wait(page, () => document.querySelector('.tutor-question').getAttribute('aria-busy') === 'false');
    assert.ok(await page.locator('.tutor-messages').evaluate(el => el.scrollTop < 100));
    assert.equal(await page.locator('.tutor-jump').isVisible(), true); await page.locator('.tutor-jump').click();
    await page.locator('#tutor-message').fill('输入法回车不发送');
    const beforeIme = calls.length;
    await page.locator('#tutor-message').evaluate(el => { el.dispatchEvent(new CompositionEvent('compositionstart')); el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true })); el.dispatchEvent(new CompositionEvent('compositionend')); });
    assert.equal(calls.length, beforeIme);
    await page.locator('#tutor-message').press('Shift+Enter'); assert.ok((await page.locator('#tutor-message').inputValue()).includes('\n'));
    await page.locator('#tutor-message').fill('');
    for (const [name, width, height, theme, visual] of [ ['04-chat-dark', 1440, 900, 'dark', 'systems'], ['05-chat-medium', 1280, 720, 'light', 'studio'], ['06-chat-mobile', 390, 844, 'dark', 'nature'] ]) {
      await page.setViewportSize({ width, height }); await page.evaluate(({ theme, visual }) => { document.documentElement.dataset.theme = theme; document.documentElement.dataset.visualTheme = visual; }, { theme, visual });
      await checkComposer();
      await page.screenshot({ path: path.join(qa, name + '.png'), animations: 'disabled' });
      assert.ok(await page.locator('#tutor-dialog').evaluate(el => el.getBoundingClientRect().right <= innerWidth + 1));
      assert.ok(await page.locator('.tutor-question').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight + 1));
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('[data-tutor-close]').click();
    await page.goto(base + second); await page.locator('.tutor-open').click(); await wait(page, () => document.querySelector('.tutor-empty'));
    assert.equal(await page.locator('.tutor-message').count(), 0, 'lesson histories must not merge');
    await ask('第二课的问题');
    page.once('dialog', prompt => prompt.accept()); await page.locator('.tutor-more summary').click(); await page.locator('[data-tutor-clear]').click();
    await wait(page, () => document.querySelector('.tutor-empty'));
    assert.equal(JSON.parse(fs.readFileSync(historyFile)).messages.length, 17);
    assert.equal(fs.existsSync(path.join(root, 'learner-chats', lessonFiles[1].replace('.html', '') + '.json')), false);
    await page.goto(base + first); await page.locator('.tutor-open').waitFor();
    await page.evaluate(() => { const paragraph = document.querySelector('main .content-section p'); const range = document.createRange(); range.selectNodeContents(paragraph); const selected = window.getSelection(); selected.removeAllRanges(); selected.addRange(range); });
    await page.locator('.tutor-open').click(); assert.equal(await page.locator('.tutor-selection').isVisible(), true);
    await page.locator('[data-tutor-unselect]').click(); assert.equal(await page.locator('.tutor-selection').isVisible(), false);
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
    await page.locator('.is-assistant .tutor-text-action').last().click();
    assert.ok((await page.evaluate(() => navigator.clipboard.readText())).startsWith('# '));
    const backup = page.waitForEvent('download'); await page.locator('.tutor-more summary').click(); await page.locator('[data-tutor-export]').click();
    const downloaded = await backup; assert.equal(downloaded.suggestedFilename(), slug + '-chat.json');
    const another = await context.newPage(); await another.goto(base + '/settings.html');
    await wait(another, () => !document.querySelector('[data-settings-models]').disabled);
    await another.locator('[name=model]').selectOption('__manual__'); await another.locator('[name=model_manual]').fill('demo-second');
    await another.locator('button[type=submit]').click(); await wait(another, () => document.querySelector('[data-settings-current]').textContent.includes('demo-second'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await wait(page, () => document.querySelector('[data-tutor-model]').textContent === 'demo-second');
    await ask('使用切换后的模型继续答疑');
    assert.equal(calls.filter(call => call.kind === 'chat').at(-1).payload.model, 'demo-second');
    await another.setViewportSize({ width: 390, height: 844 });
    await another.reload(); await wait(another, () => !document.querySelector('[data-key-toggle]').disabled);
    await another.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await another.screenshot({ path: path.join(qa, '07-settings-mobile-dark.png'), fullPage: true, animations: 'disabled' });
    await checkSettingsRow(another);
    assert.ok(await another.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('[data-tutor-close]').click();
    const providerBeforeStatic = calls.length;
    await page.goto('file:///' + path.join(root, 'lessons', lessonFiles[0]).replace(/\\/g, '/'));
    await page.locator('.tutor-open').click();
    await wait(page, () => document.querySelector('.tutor-status').textContent.includes('启动器'));
    assert.equal(calls.length, providerBeforeStatic);
    assert.equal(await page.locator('.tutor-send[type=submit]').isDisabled(), true);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(qa, 'summary.json'), JSON.stringify({ simulated: true, root, screenshots: 8, provider_operations: calls.length, client_errors: errors, settingsMeasurements, composerMeasurements, scenarios: ['no-auto-request', 'kind-default', 'key-mask', 'models', 'settings-alignment', 'success-green', 'success-reset-on-edit', 'test-error', 'compact-composer', 'true-SSE', 'partial-before-completion', 'reasoning-excluded', 'test-non-streaming', '3-rounds', 'Markdown', 'file-restore', 'retry', 'partial', 'close-during-request', 'history-scroll', 'IME', 'mobile', 'dark', 'lesson-isolation', 'clear', 'selection', 'copy', 'export', 'config-change', 'static-reading'] }, null, 2));
  } finally { await browser.close(); runtime.kill(); await new Promise(resolve => upstream.close(resolve)); }
});
