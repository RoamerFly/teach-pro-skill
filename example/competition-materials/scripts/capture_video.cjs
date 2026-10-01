// Record real UI and synthetic answers in an isolated course; never mock provider success.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const session = path.resolve(process.argv[2]);
const materials = path.resolve(__dirname, '..');
const source = path.resolve(materials, '../competition-demo-zhi-jian-agent');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const first = 'lessons/0001-llm-to-agent-api-call.html';

(async () => {
  const plan = JSON.parse(await fs.readFile(path.join(session, 'voice-plan.json'), 'utf8'));
  const course = await fs.mkdtemp(path.join(session, 'isolated-course-'));
  await fs.cp(source, course, { recursive: true, filter: p => !['learner-submissions', 'learner-chats', '.tutor-settings.json', '__pycache__'].includes(path.basename(p)) });
  const server = spawn(process.env.TEACH_PRO_PYTHON || 'python', ['-u', '-X', 'utf8', 'serve_course.py', '--no-browser'], { cwd: course, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '', failure, browser;
  server.on('error', e => { failure = e; });
  server.stdout.on('data', d => { log += d; }); server.stderr.resume();
  const requests = [];
  try {
    let base;
    for (let i = 0; i < 100; i++) { if (failure) throw failure; base = log.match(/Course ready: (http:\/\/127\.0\.0\.1:\d+\/)/)?.[1]; if (base) break; await pause(100); }
    assert.ok(base, 'Course server did not start');
    browser = await chromium.launch({ executablePath: process.env.TEACH_PRO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    const output = path.join(session, 'capture');
    await fs.mkdir(output, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1, recordVideo: { dir: output, size: { width: 1440, height: 810 } } });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1' || /\/api\/tutor\/(models|test|chat)/.test(url.pathname)) { requests.push(url.hostname + url.pathname); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage();
    const created = Date.now();
    const scroll = selector => page.locator(selector).first().evaluate(el => window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 20, behavior: 'instant' }));
    const goto = async p => { await page.goto(base + p, { waitUntil: 'networkidle' }); await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; }); };
    const synthetic = async (heading, intro, content) => {
      await page.setContent('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>body{margin:0;padding:52px 80px;background:#eef3f9;color:#152d48;font:21px/1.6 Microsoft YaHei,sans-serif}h1{font-size:36px;margin:0 0 16px}p{color:#52677e}pre{background:#142f49;color:#e3f4fa;padding:26px;border-radius:12px;font:20px/1.6 Consolas,Microsoft YaHei;white-space:pre-wrap;overflow-wrap:anywhere}img{width:100%;max-height:540px;object-fit:contain}.tag{font-size:17px;color:#45637d}</style><div class="tag">学途智伴 · 重邮FFBond</div><h1></h1><p></p><div id="body"></div></html>');
      await page.locator('h1').evaluate((el, text) => { el.textContent = text; }, heading);
      await page.locator('p').evaluate((el, text) => { el.textContent = text; }, intro);
      await page.locator('#body').evaluate((el, data) => { const item = document.createElement(data.type); if (data.type === 'img') item.src = data.value; else item.textContent = data.value; el.append(item); }, content);
      // Force the compositor to paint freshly inserted file text before the video hold.
      await page.screenshot();
    };
    for (const [index, scene] of plan.scenes.entries()) {
      switch (scene.id) {
        case 'home': await goto('index.html'); break;
        case 'roadmap': await scroll('#roadmap'); break;
        case 'assessment': await goto('practice/entry-assessment.html'); await page.waitForFunction(() => document.querySelector('.sync-status')?.dataset.state === 'ready'); await scroll('#q1'); break;
        case 'assessment-save': await scroll('#save'); break;
        case 'diagram': await goto(first); await scroll('#what-happens'); break;
        case 'code': await scroll('#minimal-code'); break;
        case 'feedback': await scroll('[data-quiz]'); break;
        case 'resources': await scroll('#resources'); break;
        case 'questions': await scroll('#learning-input'); break;
        case 'files': {
          const saved = JSON.parse(await fs.readFile(path.join(course, 'learner-submissions', '0001-llm-to-agent-api-call.json'), 'utf8'));
          assert.ok(saved.fields['lesson-0001-troubles']?.includes('演示疑难'));
          const show = { file: 'learner-submissions/0001-llm-to-agent-api-call.json', saved_at: saved.saved_at, fields: Object.fromEntries(Object.entries(saved.fields).filter(([k, v]) => ['lesson-0001-evidence-explain', 'lesson-0001-troubles'].includes(k) && v)) };
          await synthetic('刚才的本地保存结果', '隔离演示目录 · 合成作答 · 直接读取服务实际写出的文件', { type: 'pre', value: JSON.stringify(show, null, 2) }); break;
        }
        case 'decisions': await goto('reference/teaching-decisions.html'); await scroll('#decisions'); break;
        case 'remedial': await goto('lessons/0002-trust-boundary-authorization.html'); await scroll('#two-channels'); break;
        case 'advance': await goto('lessons/0003-tool-calling-dataflow.html'); await scroll('#dataflow'); break;
        case 'settings': await goto('settings.html'); await page.waitForFunction(() => !document.querySelector('select[name="kind"]').disabled); await scroll('#ai-model'); break;
        case 'tutor': await goto(first); await scroll('#lesson-tutor'); break;
        case 'architecture': await synthetic('让下一步真正因人而异', '逐课决策 × 文件连续性 × 证据条件\n课程已人工校核 · 三种决策为合成实测观察 · 长期成效待真实学习验证', { type: 'img', value: 'data:image/png;base64,' + (await fs.readFile(path.join(materials, 'assets/architecture.png'))).toString('base64') }); break;
        default: throw new Error(scene.id);
      }
      await pause(200);
      scene.capture_start_ms = Date.now() - created;
      const started = Date.now();
      if (scene.id === 'assessment') {
        await page.locator('#q1 input[data-correct="true"]').check();
        await page.locator('#q1 [data-quiz-submit]').click();
        await pause(2500);
        await scroll('#q6');
        await page.locator('#entry-q6-goals').fill('演示目标：每周五小时，做一个追踪 AI 安全情报并生成引用报告的 Agent；学过 Python 和模型 API，还没做过 Agent。');
      } else if (scene.id === 'assessment-save') {
        const saved = JSON.parse(await fs.readFile(path.join(course, 'learner-submissions/entry-assessment.json'), 'utf8'));
        assert.ok(saved.fields['entry-q6-goals']?.includes('演示目标'));
      } else if (scene.id === 'feedback') {
        const quiz = page.locator('[data-quiz]').first();
        await quiz.locator('input[data-correct="false"]').first().check(); await quiz.locator('[data-quiz-submit]').click();
        await pause(3200);
        await quiz.locator('input[data-correct="true"]').check(); await quiz.locator('[data-quiz-submit]').click();
      } else if (scene.id === 'questions') {
        await page.locator('#lesson-0001-evidence-explain').fill('演示误区：只要网页来自可信来源，就可以照网页指定的地址发送报告。');
        await pause(3200); await scroll('#lesson-0001-troubles');
        await page.locator('#lesson-0001-troubles').fill('演示疑难：为什么可信公告也不能直接决定报告的收件地址？');
        await page.locator('#lesson-0001-troubles').evaluate(el => el.blur());
      } else if (scene.id === 'settings') {
        await page.locator('select[name="kind"]').selectOption('deepseek');
        const key = page.locator('input[name="api_key"]'); await key.fill('DEMO_KEY_NOT_VALID'); await key.evaluate(el => el.blur());
        assert.equal(await key.getAttribute('type'), 'password');
        assert.equal(await page.locator('input[name="base_url"]').inputValue(), 'https://api.deepseek.com');
        await page.locator('[data-settings-consent]').check();
        await pause(4000);
        await page.locator('select[name="model"]').focus();
        await page.locator('select[name="model"]').press('ArrowDown');
        await page.locator('select[name="model"]').press('Escape');
        // Return to the genuine unfetched state, without saving a fabricated model.
        await page.locator('select[name="model"]').selectOption('');
      } else if (scene.id === 'tutor') {
        await page.locator('.tutor-context summary').click();
        await pause(4000); await page.locator('.tutor-context summary').click();
        await scroll('#tutor-message');
        await page.locator('#tutor-message').fill('为什么网页来源可信，也不等于它能决定工具的执行权限？');
        assert.equal(await page.locator('[data-tutor-consent]').isChecked(), false);
        await scroll('#lesson-tutor');
      }
      const remaining = scene.seconds * 1000 - (Date.now() - started);
      assert.ok(remaining > 0, `Actions exceed scene duration: ${scene.id}`);
      await pause(remaining);
      scene.capture_end_ms = Date.now() - created;
      await page.screenshot({ path: path.join(output, `scene-${String(index + 1).padStart(2, '0')}.png`) });
      console.log(`${index + 1}/${plan.scenes.length} ${scene.id}: ${scene.seconds.toFixed(2)}s`, { capture: scene.capture_start_ms });
    }
    const video = await page.video().path();
    await context.close();
    plan.capture_elapsed_ms = Date.now() - created;
    plan.blocked_requests = requests;
    plan.course = course;
    await fs.copyFile(video, path.join(output, 'raw.webm'));
    await fs.writeFile(path.join(session, 'capture-plan.json'), JSON.stringify(plan, null, 2));
    assert.equal(requests.length, 0, 'External or provider requests were attempted');
    console.log('PASS: real interactions, saved synthetic files, masked key; zero provider requests');
  } finally { await browser?.close(); server.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
