/* Theme regression using only public homepage HTML/CSS, never learner records. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const repo = path.resolve(__dirname, '..');
const source = process.env.HERO_COURSE_ROOT || path.join(repo, 'teach-pro');
const qa = path.resolve(process.env.HERO_QA_DIR || '../competition-work/hero-theme-qa');
const baseline = process.env.HERO_BASELINE === '1';
function contrast(a, b) {
 const lum = rgb => rgb.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4)
  .reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
 const x=lum(a),y=lum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
(async()=>{
 fs.mkdirSync(qa,{recursive:true});
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'teach-hero-'));
 let browser;
 try {
  fs.mkdirSync(path.join(root,'assets'));
  fs.copyFileSync(path.join(source,'assets/style.css'),path.join(root,'assets/style.css'));
  const template=fs.readFileSync(path.join(repo,'teach-pro/templates/course-index.html'),'utf8');
  const values={COURSE_TITLE:'统计学备考 · 数据分析师认证与校园数据研究',COURSE_DESCRIPTION:'从数据直觉到统计推断，先理解公式动机，再推导并亲手计算。',COURSE_SLUG:'hero-test',PROGRESS_LABEL:'正式课第 1 课已交付',PROGRESS_NOTE:'你的掌握状态待入门评估与第 1 课作答验证。'};
  const html=process.env.HERO_COURSE_ROOT ? fs.readFileSync(path.join(source,'index.html'),'utf8') : template.replace(/\{\{([A-Z_]+)\}\}/g,(_,key)=>values[key]||'');
  fs.writeFileSync(path.join(root,'index.html'),html);
  browser=await chromium.launch({headless:true,executablePath:process.env.TEACH_PRO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const context=await browser.newContext({reducedMotion:'reduce'});
  const remote=[],errors=[],checks=[];
  await context.route('**/*',route=>{
   const url=route.request().url();
   if(/^https?:/.test(url)){remote.push(url);return route.abort();}
   if(/\.js(?:\?|$)/.test(url))return route.fulfill({contentType:'text/javascript',body:''});
   return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  const measure=()=>page.evaluate(()=>{
   const hero=document.querySelector('.course-hero'),style=getComputedStyle(hero);
   const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
   const ctx=canvas.getContext('2d');
   const rgb=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);};
   const probe=document.createElement('i');hero.append(probe);
   const token=name=>{probe.style.color=`var(${name})`;return rgb(getComputedStyle(probe).color);};
   const backgrounds=['--lesson-hero-start','--surface-2'].map(token);
   probe.remove();
   const h=hero.getBoundingClientRect();
   const selectors=['h1','.lead','.eyebrow','.hero-facts span','.progress-panel span','.progress-panel small'];
   const text=selectors.flatMap(selector=>[...hero.querySelectorAll(selector)].map(el=>{
    const s=getComputedStyle(el),r=el.getBoundingClientRect();
    const panel=el.closest('.progress-panel'),chip=el.matches('.hero-facts span');
    return {selector,color:rgb(s.color),backgrounds:(panel||chip)?[rgb(getComputedStyle(panel||el).backgroundColor)]:backgrounds,
     contained:r.left>=h.left-1&&r.right<=h.right+1&&r.top>=h.top-1&&r.bottom<=h.bottom+1};
   }));
   const title=hero.querySelector(':scope > div').getBoundingClientRect(),progress=hero.querySelector('.progress-panel').getBoundingClientRect();
   return {background:style.backgroundImage,titleColor:getComputedStyle(hero.querySelector('h1')).color,
    pattern:getComputedStyle(hero,'::after').backgroundImage,text,overflow:document.documentElement.scrollWidth>innerWidth+1,
    separated:progress.left>=title.right-1||progress.top>=title.bottom-1};
  });
  const state=async(visual,theme,osTheme,width=1440,scale=1)=>{
   await page.emulateMedia({media:'screen',colorScheme:osTheme});await page.setViewportSize({width,height:900});
   await page.evaluate(({visual,theme,scale})=>{document.documentElement.dataset.visualTheme=visual;document.documentElement.dataset.theme=theme;document.documentElement.style.fontSize=16*scale+'px';},{visual,theme,scale});
   const result=await measure();checks.push({visual,theme,osTheme,width,scale,...result});
   if(!baseline){
    assert(!result.overflow&&result.separated&&result.text.every(x=>x.contained),`layout: ${visual}/${theme}/${width}/${scale}`);
    for(const text of result.text)for(const bg of text.backgrounds)assert(contrast(text.color,bg)>=4.5,`contrast ${visual}/${theme} ${text.selector}: ${contrast(text.color,bg)}`);
   }
   return result;
  };
  for(const visual of ['studio','systems','reading','field']){
   const light=await state(visual,'light','light'),dark=await state(visual,'dark','dark');
   if(baseline)assert.equal(light.background,dark.background,'baseline should reproduce fixed hero gradient');
   else {
    assert.notEqual(light.background,dark.background);assert.notEqual(light.titleColor,dark.titleColor);assert.notEqual(light.pattern,dark.pattern);
    assert.equal((await state(visual,'auto','light')).background,light.background);
    assert.equal((await state(visual,'auto','dark')).background,dark.background);
    assert.equal((await state(visual,'light','dark')).background,light.background);
    assert.equal((await state(visual,'dark','light')).background,dark.background);
    for(const theme of ['light','dark'])for(const width of [1024,768,390,320])for(const scale of [1,2])await state(visual,theme,theme,width,scale);
    await state(visual,'dark','dark');await page.emulateMedia({media:'print'});
    const print=await measure();assert.equal(print.background,'none');assert.equal(print.pattern,'none');
    for(const text of print.text)assert(contrast(text.color,[255,255,255])>=4.5,`print text: ${text.selector}`);
    checks.push({visual,theme:'print',...print});
   }
  }
  const actualVisual=html.match(/data-visual-theme="([^"]+)"/)?.[1]||'studio';
  for(const [theme,width] of [['light',1440],['dark',1440],['light',390]]){
   await state(actualVisual,theme,theme,width);
   await page.locator('.course-hero').screenshot({path:path.join(qa,`${baseline?'before':'after'}-${theme}-${width}.png`)});
  }
  assert.equal(remote.length,0);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(qa,'audit.json'),JSON.stringify({baseline,source:process.env.HERO_COURSE_ROOT?path.basename(source):'template-fixture',checks,remoteRequests:remote.length,pageErrors:errors},null,2));
  console.log(`PASS: ${baseline?'reproduced unchanged light/dark hero':checks.length+' hero appearance/layout states, contrast >=4.5, system and explicit modes, print'}; external requests 0; page errors 0`);
 }finally {
  if(browser)await browser.close();
  if(path.dirname(path.resolve(root))!==path.resolve(os.tmpdir())||!path.basename(root).startsWith('teach-hero-'))throw new Error('Unexpected cleanup target');
  fs.rmSync(root,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
