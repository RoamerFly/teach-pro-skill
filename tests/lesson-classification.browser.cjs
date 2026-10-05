/* Isolated template rendering: no learner workspace, provider calls or credentials. */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const repo = path.resolve(__dirname, '..');
const qa = process.env.CLASSIFICATION_QA_DIR || path.resolve(repo, '../competition-work/2026-10-05-classification-qa');

test('formal and supplementary templates have distinct labels, links and persisted fields', {timeout:60000}, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teach-classification-'));
  fs.mkdirSync(path.join(root, 'lessons'));
  fs.mkdirSync(qa, {recursive:true});
  fs.cpSync(path.join(repo, 'teach-pro/assets'), path.join(root, 'assets'), {recursive:true});
  fs.writeFileSync(path.join(root, 'settings.html'), '<main><h1>Settings fixture</h1></main>');
  const source = fs.readFileSync(path.join(repo, 'teach-pro/templates/lesson.html'), 'utf8');
  const home = fs.readFileSync(path.join(repo, 'teach-pro/templates/course-index.html'), 'utf8');
  const navigation = '<li><a href="./0001-basics.html">第 1 课 · 基础</a><ul class="lesson-supplements"><li><a href="./0001-s01-review.html">补充 · 检查位置</a></li></ul></li><li><a href="./0002-new-goal.html">第 2 课 · 新目标</a></li>';
  const base = {COURSE_TITLE:'分类测试课程', COURSE_SLUG:'classification-fixture', COURSE_PHASE:'基础阶段',
    LESSON_DESCRIPTION:'围绕本页目标学习与练习', ESTIMATED_TIME:'20 分钟', PROGRESS_LABEL:'正式课主线：第 2 课已交付',
    COURSE_NAVIGATION:navigation, LESSON_CONTENT_HTML:'<section id="concept"><h2>核心概念</h2><p>合成教学内容。</p></section>'};
  const render = (template, values) => template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => values[key] || '');
  const pages = [
    ['0001-basics', '0001', 'formal', '', '第 1 课', '基础'],
    ['0001-s01-review', '0001-s01', 'supplement', '0001', '第 1 课补充', '检查位置'],
    ['0002-new-goal', '0002', 'formal', '', '第 2 课', '新目标'],
  ];
  for (const [slug, id, kind, parent, label, title] of pages) {
    fs.writeFileSync(path.join(root, `lessons/${slug}.html`), render(source, {...base, LESSON_NUMBER:id,
      LESSON_KIND:kind, RELATED_LESSON_NUMBER:parent, LESSON_LABEL:label, LESSON_KIND_LABEL:kind==='supplement'?'补充课':'正式课', LESSON_TITLE:title}));
  }
  const cards = '<section data-course-section="formal"><h3>正式课</h3><div class="lesson-grid"><a href="lessons/0001-basics.html">第 1 课 · 基础</a><a href="lessons/0002-new-goal.html">第 2 课 · 新目标</a></div></section><section data-course-section="supplement"><h3>补充课</h3><div class="lesson-grid"><a href="lessons/0001-s01-review.html">第 1 课补充 · 检查位置</a></div></section>';
  fs.writeFileSync(path.join(root, 'index.html'), render(home, {...base, COURSE_NAVIGATION:navigation.replaceAll('href="./000', 'href="./lessons/000'), GENERATED_LESSON_CARDS:cards}));
  const browser = await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:true});
  const errors = [], network = [];
  try {
    const context = await browser.newContext({viewport:{width:1440,height:900}, reducedMotion:'reduce'});
    await context.route(/^https?:/, route => {network.push(route.request().url()); return route.abort();});
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    assert.equal(await page.locator('[data-course-section="formal"] a').count(), 2);
    assert.equal(await page.locator('[data-course-section="supplement"] a').count(), 1);
    assert.equal(await page.locator('.lesson-grid .lesson-grid').count(), 0);
    await page.locator('[data-course-section="supplement"] a').click();
    await page.locator('.tutor-open:not(:disabled)').waitFor();
    assert.equal(await page.locator('h1').textContent(), '第 1 课补充 · 检查位置');
    assert.equal(await page.locator('.lesson-kind-label').textContent(), '补充课');
    await page.locator('#lesson-evidence').fill('Synthetic supplementary work');
    await page.waitForFunction(() => [...Array(localStorage.length)].some((_,i)=>localStorage.getItem(localStorage.key(i)).includes('Synthetic supplementary work')));
    await page.locator('.tutor-open').click();
    assert.equal(await page.locator('#tutor-dialog').evaluate(e=>e.open), true);
    assert.equal(await page.locator('.tutor-eyebrow').textContent(), '第 1 课补充 · 检查位置');
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.scrollTo(0,0));
    await page.screenshot({path:path.join(qa,'supplement-light.png')});
    await page.evaluate(() => document.documentElement.dataset.theme='dark');
    await page.screenshot({path:path.join(qa,'supplement-dark.png')});
    for (const width of [390,320]) {
      await page.setViewportSize({width,height:844});
      await page.waitForTimeout(300);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.screenshot({path:path.join(qa,`supplement-${width}px.png`)});
    }
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('h1').textContent(), '第 1 课补充 · 检查位置');
    await page.emulateMedia({media:'screen'});
    await page.setViewportSize({width:1440,height:900});
    await page.goto(pathToFileURL(path.join(root, 'lessons/0002-new-goal.html')).href);
    assert.equal(await page.locator('h1').textContent(), '第 2 课 · 新目标');
    assert.equal(await page.locator('.lesson-kind-label').textContent(), '正式课');
    assert.equal(await page.locator('#lesson-evidence').inputValue(), '');
    await page.locator('#lesson-evidence').fill('Synthetic formal work');
    await page.waitForFunction(() => [...Array(localStorage.length)].some((_,i)=>localStorage.getItem(localStorage.key(i)).includes('Synthetic formal work')));
    await page.goto(pathToFileURL(path.join(root, 'lessons/0001-s01-review.html')).href);
    assert.equal(await page.locator('#lesson-evidence').inputValue(), 'Synthetic supplementary work');
    assert.equal(await page.locator('[data-save-key="lesson-0001-s01-evidence"]').count(), 1);
    assert.equal(await page.locator('.lesson-supplements a').getAttribute('href'), './0001-s01-review.html');
    const noJs = await browser.newContext({javaScriptEnabled:false});
    const staticPage = await noJs.newPage();
    await staticPage.goto(pathToFileURL(path.join(root, 'lessons/0001-s01-review.html')).href);
    assert.equal(await staticPage.locator('h1').textContent(), '第 1 课补充 · 检查位置');
    assert.equal(await staticPage.locator('.lesson-kind-label').textContent(), '补充课');
    assert.deepEqual(errors, []);
    assert.deepEqual(network, []);
    fs.writeFileSync(path.join(qa,'summary.json'), JSON.stringify({fixture:root, errors, network, cases:['home-groups','navigation','formal-title','supplement-title','modal-title','save-restore-isolation','320px','390px','themes','print','no-js']},null,2));
  } finally {await browser.close();}
});
