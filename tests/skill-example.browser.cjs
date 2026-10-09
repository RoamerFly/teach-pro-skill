/* Real fixture interactions in a new workspace; no external models or keys. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn,execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const {pathToFileURL}=require('node:url');
const repo=path.resolve(__dirname,'..');
const skill=process.env.EXAMPLE_SKILL_ROOT || path.join(repo,'teach-pro');
const python=process.env.TEACH_PRO_PYTHON || 'C:/Users/浪客飞/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const qa=path.resolve(process.env.EXAMPLE_QA_DIR || '../competition-work/skill-example-qa');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'teach-example-browser-'));
 const course=path.join(root,'course');fs.mkdirSync(qa,{recursive:true});
 let browser,runtime;
 const stop=async()=>{if(!runtime)return;const p=runtime;runtime=null;await new Promise(resolve=>{p.once('exit',resolve);p.kill();});};
 const start=()=>new Promise((resolve,reject)=>{
  runtime=spawn(python,['-X','utf8','-B','-u','serve_course.py','--session-only','--no-browser','--port','0'],{cwd:course,windowsHide:true});
  runtime.stderr.resume();let text='';
  const timer=setTimeout(()=>reject(new Error('runtime startup timeout')),10000);
  runtime.once('error',e=>{clearTimeout(timer);reject(e);});
  runtime.once('exit',()=>{clearTimeout(timer);reject(new Error('runtime exited'));});
  runtime.stdout.on('data',chunk=>{text+=chunk;const match=text.match(/Course ready: (http:\/\/127\.0\.0\.1:\d+)\//);if(match){clearTimeout(timer);resolve(match[1]);}});
 });
 try {
  execFileSync(python,['-X','utf8','-B',path.join(skill,'scripts/build_example.py'),course,'--stage','lesson'],{windowsHide:true});
  browser=await chromium.launch({headless:true,executablePath:process.env.TEACH_PRO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const context=await browser.newContext(),errors=[],remote=[];
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(['http:','https:'].includes(url.protocol)&&url.hostname!=='127.0.0.1'){remote.push(url.href);return route.abort();}
   return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  // Direct HTML still supports browser-local answers without Python or AI setup.
  await page.goto(pathToFileURL(path.join(course,'practice/entry-assessment.html')).href);
  await page.locator('input[value="mean-20"]').check();await page.locator('[data-quiz-submit]').click();
  assert.match(await page.locator('[data-quiz-feedback]').innerText(),/还需要调整/);
  await page.locator('input[value="mean-30"]').check();
  assert.equal(await page.locator('[data-quiz-feedback]').innerText(),'');
  await page.locator('[data-quiz-submit]').click();assert.match(await page.locator('[data-quiz-feedback]').innerText(),/回答正确/);
  await page.locator('#entry-explanation').fill('合成：150÷5=30，还不会中位数。');
  await page.reload();assert.equal(await page.locator('#entry-explanation').inputValue(),'合成：150÷5=30，还不会中位数。');
  assert(await page.locator('input[value="mean-30"]').isChecked());
  assert(!fs.existsSync(path.join(course,'learner-submissions')));
  let base=await start();await page.goto(base+'/practice/entry-assessment.html');
  await page.locator('input[value="mean-30"]').check();
  await page.locator('#entry-explanation').fill('合成文件测试：总额 150 元，共五天，均值 30 元。');
  const record=path.join(course,'learner-submissions/entry-assessment.json');
  await page.waitForFunction(()=>document.querySelector('.sync-status')?.dataset.state==='saved');
  const original=fs.readFileSync(record);
  const fields=JSON.parse(original).fields;assert.equal(fields['entry-mean'],'mean-30');
  page.once('dialog',d=>d.dismiss());await page.locator('[data-save-clear]').click();
  assert.deepEqual(fs.readFileSync(record),original);
  await stop();base=await start();
  const fresh=await browser.newContext();await fresh.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const restored=await fresh.newPage();restored.on('pageerror',e=>errors.push(e.message));
  await restored.goto(base+'/practice/entry-assessment.html');await restored.waitForFunction(()=>document.querySelector('.sync-status')?.dataset.state==='saved');
  assert.equal(await restored.locator('#entry-explanation').inputValue(),fields['entry-explanation']);
  assert(await restored.locator('input[value="mean-30"]').isChecked());
  await restored.goto(base+'/lessons/0001-mean-and-median.html');
  assert.equal(await restored.locator('.tutor-open').count(),1);
  for(const width of [1440,390,320])for(const theme of ['light','dark']){
   await restored.setViewportSize({width,height:900});await restored.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   assert(await restored.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow ${width}/${theme}`);
  }
  await restored.setViewportSize({width:1440,height:900});await restored.screenshot({path:path.join(qa,'lesson-dark.png'),fullPage:true});
  await restored.locator('#lesson-evidence').fill('合成：均值 40，中位数 25；替换最大值后均值 265、中位数仍为 25。');
  await restored.locator('#lesson-questions').fill('新增观测时，中间位置怎样判断？');
  await restored.waitForFunction(()=>document.querySelector('.sync-status')?.dataset.state==='saved');
  assert(fs.existsSync(path.join(course,'learner-submissions/0001-mean-and-median.json')));
  await restored.goto(base+'/settings.html');assert.equal(await restored.locator('[name="api_key"]').getAttribute('type'),'password');
  assert(!fs.existsSync(path.join(course,'.tutor-settings.json')));assert(!fs.existsSync(path.join(course,'learner-chats')));
  assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);
  const report={checks:['file-mode-feedback','change-answer-reset','browser-restore','file-sync','cancel-preserves-file','restart-new-browser-restore','six-layout-states','lesson-evidence-and-question-sync','masked-unconfigured-settings'],externalRequests:0,pageErrors:errors,synthetic:true};
  fs.writeFileSync(path.join(qa,'audit.json'),JSON.stringify(report,null,2));console.log('PASS: '+JSON.stringify(report));
 }finally{
  await browser?.close();await stop();
  if(path.dirname(path.resolve(root))!==path.resolve(os.tmpdir())||!path.basename(root).startsWith('teach-example-browser-'))throw new Error('Unexpected cleanup target');
  fs.rmSync(root,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
