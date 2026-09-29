const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const script = fs.readFileSync(path.resolve(__dirname, '../teach-pro/assets/course.js'), 'utf8');

function makeElement() {
  const listeners = new Map();
  const attributes = new Map();
  const element = {
    isConnected: false,
    className: '',
    dataset: {},
    children: [],
    textContent: '',
    open: false,
    appendChild(child) {
      if (child.parentNode) child.parentNode.children.splice(child.parentNode.children.indexOf(child), 1);
      child.parentNode = this;
      child.isConnected = true;
      this.children.push(child);
    },
    prepend(child) { this.appendChild(child); this.children.unshift(this.children.pop()); },
    contains(child) { return child === this || this.children.some((node) => node.contains(child)); },
    focus() { this.focused = true; },
    setAttribute(key, value) { attributes.set(key, value); },
    getAttribute(key) { return attributes.get(key); },
    addEventListener(key, listener) { listeners.set(key, listener); },
    fire(type, event = {}) { listeners.get(type)?.(event); },
    click() { this.fire('click'); },
  };
  element.classList = {
    contains(name) { return element.className.split(' ').includes(name); },
    add(name) { if (!this.contains(name)) element.className += ' ' + name; },
  };
  return element;
}

function loadPage(backingStore, courseKey = 'course-a', storageBlocked = false) {
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
  const sidebar = makeElement();
  const navigation = makeElement();
  const brand = makeElement();
  sidebar.appendChild(navigation);
  sidebar.appendChild(brand);
  sidebar.querySelector = (selector) => sidebar.children.find((child) => child.classList.contains(selector.slice(1))) || null;
  const documentListeners = new Map();
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
    addEventListener(type, listener) { documentListeners.set(type, listener); },
  };
  const window = {};
  Object.defineProperty(window, 'localStorage', { get() { if (storageBlocked) throw new Error('blocked'); return storage; } });
  vm.runInNewContext(script, {
    document,
    window,
    location: { pathname: '/index.html' },
    setTimeout() {},
    decodeURIComponent,
  });
  const control = sidebar.querySelector('.theme-control');
  return { root, shell, sidebar, navigation, brand, control,
    collapseButton: sidebar.querySelector('.sidebar-collapse'),
    current: control.children[0], options: control.children[1].children,
    clickOutside(target = makeElement()) { documentListeners.get('click')?.({ target }); },
  };
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

test('theme card is separate from navigation scroll and preserves original navigation', () => {
  const page = loadPage(new Map());
  assert.equal(page.sidebar.classList.contains('has-theme-control'), true);
  assert.deepEqual(page.sidebar.children.map((node) => node.className.trim()), ['sidebar-collapse', 'sidebar-scroll', 'theme-control']);
  assert.equal(page.sidebar.children[1].children[0], page.navigation);
  assert.equal(page.sidebar.children[1].children[1], page.brand);
});

test('theme choices update label, pressed state and storage then restore on another page', () => {
  const values = new Map();
  const page = loadPage(values);
  page.control.open = true;
  page.options[2].click();
  assert.equal(page.root.dataset.theme, 'dark');
  assert.equal(page.root.dataset.visualTheme, 'reading');
  assert.equal(page.current.children[1].textContent, '深色');
  assert.equal(page.options[2].getAttribute('aria-pressed'), 'true');
  assert.equal(page.options[0].getAttribute('aria-pressed'), 'false');
  assert.equal(page.control.open, false);
  assert.equal(page.current.focused, true);
  assert.equal(values.get('course-theme'), 'dark');
  const restored = loadPage(values);
  assert.equal(restored.options[2].getAttribute('aria-pressed'), 'true');
  restored.options[0].click();
  assert.equal(values.get('course-theme'), 'auto');
});

test('Escape closes theme popup with focus return; outside click closes, inside click does not', () => {
  const page = loadPage(new Map());
  page.control.open = true;
  page.clickOutside(page.options[0]);
  assert.equal(page.control.open, true);
  let prevented = false, stopped = false;
  page.control.fire('keydown', {key: 'Escape', preventDefault() { prevented = true; }, stopPropagation() { stopped = true; }});
  assert.equal(page.control.open, false);
  assert.equal(page.current.focused, true);
  assert.equal(prevented && stopped, true);
  page.control.open = true;
  page.clickOutside();
  assert.equal(page.control.open, false);
});

test('invalid saved themes fall back; blocked browser storage does not prevent switching', () => {
  const invalid = loadPage(new Map([['course-theme', 'not-a-theme']]));
  assert.equal(invalid.root.dataset.theme, 'auto');
  assert.equal(invalid.options[0].getAttribute('aria-pressed'), 'true');
  const blocked = loadPage(new Map(), 'course-a', true);
  blocked.options[1].click();
  assert.equal(blocked.root.dataset.theme, 'light');
});
