// Optional visual regression: requires Playwright and a browser, not a course runtime.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

async function main() {
  const course = path.resolve(process.argv[2] || 'example/ai-agent-security-intelligence');
  const output = process.argv[3] ? path.resolve(process.argv[3]) : null;
  if (output) fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true,
    ...(process.env.TEACH_PRO_BROWSER ? { executablePath: process.env.TEACH_PRO_BROWSER } : {}),
  });
  const errors = [], remote = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce', colorScheme: 'light' });
    await context.route('**/*', (route) => {
      const protocol = new URL(route.request().url()).protocol;
      if (protocol === 'http:' || protocol === 'https:') {
        remote.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    const go = (relative) => page.goto(pathToFileURL(path.join(course, relative)).href);
    const control = page.locator('.theme-control');
    const current = page.locator('.theme-current');
    const select = async (value) => {
      if ((await control.getAttribute('open')) === null) await current.click();
      await page.locator(`[data-theme-value="${value}"]`).click();
      assert.equal(await control.getAttribute('open'), null);
      assert.equal(await page.locator('html').getAttribute('data-theme'), value);
    };
    const geometry = () => page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect().toJSON();
      return { sidebar: rect('#course-sidebar'), card: rect('.theme-control'),
        popup: rect('.theme-options'), summary: rect('.theme-current'), viewport: innerHeight };
    });
    const verifyFooter = async () => {
      const { sidebar, card, viewport } = await geometry();
      assert(Math.abs(sidebar.bottom - viewport) < 2, 'sidebar reaches viewport bottom');
      assert(sidebar.bottom - card.bottom >= 0 && sidebar.bottom - card.bottom <= 24, 'theme card stays in footer');
    };
    const shot = async (name) => {
      if (output) await page.locator('#course-sidebar').screenshot({ path: path.join(output, name + '.png'), animations: 'disabled' });
    };
    await go('index.html');
    assert.equal(await control.count(), 1);
    assert.equal(await page.locator('select.theme-control').count(), 0);
    await verifyFooter();
    const closed = await geometry();
    await current.focus(); await page.keyboard.press('Enter');
    const opened = await geometry();
    assert(opened.popup.bottom < opened.card.top && opened.popup.top >= 0, 'popup opens upward within viewport');
    assert(Math.abs(closed.card.y - opened.card.y) < 1, 'opening does not move card');
    assert(opened.summary.left >= opened.card.left && opened.summary.right <= opened.card.right, 'summary fits rounded card');
    await shot('systems-light');
    await page.keyboard.press('Escape');
    assert.equal(await control.getAttribute('open'), null);
    assert(await current.evaluate((el) => el === document.activeElement));
    await current.click(); await page.locator('#main-content h1').click();
    assert.equal(await control.getAttribute('open'), null);

    const scroll = page.locator('.sidebar-scroll');
    const beforeLong = (await geometry()).card.y;
    await scroll.evaluate((el) => {
      const list = document.createElement('div'); list.className = 'synthetic-long-navigation';
      for (let i = 0; i < 60; i++) {
        const link = document.createElement('a'); link.href = '#main-content'; link.textContent = `测试目录 ${i + 1}`;
        const row = document.createElement('p'); row.append(link); list.append(row);
      }
      el.append(list); el.scrollTop = el.scrollHeight;
    });
    assert(Math.abs((await geometry()).card.y - beforeLong) < 1, 'long navigation does not push footer off screen');
    assert(await scroll.evaluate((el) => el.scrollTop > 0 && el.scrollHeight > el.clientHeight));
    await verifyFooter();
    await current.click(); await select('dark'); await current.click();
    await shot('systems-dark-long-navigation');
    const dark = await control.evaluate((el) => getComputedStyle(el).backgroundColor);
    const selectedDark = await page.locator('[data-theme-value="dark"]').evaluate((el) => ({ background: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
    assert.equal(await page.locator('[data-theme-value="dark"]').getAttribute('aria-pressed'), 'true');
    await select('light'); await current.click();
    const light = await control.evaluate((el) => getComputedStyle(el).backgroundColor);
    const selectedLight = await page.locator('[data-theme-value="light"]').evaluate((el) => ({ background: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
    assert.notEqual(dark, light, 'card colors respond to light/dark');
    assert.notDeepEqual(selectedDark, selectedLight, 'selected button colors respond to light/dark');
    await select('dark'); await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await page.locator('.theme-current-label').innerText(), '深色');
    assert.equal(await page.locator('html').getAttribute('data-visual-theme'), 'systems');

    for (const theme of ['reading', 'field', 'systems']) {
      await page.evaluate((value) => document.documentElement.dataset.visualTheme = value, theme);
      await current.click(); await shot(theme + '-dark'); await select('auto');
      await page.emulateMedia({ colorScheme: 'light' });
      const autoLight = await control.evaluate((el) => getComputedStyle(el).backgroundColor);
      await page.emulateMedia({ colorScheme: 'dark' });
      const autoDark = await control.evaluate((el) => getComputedStyle(el).backgroundColor);
      assert.notEqual(autoLight, autoDark, 'automatic theme follows OS');
      assert.equal(await page.locator('html').getAttribute('data-visual-theme'), theme);
      await select('dark');
    }
    await page.locator('.sidebar-collapse').click();
    assert.equal(await control.isVisible(), false);
    await page.locator('.sidebar-collapse').click(); await verifyFooter();
    await go('practice/entry-assessment.html'); await verifyFooter();
    assert.equal(await control.count(), 1);
    await go('settings.html'); await verifyFooter();
    assert.equal(await control.count(), 1);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.nav-toggle').click(); await verifyFooter();
    assert.equal(await page.locator('.nav-toggle').isVisible(), false, 'floating button does not cover theme footer');
    assert.equal(await page.locator('.sidebar-close').isVisible(), true);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await current.click();
    let mobile = await geometry();
    assert(mobile.popup.left >= 0 && mobile.popup.right <= 390 && mobile.popup.top >= 0);
    await shot('mobile-dark');
    await page.keyboard.press('Escape');
    assert.equal(await control.getAttribute('open'), null);
    assert.equal(await page.locator('.nav-toggle').getAttribute('aria-expanded'), 'true', 'Escape closes popup before drawer');
    await page.locator('.sidebar-close').click();
    assert.equal(await page.locator('.nav-toggle').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('.nav-toggle').isVisible(), true);
    await page.locator('.nav-toggle').click();
    await page.setViewportSize({ width: 900, height: 480 });
    await verifyFooter(); await current.click();
    assert((await geometry()).popup.top >= 0, 'short landscape viewport');
    await page.emulateMedia({ media: 'print' });
    assert.equal(await control.isVisible(), false);
    assert.deepEqual(errors, []);
    assert.deepEqual(remote, []);
    console.log(JSON.stringify({ passed: true, course, checks: ['footer-short-and-long-nav', 'upward-popup', 'keyboard-and-focus', 'light-dark-auto', 'visual-theme-palette', 'restore', 'collapse', 'assessment-and-settings', 'mobile-and-landscape', 'print', 'no-remote-requests', 'no-page-errors'], screenshots: output }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
