/* Native keyring + actual process restarts + synthetic local model only. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn, execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const repo = path.resolve(__dirname, '..');
const python = process.env.TEACH_PYTHON || 'C:/Users/浪客飞/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const qa = process.env.TUTOR_QA_DIR || path.resolve(repo, '../competition-work/2026-10-04-credential-qa');

test('device credentials survive real restarts and respect disconnect/confirmed deletion',
  { skip: process.platform !== 'win32', timeout: 120000 }, async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'teach-credentials-'));
    const root = path.join(temporary, 'course');
    const demo = path.join(repo, 'example/competition-demo-zhi-jian-agent');
    fs.cpSync(demo, root, { recursive: true, filter: file => !['learner-chats', 'learner-submissions', '.tutor-settings.json', '.teach-runtime', '__pycache__'].includes(path.relative(demo, file).split(path.sep)[0]) });
    fs.mkdirSync(qa, { recursive: true });
    const key = 'synthetic-credential-not-a-real-key';
    let requests = 0, runtime, base;
    const upstream = http.createServer((request, response) => {
      requests++;
      assert.equal(request.headers.authorization, 'Bearer ' + key);
      let raw = '';
      request.on('data', part => { raw += part; });
      request.on('end', () => {
        const payload = JSON.parse(raw);
        assert.equal(payload.model, 'synthetic-model');
        response.setHeader('Content-Type', 'text/event-stream');
        response.end('data: ' + JSON.stringify({ choices: [{ delta: { content: '**合成回答**：模型提出动作，运行时授权。' }, finish_reason: null }] }) + '\n\ndata: ' + JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n');
      });
    });
    await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
    const start = async () => {
      runtime = spawn(python, ['-B', '-X', 'utf8', path.join(root, 'serve_course.py'), '--no-browser'], {
        windowsHide: true, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }
      });
      await new Promise((resolve, reject) => {
        let output = '';
        const timeout = setTimeout(() => reject(new Error('Runtime startup timeout')), 10000);
        runtime.stdout.on('data', chunk => {
          output += chunk;
          const match = output.match(/Course ready: (http:\/\/127\.0\.0\.1:\d+)\//);
          if (match) { base = match[1]; clearTimeout(timeout); resolve(); }
        });
        runtime.once('exit', code => { clearTimeout(timeout); reject(new Error('Runtime exited: ' + code)); });
      });
    };
    const stop = async () => {
      if (!runtime || runtime.exitCode !== null) return;
      const stopped = new Promise(resolve => runtime.once('exit', resolve));
      runtime.kill(); await stopped;
    };
    const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    const vaultProbe = action => execFileSync(python, ['-B', '-c',
      "import sys; from pathlib import Path; root=Path(sys.argv[1]); sys.path.insert(0,str(root)); import credential_store as v; store=v.CredentialStore(root); " +
      (action === 'delete' ? 'store.delete()' : 'print(int(v.system_backend().get_password(v.SERVICE,store.account) is not None))'), root],
      { windowsHide: true, encoding: 'utf8' }).trim();
    let page;
    try {
      const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
      await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
      page = await context.newPage(); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const openSettings = async () => {
        await page.goto(base + '/settings.html');
        await page.waitForFunction(() => !document.querySelector('[name=kind]').disabled);
      };
      await start(); await openSettings();
      assert.equal(await page.locator('[name=remember_key]').isChecked(), true);
      assert.equal(await page.locator('[data-settings-forget]').isVisible(), false);
      await page.locator('[name=kind]').selectOption('custom');
      await page.locator('[name=provider]').fill('合成测试模型');
      await page.locator('[name=mode]').selectOption('local');
      await page.locator('[name=base_url]').fill('http://127.0.0.1:' + upstream.address().port + '/v1');
      await page.locator('[name=model]').selectOption('__manual__');
      await page.locator('[name=model_manual]').fill('synthetic-model');
      await page.locator('[name=api_key]').fill(key);
      await page.locator('button[type=submit]').click();
      await page.waitForFunction(() => !document.querySelector('[data-settings-test]').disabled);
      assert.equal(await page.locator('[name=api_key]').inputValue(), '');
      assert.equal(await page.locator('[name=api_key]').getAttribute('type'), 'password');
      assert.equal(requests, 0);
      assert.equal(vaultProbe('read'), '1', 'OS vault holds the synthetic credential');
      assert.equal(fs.readFileSync(path.join(root, '.tutor-settings.json'), 'utf8').includes(key), false);
      await stop(); await start(); await openSettings();
      assert.match(await page.locator('[data-settings-current]').innerText(), /已连接/);
      assert.equal(await page.locator('[name=api_key]').inputValue(), '');
      assert.equal(requests, 0, 'restart must not call a model');
      await page.screenshot({ path: path.join(qa, 'restored-desktop.png') });
      for (const theme of ['light', 'dark']) {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
        const box = await page.locator('[name=remember_key]').boundingBox();
        assert.ok(box.width <= 20 && box.height <= 20, 'compact checkbox');
        await page.screenshot({ path: path.join(qa, 'restored-mobile-' + theme + '.png') });
      }
      const lesson = fs.readdirSync(path.join(root, 'lessons')).sort()[0];
      await page.goto(base + '/lessons/' + lesson);
      await page.locator('.tutor-open').click();
      await page.locator('#tutor-message').fill('合成测试：解释模型与运行时。');
      await page.locator('.tutor-send').click();
      await page.locator('.is-assistant .tutor-text-action').waitFor();
      await page.waitForFunction(() => document.querySelector('.tutor-question').getAttribute('aria-busy') === 'false');
      assert.equal(requests, 1);
      await openSettings();
      await page.locator('[data-settings-disconnect]').click();
      await page.waitForFunction(() => document.querySelector('[data-settings-current]').textContent.includes('已暂停'));
      await stop(); await start(); await openSettings();
      assert.equal(await page.locator('[data-settings-test]').isDisabled(), true);
      assert.equal(await page.locator('[data-settings-forget]').isVisible(), true);
      await page.locator('button[type=submit]').click();
      await page.waitForFunction(() => !document.querySelector('[data-settings-test]').disabled);
      const beforeCancel = fs.readFileSync(path.join(root, '.tutor-settings.json'));
      page.once('dialog', dialog => dialog.dismiss());
      await page.locator('[data-settings-forget]').click();
      assert.deepEqual(fs.readFileSync(path.join(root, '.tutor-settings.json')), beforeCancel, 'cancel retains configuration');
      assert.equal(vaultProbe('read'), '1', 'cancel retains OS credential');
      page.once('dialog', dialog => dialog.accept());
      await page.locator('[data-settings-forget]').click();
      await page.waitForFunction(() => document.querySelector('.tutor-status').textContent.includes('已删除'));
      assert.equal(vaultProbe('read'), '0', 'confirmed deletion removes OS credential');
      await stop(); await start(); await openSettings();
      assert.equal(await page.locator('[data-settings-test]').isDisabled(), true);
      assert.equal(await page.locator('[data-settings-forget]').isVisible(), false);
      assert.equal(requests, 1);
      assert.deepEqual(errors, []);
      fs.writeFileSync(path.join(qa, 'restart-summary.json'), JSON.stringify({ platform: process.platform,
        native_storage: 'keyring Windows Credential Locker', synthetic_provider_requests: requests, process_restarts: 3,
        restored_without_key_input: true, disconnect_stays_off: true, deletion_cancel_and_confirm: true,
        desktop_and_mobile: true, errors }, null, 2));
    } catch (error) {
      if (page) {
        await page.screenshot({ path: path.join(qa, 'failure.png') });
        console.error('Synthetic browser status:', await page.locator('.tutor-status').allTextContents(), 'provider requests:', requests,
          'assistant DOM:', await page.locator('.is-assistant').allTextContents());
      }
      throw error;
    } finally {
      await browser.close(); await stop(); await new Promise(resolve => upstream.close(resolve));
      vaultProbe('delete'); // Only this test's synthetic course account, even on assertion failure.
      // Only this test's validated temporary workspace is removed.
      assert.ok(temporary.startsWith(path.join(os.tmpdir(), 'teach-credentials-')));
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });
