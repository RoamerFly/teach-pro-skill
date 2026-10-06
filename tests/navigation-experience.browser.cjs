// Read-only course server: never writes learner data or forwards model requests.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const {pathToFileURL}=require('node:url');
const {chromium} = require('playwright');

(async () => {
 const root=path.resolve('example/competition-demo-rc12');
 const output=path.resolve(process.argv[2] || '../competition-work/2026-10-06-navigation-qa');
 await fs.mkdir(output,{recursive:true});
 const server=http.createServer(async(req,res)=>{
  try {
   const relative=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).slice(1) || 'index.html';
   const file=path.resolve(root,relative);
   if(!file.startsWith(root+path.sep)||!['.html','.js','.css','.svg'].includes(path.extname(file))) {
    res.writeHead(404,{'Content-Type':'application/json'});res.end('{"error":"Read-only UI test"}');return;
   }
   const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[path.extname(file)];
   res.writeHead(200,{'Content-Type':type+'; charset=utf-8'});res.end(await fs.readFile(file));
  }catch {res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}/`;
 let browser;
 try {
  browser=await chromium.launch({headless:true,executablePath:process.env.TEACH_PRO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const context=await browser.newContext({viewport:{width:1280,height:600},reducedMotion:'reduce'});
  let remote=0;await context.route('**/*',route=>{if(!route.request().url().startsWith(base)){remote++;return route.abort();}return route.continue();});
  // Make every navigation list long before course.js runs, on real pages.
  await context.route('**/*.html*',async route=>{
   const response=await route.fetch();let html=await response.text();
   const items=Array.from({length:35},(_,i)=>`<li><a href="${base}reference/resource-learning-center.html#resource-${i}">长目录测试 ${i}</a></li>`).join('');
   html=html.replace(/(<ol class="course-list">)/,'$1'+items);
   await route.fulfill({response,body:html});
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const lesson='lessons/0001-llm-to-agent-api-call.html';
  await page.goto(base+lesson);
  await page.locator('.sidebar-scroll').evaluate(el=>{el.scrollTop=450;el.dispatchEvent(new Event('scroll'));});
  const before=await page.locator('.sidebar-scroll').evaluate(el=>el.scrollTop);
  assert(before>400);
  await page.goto(base+'lessons/0003-safe-tool-contract.html');
  const savedAnchor=await page.evaluate(()=>JSON.parse(sessionStorage.getItem(Object.keys(sessionStorage).find(key=>key.startsWith('course-nav-scroll:')&&key.endsWith(':reader')))));
  const anchorOffset=await page.locator('.sidebar-scroll').evaluate((el,href)=>{const a=[...el.querySelectorAll('.course-list a')].find(a=>a.href===href);return a.getBoundingClientRect().top-el.getBoundingClientRect().top;},savedAnchor.anchor);
  assert(Math.abs(anchorOffset-savedAnchor.offset)<3,'visible course link position survives different TOC lengths');
  await page.reload();
  assert(await page.locator('.sidebar-scroll').evaluate(el=>el.scrollTop>0),'reload restores');
  await page.locator('.course-settings-nav a').click();
  const back=page.locator('.sidebar-settings-return');
  assert((await back.getAttribute('href')).includes('0003-safe-tool-contract.html'));
  assert((await back.innerText()).includes('工具'));
  const positions=await page.evaluate(()=>{const r=s=>document.querySelector(s).getBoundingClientRect().toJSON();return {back:r('.sidebar-settings-return'),collapse:r('.sidebar-collapse')};});
  assert(positions.back.left>=positions.collapse.right,'return button is right of collapse');
  assert(Math.abs(positions.back.top-positions.collapse.top)<5,'header buttons align');
  await page.screenshot({path:path.join(output,'settings-light.png')});
  await back.click();
  assert(page.url().includes('0003-safe-tool-contract.html'));
  assert(await page.locator('.sidebar-scroll').evaluate(el=>el.scrollTop>0),'settings did not overwrite reader scroll');
  await page.goto(base+'settings.html?lesson=0001-llm-to-agent-api-call');
  assert((await back.getAttribute('href')).endsWith('0001-llm-to-agent-api-call.html#lesson-tutor'),'explicit tutor return');
  await back.click();assert(await page.locator('dialog').evaluate(el=>el.open),'return reopens tutor');
  await page.keyboard.press('Escape');
  for(const visual of ['studio','systems','reading','field']) {
   await page.evaluate(value=>document.documentElement.dataset.visualTheme=value,visual);
   const appearances=[];
   for(const theme of ['light','dark']) {
    await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
    appearances.push(await page.locator('#course-sidebar').evaluate(el=>({background:getComputedStyle(el).backgroundImage, text:getComputedStyle(el.querySelector('.course-title, .site-brand, .course-list a')).color})));
   }
   assert.notEqual(appearances[0].background,appearances[1].background,visual+' sidebar background follows theme');
   assert.notEqual(appearances[0].text,appearances[1].text,visual+' sidebar text follows theme');
   await page.evaluate(()=>document.documentElement.dataset.theme='auto');
   await page.emulateMedia({colorScheme:'light'});const light=await page.locator('#course-sidebar').evaluate(el=>getComputedStyle(el).backgroundImage);
   await page.emulateMedia({colorScheme:'dark'});const dark=await page.locator('#course-sidebar').evaluate(el=>getComputedStyle(el).backgroundImage);
   assert.notEqual(light,dark,visual+' auto follows system');
  }
  await page.evaluate(()=>{document.documentElement.dataset.visualTheme='systems';document.documentElement.dataset.theme='dark';});
  await page.goto(base+'settings.html');
  await page.evaluate(()=>document.documentElement.dataset.theme='dark');
  await page.screenshot({path:path.join(output,'settings-dark.png')});
  for(const width of [390,320]) {
   await page.setViewportSize({width,height:844});await page.locator('.nav-toggle').click();
   const rect=await back.boundingBox();assert(rect.x>=0&&rect.x+rect.width<=width,'mobile return fits');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.locator('.sidebar-close').click();
  }
  const fresh=await context.newPage();await fresh.goto(base+'settings.html');
  assert((await fresh.locator('.sidebar-settings-return').getAttribute('href')).endsWith('index.html'),'fresh tab falls back to home');
  await fresh.evaluate(()=>{const key='course-return:competition-demo-rc12:/';sessionStorage.setItem(key,JSON.stringify({href:'https://example.com/private',title:'External'}));});
  await fresh.reload();
  assert((await fresh.locator('.sidebar-settings-return').getAttribute('href')).endsWith('index.html'),'foreign return destination rejected');
  await context.addInitScript(()=>Object.defineProperty(window,'sessionStorage',{get(){throw Error('blocked');}}));
  const blocked=await context.newPage();await blocked.goto(base+'settings.html');
  assert((await blocked.locator('.sidebar-settings-return').getAttribute('href')).endsWith('index.html'));
  const fileContext=await browser.newContext({viewport:{width:1280,height:600},reducedMotion:'reduce'});
  const filePage=await fileContext.newPage();filePage.on('pageerror',e=>errors.push(e.message));
  await filePage.goto(pathToFileURL(path.join(root,lesson)).href);
  await filePage.locator('.course-settings-nav a').click();
  assert((await filePage.locator('.sidebar-settings-return').getAttribute('href')).includes('0001-llm-to-agent-api-call.html'),'file mode retains source lesson');
  await fileContext.close();
  assert.deepEqual(errors,[]);assert.equal(remote,0);
  const report={passed:true,checks:['cross-lesson-scroll-anchor','reload','settings-scroll-isolation','named-quick-return','explicit-tutor-return','four-visual-themes-light-dark-auto','390-320px','fresh-tab-home','foreign-return-rejected','blocked-session-storage','file-mode-return'],external_requests:remote,page_errors:errors};
  await fs.writeFile(path.join(output,'checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
