// Capture current rc.15 UI only; do not call models or use device credentials.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');
const materials=path.resolve(__dirname,'..'),repo=path.resolve(materials,'../../..');
const work=path.resolve(process.argv[2]);
const source=path.join(repo,'example/competition-demo-rc12');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  assert(!fs.existsSync(work),'Choose a new capture directory');fs.mkdirSync(work,{recursive:true});
  const course=path.join(work,'isolated-course');fs.mkdirSync(course);
  for(const n of ['assets','lessons','practice','reference','index.html','settings.html','serve_course.py','tutor_chat.py','credential_store.py'])fs.cpSync(path.join(source,n),path.join(course,n),{recursive:true});
  const runtime=spawn(process.env.TEACH_PRO_PYTHON||'python',['-u','-B','-X','utf8','serve_course.py','--session-only','--no-browser','--port','0'],{cwd:course,windowsHide:true});runtime.stderr.resume();
  let browser;const errors=[];let external=0,provider=0;
  try{
    const base=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(new Error('Startup timeout')),10000);runtime.once('error',reject);runtime.stdout.on('data',d=>{log+=d;const match=log.match(/Course ready: (http:\/\/127\.0\.0\.1:\d+)\//);if(match){clearTimeout(timer);resolve(match[1]);}});});
    browser=await chromium.launch({headless:true,executablePath:process.env.TEACH_PRO_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
    const capture=async(name,action)=>{
      const ctx=await browser.newContext({viewport:{width:1440,height:810},deviceScaleFactor:1,recordVideo:{dir:path.join(work,'videos'),size:{width:1440,height:810}}});
      await ctx.route('**/*',route=>{const req=route.request();if(!req.url().startsWith(base)){external++;return route.abort();}if(req.method()==='POST'&&/\/api\/tutor\/(models|config|test|chat)/.test(req.url())){provider++;return route.abort();}return route.continue();});
      const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
      const goto=async file=>{await page.goto(base+'/'+file);await page.evaluate(()=>document.documentElement.dataset.theme='light');};
      const scroll=async selector=>{await page.locator(selector).first().evaluate(el=>{const top=el.getBoundingClientRect().top+scrollY;window.scrollTo({top:top-(document.querySelector('.lesson-toolbar')?.getBoundingClientRect().height||0)-18,behavior:'smooth'});});await delay(550);};
      const label=async text=>page.evaluate(text=>{const tag=document.createElement('div');tag.textContent=text;tag.style.cssText='position:fixed;right:16px;top:10px;padding:5px 10px;border-radius:15px;background:#eaf0fb;color:#254a80;font:13px Microsoft YaHei;z-index:9000';document.body.append(tag);},text);
      const timing=await action(page,goto,scroll,label);
      const video=await page.video().path();await ctx.close();fs.copyFileSync(video,path.join(work,name+'.webm'));
      return timing;
    };
    const clips={};
    clips.assessment=await capture('assessment',async(page,goto,scroll,label)=>{
      await goto('practice/entry-assessment.html');await label('演示作答');
      await page.locator('input[name="q1"]').first().check();
      await page.locator('[data-quiz-submit]').first().click();await scroll('#q1');
      await delay(2300);await scroll('#q6');
      await page.locator('#entry-q6-goals').fill('我有 Python 基础，会调用模型 API，希望学会开发安全的 AI 情报 Agent。每周大约五小时，先看图解，再读代码。');
      await scroll('#q6');
      await delay(4500);return {current_ui:true,synthetic_answer:true};
    });
    clips.context=await capture('context',async(page,goto,scroll)=>{
      await goto('settings.html');await page.waitForFunction(()=>!document.querySelector('[name=kind]').disabled);
      await page.locator('[name=kind]').selectOption('deepseek');
      await page.locator('[data-context-settings]').evaluate(el=>el.open=true);
      await scroll('[data-context-settings]');
      await delay(200);const start=await page.evaluate(()=>performance.now());const videoOffset=Date.now();
      await page.screenshot({path:path.join(work,'context-full.png')});
      await page.locator('[data-context-settings]').screenshot({path:path.join(materials,'assets/context-settings.png')});
      await delay(1400);await page.locator('[name=context_scope]').selectOption('current');await delay(1000);
      await page.locator('[name=context_scope]').selectOption('course');await delay(1100);
      await page.locator('[name=history_turns]').selectOption('10');await delay(1000);await page.locator('[name=history_turns]').selectOption('5');
      await delay(2000);
      assert.equal(await page.locator('[name=context_scope]').inputValue(),'course');
      return {action_ms:Date.now()-videoOffset,start_performance_ms:start};
    });
    clips.practice=await capture('practice',async(page,goto,scroll,label)=>{
      await goto('lessons/0001-llm-to-agent-api-call.html');await label('演示作答');
      await page.waitForFunction(()=>document.querySelector('.sync-status')?.dataset.state==='ready');
      await page.locator('#lesson-0001-evidence-explain').evaluate(el=>el.closest('.exercise-card').id='recording-inline-exercise');
      await scroll('#recording-inline-exercise');await delay(700);
      await page.locator('#lesson-0001-evidence-explain').fill('模型只看本次 messages；历史要由程序带上。工具型 Agent 还需要受控工具循环，把工具结果送回模型。');
      await scroll('#recording-inline-exercise');
      await delay(2700);await page.locator('#lesson-0001-evidence-explain').screenshot({path:path.join(work,'inline-answer.png')});
      await page.screenshot({path:path.join(work,'inline-full.png')});
      await delay(1200);await scroll('#learning-input');await page.locator('#lesson-0001-troubles').fill('下一课能否用一次工具调用说明程序怎样控制执行？');
      await page.locator('#lesson-0001-troubles').evaluate(el=>window.scrollTo({top:el.getBoundingClientRect().top+scrollY-230,behavior:'smooth'}));await delay(650);
      await page.waitForFunction(()=>document.querySelector('.sync-status')?.dataset.state==='saved');
      await delay(5200);await page.screenshot({path:path.join(work,'doubts-full.png')});
      assert(fs.existsSync(path.join(course,'learner-submissions/0001-llm-to-agent-api-call.json')));
      return {file_save:'pass'};
    });
    clips.resources=await capture('resources',async(page,goto,scroll)=>{
      await goto('lessons/0001-llm-to-agent-api-call.html');await scroll('#resources');await delay(3500);
      const detail=page.locator('[data-resource-id="video-lee-agent"]');if(await detail.count())await detail.locator('summary').click();
      await delay(4700);return {current_ui:true};
    });
    clips.lesson=await capture('lesson',async(page,goto,scroll)=>{
      await goto('lessons/0001-llm-to-agent-api-call.html');await scroll('#what-happens');
      await delay(3100);await scroll('#minimal-code');await delay(4100);return {current_ui:true};
    });
    clips.question=await capture('question',async(page,goto,scroll)=>{
      await goto('lessons/0001-llm-to-agent-api-call.html');await scroll('#minimal-code');
      await delay(5200);await page.locator('.tutor-open').click();
      await page.locator('#tutor-dialog').waitFor({state:'visible'});await delay(9300);
      assert.equal(await page.locator('[data-tutor-model]').textContent(),'未连接模型');
      return {current_ui:true,unconfigured_tutor:true};
    });
    assert.equal(provider,0);assert.equal(external,0);assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(work,'capture-audit.json'),JSON.stringify({status:'pass',current_version:'1.1.0-rc.15',clips,provider_requests:provider,external_requests:external,page_errors:errors,synthetic_input_saved_only_to_isolated_copy:true},null,2));
    console.log(JSON.stringify({status:'pass',clips:Object.keys(clips),provider_requests:provider,external_requests:external}));
  }finally{await browser?.close();if(runtime.exitCode===null)await new Promise(resolve=>{runtime.once('exit',resolve);runtime.kill();});}
})().catch(e=>{console.error(e);process.exitCode=1;});
