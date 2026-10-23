/* Browser -> isolated course runtime -> loopback synthetic SSE/JSON, no real key. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const {spawn} = require('node:child_process');
const {chromium} = require('playwright');
const repo = path.resolve(__dirname,'..');
const qa = process.env.LIMITS_QA_DIR || path.resolve(repo,'../competition-work/2026-10-23-tutor-limits-browser');
const python = process.env.TEACH_PRO_PYTHON || 'C:/Users/浪客飞/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const source = path.join(repo,'example/competition-demo-rc12');
const slug = '0001-llm-to-agent-api-call';
const event = (content,finish=null,extra={}) => 'data: '+JSON.stringify({id:'mock-'+ 'm'.repeat(180),model:'loopback-only',choices:[{index:0,delta:content===null?{}:{content},finish_reason:finish}],...extra})+'\n\n';
(async()=>{
  const temp = fs.mkdtempSync(path.join(os.tmpdir(),'teach-limits-'));
  const course = path.join(temp,'isolated-course'); fs.mkdirSync(course); fs.mkdirSync(qa,{recursive:true});
  let browser,runtime; const calls=[];
  const upstream=http.createServer((req,res)=>{
    req.on('error',()=>{});res.on('error',()=>{});
    let body='';req.on('data',d=>body+=d);req.on('end',()=>{
      const q=JSON.parse(body).messages.at(-1).content;calls.push(q);
      res.setHeader('Connection','close');
      if(q==='json-fallback'){
        res.setHeader('Content-Type','application/json');
        return res.end(JSON.stringify({choices:[{message:{content:'JSON兼容回答完成。',reasoning_content:'思'.repeat(190000)},finish_reason:'stop'}]}));
      }
      res.setHeader('Content-Type','text/event-stream');
      if(q==='unicode'){
        res.write(event('🙂𠮷'.repeat(9000)));res.end(event(null,'stop')+'data: [DONE]\n\n');
      }else if(q==='reply-limit'){
        res.end(event('字'.repeat(25000))+event(null,'stop'));
      }else if(q==='event-limit'){
        res.end(event('已收到的正文。')+event(null,null,{metadata:'m'.repeat(1024*1024+10)}));
      }else if(q==='wire-limit'){
        res.end(event('传输超限前正文。')+(': '+ 'p'.repeat(4000)+'\n\n').repeat(4200));
      }else if(q==='interrupted'){
        res.end(event('连接中断前正文。'));
      }else{
        const payload=Array.from({length:3153},()=>event('答')).join('');
        assert(Buffer.byteLength(payload)>512*1024);
        res.end(payload+event(null,'stop')+'data: [DONE]\n\n');
      }
    });
  });
  try{
    for(const n of ['assets','lessons','index.html','settings.html','serve_course.py','tutor_chat.py','credential_store.py'])fs.cpSync(path.join(source,n),path.join(course,n),{recursive:true});
    await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
    runtime=spawn(python,['-u','-B','-X','utf8','serve_course.py','--session-only','--no-browser','--port','0'],{cwd:course,windowsHide:true});runtime.stderr.resume();
    const base=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(new Error('Runtime startup timeout')),10000);runtime.once('error',reject);runtime.stdout.on('data',d=>{log+=d;const m=log.match(/Course ready: (http:\/\/127\.0\.0\.1:\d+)\//);if(m){clearTimeout(timer);resolve(m[1]);}});});
    browser=await chromium.launch({headless:true,executablePath:process.env.TEACH_PRO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
    const ctx=await browser.newContext({viewport:{width:1440,height:900}});const errors=[];let external=0;
    await ctx.route('**/*',route=>{if(new URL(route.request().url()).hostname!=='127.0.0.1'){external++;return route.abort();}return route.continue();});
    const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/settings.html');
    await page.waitForFunction(()=>!document.querySelector('[data-settings-models]').disabled);
    await page.locator('[name=kind]').selectOption('custom');
    await page.locator('.settings-advanced').evaluate(e=>e.open=true);
    await page.locator('[name=provider]').fill('隔离模拟接口');await page.locator('[name=mode]').selectOption('local');
    await page.locator('[name=base_url]').fill('http://127.0.0.1:'+upstream.address().port+'/v1');
    await page.locator('[name=model]').selectOption('__manual__');await page.locator('[name=model_manual]').fill('mock-sse');
    await page.locator('[name=remember_key]').uncheck();await page.locator('.tutor-config button[type=submit]').click();
    await page.waitForFunction(()=>!document.querySelector('[data-settings-test]').disabled);
    await page.goto(base+'/lessons/'+slug+'.html');await page.locator('.tutor-open').click();
    const cases=[['normal-long','complete',3153,null],['unicode','complete',18000,null],['json-fallback','complete',11,null],['reply-limit','incomplete',24000,'reply_limit'],['event-limit','incomplete',7,'event_size'],['wire-limit','incomplete',8,'response_size'],['interrupted','incomplete',8,'stream_interrupted']];
    const results=[];const historyFile=path.join(course,'learner-chats',slug+'.json');
    for(const [q,status,expected,code] of cases){
      await page.locator('#tutor-message').fill(q);await page.locator('.tutor-send').click();
      await page.waitForFunction(()=>document.querySelector('.tutor-question').getAttribute('aria-busy')==='false',{},{timeout:30000});
      const record=JSON.parse(fs.readFileSync(historyFile));const last=record.messages.at(-1);
      assert.equal(last.role,'assistant');assert.equal(last.status,status);
      assert.equal(Array.from(last.content).length,expected);
      if(code)assert.equal(last.diagnostics.code,code);
      assert.equal(await page.locator('.tutor-message.is-assistant').count(),results.length+1);
      if(q==='unicode')assert(!await page.locator('.tutor-status').isVisible());
      results.push({case:q,status:last.status,characters:Array.from(last.content).length,code:last.diagnostics.code||null,response_bytes:last.diagnostics.response_bytes||null});
    }
    const before=fs.readFileSync(historyFile);
    await page.reload();await page.locator('.tutor-open').click();
    await page.locator('.tutor-message.is-assistant').nth(6).waitFor();
    assert.deepEqual(fs.readFileSync(historyFile),before);
    assert.equal(await page.locator('.tutor-message.is-assistant .tutor-text-action').count(),7);
    assert.equal(await page.locator('[data-tutor-retry]').count(),1);
    await page.locator('[data-tutor-retry]').click();
    await page.waitForFunction(()=>document.querySelector('.tutor-question').getAttribute('aria-busy')==='false',{},{timeout:30000});
    const retried=JSON.parse(fs.readFileSync(historyFile));
    assert.equal(retried.messages.filter(m=>m.role==='user').length,7);
    assert.equal(retried.messages.filter(m=>m.role==='user').at(-1).attempts,2);
    assert.equal(calls.length,8);assert.equal(external,0);assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(qa,'partial-answer-restored.png'),fullPage:false});
    const report={status:'pass',synthetic:true,cases:results,refreshPreservesRecords:true,retryKeepsSingleUser:true,providerRequests:0,loopbackRequests:calls.length,externalRequests:external,pageErrors:errors};
    fs.writeFileSync(path.join(qa,'audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{
    await browser?.close();if(runtime&&runtime.exitCode===null)await new Promise(resolve=>{runtime.once('exit',resolve);runtime.kill();});
    upstream.closeAllConnections();await new Promise(resolve=>upstream.close(resolve));
    if(path.dirname(temp)!==path.resolve(os.tmpdir())||!path.basename(temp).startsWith('teach-limits-'))throw new Error('Unsafe cleanup path');
    fs.rmSync(temp,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
