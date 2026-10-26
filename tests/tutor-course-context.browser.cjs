/* Browser -> isolated course -> synthetic model. No real learner/API data. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');
const repo=path.resolve(__dirname,'..');
const qa=process.env.CONTEXT_QA_DIR||path.resolve(repo,'../competition-work/2026-10-26-course-context-browser');
const python=process.env.TEACH_PRO_PYTHON||'C:/Users/浪客飞/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const source=path.join(repo,'example/competition-demo-rc12');
const slug='0004-s01-context';
const quote='按具体合同抽样';
(async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'teach-course-context-'));
  const course=path.join(temp,'isolated-course');fs.mkdirSync(course);fs.mkdirSync(qa,{recursive:true});
  let browser,runtime;const calls=[],errors=[];let external=0;
  const upstream=http.createServer((req,res)=>{
    req.on('error',()=>{});res.on('error',()=>{});let body='';req.on('data',d=>body+=d);req.on('end',()=>{
      const payload=JSON.parse(body);calls.push(payload);
      res.setHeader('Content-Type','text/event-stream');
      res.end('data: '+JSON.stringify({choices:[{index:0,delta:{content:'模拟接口已收到带来源的教材与当前提问。'},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');
    });
  });
  try{
    for(const n of ['assets','lessons','practice','reference','index.html','settings.html','serve_course.py','tutor_chat.py','credential_store.py'])fs.cpSync(path.join(source,n),path.join(course,n),{recursive:true});
    const first=path.join(course,'lessons/0001-llm-to-agent-api-call.html'),baseLesson=fs.readFileSync(first,'utf8');
    fs.writeFileSync(first,baseLesson.replace('</main>','<p>SYNTHETIC_PAST_LESSON_FACT</p></main>'));
    const fixture='<section id="quote-fixture"><h2>两道短检查</h2><h3>A. 解释历史信号</h3><details class="answer"><summary>参考标准</summary><p>不必同批，按具体合同抽样。历史分数来自过去模型。</p></details><details><summary>补充解释</summary><p>SYNTHETIC_FOLDED_EXPLANATION</p></details></section>';
    fs.writeFileSync(path.join(course,'lessons',slug+'.html'),baseLesson.replace(/<h1[^>]*>[\s\S]*?<\/h1>/,'<h1>第4课补充 · 历史信号</h1>').replace('<main ','<main data-lesson-kind="supplement" data-related-lesson="0004" ').replace('</main>',fixture+'</main>'));
    await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
    runtime=spawn(python,['-u','-B','-X','utf8','serve_course.py','--session-only','--no-browser','--port','0'],{cwd:course,windowsHide:true});runtime.stderr.resume();
    const base=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(new Error('Startup timeout')),10000);runtime.once('error',reject);runtime.stdout.on('data',d=>{log+=d;const match=log.match(/Course ready: (http:\/\/127\.0\.0\.1:\d+)\//);if(match){clearTimeout(timer);resolve(match[1]);}});});
    browser=await chromium.launch({headless:true,executablePath:process.env.TEACH_PRO_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
    const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
    await ctx.route('**/*',route=>{if(new URL(route.request().url()).hostname!=='127.0.0.1'){external++;return route.abort();}return route.continue();});
    const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
    const openSettings=async()=>{await page.goto(base+'/settings.html?lesson='+slug);await page.waitForFunction(()=>!document.querySelector('[data-settings-models]').disabled);await page.locator('[data-context-settings]').evaluate(e=>e.open=true);};
    const save=async()=>{await page.locator('[name=remember_key]').uncheck();await page.locator('.tutor-config button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('.tutor-status').dataset.state==='success');};
    await openSettings();
    assert.equal(await page.locator('[name=context_scope]').inputValue(),'course');
    assert(await page.locator('[name=context_answers]').isChecked());assert(await page.locator('[name=context_resources]').isChecked());
    assert.equal(await page.locator('[name=history_turns]').inputValue(),'5');
    await page.locator('[name=kind]').selectOption('custom');await page.locator('.settings-advanced').evaluate(e=>e.open=true);
    await page.locator('[name=provider]').fill('本机上下文验证');await page.locator('[name=mode]').selectOption('local');
    await page.locator('[name=base_url]').fill('http://127.0.0.1:'+upstream.address().port+'/v1');
    await page.locator('[name=model]').selectOption('__manual__');await page.locator('[name=model_manual]').fill('mock-context');await save();
    const layout=[];
    for(const [width,theme] of [[1440,'light'],[1440,'dark'],[390,'light'],[390,'dark']]){
      await page.setViewportSize({width,height:1000});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      const data=await page.locator('[data-context-settings]').evaluate(el=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,checkbox:el.querySelector('input[type=checkbox]').getBoundingClientRect().width,background:getComputedStyle(el).backgroundColor}));
      assert(!data.overflow);assert(data.checkbox>=12&&data.checkbox<=20);layout.push({theme,...data});
    }
    await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>document.documentElement.dataset.theme='light');
    await page.screenshot({path:path.join(qa,'context-settings.png'),fullPage:true});
    assert.equal(calls.length,0);
    const ask=async(q,selected=false)=>{
      await page.goto(base+'/lessons/'+slug+'.html');await page.locator('.tutor-open').waitFor();
      if(selected)await page.evaluate(phrase=>{
        document.querySelector('#quote-fixture details.answer').open=true;
        const node=document.querySelector('#quote-fixture details.answer p').firstChild,start=node.textContent.indexOf(phrase);
        const range=document.createRange();range.setStart(node,start);range.setEnd(node,start+phrase.length);
        const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
      },quote);
      await page.locator('.tutor-open').click();
      if(selected)assert.equal(await page.locator('[data-selection-text]').innerText(),quote);
      const before=calls.length;await page.locator('#tutor-message').fill(q);await page.locator('.tutor-send').click();
      await page.waitForFunction(()=>document.querySelector('.tutor-question').getAttribute('aria-busy')==='false');
      assert.equal(calls.length,before+1);return calls.at(-1);
    };
    let payload=await ask('解释我选中的词，并联系第一课。',true);
    assert(payload.messages[0].content.includes('SYNTHETIC_PAST_LESSON_FACT'));
    assert(payload.messages[0].content.includes('SYNTHETIC_FOLDED_EXPLANATION'));
    assert(payload.messages[0].content.includes('"lesson": "'+slug+'"'));
    assert(payload.messages[0].content.includes('"number": "4"'));
    assert(payload.messages.at(-1).content.includes('参考标准'));assert(payload.messages.at(-1).content.includes('历史分数来自过去模型'));
    let record=JSON.parse(fs.readFileSync(path.join(course,'learner-chats',slug+'.json')));
    assert.equal(record.messages[0].selection_context.section,'quote-fixture');assert.equal(record.context_manifest.current_page.lesson,slug);
    await page.screenshot({path:path.join(qa,'selected-answer-context.png')});
    await openSettings();await page.locator('[name=context_scope]').selectOption('current');await page.locator('[name=context_answers]').uncheck();await page.locator('[name=context_resources]').uncheck();await page.locator('[name=history_turns]').selectOption('all');await save();
    await openSettings();assert.equal(await page.locator('[name=context_scope]').inputValue(),'current');assert(!await page.locator('[name=context_answers]').isChecked());assert.equal(await page.locator('[name=history_turns]').inputValue(),'all');
    payload=await ask('缩小范围后，再解释刚选中的句子。',true);
    assert(!payload.messages[0].content.includes('SYNTHETIC_PAST_LESSON_FACT'));assert(!payload.messages[0].content.includes(quote));
    assert(payload.messages[0].content.includes('SYNTHETIC_FOLDED_EXPLANATION'));assert(payload.messages.at(-1).content.includes('历史分数来自过去模型'));
    assert.equal(payload.messages.length,4); // instruction, previous user/assistant, current user.
    await openSettings();await page.locator('[name=context_scope]').selectOption('course');await page.locator('[name=context_answers]').check();await page.locator('[name=context_resources]').check();await save();
    payload=await ask('重新使用整门教材解答。');assert(payload.messages[0].content.includes('SYNTHETIC_PAST_LESSON_FACT'));
    assert.equal(payload.messages.length,6);assert.equal(external,0);assert.deepEqual(errors,[]);
    record=JSON.parse(fs.readFileSync(path.join(course,'learner-chats',slug+'.json')));
    assert.equal(record.context_manifest.options.context_scope,'course');assert.equal(record.context_manifest.options.history_turns,null);
    const report={status:'pass',synthetic:true,defaultCourseScope:true,selectedAnswerSource:true,currentFourthSupplement:true,scopeAndFlagsActuallyAffectPayload:true,explicitSelectionOverridesBulkExclusion:true,historyAllRetainsPairs:true,settingsReload:true,layout,loopbackRequests:calls.length,realProviderRequests:0,externalRequests:external,pageErrors:errors};
    fs.writeFileSync(path.join(qa,'audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{
    await browser?.close();if(runtime&&runtime.exitCode===null)await new Promise(resolve=>{runtime.once('exit',resolve);runtime.kill();});
    upstream.closeAllConnections();await new Promise(resolve=>upstream.close(resolve));
    if(path.dirname(temp)!==path.resolve(os.tmpdir())||!path.basename(temp).startsWith('teach-course-context-'))throw new Error('Unsafe cleanup');
    fs.rmSync(temp,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
