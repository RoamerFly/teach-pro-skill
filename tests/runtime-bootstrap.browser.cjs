/* Windows first-run launcher: actual isolated install, no model or real credentials. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const repo = path.resolve(__dirname, '..');
const python = process.env.BOOTSTRAP_PYTHON || 'C:/Users/浪客飞/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const qa = process.env.TUTOR_QA_DIR || path.resolve(repo, '../competition-work/2026-10-05-auto-runtime-qa');

test('ordinary launcher automatically prepares a fresh course and reuses it on restart',
  { skip: process.platform !== 'win32', timeout: 180000 }, async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'teach-runtime-bootstrap-'));
    const root = path.join(temporary, 'course');
    const demo = path.join(repo, 'example/competition-demo-zhi-jian-agent');
    fs.cpSync(demo, root, { recursive: true, filter: file => !['learner-chats', 'learner-submissions', '.tutor-settings.json', '.teach-runtime', '__pycache__'].includes(path.relative(demo, file).split(path.sep)[0]) });
    fs.mkdirSync(qa, { recursive: true });
    let runtime, port, base, output = '';
    const stop = () => {
      if (port) {
        const pid = execFileSync('powershell.exe', ['-NoProfile', '-Command',
          `(Get-NetTCPConnection -State Listen -LocalAddress 127.0.0.1 -LocalPort ${port}).OwningProcess`],
          { windowsHide: true, encoding: 'utf8' }).trim();
        assert.match(pid, /^\d+$/);
        execFileSync('taskkill.exe', ['/pid', pid, '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
        port = null;
      }
      if (runtime && runtime.exitCode === null) runtime.kill();
    };
    const start = async () => {
      output = '';
      runtime = spawn('cmd.exe', ['/d', '/c', 'start-course.cmd', '--no-browser'], {
        cwd: root, windowsHide: true,
        env: { ...process.env, PATH: path.dirname(python) + path.delimiter + process.env.PATH, PYTHONUTF8: '1' }
      });
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('automatic startup timeout')), 120000);
        runtime.stdout.on('data', chunk => {
          output += chunk;
          const match = output.match(/Course ready: (http:\/\/127\.0\.0\.1:(\d+))\//);
          if (match) { base = match[1]; port = Number(match[2]); clearTimeout(timeout); resolve(); }
        });
        runtime.once('error', error => { clearTimeout(timeout); reject(error); });
      });
      const response = await fetch(base + '/api/tutor/bootstrap');
      assert.equal(response.status, 200);
      const boot = await response.json();
      assert.equal(boot.credential_storage.available, true);
      assert.equal(boot.credential_storage.backend, 'keyring.backends.Windows.WinVaultKeyring');
      assert.equal(boot.configured, false);
    };
    const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    try {
      assert.equal(fs.existsSync(path.join(root, '.teach-runtime')), false);
      const originalPrefix = execFileSync(python, ['-B', '-c', 'import sys; print(sys.prefix)'], { windowsHide: true, encoding: 'utf8' }).trim();
      const globalKeyringVersion = () => execFileSync(python, ['-B', '-c',
        'import importlib.metadata as m\ntry: print(m.version("keyring"))\nexcept m.PackageNotFoundError: print("absent")'],
        { windowsHide: true, encoding: 'utf8' }).trim();
      const originalKeyringVersion = globalKeyringVersion();
      await start();
      assert.match(output, /Preparing course runtime/);
      assert.match(output, /Course runtime ready/);
      assert.equal((output.match(/Preparing course runtime/g) || []).length, 1);
      assert.equal(fs.existsSync(path.join(root, '.teach-runtime/Scripts/python.exe')), true);
      assert.equal(fs.existsSync(path.join(root, '.tutor-settings.json')), false);
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/settings.html');
      await page.waitForFunction(() => !document.querySelector('[name=kind]').disabled);
      assert.equal(await page.locator('[name=remember_key]').isChecked(), true);
      assert.equal(await page.locator('[name=remember_key]').isEnabled(), true);
      assert.equal(await page.locator('[data-storage-hint]').isVisible(), false);
      await page.screenshot({ path: path.join(qa, 'automatically-ready.png') });
      stop(); await start();
      assert.equal(output.includes('Preparing course runtime'), false, 'restart must not install again');
      assert.equal(execFileSync(python, ['-B', '-c', 'import sys; print(sys.prefix)'], { windowsHide: true, encoding: 'utf8' }).trim(), originalPrefix);
      assert.equal(globalKeyringVersion(), originalKeyringVersion, 'global keyring installation must not change');
      assert.deepEqual(errors, []);
      fs.writeFileSync(path.join(qa, 'summary.json'), JSON.stringify({
        native_platform: 'Windows', invocation: 'start-course.cmd --no-browser',
        fresh_environment_automatically_installed: true, reused_without_installation: true,
        default_checkbox_usable: true, global_environment_unchanged: true, model_requests: 0, errors
      }, null, 2));
    } finally {
      await browser.close(); stop();
      assert.ok(temporary.startsWith(path.join(os.tmpdir(), 'teach-runtime-bootstrap-')));
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });
