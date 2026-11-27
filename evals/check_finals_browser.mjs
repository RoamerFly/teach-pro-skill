/** Offline browser checks against an isolated, extracted finals course. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const [modules,executable,base,output,phase]=process.argv.slice(2);
const {chromium}=await import(pathToFileURL(path.join(modules,'playwright/index.mjs')).href);
const browser=await chromium.launch({headless:true,executablePath:executable,args:['--disable-background-networking','--no-first-run']});
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'});
const blocked=[],errors=[],badResponses=[];
const result={phase,external_requests:blocked,browser_errors:errors,failed_local_requests:badResponses};
await context.route('**/*',route=>{
 const u=new URL(route.request().url());
 if(u.hostname==='127.0.0.1')return route.continue();
 blocked.push(u.origin);return route.abort();
});
const page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))badResponses.push({path:new URL(r.url()).pathname,status:r.status()});});
const marker='便携验收：负一是横坐标，负八是函数值。🧮';
try{
 await page.goto(base,{waitUntil:'networkidle'});
 assert.match(await page.locator('h1').innerText(),/大学高等数学/);
 assert.equal(await page.locator('a[href*="lessons/"]').count()>=3,true);
 result.home_and_course_directory=true;
 await page.goto(base+'practice/entry-assessment.html',{waitUntil:'networkidle'});
 const entry=page.locator('#entry-algebra');
 assert.match(await entry.inputValue(),/11/);
 assert((await page.locator('[data-save-key]').evaluateAll(items=>items.every(x=>x.value.trim().length>0))));
 result.simulated_entry_answers_visible=true;
 await page.goto(base+'lessons/0001-function-points-and-intercepts.html',{waitUntil:'networkidle'});
 assert.equal(await page.locator('svg').count()>0,true);
 const answer=page.locator('#lesson-0001-exercise-01');
 if(phase==='first'){
  assert.match(await answer.inputValue(),/-8/);
  await answer.fill(marker);
  await page.waitForFunction(async expected=>{
   const r=await fetch('/api/submissions/0001-function-points-and-intercepts');
   return (await r.json()).fields['lesson-0001-exercise-01']===expected;
  },marker);
  await page.reload({waitUntil:'networkidle'});
 }
 assert.equal(await answer.inputValue(),marker);
 result.inline_answer_save_and_restore=true;
 const theme=page.locator('.theme-control select');
 if(await theme.count()){
  await theme.selectOption('dark');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await theme.selectOption('light');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  result.theme_controls_work=true;
 }
 await page.locator('.tutor-open').click();
 await page.locator('#tutor-dialog').waitFor({state:'visible'});
 result.tutor_modal_opens_without_model_configuration=true;
 await page.locator('[data-tutor-close]').click();
 await page.screenshot({path:path.join(path.dirname(output),'lesson-'+phase+'.png'),fullPage:false});
 await page.goto(base+'settings.html',{waitUntil:'networkidle'});
 assert.equal(await page.locator('input[type="password"]').count()>0,true);
 result.settings_and_masked_key_available=true;
 await page.goto(base+'lessons/0001-s01-shifted-symmetry.html',{waitUntil:'networkidle'});
 assert.match(await page.locator('h1').innerText(),/平移|对称/);
 await page.goto(base+'lessons/0002-approaching-a-point.html',{waitUntil:'networkidle'});
 assert.match(await page.locator('h1').innerText(),/接近|函数|点/);
 result.supplement_and_second_formal_lesson_open=true;
 assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);assert.deepEqual(blocked,[]);
 result.status='pass';
 await fs.writeFile(output,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
} finally{await context.close();await browser.close();}
