/* Isolated synthetic course/browser QA. No credentials or model requests. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn, execFileSync} = require('node:child_process');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'example/competition-demo-rc12');
const qa = process.env.INLINE_QA_DIR || path.resolve(root, '../competition-work/2026-10-17-pages-inline-browser');
const python = process.env.TEACH_PRO_PYTHON || 'C:/Users/浪客飞/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const mapping = [
  ['0001-llm-to-agent-api-call', 'lesson-0001-evidence-code'],
  ['0002-react-reasoning-loop', 'lesson-0002-evidence'],
  ['0002-s01-injection-without-thought', 'lesson-0002-s01-evidence'],
  ['0003-safe-tool-contract', 'lesson-0003-evidence']
];
(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'teach-pages-inline-'));
  const course = path.join(temp, 'course'); fs.mkdirSync(course); fs.mkdirSync(qa, {recursive:true});
  let browser, server;
  try {
    for (const name of ['assets','lessons','practice','reference','index.html','settings.html','serve_course.py','tutor_chat.py','credential_store.py'])
      fs.cpSync(path.join(source,name),path.join(course,name),{recursive:true});
    server = spawn(python, ['-u','-B','-X','utf8','serve_course.py','--session-only','--no-browser','--port','0'], {cwd:course,windowsHide:true});
    server.stderr.resume();
    const base = await new Promise((resolve,reject) => {
      let log = ''; const timer = setTimeout(()=>reject(new Error('Server startup timeout')),10000);
      server.once('error',reject); server.stdout.on('data',data=> {log += data; const m = log.match(/Course ready: (http:\/\/127\.0\.0\.1:\d+)\//); if(m){clearTimeout(timer);resolve(m[1]);}});
    });
    browser = await chromium.launch({headless:true,executablePath:process.env.TEACH_PRO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
    const context = await browser.newContext(); const errors=[]; let remote=0, layouts=0;
    await context.route('**/*', route => {const url=new URL(route.request().url()); if(url.hostname!=='127.0.0.1'){remote++;return route.abort();} return route.continue();});
    const page = await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/lessons/'+mapping[0][0]+'.html');
    // Seed precisely the keys written by the old page layout, then reload the migrated page.
    await page.evaluate(()=>{
      localStorage.setItem('competition-demo-rc12:lesson-0001-evidence-code','迁移前合成答案：从环境变量读取密钥，messages 使用列表，只显示 content。');
      localStorage.setItem('competition-demo-rc12:lesson-0001-evidence-explain','迁移前解释：请求需由应用携带历史。');
      localStorage.setItem('competition-demo-rc12:lesson-0001-evidence-predict','迁移前预测：材料不能给工具授权。');
    });
    await page.reload();
    assert.match(await page.locator('#lesson-0001-evidence-code').inputValue(), /迁移前合成答案/);
    assert.match(await page.locator('#stateless #lesson-0001-evidence-explain').inputValue(), /迁移前解释/);
    assert.match(await page.locator('#trust-gap #lesson-0001-evidence-predict').inputValue(), /迁移前预测/);
    for (const [slug,key] of mapping) {
      await page.goto(base+'/lessons/'+slug+'.html');
      assert.equal(await page.locator('#learning-input textarea').count(),1);
      assert.equal(await page.locator('#learning-input h2').innerText(),'本课疑难记录');
      assert.equal(await page.locator('[data-exercise="open"] [data-save-key="'+key+'"]').count(),1);
      const answer='合成测试：'+slug; await page.locator('[data-save-key="'+key+'"]').fill(answer);
      await page.waitForFunction(()=>document.querySelector('.sync-status')?.dataset.state==='saved');
      const record=JSON.parse(fs.readFileSync(path.join(course,'learner-submissions',slug+'.json')));
      assert.equal(record.fields[key],answer);
      await page.reload(); assert.equal(await page.locator('[data-save-key="'+key+'"]').inputValue(),answer);
      for(const width of [1440,390,320]) for(const theme of ['light','dark']) {
        await page.setViewportSize({width,height:900}); await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        assert(await page.locator('[data-save-key="'+key+'"]').evaluate(e=>e.getBoundingClientRect().width>100)); layouts++;
      }
    }
    await page.setViewportSize({width:1440,height:900});
    await page.goto(base+'/lessons/'+mapping[0][0]+'.html#practice');
    await page.locator('#practice').screenshot({path:path.join(qa,'first-lesson-practice.png')});
    const fresh = await browser.newContext(); const restored=await fresh.newPage();
    for(const [slug,key] of mapping) {
      await restored.goto(base+'/lessons/'+slug+'.html'); await restored.waitForFunction(()=>document.querySelector('.sync-status')?.dataset.state==='saved');
      assert.equal(await restored.locator('[data-save-key="'+key+'"]').inputValue(),'合成测试：'+slug);
    }
    assert.deepEqual(errors,[]); assert.equal(remote,0);
    const result={synthetic:true,oldKeysRestored:3,lessons:4,layoutChecks:layouts,fileSaveAndFreshBrowserRestore:true,pageErrors:errors,providerRequests:0};
    fs.writeFileSync(path.join(qa,'audit.json'),JSON.stringify(result,null,2)); console.log('PASS: '+JSON.stringify(result));
  } finally {
    await browser?.close(); if(server && server.exitCode===null) await new Promise(resolve=>{server.once('exit',resolve);server.kill();});
    if(path.dirname(temp)!==path.resolve(os.tmpdir()) || !path.basename(temp).startsWith('teach-pages-inline-'))throw new Error('Invalid cleanup target');
    fs.rmSync(temp,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
