// Real course UI and provider calls, in an isolated copy; stdin credential only.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {createInterface} = require('node:readline');
const {chromium} = require('playwright');
const {readTutorResponse} = require('../../scripts/capture_response.cjs');
const materials = path.resolve(__dirname, '..');
const source = path.resolve(materials, '../../competition-demo-rc12');
const session = path.resolve(process.argv[2]);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const slug = '0001-llm-to-agent-api-call';
let key = '';
(async () => {
  assert.equal(process.argv[3], '--live');
  assert(!process.stdin.isTTY, 'Use the Python hidden-input recording entrypoint');
  const reader = createInterface({input:process.stdin});
  key = await new Promise(resolve => reader.once('line', line => resolve(line.trim()))); reader.close();
  assert(key.length > 10, 'Missing credential');
  const plan = JSON.parse(await fs.readFile(path.join(materials,'dialogue-plan.json'),'utf8'));
  await fs.mkdir(session,{recursive:true});
  const course = await fs.mkdtemp(path.join(session,'isolated-course-'));
  await fs.cp(source,course,{recursive:true,filter:p=>!['learner-submissions','learner-chats','.tutor-settings.json','.teach-runtime','__pycache__'].includes(path.basename(p))});
  const output = path.join(session,'capture'); await fs.mkdir(output,{recursive:true});
  const server = spawn(process.env.TEACH_PRO_PYTHON || 'python',['-u','-X','utf8','serve_course.py','--no-browser'],{cwd:course,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let log='', startupError, browser, page, base, remember=false;
  server.on('error',error=>startupError=error);server.stdout.on('data',data=>log+=data);server.stderr.resume();
  const operations=[], errors=[], forbidden=[];
  const cleanupCredential = async () => {
    if (!page || !remember) return;
    const result = await page.evaluate(async () => {
      const boot=await fetch('/api/tutor/bootstrap').then(r=>r.json());
      const r=await fetch('/api/tutor/forget',{method:'POST',headers:{'Content-Type':'application/json','X-Teach-Token':boot.token},body:JSON.stringify({confirm:true})});
      return r.status;
    });
    assert.equal(result,200,'Temporary demonstration credential cleanup failed');
    remember=false;
  };
  try {
    for(let i=0;i<750;i++){if(startupError)throw startupError;base=log.match(/Course ready: (http:\/\/127\.0\.0\.1:\d+\/)/)?.[1];if(base)break;await wait(100);}
    assert(base,'Course startup failed');
    browser=await chromium.launch({headless:true,executablePath:process.env.TEACH_PRO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
    const context=await browser.newContext({viewport:{width:1440,height:810},deviceScaleFactor:1,recordVideo:{dir:output,size:{width:1440,height:810}}});
    await context.route('**/*',route=>{if(!route.request().url().startsWith(base)){forbidden.push('external-browser-request');return route.abort();}return route.continue();});
    page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
    const clock=Date.now();
    const goto=async file=>{await page.goto(base+file,{waitUntil:'networkidle'});await page.evaluate(()=>{document.documentElement.dataset.theme='light';});};
    const scroll=async selector=>{await page.locator(selector).first().evaluate(el=>{const toolbar=document.querySelector('.lesson-toolbar');window.scrollTo({top:el.getBoundingClientRect().top+scrollY-(toolbar?.getBoundingClientRect().height||0)-18,behavior:'smooth'});});await wait(700);await page.screenshot();};
    const label=async text=>page.evaluate(value=>{document.getElementById('recording-label')?.remove();const el=document.createElement('span');el.id='recording-label';el.textContent=value;el.style.cssText='position:fixed;top:12px;right:18px;z-index:9999;font:13px Microsoft YaHei;background:#eaf0fb;color:#395b9b;padding:4px 9px;border:1px solid #bfcfea;border-radius:20px;pointer-events:none';document.body.append(el);},text);
    const click=async selector=>{const el=page.locator(selector).first();await el.hover();await wait(300);await el.click();};
    const request=async(endpoint,selector)=>{
      const start=Date.now();
      const waiting=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/tutor/'+endpoint&&r.request().method()==='POST',{timeout:65000});
      await click(selector);const response=await waiting;const data=await readTutorResponse(response,page);
      const isChat=endpoint.startsWith('chat-stream/');
      const item={operation:isChat?'chat':endpoint,local_http_status:response.status(),elapsed_ms:Date.now()-start};
      if(endpoint==='models')item.model_ids=data.models.map(m=>m.id);
      if(isChat){const answer=data.messages.at(-1);assert.equal(answer.model,plan.model);assert.equal(answer.status,'complete');item.message_count=data.messages.length;item.context_version=answer.context_version;item.answer_characters=answer.content.length;item.answer_sha256=require('node:crypto').createHash('sha256').update(answer.content).digest('hex');item.diagnostics=answer.diagnostics;item.usage=answer.usage;item.transport='stream';}
      operations.push(item);console.log(`LIVE ${item.operation}: HTTP ${item.local_http_status}, ${item.elapsed_ms}ms`);return data;
    };
    for(const [index,scene] of plan.scenes.entries()){
      scene.capture_start_ms=Date.now()-clock;
      switch(scene.id){
        case 'home': await page.setContent(await fs.readFile(path.join(materials,'assets/video-overview.html'),'utf8')); break;
        case 'assessment':
          await goto('practice/entry-assessment.html');await label('演示作答');
          await page.waitForFunction(()=>document.querySelector('.sync-status')?.dataset.state==='ready');
          await scroll('#q1');await wait(1200);await page.locator('#q1 input[data-correct="true"]').check();await click('#q1 [data-quiz-submit]');await wait(2000);
          await scroll('#q6');await page.locator('#entry-q6-goals').fill('演示学员：基础 Python，会调用模型 API，没有 Agent 项目经验。每周五小时，希望独立开发安全情报 Agent。偏好先看图，再理解代码。');break;
        case 'lesson': await goto('lessons/'+slug+'.html');await scroll('#what-happens');await wait(5000);await scroll('#minimal-code');break;
        case 'resources': await scroll('#resources');await wait(1200);await click('[data-resource-id="video-lee-agent"] summary');await wait(2000);break;
        case 'settings': {
          await click('.course-settings-nav a');await page.waitForFunction(()=>!document.querySelector('select[name="kind"]').disabled);
          await scroll('#ai-model');await page.locator('select[name="kind"]').selectOption('deepseek');
          const field=page.locator('input[name="api_key"]');assert.equal(await field.getAttribute('type'),'password');
          await field.fill(key);await field.evaluate(el=>el.blur());await wait(1200);
          const list=await request('models','[data-settings-models]');assert(list.models.some(m=>m.id===plan.model),'Requested model not in actual list');
          await page.locator('select[name="model"]').selectOption(plan.model);await wait(900);
          // Use the actual OS vault when available; do not simulate device memory.
          const boot=await page.evaluate(()=>fetch('/api/tutor/bootstrap').then(r=>r.json()));
          if(!boot.credential_storage?.available && await page.locator('[data-storage-hint]').isVisible()) await page.locator('input[name="remember_key"]').uncheck();
          const saving=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/tutor/config'&&r.request().method()==='POST');
          await click('.tutor-config button[type="submit"]');const response=await saving;const saved=await response.json();assert.equal(response.status(),200);assert.equal(saved.configured,true);
          remember=!!saved.settings?.remember_key;plan.remembered_device=remember;
          assert.equal(await field.inputValue(),'');assert(!(await fs.readFile(path.join(course,'.tutor-settings.json'),'utf8')).includes(key));break;
        }
        case 'connection': await request('test','[data-settings-test]');await wait(1500);await click('.sidebar-settings-return');break;
        case 'tutor-answer':
        case 'followup': {
          if(scene.id==='tutor-answer')await click('.tutor-open');
          await page.locator('#tutor-message').fill(scene.question);await wait(1600);
          await page.evaluate(()=>{window.__recordedDeltas=[];const el=document.querySelector('.tutor-messages');window.__deltaObserver=new MutationObserver(()=>{const last=el.querySelector('.is-assistant:last-child');const n=last?.textContent.length||0;if(n&&n!==window.__recordedDeltas.at(-1)?.characters)window.__recordedDeltas.push({ms:performance.now(),characters:n});});window.__deltaObserver.observe(el,{subtree:true,childList:true,characterData:true});});
          const chat=await request('chat-stream/'+slug,'.tutor-question button[type="submit"]');scene.live_answer=chat.messages.at(-1).content;
          scene.stream_observations=await page.evaluate(()=>{window.__deltaObserver.disconnect();return window.__recordedDeltas;});
          assert(scene.stream_observations.length>1,'No incremental answer observed');await page.locator('.tutor-messages').evaluate(el=>el.scrollTop=el.scrollHeight);break;
        }
        case 'save': {
          await click('[data-tutor-close]');await label('演示作答');await scroll('#learning-input');
          await page.locator('#lesson-0001-evidence-explain').fill('演示学员：模型只看本次 messages；历史要由程序再次带上。工具型 Agent 还需要受控工具循环，把结果送回模型。');await wait(2200);
          await scroll('#lesson-0001-troubles');await page.locator('#lesson-0001-troubles').fill('演示疑难：下一课能否用一次工具调用说明程序怎样控制执行？');
          await page.waitForFunction(()=>document.querySelector('.sync-status')?.dataset.state==='saved');
          const submissions=await fs.readFile(path.join(course,'learner-submissions',slug+'.json'),'utf8');const chat=await fs.readFile(path.join(course,'learner-chats',slug+'.json'),'utf8');assert(!submissions.includes(key)&&!chat.includes(key));
          assert.equal(JSON.parse(chat).messages.length,4);plan.local_save_verified=true;break;
        }
        case 'adaptive': await goto('index.html');await label('已生成课程结果回放');await scroll('#lessons');await wait(3000);await goto('lessons/0003-safe-tool-contract.html');await label('已生成课程结果回放');await scroll('#contract');await wait(2500);await goto('lessons/0002-s01-injection-without-thought.html');await label('关联补充课 · 已生成结果回放');break;
        case 'closing': await page.setContent(await fs.readFile(path.join(materials,'assets/video-overview.html'),'utf8'));await page.evaluate(()=>document.body.classList.add('closing'));break;
        default: throw new Error('Unknown scene');
      }
      scene.action_end_ms=Date.now()-clock;
      await wait(Math.max(5000,scene.budget*1000-(scene.action_end_ms-scene.capture_start_ms)));
      scene.capture_end_ms=Date.now()-clock;
      await page.screenshot({path:path.join(output,`scene-${String(index+1).padStart(2,'0')}.png`)});
      console.log(`RECORDED ${index+1}/${plan.scenes.length}: ${scene.id}`);
    }
    assert.equal(operations.length,4);assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
    const video=await page.video().path();
    // The final overview uses about:blank content; restore local origin for cleanup.
    await goto('settings.html');await cleanupCredential();
    await context.close();await fs.copyFile(video,path.join(output,'raw.webm'));
    plan.capture_total_ms=Date.now()-clock;plan.live_operations=operations;plan.page_errors=errors;plan.external_browser_requests=forbidden.length;
    await fs.writeFile(path.join(session,'capture-plan.json'),JSON.stringify(plan,null,2));console.log('PASS: genuine model listing, connection and two saved streaming answers');
  }finally{
    if(remember&&page){try{await page.goto(base+'settings.html');await cleanupCredential();}catch{console.error('Temporary OS credential cleanup failed; remove it from the isolated course settings.');}}
    await browser?.close();server.kill();key='';
  }
})().catch(error=>{const message=key?String(error.message).replaceAll(key,'[redacted]'):String(error.message);console.error(message.replace(/sk-[A-Za-z0-9_.-]{16,}/g,'[redacted]'));process.exitCode=1;});
