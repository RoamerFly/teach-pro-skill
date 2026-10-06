/* Layout regression for stage numbers and long labels. Local HTML/CSS only. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const repo = path.resolve(__dirname, '..');
const qa = path.resolve(process.env.ROADMAP_QA_DIR || '../competition-work/roadmap-layout-qa');
const baseline = process.env.ROADMAP_BASELINE === '1';
const course = process.env.ROADMAP_COURSE_ROOT;

function contrast(a, b) {
 const lum = color => color.match(/[\d.]+/g).slice(0,3).map(x=>Number(x)/255)
  .map(x=>x<=.04045 ? x/12.92 : ((x+.055)/1.055)**2.4)
  .reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
 const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}

(async()=>{
 fs.mkdirSync(qa,{recursive:true});
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'teach-roadmap-'));
 fs.mkdirSync(path.join(root,'assets'));
 const source=course || path.join(repo,'teach-pro');
 fs.copyFileSync(path.join(source,'assets/style.css'),path.join(root,'assets/style.css'));
 const cards=[
  '<span class="phase-number">01</span><h3>描述统计与数据直觉</h3><p>集中趋势、离散程度、数据分布与可视化。</p>',
  '<span class="eyebrow">Phase 1 · 当前</span><h3>概率基础</h3><p>概率规则、条件概率与常见分布。</p>',
  '<span>Phase 3 · 推断统计的起点与不确定性</span><h3>推断统计</h3><p>抽样分布、置信区间和假设检验。</p>',
  '<span class="phase-label">阶段四 · 关系分析与回归模型的解释</span><h3>关系分析</h3><p>相关分析、回归与方法边界。</p>',
  `<span class="eyebrow">${'StatisticsLearningStage'.repeat(4)}</span><h3>长英文标签换行</h3><p>无空格标签也不能盖住标题。</p>`
 ].map(x=>'<article class="phase-card">'+x+'</article>').join('');
 const template=fs.readFileSync(path.join(repo,'teach-pro/templates/course-index.html'),'utf8');
 const values={COURSE_TITLE:'校园数据侦探',COURSE_DESCRIPTION:'用统计理解校园调查。',COURSE_SLUG:'roadmap-test',PROGRESS_LABEL:'第 1 阶段',PROGRESS_NOTE:'待作答',ROADMAP_HTML:cards};
 const fixture=template.replace(/\{\{([A-Z_]+)\}\}/g,(_,key)=>values[key]||'');
 const filename=path.join(root,'index.html');
 fs.writeFileSync(filename,course ? fs.readFileSync(path.join(course,'index.html')) : fixture);
 let browser; const errors=[],remote=[],checks=[];
 try {
  browser=await chromium.launch({headless:true,executablePath:process.env.TEACH_PRO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const context=await browser.newContext({reducedMotion:'reduce'});
  await context.route('**/*',route=>{
   const url=route.request().url();
   // Do not run course scripts, read answers, or send any model request.
   if(/^https?:/.test(url)){remote.push(url);return route.abort();}
   if(/\.js(?:\?|$)/.test(url))return route.fulfill({contentType:'text/javascript',body:''});
   return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(filename).href);
  const measure=()=>page.evaluate(()=>{
   const rows=[...document.querySelectorAll('.phase-card')].map(card=>{
    const label=card.querySelector(':scope > span'),heading=card.querySelector('h3');
    const box=label.getBoundingClientRect(),h=heading.getBoundingClientRect(),c=card.getBoundingClientRect();
    const range=document.createRange();range.selectNodeContents(label);
    const text=range.getBoundingClientRect(),style=getComputedStyle(label);
    return {label:label.textContent,inside:text.top>=box.top-1 && text.bottom<=box.bottom+1 && text.left>=box.left-1 && text.right<=box.right+1,
     headingClear:h.top>=Math.max(box.bottom,text.bottom)-1,
     cardWidth:box.right<=c.right+1,color:style.color,background:style.backgroundColor};
   });
   return {rows,overflow:document.documentElement.scrollWidth>innerWidth+1};
  });
  const widths=baseline ? [1440] : [1440,1024,768,560,390,320];
  const visuals=baseline ? ['field'] : ['studio','systems','reading','field'];
  for(const visual of visuals)for(const theme of (baseline ? ['light'] : ['light','dark']))for(const width of widths)for(const scale of (baseline ? [1] : [1,2])) {
   await page.setViewportSize({width,height:900});
   await page.evaluate(({visual,theme,scale})=>{document.documentElement.dataset.visualTheme=visual;document.documentElement.dataset.theme=theme;document.documentElement.style.fontSize=16*scale+'px';},{visual,theme,scale});
   const result=await measure();checks.push({visual,theme,width,scale,...result});
   if(!baseline){
    assert(result.rows.length>=5);
    assert(!result.overflow,`page overflow: ${visual}/${theme}/${width}/${scale}`);
    for(const row of result.rows){assert(row.inside && row.headingClear && row.cardWidth,`label overlaps: ${visual}/${theme}/${width}/${scale} ${row.label}`);assert(contrast(row.color,row.background)>=4.5,'label contrast');}
   }
  }
  if(!baseline){
   for(const colorScheme of ['light','dark']){
    await page.setViewportSize({width:390,height:900});await page.emulateMedia({colorScheme});
    await page.evaluate(()=>{document.documentElement.dataset.theme='auto';document.documentElement.style.fontSize='16px';});
    const result=await measure();assert(!result.overflow && result.rows.every(x=>x.inside&&x.headingClear&&x.cardWidth));
    checks.push({visual:'field',theme:'auto',colorScheme,width:390,scale:1,...result});
   }
   await page.emulateMedia({media:'print'});const result=await measure();assert(result.rows.every(x=>x.inside&&x.headingClear&&x.cardWidth));
   checks.push({theme:'print',...result});await page.emulateMedia({media:'screen'});
  }else assert(checks.some(x=>x.rows.some(row=>!row.inside||!row.headingClear)),'baseline must reproduce label overflow');
  for(const [theme,width] of [['light',1440],['dark',1440],['light',390]]){
   await page.setViewportSize({width,height:900});
   await page.evaluate(theme=>{document.documentElement.dataset.visualTheme='field';document.documentElement.dataset.theme=theme;document.documentElement.style.fontSize='16px';},theme);
   await page.locator('#roadmap').screenshot({path:path.join(qa,`${baseline?'before':'after'}-${theme}-${width}.png`)});
  }
  assert.equal(remote.length,0);assert.equal(errors.length,0);
  fs.writeFileSync(path.join(qa,'audit.json'),JSON.stringify({baseline,course:course?path.basename(course):'synthetic-stage-fixture',checks,remoteRequests:remote.length,pageErrors:errors},null,2));
  console.log(`PASS: ${baseline?'reproduced original label overflow':checks.length+' roadmap layout states, labels contained, headings clear, no page overflow'}; external requests 0; page errors 0`);
 }finally{
  if(browser)await browser.close();
  if(path.dirname(path.resolve(root))!==path.resolve(os.tmpdir()) || !path.basename(root).startsWith('teach-roadmap-'))throw new Error('Unexpected cleanup target');
  fs.rmSync(root,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
