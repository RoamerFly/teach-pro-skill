// Isolated synthetic answers; no video playback, credentials or provider calls.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {chromium} = require('playwright');
const repo = path.resolve(__dirname, '..');
const source = path.join(repo, 'example/competition-demo-rc12');
const cases = [
  ['0001-llm-to-agent-api-call.html', 'video-lee-agent', 'https://www.youtube.com/watch?v=M2Yg1kwPpts', '0001-resource-2'],
  ['0002-react-reasoning-loop.html', 'video-datawhale-react', 'https://www.bilibili.com/video/BV12Z63BCEn6/?p=1', '0002-resource-2'],
];

test('video links remain optional, navigable and save the adjacent resource task input', {timeout:60000}, async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'teach-video-resources-'));
  const course = path.join(temp, 'course');
  const qa = process.env.RESOURCE_QA_DIR || path.resolve(repo, '../competition-work/2026-10-05-video-resource-qa');
  await fs.mkdir(course); await fs.mkdir(qa, {recursive:true});
  // Allowlist avoids copying runtime environments, learner files or model settings.
  for (const file of ['assets','lessons','reference','practice','index.html','settings.html','.teach-course.json','serve_course.py','tutor_chat.py','credential_store.py']) {
    await fs.cp(path.join(source,file), path.join(course,file), {recursive:true});
  }
  const server = spawn(process.env.TEACH_PRO_PYTHON || 'python', ['-u','-B','-X','utf8','serve_course.py','--no-browser','--session-only'], {cwd:course,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let log='', launchError, browser;
  server.on('error', e => {launchError=e;}); server.stdout.on('data', data => {log+=data;}); server.stderr.on('data', data => {log+=data;});
  const result={synthetic:true, video_playback_verified:false, provider_requests:0, external_requests:0, checks:[]};
  try {
    let base;
    for (let i=0;i<150;i++) {
      if(launchError) throw launchError;
      base=log.match(/Course ready: (http:\/\/127\.0\.0\.1:\d+\/)/)?.[1];
      if(base) break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert(base, 'Isolated course server failed to start');
    browser=await chromium.launch({executablePath:process.env.TEACH_PRO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:true});
    const context=await browser.newContext();
    await context.route('**/*', route => {
      if(new URL(route.request().url()).hostname!=='127.0.0.1') {result.external_requests++;return route.abort();}
      return route.continue();
    });
    const page=await context.newPage(); const errors=[];
    page.on('pageerror', error=>errors.push(error.message));
    for(const [file,id,url,key] of cases) {
      for(const width of [320,390,1280]) for(const theme of ['light','dark']) {
        await page.setViewportSize({width,height:900});
        await page.goto('about:blank');
        await page.goto(base+'lessons/'+file+'#resources');
        await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
        const card=page.locator('#resources details[data-resource-id="'+id+'"]');
        assert.equal(await card.getAttribute('open'),null);
        await card.locator('summary').focus(); await page.keyboard.press('Enter');
        assert.notEqual(await card.getAttribute('open'),null);
        const link=card.locator('a').first();
        assert.equal(await link.getAttribute('href'),url); assert(await link.isVisible());
        assert.equal(await link.getAttribute('target'),'_blank');
        assert((await link.getAttribute('rel')).includes('noopener'));
        assert.equal(await page.locator('#resources video, #resources iframe').count(),0);
        assert.equal(await page.locator('[data-save-key="'+key+'"]').count(),1);
        const geometry=await card.evaluate(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1}));
        assert(!geometry.overflow); assert(geometry.left>=0 && geometry.right<=geometry.width+1);
        result.checks.push({file,width,theme,expanded:true,link:url,existing_input:key});
        if(width===1280 && theme==='light') await card.screenshot({path:path.join(qa,id+'.png')});
      }
      const text='合成测试：视频导学产出，提议不等于执行。';
      await page.locator('[data-save-key="'+key+'"]').fill(text);
      await page.waitForFunction(()=>document.querySelector('.sync-status')?.dataset.state==='saved');
      const state=await page.evaluate(async file=>{
        const response=await fetch('/api/submissions/'+file.replace(/\.html$/,''));
        if(!response.ok) throw new Error('Cannot read the saved resource output');
        return response.json();
      },file);
      assert.equal(state.fields[key],text);
      const saved=await fs.readdir(path.join(course,'learner-submissions'));
      let found=false;
      for(const name of saved) {
        const data=JSON.parse(await fs.readFile(path.join(course,'learner-submissions',name),'utf8'));
        if(data.fields?.[key]===text) found=true;
      }
      assert(found, 'Resource output must reach the isolated local answer file');
      await page.reload(); assert.equal(await page.locator('[data-save-key="'+key+'"]').inputValue(),text);
    }
    await page.goto(base+'reference/resource-learning-center.html');
    for(const [file] of cases) {
      const link=page.locator('a[href="../lessons/'+file+'#resources"]');
      await link.click(); assert.equal(new URL(page.url()).hash,'#resources');
      await page.goBack();
    }
    assert.deepEqual(errors,[]); assert.equal(result.external_requests,0);
    result.local_file_roundtrips=cases.length; result.errors=errors;
    await fs.writeFile(path.join(qa,'checks.json'),JSON.stringify(result,null,2));
  } finally {
    if(browser) await browser.close();
    server.kill();
  }
});
