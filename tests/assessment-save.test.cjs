const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const asset = (name) => fs.readFileSync(path.resolve(__dirname, '../teach-pro/assets', name), 'utf8');

function fixture(initial = new Map()) {
  const listeners = new Map();
  const on = (target, event, callback) => {
    const key = `${target}:${event}`;
    listeners.set(key, [...(listeners.get(key) || []), callback]);
  };
  const emit = (target, event) => (listeners.get(`${target}:${event}`) || []).forEach((callback) => callback());
  const choices = [
    { value: 'a', checked: false, dataset: { correct: 'true' } },
    { value: 'b', checked: false, dataset: {} },
  ];
  const feedback = {};
  const group = {
    dataset: { saveKey: 'entry-q3', correctAnswer: 'A' },
    matches: (selector) => selector === '[data-quiz]',
    querySelector: (selector) => {
      if (selector === '[data-quiz-submit]') return submit;
      if (selector === '[data-quiz-feedback]') return feedback;
      if (selector === 'input[type="radio"]:checked') return choices.find((choice) => choice.checked) || null;
      return null;
    },
    querySelectorAll: (selector) => selector === 'input[type="radio"]' ? choices : [],
    addEventListener: (event, callback) => on('group', event, callback),
  };
  const submit = { addEventListener: (event, callback) => on('submit', event, callback) };
  const clear = { addEventListener: (event, callback) => on('clear', event, callback) };
  const saveStatus = { textContent: '', parentNode: { appendChild() {} } };
  const document = {
    documentElement: { dataset: { theme: 'auto' } },
    body: { dataset: { courseKey: 'transformer-attention' } },
    getElementById: () => null,
    querySelector: (selector) => selector === '[data-save-status]' ? saveStatus : null,
    querySelectorAll: (selector) => ({
      pre: [], '[data-toc] a[href^="#"]': [], '[data-quiz]': [group],
      '[data-save-key]': [group], '[data-save-clear]': [clear], '[data-save-export]': [],
    })[selector] || [],
    createElement: () => ({ setAttribute() {}, dataset: {} }),
  };
  const storage = {
    getItem: (key) => initial.get(key) ?? null,
    setItem: (key, value) => initial.set(key, value),
    removeItem: (key) => initial.delete(key),
  };
  return { choices, document, emit, group, saveStatus, storage, values: initial };
}

test('choice answer saves, restores, and clears in browser storage', () => {
  const page = fixture();
  vm.runInNewContext(asset('course.js'), {
    document: page.document,
    window: { localStorage: page.storage },
    location: { pathname: '/practice/entry-assessment.html' },
    setTimeout() {},
  });
  page.choices[1].checked = true;
  page.emit('group', 'change');
  assert.equal(page.values.get('transformer-attention:entry-q3'), 'b');

  const reopened = fixture(page.values);
  vm.runInNewContext(asset('course.js'), {
    document: reopened.document,
    window: { localStorage: reopened.storage },
    location: { pathname: '/practice/entry-assessment.html' },
    setTimeout() {},
  });
  assert.equal(reopened.choices[1].checked, true);
  reopened.emit('clear', 'click');
  assert.equal(reopened.choices.some((choice) => choice.checked), false);
  assert.equal(page.values.has('transformer-attention:entry-q3'), false);
});

test('choice answer from course directory restores and syncs after change', async () => {
  const page = fixture();
  const posts = [];
  const fetch = async (_url, options) => {
    if (!options || !options.method) return {
      ok: true,
      json: async () => ({ saved_at: '2026-09-28T00:00:00Z', fields: { 'entry-q3': 'a' } }),
    };
    posts.push(JSON.parse(options.body));
    return { ok: true };
  };
  vm.runInNewContext(asset('sync.js'), {
    document: page.document,
    window: { localStorage: page.storage, addEventListener() {} },
    location: { pathname: '/practice/entry-assessment.html', protocol: 'http:', hostname: '127.0.0.1' },
    fetch,
    setTimeout: (callback) => { callback(); return 1; },
    clearTimeout() {},
  });
  await new Promise(setImmediate);
  assert.equal(page.choices[0].checked, true);
  page.choices[0].checked = false;
  page.choices[1].checked = true;
  page.emit('group', 'change');
  await new Promise(setImmediate);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].fields['entry-q3'], 'b');
});
