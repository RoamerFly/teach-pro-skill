// Re-record the current UI; replay only the hash-pinned, previously recorded answers.
// No provider request, real credential, or speech synthesis is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const {chromium} = require('playwright');
const materials = path.resolve(__dirname, '..'), repo = path.resolve(materials, '../../..');
const work = path.resolve(process.argv[2]), accepted = path.resolve(process.argv[3]);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const slug = '0001-llm-to-agent-api-call';
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
(async () => {
  assert(!fs.existsSync(work), 'Choose a new capture folder');
  const original = JSON.parse(fs.readFileSync(path.join(accepted, 'capture-plan.json'), 'utf8'));
  const previous = JSON.parse(fs.readFileSync(path.join(materials, 'dialogue-video-chapters.json'), 'utf8'));
  const answers = original.scenes.filter(s => ['tutor-answer', 'followup'].includes(s.id));
  const live = previous.live_operations.filter(s => s.operation === 'chat');
  assert.equal(answers.length, 2);
  answers.forEach((s, i) => assert.equal(hash(s.live_answer), live[i].answer_sha256));
  fs.mkdirSync(work, {recursive: true});
  const course = path.join(work, 'isolated-course'); fs.mkdirSync(course);
  const source = path.join(repo, 'example/competition-demo-rc12');
  for (const name of ['assets','lessons','practice','reference','index.html','settings.html','serve_course.py','tutor_chat.py','credential_store.py'])
    fs.cpSync(path.join(source, name), path.join(course, name), {recursive: true});
  const requests = [];
  const replay = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url.endsWith('/models')) {
      requests.push({operation: 'archived-model-list'});
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({data: previous.live_operations[0].model_ids.map(id => ({id}))})); return;
    }
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw), question = body.messages.at(-1).content;
    if (question === '连接测试，请仅回复 OK。') {
      requests.push({operation: 'local-connection-check'});
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({choices:[{message:{content:'OK'},finish_reason:'stop'}]})); return;
    }
    const record = answers.find(s => s.question === question); assert(record, 'Unrecorded question cannot be replayed');
    requests.push({operation: 'archived-answer-playback', scene: record.id, sha256: hash(record.live_answer)});
    res.writeHead(200, {'Content-Type':'text/event-stream','Cache-Control':'no-store'});
    for (let i = 0; i < record.live_answer.length; i += 5) {
      res.write('data: '+JSON.stringify({choices:[{delta:{content:record.live_answer.slice(i,i+5)},finish_reason:null}]})+'\n\n');
      await delay(50);
    }
    res.end('data: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');
  });
  await new Promise(resolve => replay.listen(0, '127.0.0.1', resolve));
  // Patch transport only in the isolated process; production files remain byte-identical.
  fs.writeFileSync(path.join(course, 'recording_runtime.py'), `import http.client, runpy, socket, sys\nimport tutor_chat\nport=${replay.address().port}\ntutor_chat.connection=lambda url, remote_port, mode: http.client.HTTPConnection('127.0.0.1',port,timeout=30)\noriginal=socket.create_connection\ndef loopback_only(address,*args,**kwargs):\n    if address[0] not in ('127.0.0.1','localhost','::1'): raise RuntimeError('Recording forbids external connections')\n    return original(address,*args,**kwargs)\nsocket.create_connection=loopback_only\nsys.argv=['serve_course.py','--session-only','--no-browser','--port','0']\nrunpy.run_path('serve_course.py',run_name='__main__')\n`);
  let runtime, browser, context, page, base, remembered = false;
  const errors = [], forbidden = [], scenes = [];
  try {
    runtime = spawn(process.env.TEACH_PRO_PYTHON || 'python', ['-u','-B','-X','utf8','recording_runtime.py'], {cwd:course,windowsHide:true});
    runtime.stderr.on('data', d => process.stderr.write(d));
    base = await new Promise((resolve,reject) => {let log=''; const timer=setTimeout(()=>reject(new Error('Startup timeout')),10000);runtime.once('error',reject);runtime.stdout.on('data',d=>{log+=d;const m=log.match(/Course ready: (http:\/\/127\.0\.0\.1:\d+)\//);if(m){clearTimeout(timer);resolve(m[1]);}});});
    browser = await chromium.launch({headless:true,executablePath:process.env.TEACH_PRO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
    context = await browser.newContext({viewport:{width:1440,height:810},deviceScaleFactor:1,permissions:['clipboard-read','clipboard-write'],recordVideo:{dir:path.join(work,'videos'),size:{width:1440,height:810}}});
    await context.route('**/*', route => {if(!route.request().url().startsWith(base)&&!route.request().url().startsWith('blob:')){forbidden.push(route.request().url().split('?')[0]);return route.abort();}return route.continue();});
    page=await context.newPage(); page.on('pageerror', e=>errors.push(e.message));
    const goto=async file=>{await page.goto(base+'/'+file);await page.evaluate(()=>document.documentElement.dataset.theme='light');};
    const scroll=async selector=>{await page.locator(selector).first().evaluate(el=>window.scrollTo({top:el.getBoundingClientRect().top+scrollY-(document.querySelector('.lesson-toolbar')?.getBoundingClientRect().height||0)-18,behavior:'smooth'}));await delay(450);};
    await goto('practice/entry-assessment.html'); await delay(800);
    const clock=Date.now(); let sceneClock;
    const at=async seconds=>{const left=sceneClock+seconds*1000-Date.now();if(left>0)await delay(left);};
    const click=async selector=>{await page.locator(selector).first().hover();await delay(100);await page.locator(selector).first().click();};
    for (const chapter of previous.chapters.filter(c=>c.id!=='home')) {
      // A short in-frame marker gives the editor an exact clock, independent of
      // browser startup/encoder flush time. It is removed from the final film.
      await page.evaluate(()=>{const m=document.createElement('div');m.id='capture-sync-marker';m.style.cssText='position:fixed;inset:auto 0 0;height:8px;background:#ff00ff;z-index:2147483647;pointer-events:none';document.body.append(m);});
      await delay(180);
      await page.evaluate(()=>document.getElementById('capture-sync-marker').remove());
      sceneClock=Date.now();
      const scene={id:chapter.id,seconds:chapter.seconds,start_ms:sceneClock-clock};
      switch(chapter.id) {
        case 'assessment':
          await page.locator('input[name="q1"]').first().check();await click('[data-quiz-submit]');await scroll('#q1');
          await at(3.3);await scroll('#q6');await page.locator('#entry-q6-goals').fill('我有 Python 基础，会调用模型 API。每周五小时，先看图解再读代码，目标是开发安全情报 Agent。');break;
        case 'lesson':
          await goto('lessons/'+slug+'.html');await scroll('#what-happens');await at(4.2);await scroll('#minimal-code');break;
        case 'resources':
          await scroll('#resources');await at(5);await click('[data-resource-id="video-lee-agent"] summary');break;
        case 'question-origin':
          await scroll('#minimal-code');await at(6.2);await click('.tutor-open');await page.locator('#tutor-dialog').waitFor({state:'visible'});break;
        case 'settings':
          await at(.3);await page.getByRole('link',{name:'连接答疑模型',exact:true}).click();
          await page.waitForFunction(()=>!document.querySelector('[name=kind]').disabled);
          await at(3.2);await page.locator('[name=kind]').selectOption('deepseek');
          await at(5);await page.locator('[name=api_key]').pressSequentially('DEMO_RECORDING_KEY_NOT_VALID',{delay:18});
          assert.equal(await page.locator('[name=api_key]').getAttribute('type'),'password');
          await at(6.2);await click('[data-settings-models]');await page.waitForFunction(()=>document.querySelector('[name=model] option[value="deepseek-flash"]'));
          await at(7.5);await page.locator('[name=model]').selectOption('deepseek-flash');
          remembered=await page.locator('[name=remember_key]').isEnabled();if(!remembered)await page.locator('[name=remember_key]').uncheck({force:true});
          await at(9.6);await click('.tutor-config button[type=submit]');await page.waitForFunction(()=>document.querySelector('.tutor-status').dataset.state==='success');
          await at(14.4);await page.locator('[data-context-settings]').evaluate(el=>el.open=true);await scroll('[data-context-settings]');break;
        case 'connection':
          await scroll('#ai-model');await click('[data-settings-test]');await page.waitForFunction(()=>document.querySelector('.tutor-status').textContent.includes('连接成功'));
          await at(3.9);await click('.sidebar-settings-return');await page.waitForFunction(()=>document.querySelector('#tutor-dialog')?.open);break;
        case 'tutor-answer':
          await at(.2);await page.locator('[data-tutor-model-select]').selectOption('deepseek-flash');
          await page.locator('#tutor-message').fill(answers[0].question);await at(4.6);await click('.tutor-send');
          await page.waitForFunction(()=>document.querySelector('.is-assistant')&&!document.querySelector('.is-streaming'));
          assert.equal((await page.locator('.is-assistant .tutor-message-body').textContent()).trim(),answers[0].live_answer);
          await at(14.7);await page.getByRole('button',{name:'复制回答',exact:true}).click();break;
        case 'followup':
          // Current controls are visible during the natural pause before the follow-up.
          await page.locator('[data-tutor-effort]').focus();await page.locator('[data-tutor-effort]').selectOption('none');
          await at(1);await page.locator('#tutor-message').fill(answers[1].question);
          await at(6.7);await click('.tutor-send');await page.waitForFunction(()=>document.querySelectorAll('.is-assistant').length===2&&!document.querySelector('.is-streaming'));
          assert.equal((await page.locator('.is-assistant .tutor-message-body').last().textContent()).trim(),answers[1].live_answer);break;
        case 'save':
          await at(1.8);await click('[data-tutor-close]');await scroll('#lesson-0001-evidence-explain');
          await page.locator('#lesson-0001-evidence-explain').fill('模型只看本次 messages；历史要由程序带上。工具型 Agent 还需要受控工具循环，把执行结果送回模型。');
          await at(8);await scroll('#learning-input');await page.locator('#lesson-0001-troubles').fill('下一课能否用一次工具调用说明程序怎样控制执行？');
          await page.waitForFunction(()=>document.querySelector('.sync-status')?.dataset.state==='saved');break;
        case 'adaptive':
          await goto('index.html');await scroll('#lessons');await at(3);await goto('lessons/0003-safe-tool-contract.html');await scroll('#contract');
          await at(6.4);await goto('lessons/0002-s01-injection-without-thought.html');break;
        case 'continuation':
        case 'closing':
          await page.setContent(fs.readFileSync(path.join(materials,'assets/video-overview.html'),'utf8'));
          await page.evaluate(kind=>document.body.classList.add(kind),chapter.id);break;
      }
      scene.action_end_ms=Date.now()-clock;assert(scene.action_end_ms-scene.start_ms<chapter.seconds*1000,chapter.id+' overran its narration');
      await at(chapter.seconds-.16);await page.screenshot({path:path.join(work,chapter.id+'.png')});await at(chapter.seconds);
      scene.end_ms=Date.now()-clock;scenes.push(scene);console.log('Recorded '+chapter.id);
    }
    await delay(250);const total=Date.now()-clock,video=await page.video().path();await context.close();context=null;
    fs.copyFileSync(video,path.join(work,'current-ui.webm'));
    assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
    assert.equal(requests.filter(r=>r.operation==='archived-answer-playback').length,2);
    const runtimeFiles=['serve_course.py','tutor_chat.py','credential_store.py','assets/tutor.js','assets/tutor-settings.js','assets/style.css'];
    const runtimeHashes=Object.fromEntries(runtimeFiles.map(n=>[n,hash(fs.readFileSync(path.join(course,n)))]));
    fs.writeFileSync(path.join(work,'capture-audit.json'),JSON.stringify({status:'pass',version:'1.1.0-rc.16',capture_total_ms:total,scenes,requests,new_provider_requests:0,new_speech_synthesis_requests:0,answer_mode:'hash-verified accepted real DeepSeek answers replayed through the current HTTP/SSE runtime',page_errors:errors,external_browser_requests:forbidden.length,remembered_device_in_isolated_recording:remembered,runtime_hashes:runtimeHashes},null,2));
  } finally {
    // The only stored key belongs to this unique disposable course and is an invalid demo value.
    if(runtime?.exitCode===null&&remembered&&base)try{const boot=await(await fetch(base+'/api/tutor/bootstrap')).json();await fetch(base+'/api/tutor/forget',{method:'POST',headers:{'Content-Type':'application/json','Origin':base,'X-Teach-Token':boot.token},body:JSON.stringify({confirm:true})});}catch(e){console.error('Temporary recording credential cleanup failed');process.exitCode=1;}
    await context?.close();await browser?.close();if(runtime?.exitCode===null)await new Promise(r=>{runtime.once('exit',r);runtime.kill();});await new Promise(r=>replay.close(r));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
