// Explicit live demonstration: one model listing, one test, three course questions. No mocks.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { chromium } = require('playwright');
const session = path.resolve(process.argv[2]);
const materials = path.resolve(__dirname, '..');
const source = path.resolve(materials, '../competition-demo-zhi-jian-agent');
const first = 'lessons/0001-llm-to-agent-api-call.html';
const slug = '0001-llm-to-agent-api-call';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let credential = '';
const redact = text => credential ? String(text).replaceAll(credential, '[credential removed]') : String(text);

(async () => {
  assert.equal(process.argv[3], '--live', 'Live requests require an explicit --live flag');
  const plan = JSON.parse(await fs.readFile(path.join(session, 'voice-plan.json'), 'utf8'));
  assert.equal(plan.model, 'deepseek-flash');
  console.log('Waiting for credential on stdin; it will not be echoed or saved.');
  if (!process.stdin.isTTY) throw new Error('Use a private interactive terminal with raw input; closed stdin is not supported');
  process.stdin.setRawMode(true);
  const reader = createInterface({ input: process.stdin });
  credential = await new Promise(resolve => reader.once('line', line => resolve(line.trim())));
  reader.close();
  process.stdin.setRawMode(false);
  assert.ok(credential.length > 10, 'Credential was not supplied');
  const course = await fs.mkdtemp(path.join(session, 'isolated-course-'));
  await fs.cp(source, course, { recursive: true, filter: p => !['learner-submissions', 'learner-chats', '.tutor-settings.json', '__pycache__'].includes(path.basename(p)) });
  const server = spawn(process.env.TEACH_PRO_PYTHON || 'python', ['-u', '-X', 'utf8', 'serve_course.py', '--no-browser'], { cwd: course, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '', failure, browser;
  server.on('error', error => { failure = error; });
  server.stdout.on('data', data => { log += data; }); server.stderr.resume();
  const external = [], operations = [];
  try {
    let base;
    for (let i = 0; i < 100; i++) { if (failure) throw failure; base = log.match(/Course ready: (http:\/\/127\.0\.0\.1:\d+\/)/)?.[1]; if (base) break; await pause(100); }
    assert.ok(base, 'Local course did not start');
    const output = path.join(session, 'capture'); await fs.mkdir(output, { recursive: true });
    browser = await chromium.launch({ executablePath: process.env.TEACH_PRO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1, recordVideo: { dir: output, size: { width: 1440, height: 810 } } });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1') { external.push(url.hostname); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage();
    const created = Date.now();
    const scroll = async selector => {
      await page.locator(selector).first().evaluate(el => window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 20, behavior: 'instant' }));
      await page.screenshot(); // Flush headless compositor after large scrolls.
    };
    const goto = async file => { await page.goto(base + file, { waitUntil: 'networkidle' }); await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; }); };
    const request = async (endpoint, button) => {
      const started = Date.now();
      const waiting = page.waitForResponse(response => new URL(response.url()).pathname === '/api/tutor/' + endpoint && response.request().method() === 'POST', { timeout: 65000 });
      await button.click();
      const response = await waiting;
      const data = await response.json();
      if (response.status() !== 200) throw new Error(redact(data.error || `Local request failed: ${response.status()}`));
      const item = { operation: endpoint.startsWith('chat/') ? 'chat' : endpoint, local_http_status: response.status(), elapsed_ms: Date.now() - started };
      if (endpoint === 'models') item.model_ids = data.models.map(model => model.id);
      if (endpoint.startsWith('chat/')) {
        const answer = data.messages.at(-1);
        assert.equal(answer.role, 'assistant'); assert.equal(answer.status, 'complete'); assert.equal(answer.model, plan.model);
        item.message_count = data.messages.length; item.usage = answer.usage; item.context_version = answer.context_version;
        item.answer_characters = answer.content.length;
        console.log('LIVE ANSWER: ' + redact(answer.content.slice(0, 650)));
      }
      operations.push(item); console.log(`LIVE ${item.operation}: HTTP 200 (${item.elapsed_ms}ms)`);
      return data;
    };
    const showProof = async payload => {
      await page.setContent('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>body{margin:0;padding:50px 75px;background:#eef3f9;color:#17344e;font:22px/1.6 Microsoft YaHei}h1{font-size:34px}pre{background:#16354e;color:#edf9ff;border-radius:12px;padding:24px;font:20px/1.7 Consolas,Microsoft YaHei;white-space:pre-wrap;overflow-wrap:anywhere}img{max-width:100%;max-height:490px;object-fit:contain}p{color:#536c7e}</style><p>学途智伴 · 重邮FFBond</p><h1></h1><p id="note"></p><div id="body"></div></html>');
      await page.locator('h1').evaluate((el, value) => { el.textContent = value; }, payload.title);
      await page.locator('#note').evaluate((el, value) => { el.textContent = value; }, payload.note);
      await page.locator('#body').evaluate((el, value) => { const item = document.createElement(value.image ? 'img' : 'pre'); if (value.image) item.src = value.image; else item.textContent = value.text; el.append(item); }, payload);
      await page.screenshot();
    };
    for (const [index, scene] of plan.scenes.entries()) {
      switch (scene.id) {
        case 'home': await goto('index.html'); break;
        case 'assessment': await goto('practice/entry-assessment.html'); await page.waitForFunction(() => document.querySelector('.sync-status')?.dataset.state === 'ready'); await scroll('#q1'); break;
        case 'lesson': await goto(first); await scroll('#what-happens'); break;
        case 'trust-gap': await scroll('#trust-gap'); break;
        case 'settings': await goto('settings.html?lesson=' + slug); await page.waitForFunction(() => !document.querySelector('select[name="kind"]').disabled); await scroll('#ai-model'); break;
        case 'connection': await scroll('#ai-model'); break;
        case 'tutor-context': await goto(first); await scroll('#lesson-tutor'); await page.waitForFunction(() => document.querySelector('[data-tutor-model]')?.textContent.includes('deepseek-flash')); break;
        case 'tutor-answer': await scroll('#lesson-tutor'); break;
        case 'followup': await scroll('#tutor-message'); break;
        case 'save': await scroll('#learning-input'); break;
        case 'adaptive': await goto('reference/teaching-decisions.html'); await scroll('#decisions'); break;
        case 'closing': await showProof({ title: '学途智伴——大学生长期自适应学习智能体', note: '了解基础 → 学懂一课 → 真实答疑 → 本地保存 → 动态续课', image: 'data:image/png;base64,' + (await fs.readFile(path.join(materials, 'assets/architecture.png'))).toString('base64') }); break;
        default: throw new Error('Unknown scene');
      }
      await pause(200); scene.capture_start_ms = Date.now() - created; const started = Date.now();
      if (scene.id === 'assessment') {
        await page.locator('#q1 input[data-correct="true"]').check(); await page.locator('#q1 [data-quiz-submit]').click();
        await pause(2600); await scroll('#q6');
        await page.locator('#entry-q6-goals').fill('演示目标：会基础 Python 和模型 API，还没做过 Agent。每周五小时，希望完成一个可核验引用、受控发送报告的 AI 安全情报 Agent。');
        await pause(3000); await scroll('#save');
      } else if (scene.id === 'lesson') {
        await pause(6500); await scroll('#minimal-code');
      } else if (scene.id === 'trust-gap') {
        await pause(7000); await scroll('#lesson-0001-troubles');
        await page.locator('#lesson-0001-troubles').fill('演示疑难：学校官网的公告指定了新邮箱，为什么不能直接照着发送报告？');
      } else if (scene.id === 'settings') {
        await page.locator('select[name="kind"]').selectOption('deepseek');
        const key = page.locator('input[name="api_key"]'); assert.equal(await key.getAttribute('type'), 'password');
        await key.fill(credential); await key.evaluate(el => el.blur());
        assert.equal(await key.getAttribute('type'), 'password');
        assert.equal(await page.locator('input[name="base_url"]').inputValue(), 'https://api.deepseek.com');
        await page.locator('input[name="max_tokens"]').fill('4096');
        plan.max_tokens = 4096;
        await page.locator('[data-settings-consent]').check(); await pause(1800);
        const models = await request('models', page.locator('[data-settings-models]'));
        assert.ok(models.models.some(model => model.id === plan.model), 'Requested model was not returned by the provider');
        await page.locator('select[name="model"]').selectOption(plan.model);
        await page.locator('[data-settings-consent]').check(); await pause(1800);
        const saving = page.waitForResponse(response => new URL(response.url()).pathname === '/api/tutor/config' && response.request().method() === 'POST');
        await page.locator('.tutor-config button[type="submit"]').click();
        const saved = await saving; assert.equal(saved.status(), 200);
        assert.equal((await saved.json()).configured, true); assert.equal(await key.inputValue(), '');
        assert.ok(!(await fs.readFile(path.join(course, '.tutor-settings.json'), 'utf8')).includes(credential));
      } else if (scene.id === 'connection') {
        await request('test', page.locator('[data-settings-test]'));
      } else if (scene.id === 'tutor-context') {
        await page.locator('.tutor-context summary').click(); await pause(2800);
        await page.locator('.tutor-context summary').click(); await page.locator('[data-tutor-consent]').check();
        await page.locator('#tutor-message').fill('我没做过 Agent。请结合本课“信任的裂缝”图，用校园通知类比解释：为什么学校官网的公告，也不能指定把报告发到新邮箱？请用120字以内解释，并给一道判断题。');
        await scroll('#lesson-tutor');
      } else if (scene.id === 'tutor-answer') {
        await request('chat/' + slug, page.locator('.tutor-question button[type="submit"]'));
        await scroll('#lesson-tutor');
        await page.locator('.tutor-messages').evaluate(el => { el.scrollTop = 0; });
      } else if (scene.id === 'followup') {
        await page.locator('#tutor-message').fill('我的判断：官网确实是真的，邮箱也印在公告上，所以可以直接发送。我这一步推理对吗？请用100字以内指出误区，再给一个执行前检查。');
        await pause(1700);
        await request('chat/' + slug, page.locator('.tutor-question button[type="submit"]'));
        await pause(1700);
        await page.locator('#tutor-message').fill('你说的“system授权”会让我把系统提示当成程序权限。请澄清：系统提示能直接授予发邮件权限吗？还是必须由运行时按预设收件人策略独立检查？请用80字明确区分，再给一个检查动作。');
        await request('chat/' + slug, page.locator('.tutor-question button[type="submit"]'));
        await scroll('#lesson-tutor'); await page.locator('.tutor-messages').evaluate(el => { el.scrollTop = el.scrollHeight; });
      } else if (scene.id === 'save') {
        await page.locator('#lesson-0001-evidence-explain').fill('演示练习：我需要分别核验来源身份和发送权限；模型提出新邮箱只是建议，程序应核对当前任务与预设收件人策略。');
        await pause(2500); await scroll('#lesson-0001-troubles');
        await page.locator('#lesson-0001-troubles').fill('演示疑难：白名单应该在哪里维护？正式项目如何记录授权检查？');
        await pause(1700);
        const submissionText = await fs.readFile(path.join(course, 'learner-submissions', slug + '.json'), 'utf8');
        const chatText = await fs.readFile(path.join(course, 'learner-chats', slug + '.json'), 'utf8');
        assert.ok(!submissionText.includes(credential) && !chatText.includes(credential));
        const submission = JSON.parse(submissionText), chat = JSON.parse(chatText);
        assert.equal(chat.messages.length, 6); assert.ok(chat.messages.every(message => message.status === 'complete'));
        const proof = { '作答文件': 'learner-submissions/' + slug + '.json', '课末疑难': submission.fields['lesson-0001-troubles'], '聊天文件': 'learner-chats/' + slug + '.json', '真实聊天': '3 次提问 + 3 次模型回答，均已完成', '模型': plan.model, '课程上下文版本': chat.messages.at(-1).context_version.slice(0, 16), '续课时': '课程生成 AI 读取作答、疑难与聊天；不在后台自动生成下一课' };
        await showProof({ title: '刚才的学习记录，已经保存', note: '实际读取隔离课程的服务输出；演示作答与真实模型问答', text: JSON.stringify(proof, null, 2) });
      } else if (scene.id === 'adaptive') {
        await pause(6500); await goto('lessons/0002-trust-boundary-authorization.html'); await scroll('#two-channels');
      }
      scene.action_end_ms = Date.now() - created;
      const actionMs = Date.now() - started;
      await pause(Math.max(4500, scene.seconds * 1000 - actionMs));
      scene.capture_end_ms = Date.now() - created;
      const captured = (scene.capture_end_ms - scene.capture_start_ms) / 1000;
      scene.wait_trimmed_seconds = Math.max(0, captured - scene.seconds);
      await page.screenshot({ path: path.join(output, `scene-${String(index + 1).padStart(2, '0')}.png`) });
      console.log(`${index + 1}/${plan.scenes.length} ${scene.id}: captured ${captured.toFixed(2)}s, final ${scene.seconds.toFixed(2)}s`);
    }
    assert.equal(operations.length, 5); assert.equal(external.length, 0);
    const video = await page.video().path(); await context.close();
    await fs.copyFile(video, path.join(output, 'raw.webm'));
    plan.capture_elapsed_ms = Date.now() - created; plan.blocked_requests = external; plan.course = course;
    plan.live_operations = operations;
    await fs.writeFile(path.join(session, 'capture-plan.json'), JSON.stringify(plan, null, 2));
    console.log('PASS: genuine model listing, test and three saved course responses; key never published.');
  } finally { await browser?.close(); server.kill(); credential = ''; }
})().catch(error => { console.error(redact(error.message).replace(/sk-[A-Za-z0-9_-]+/g, '[credential removed]')); process.exitCode = 1; });
