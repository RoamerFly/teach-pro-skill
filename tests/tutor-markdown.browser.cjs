const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
test('local Markdown renders semantic blocks without executing provider HTML', async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<main id="answer"></main>');
    const assets = path.resolve(__dirname, '../teach-pro/assets');
    await page.addScriptTag({ path: path.join(assets, 'vendor/marked.umd.js') });
    await page.addScriptTag({ path: path.join(assets, 'vendor/purify.min.js') });
    // Use a URL so the module can resolve its own local dependencies.
    await page.route('http://render.test/tutor-markdown.js', route => route.fulfill({ path: path.join(assets, 'tutor-markdown.js'), contentType: 'application/javascript' }));
    await page.addScriptTag({ url: 'http://render.test/tutor-markdown.js' });
    const markdown = '# 讲解\n\n**重要**与`#原样`。\n\n- 第一项\n  - 子项\n\n> 引用\n\n```python\n# keep * literally\nprint("好")\n```\n\n|动作|授权|\n|---|---|\n|模型|运行时|\n\n[官方](https://example.com) [攻击](javascript:alert(1))\n\n![图](https://remote.test/image.png)\n\n<img src=x onerror="window.injected=1"><script>window.injected=1</script>';
    await page.evaluate(text => window.TutorMarkdown.render(document.querySelector('#answer'), text), markdown);
    assert.equal(await page.locator('#answer h1').count(), 0);
    assert.equal(await page.locator('#answer h3').textContent(), '讲解');
    assert.equal(await page.locator('#answer strong').textContent(), '重要');
    assert.equal(await page.locator('.tutor-code-block pre').textContent(), '# keep * literally\nprint("好")\n');
    assert.equal(await page.locator('.tutor-table-wrap table').count(), 1);
    assert.equal(await page.locator('#answer img, #answer script, #answer [onerror], #answer a[href^="javascript:"]').count(), 0);
    assert.equal(await page.evaluate(() => window.injected), undefined);
    assert.equal(await page.locator('#answer a[href="https://example.com"]').getAttribute('rel'), 'noopener noreferrer');
    await page.evaluate(() => window.TutorMarkdown.render(document.querySelector('#answer'), '```python\n# unfinished'));
    assert.ok((await page.locator('#answer code').textContent()).includes('# unfinished'));
  } finally { await browser.close(); }
});
