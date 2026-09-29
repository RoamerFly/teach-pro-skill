const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const script = fs.readFileSync(path.resolve(__dirname, '../teach-pro/assets/course.js'), 'utf8');

function makeElement() {
  const listeners = new Map();
  const attributes = new Map();
  return {
    isConnected: false,
    textContent: '',
    setAttribute(key, value) { attributes.set(key, value); },
    getAttribute(key) { return attributes.get(key); },
    addEventListener(key, listener) { listeners.set(key, listener); },
    click() { listeners.get('click')?.(); },
  };
}

function loadPage(backingStore, courseKey = 'course-a') {
  const root = { dataset: { theme: 'auto', visualTheme: 'reading' } };
  const classes = new Set();
  const shell = {
    classList: {
      contains(name) { return classes.has(name); },
      toggle(name, enabled) {
        const next = enabled === undefined ? !classes.has(name) : enabled;
        if (next) classes.add(name); else classes.delete(name);
        return next;
      },
    },
  };
  let collapseButton;
  let themeControl;
  const sidebar = {
    querySelector(selector) {
      if (selector === '.sidebar-collapse') return collapseButton;
      if (selector === '.theme-control') return themeControl;
      return null;
    },
    prepend(element) { collapseButton = element; element.isConnected = true; },
    appendChild(element) { themeControl = element; element.isConnected = true; },
    addEventListener() {},
  };
  const storage = {
    getItem(key) { return backingStore.get(key) ?? null; },
    setItem(key, value) { backingStore.set(key, value); },
  };
  const document = {
    documentElement: root,
    body: { dataset: { courseKey } },
    getElementById(key) { return key === 'course-sidebar' ? sidebar : null; },
    querySelector(key) { return key === '.page-shell' ? shell : null; },
    querySelectorAll() { return []; },
    createElement() { return makeElement(); },
    addEventListener() {},
  };
  vm.runInNewContext(script, {
    document,
    window: { localStorage: storage },
    location: { pathname: '/index.html' },
    setTimeout() {},
    decodeURIComponent,
  });
  return { root, shell, collapseButton };
}

test('desktop navigation collapses, restores and stays scoped to one course', () => {
  const values = new Map();
  const first = loadPage(values);
  assert.equal(first.collapseButton.getAttribute('aria-expanded'), 'true');
  first.collapseButton.click();
  assert.equal(first.shell.classList.contains('is-sidebar-collapsed'), true);
  assert.equal(first.collapseButton.getAttribute('aria-label'), '展开左侧导航');
  assert.equal(values.get('course-sidebar-collapsed:course-a'), '1');

  const reopened = loadPage(values);
  assert.equal(reopened.shell.classList.contains('is-sidebar-collapsed'), true);
  reopened.collapseButton.click();
  assert.equal(reopened.shell.classList.contains('is-sidebar-collapsed'), false);
  assert.equal(values.get('course-sidebar-collapsed:course-a'), '0');
  assert.equal(loadPage(values, 'course-b').shell.classList.contains('is-sidebar-collapsed'), false);
});

test('reader light/dark choice does not replace the course visual theme', () => {
  const page = loadPage(new Map([['course-theme', 'dark']]));
  assert.equal(page.root.dataset.theme, 'dark');
  assert.equal(page.root.dataset.visualTheme, 'reading');
});
