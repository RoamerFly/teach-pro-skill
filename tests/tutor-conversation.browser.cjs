/* Real loopback HTTP/SSE and browser interaction; synthetic course and provider. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),qa=process.env.CONVERSATION_QA_DIR||path.resolve(root,'../competition-work/2026-10-26-rc16-conversation-browser');
const python=process.env.TEACH_PRO_PYTHON||'C:/Users/浪客飞/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const pause=ms=>new Promise(r=>setTimeout(r,ms)),calls=[],streams=[];
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
(async()=>{
  fs.mkdirSync(qa,{recursive:true});const temp=fs.mkdtempSync(path.join(os.tmpdir(),'teach-conversation-')),course=path.join(temp,'course');fs.mkdirSync(course);
  const source=path.join(root,'example/competition-demo-rc12');
  for(const name of ['assets','lessons','reference','practice','index.html','settings.html','serve_course.py','tutor_chat.py','credential_store.py'])fs.cpSync(path.join(source,name),path.join(course,name),{recursive:true});
  for(const name of ['tutor.js','style.css','tutor_chat.py'])fs.copyFileSync(path.join(root,'teach-pro/assets',name),path.join(course,name.endsWith('.py')?name:'assets/'+name));
  const upstream=http.createServer(async(req,res)=>{
    if(req.url==='/v1/models'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:'mock-thinking',name:'本机验证 · 图文推理',input_modalities:['text','image'],effort:{supported_levels:['low','high']}},{id:'mock-text',name:'本机验证 · 纯文本',input_modalities:['text']}]}));return;}
    let raw='';for await(const b of req)raw+=b;const body=JSON.parse(raw);calls.push(body);
    const number=calls.length,state={number,closed:false,sent:0};streams.push(state);res.on('close',()=>{state.closed=true;});
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'});
    const event=(delta,reason=null)=>{if(!res.destroyed){res.write('data: '+JSON.stringify({choices:[{index:0,delta,finish_reason:reason}]})+'\n\n');state.sent++;}};
    event({reasoning_content:'先结合当前课与附件检查问题。'});await pause(550);
    const question=body.messages.at(-1).content,text=typeof question==='string'?question:question.filter(p=>p.type==='text').map(p=>p.text).join('\n');
    event({content:'### 回答 '+number+'\n\n这是当前分支的解释。'});
    if(text.includes('STOP')){while(!res.destroyed){await pause(200);event({content:' 保留已收到的正文。'});}return;}
    await pause(450);event({content:'\n\n- 先理解图解\n- 再用自己的话解释'});event({},'stop');res.end('data: [DONE]\n\n');
  });
  await new Promise(r=>upstream.listen(0,'127.0.0.1',r));let browser,runtime;
  try{
    runtime=spawn(python,['-u','-B','-X','utf8','serve_course.py','--session-only','--no-browser','--port','0'],{cwd:course,windowsHide:true});runtime.stderr.resume();
    const base=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(new Error('startup timeout')),10000);runtime.once('error',reject);runtime.stdout.on('data',d=>{log+=d;const m=log.match(/Course ready: (http:\/\/127\.0\.0\.1:\d+)\//);if(m){clearTimeout(timer);resolve(m[1]);}});});
    browser=await chromium.launch({headless:true,executablePath:process.env.TEACH_PRO_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
    const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
    let external=0;await context.route('**/*',route=>{if(!route.request().url().startsWith(base)&&!route.request().url().startsWith('blob:')){external++;return route.abort();}return route.continue();});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/settings.html');
    await page.evaluate(async address=>{const boot=await(await fetch('/api/tutor/bootstrap')).json();const post=async(route,data)=>{const r=await fetch('/api/tutor/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Teach-Token':boot.token},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw new Error(j.error);return j;};await post('models',{kind:'custom',base_url:address,mode:'local',api_key:''});await post('config',{kind:'custom',provider:'隔离验证',base_url:address,mode:'local',api_key:'',model:'mock-thinking',remember_key:false});},'http://127.0.0.1:'+upstream.address().port+'/v1');
    const slug='0001-llm-to-agent-api-call',lesson=base+'/lessons/'+slug+'.html';
    await page.goto(lesson);await page.locator('.tutor-open').click();await page.waitForFunction(()=>!document.querySelector('[data-tutor-attach]').disabled);
    assert.equal(await page.locator('[data-tutor-model-select] option').count(),2);
    await page.locator('[data-tutor-effort]').selectOption('high');
    await page.locator('[data-tutor-files]').setInputFiles([{name:'学习图.png',mimeType:'image/png',buffer:png},{name:'学习笔记.md',mimeType:'text/plain',buffer:Buffer.from('附件学习线索 UNIQUE_NOTE')}]);
    await page.waitForFunction(()=>document.querySelectorAll('[data-tutor-attachments] .tutor-attachment').length===2&&!document.querySelector('.tutor-send').disabled);
    await page.waitForFunction(()=>document.querySelector('[data-tutor-attachments] img')?.naturalWidth>0);
    const send=async text=>{await page.locator('#tutor-message').fill(text);await page.locator('.tutor-send').click();await page.waitForFunction(()=>!!document.querySelector('.is-streaming'));};
    const done=async()=>page.waitForFunction(()=>!document.querySelector('.is-streaming')&&document.querySelector('.tutor-question').getAttribute('aria-busy')==='false');
    const read=()=>JSON.parse(fs.readFileSync(path.join(course,'learner-chats',slug+'.json'),'utf8'));
    await send('Q-ORIGINAL');await page.waitForFunction(()=>!document.querySelector('.is-streaming .tutor-reasoning').hidden);
    assert((await page.locator('.is-streaming .tutor-reasoning').textContent()).includes('当前课'));
    await done();assert.equal(calls[0].reasoning_effort,'high');assert.equal(calls[0].model,'mock-thinking');
    assert(calls[0].messages.at(-1).content.some(p=>p.type==='image_url'&&p.image_url.url.startsWith('data:image/png;base64,')));
    assert(JSON.stringify(calls[0].messages).includes('UNIQUE_NOTE'));assert.equal(await page.locator('.is-assistant h3').count(),1);
    await page.getByRole('button',{name:'复制问题',exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'Q-ORIGINAL');
    await page.getByRole('button',{name:'复制回答',exact:true}).click();assert((await page.evaluate(()=>navigator.clipboard.readText())).startsWith('### 回答'));
    const first=read(),original=first.messages[0].id;
    await send('Q-CHILD');await done();assert(JSON.stringify(calls[1].messages).includes('Q-ORIGINAL'));
    await page.locator('#tutor-message').fill('未发送草稿');await page.locator('[data-tutor-edit]').first().click();
    await page.getByRole('textbox',{name:'修改问题',exact:true}).fill('Q-EDITED');await page.locator('.tutor-edit-actions .button--primary').click();await page.waitForFunction(()=>!!document.querySelector('.is-streaming'));await done();
    assert.equal(await page.locator('.is-user').count(),1);assert.equal(await page.locator('#tutor-message').inputValue(),'未发送草稿');
    assert(!JSON.stringify(calls[2].messages).includes('Q-ORIGINAL'));assert(!JSON.stringify(calls[2].messages).includes('Q-CHILD'));
    assert.equal(read().messages.length,6);let before=calls.length;
    await page.locator('.is-user .tutor-versions button').first().click();await page.waitForFunction(()=>document.querySelectorAll('.is-user').length===2);assert.equal(calls.length,before);
    assert((await page.locator('.is-user').first().textContent()).includes('Q-ORIGINAL'));
    await page.locator('.is-user').first().locator('.tutor-versions button').last().click();await page.waitForFunction(()=>document.querySelectorAll('.is-user').length===1);
    await page.locator('[data-tutor-regenerate]').click();await page.waitForFunction(()=>!!document.querySelector('.is-streaming'));await done();
    assert.equal(read().messages.filter(m=>m.role==='user').length,3);assert((await page.locator('.is-assistant .tutor-versions').textContent()).includes('2 / 2'));
    before=calls.length;await page.locator('.is-assistant .tutor-versions button').first().click();await page.waitForFunction(()=>document.querySelector('.is-assistant .tutor-versions')?.textContent.includes('1 / 2'));assert.equal(calls.length,before);
    await page.reload();await page.locator('.tutor-open').click();await page.waitForFunction(()=>document.querySelector('.is-assistant .tutor-versions')?.textContent.includes('1 / 2'));
    await send('STOP');await page.waitForFunction(()=>document.querySelector('.is-streaming')?.textContent.includes('这是当前分支'));
    await page.locator('#tutor-message').fill('停止后保留的草稿');const started=Date.now();await page.getByRole('button',{name:'停止生成',exact:true}).click();await done();
    const stopMs=Date.now()-started;assert(stopMs<3000,'stop must close the upstream, not just hide the answer');assert.equal(read().messages.at(-1).status,'stopped');assert(read().messages.at(-1).content.includes('当前分支'));
    assert.equal(await page.locator('#tutor-message').inputValue(),'停止后保留的草稿');await pause(300);assert(streams.at(-1).closed);
    const transport=async kind=>page.locator('#tutor-message').evaluate((el,{data,kind})=>{const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(data)],kind+'.png',{type:'image/png'}));el.dispatchEvent(kind==='paste'?new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}):new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));},{data:[...png],kind});
    await transport('paste');await page.waitForFunction(()=>document.querySelectorAll('[data-tutor-attachments] .tutor-attachment').length===1);
    await transport('drop');await page.waitForFunction(()=>document.querySelectorAll('[data-tutor-attachments] .tutor-attachment').length===2);
    const layouts=[];for(const width of [1440,390,320])for(const theme of ['light','dark']){
      await page.setViewportSize({width,height:900});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      const geometry=await page.locator('#tutor-dialog').evaluate(el=>{const c=el.querySelector('.tutor-composer').getBoundingClientRect(),d=el.getBoundingClientRect();return {width:innerWidth,dialogWidth:d.width,composerLeft:c.left,composerRight:c.right,bodyOverflow:document.documentElement.scrollWidth>innerWidth+1,background:getComputedStyle(el).backgroundColor};});
      assert(!geometry.bodyOverflow);assert(geometry.composerLeft>=0&&geometry.composerRight<=width+1,JSON.stringify(geometry));layouts.push({theme,...geometry});await page.screenshot({path:path.join(qa,`${width}-${theme}.png`)});
    }
    await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>document.documentElement.dataset.theme='light');
    await page.screenshot({path:path.join(qa,'conversation.png')});assert.deepEqual(errors,[]);assert.equal(external,0);
    const beforeEarly=calls.length;
    await page.route('**/api/tutor/bootstrap',async route=>{await pause(700);await route.continue();});
    await page.locator('#tutor-message').fill('EARLY STOP');await page.locator('.tutor-send').click();
    await page.getByRole('button',{name:'停止生成',exact:true}).click();await done();
    assert.equal(calls.length,beforeEarly,'stop during bootstrap must prevent a later provider request');
    assert.equal(await page.locator('#tutor-message').inputValue(),'EARLY STOP');
    fs.writeFileSync(path.join(qa,'audit.json'),JSON.stringify({status:'pass',synthetic_provider:true,real_provider_requests:0,external_requests:external,page_errors:errors,stop_ms:stopMs,checks:['streamed reasoning','Markdown answer','copy question and answer','model/effort payload','image and text attachments','edit forks context','regenerate answer versions','left/right restore','refresh restores active branch','server upstream cancellation','early stop prevents request','draft preservation','paste/drop images'],layouts},null,2));
    console.log(JSON.stringify({status:'pass',mock_requests:calls.length,stop_ms:stopMs,layouts:layouts.length,real_provider_requests:0,page_errors:errors}));
  }finally{await browser?.close();if(runtime&&runtime.exitCode===null)await new Promise(r=>{runtime.once('exit',r);runtime.kill();});await new Promise(r=>upstream.close(r));fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
