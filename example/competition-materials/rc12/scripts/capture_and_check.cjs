// Offline provider policy: local course requests only; API Key is an invalid screenshot value.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {chromium} = require('playwright');
const crypto = require('node:crypto');
const materials = path.resolve(__dirname, '..');
const repo = path.resolve(materials, '../../..');
const source = path.join(repo, 'example/competition-demo-rc12');
const delay = ms => new Promise(resolve => setTimeout(resolve,ms));
(async () => {
 const temp = await fs.mkdtemp(path.join(os.tmpdir(),'teach-pro-rc12-materials-'));
 const course = path.join(temp, 'competition-demo-rc12');
 await fs.cp(source,course,{recursive:true,filter:file=>!['learner-submissions','learner-chats','.tutor-settings.json','.teach-runtime','__pycache__'].includes(path.basename(file))});
 const server = spawn(process.env.TEACH_PRO_PYTHON || 'python',['-u','-X','utf8','serve_course.py','--no-browser','--session-only'],{cwd:course,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let log='', launchError, browser;
 server.on('error',e=>{launchError=e;});server.stdout.on('data',data=>{log+=data;});server.stderr.resume();
 const result={skill:'1.1.0-rc.12',synthetic:true,provider_requests:0,pages:[],external_requests:0,checks:[],platform:'Windows'};
 const assets = path.join(materials,'assets');await fs.mkdir(assets,{recursive:true});
 try {
  let base;
  for(let i=0;i<150;i++){if(launchError)throw launchError;base=log.match(/Course ready: (http:\/\/127\.0\.0\.1:\d+\/)/)?.[1];if(base)break;await delay(100);}
  assert(base,'Course server startup failed');
  browser=await chromium.launch({executablePath:process.env.TEACH_PRO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1.5});
  let externals=0;await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1'){externals++;return route.abort();}return route.continue();});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const files=['index.html','settings.html','practice/entry-assessment.html','reference/resource-learning-center.html','lessons/0001-llm-to-agent-api-call.html','lessons/0002-react-reasoning-loop.html','lessons/0002-s01-injection-without-thought.html','lessons/0003-safe-tool-contract.html'];
  for(const file of files){
   await page.goto(base+file);await page.waitForTimeout(120);
   const broken=await page.evaluate(()=>[...document.querySelectorAll('a[href],script[src],link[href]')].map(el=>el.getAttribute('href')||el.getAttribute('src')).filter(url=>url&&!/^(?:https?:|mailto:|data:)/.test(url)));
   for(const link of broken){const url=new URL(link,new URL(file,base));const rel=decodeURIComponent(url.pathname.slice(1));assert((await fs.stat(path.join(course,rel))).isFile(),file+': '+link);if(url.hash&&url.pathname===new URL(file,base).pathname)assert(await page.locator('[id="'+decodeURIComponent(url.hash.slice(1))+'"]').count(),file+': '+link);}
   assert.equal(await page.locator('input:checked:not([name="remember_key"])').count(),0,file+' must not contain prefilled answers');
   result.pages.push(file);
   for(const width of [1280,390,320]){await page.setViewportSize({width,height:800});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),file+' horizontal overflow '+width);}
   await page.setViewportSize({width:1280,height:800});
  }
  assert.equal(errors.length,0,errors.join('\n'));result.checks.push('8 pages: relative links, same-page anchors, blank answers, 1280/390/320px overflow, JavaScript errors');
  for(const name of ['style.css','course.js','sync.js','tutor.js','tutor-settings.js','tutor-markdown.js'])assert.deepEqual(await fs.readFile(path.join(source,'assets',name)),await fs.readFile(path.join(repo,'teach-pro/assets',name)));
  for(const name of ['serve_course.py','tutor_chat.py','credential_store.py','start-course.cmd','start-course.sh','start-course.command'])assert.deepEqual(await fs.readFile(path.join(source,name)),await fs.readFile(path.join(repo,'teach-pro/assets',name)));
  result.checks.push('12 runtime files byte-identical to rc.12 Skill');
  await page.goto(base+'index.html');await page.evaluate(()=>{document.documentElement.dataset.theme='light';});
  await page.screenshot({path:path.join(assets,'course-home.png'),animations:'disabled',scale:'css'});
  await page.locator('#lessons').screenshot({path:path.join(assets,'formal-supplement.png'),animations:'disabled'});
  await page.goto(base+'practice/entry-assessment.html');await page.waitForFunction(()=>document.querySelector('.sync-status')?.dataset.state==='ready');
  await page.locator('#q1').screenshot({path:path.join(assets,'assessment.png'),animations:'disabled'});
  await page.goto(base+'settings.html');await page.waitForFunction(()=>!document.querySelector('select[name="kind"]').disabled);
  await page.locator('select[name="kind"]').selectOption('deepseek');await page.locator('input[name="api_key"]').fill('DEMO_KEY_NOT_VALID');
  assert.equal(await page.locator('input[name="api_key"]').getAttribute('type'),'password');assert.equal(await page.locator('input[name="base_url"]').inputValue(),'https://api.deepseek.com');
  await page.locator('input[name="api_key"]').evaluate(input=>input.blur());
  await page.locator('label.settings-key-row').first().screenshot({path:path.join(assets,'masked-key.png'),animations:'disabled'});
  await page.locator('[data-tutor-settings-page]').screenshot({path:path.join(assets,'deepseek-settings.png'),animations:'disabled'});
  result.checks.push('DeepSeek preset address and masked invalid screenshot key; no save or model call');
  await page.goto(base+'lessons/0001-llm-to-agent-api-call.html');await page.waitForFunction(()=>!document.querySelector('.tutor-open').disabled);
  await page.locator('#what-happens figure').screenshot({path:path.join(assets,'lesson-diagram.png'),animations:'disabled'});
  await page.locator('.tutor-open').click();await page.locator('#tutor-dialog').screenshot({path:path.join(assets,'tutor-dialog.png'),animations:'disabled'});
  await page.locator('[data-tutor-close]').click();
  await page.goto(base+'lessons/0003-safe-tool-contract.html');await page.waitForFunction(()=>document.querySelector('.sync-status')?.dataset.state==='ready');
  await page.locator('#lesson-evidence').fill('合成演示：合法 JSON 仍需契约、权限和预算检查；拒绝不执行工具。');
  await page.locator('#lesson-questions').fill('合成演示：工具结果在下一轮怎样带回模型？');
  await page.waitForFunction(()=>document.querySelector('.sync-status')?.dataset.state==='saved');
  const saved=JSON.parse(await fs.readFile(path.join(course,'learner-submissions/0003-safe-tool-contract.json'),'utf8'));
  assert(saved.fields['lesson-0003-evidence'].includes('合成演示'));
  const fresh=await browser.newContext({viewport:{width:1280,height:800}});const restored=await fresh.newPage();await restored.goto(base+'lessons/0003-safe-tool-contract.html');await restored.waitForFunction(()=>document.querySelector('#lesson-evidence').value.includes('合成演示'));await fresh.close();
  result.checks.push('Isolated synthetic third-lesson answer saved and restored in fresh browser');
  await page.goto(base+'index.html');await page.evaluate(()=>{document.documentElement.dataset.theme='dark';});await page.screenshot({path:path.join(assets,'course-home-dark.png'),animations:'disabled',scale:'css'});
  result.external_requests=externals;assert.equal(externals,0);assert.equal(errors.length,0);
  result.screenshots=await Promise.all((await fs.readdir(assets)).filter(f=>f.endsWith('.png')).map(async f=>({file:f,sha256:crypto.createHash('sha256').update(await fs.readFile(path.join(assets,f))).digest('hex')})));
  await fs.writeFile(path.join(materials,'capture-checks.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
