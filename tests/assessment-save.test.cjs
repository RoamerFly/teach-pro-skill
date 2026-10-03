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
  const feedback = { textContent: '', className: '' };
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
    addEventListener: (event, callback) => on('document', event, callback),
    dispatchEvent: (event) => emit('document', event.type),
  };
  const storage = {
    getItem: (key) => initial.get(key) ?? null,
    setItem: (key, value) => initial.set(key, value),
    removeItem: (key) => initial.delete(key),
  };
  return { choices, document, emit, group, feedback, saveStatus, storage, values: initial };
}

test('choice answer saves, restores, and clears in browser storage', () => {
  const page = fixture();
  vm.runInNewContext(asset('course.js'), {
    document: page.document,
    window: { localStorage: page.storage, confirm: () => true }, CustomEvent,
    location: { pathname: '/practice/entry-assessment.html' },
    setTimeout() {},
  });
  page.choices[1].checked = true;
  page.emit('group', 'change');
  assert.equal(page.values.get('transformer-attention:entry-q3'), 'b');

  const reopened = fixture(page.values);
  vm.runInNewContext(asset('course.js'), {
    document: reopened.document,
    window: { localStorage: reopened.storage, confirm: () => true }, CustomEvent,
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
    return { ok: true, json: async () => ({ ok: true }) };
  };
  vm.runInNewContext(asset('sync.js'), {
    document: page.document,
    window: { localStorage: page.storage, addEventListener() {} },
    location: { pathname: '/practice/entry-assessment.html', protocol: 'http:', hostname: '127.0.0.1' },
    fetch,
    AbortController,
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

test('cancelled clear preserves answers and never emits a clear event', () => {
  const page = fixture(); let cleared = 0;
  page.document.addEventListener('teach:answers-cleared', () => cleared++);
  vm.runInNewContext(asset('course.js'), {
    document: page.document, window: { localStorage: page.storage, confirm: () => false }, CustomEvent,
    location: { pathname: '/practice/entry-assessment.html' }, setTimeout() {},
  });
  page.choices[0].checked = true; page.emit('group', 'change');
  page.emit('submit', 'click'); page.emit('clear', 'click');
  assert.equal(page.choices[0].checked, true);
  assert.equal(page.values.get('transformer-attention:entry-q3'), 'a');
  assert.equal(page.feedback.className, 'quiz-feedback is-visible is-correct');
  assert.equal(cleared, 0);
  page.choices[0].checked = false; page.choices[1].checked = true; page.emit('group', 'change');
  assert.equal(page.feedback.className, 'quiz-feedback'); assert.equal(page.feedback.textContent, '');
});

function syncHarness(fetch, initial = new Map()) {
  const page = fixture(initial), timers = new Map(), events = new Map(); let id = 0;
  const text = (key) => ({ dataset: { saveKey: key }, value: '', matches: () => false,
    addEventListener: (event, callback) => events.set(`${key}:${event}`, callback) });
  const fields = [text('q1'), text('q2')];
  const query = page.document.querySelectorAll;
  page.document.querySelectorAll = (selector) => selector === '[data-save-key]' ? fields : query(selector);
  page.saveStatus.parentNode.appendChild = (node) => { page.syncStatus = node; };
  vm.runInNewContext(asset('sync.js'), {
    document: page.document, window: { localStorage: page.storage, addEventListener: (event, callback) => events.set(event, callback) },
    location: { pathname: '/lessons/0001-intro.html', protocol: 'http:', hostname: '127.0.0.1' }, fetch, AbortController,
    setTimeout: (callback, delay) => { const key = ++id; timers.set(key, { callback, delay }); return key; },
    clearTimeout: (key) => timers.delete(key),
  });
  const settled = () => new Promise(setImmediate);
  const flush = async (delay = 350) => {
    await settled();
    for (let count = 0; count < 100; count++) {
      const next = [...timers].find(([, timer]) => timer.delay <= delay);
      if (!next) return;
      timers.delete(next[0]); next[1].callback(); await settled();
    }
    throw new Error('unbounded timer loop');
  };
  return { ...page, fields, timers, events, flush, settled, status: () => page.syncStatus,
    edit: (index, value) => { fields[index].value = value; events.get(`q${index + 1}:input`)(); } };
}
const reply = (data) => ({ ok: true, json: async () => data });
const saved = { saved_at: '2026-10-01T00:00:00Z', fields: { q1: 'old one', q2: 'valuable old two' } };

test('editing before restore merges untouched fields instead of overwriting them', async () => {
  let resolve; const posts = [];
  const page = syncHarness(async (_url, options) => {
    if (options.method === 'POST') { posts.push(JSON.parse(options.body)); return reply({ ok: true }); }
    return new Promise((done) => { resolve = done; });
  });
  page.edit(0, 'new one'); resolve(reply(saved)); await page.flush();
  assert.deepEqual(posts[0].fields, { q1: 'new one', q2: 'valuable old two' });
  assert.equal(page.fields[1].value, 'valuable old two');
});

test('failed initial restore retries automatically and writes accumulated edits', async () => {
  let reads = 0; const posts = [];
  const page = syncHarness(async (_url, options) => {
    if (options.method === 'POST') { posts.push(JSON.parse(options.body)); return reply({ ok: true }); }
    if (++reads === 1) throw new Error('offline'); return reply(saved);
  });
  await page.settled(); assert.equal(page.status().dataset.state, 'offline');
  page.edit(0, 'new after outage'); await page.flush();
  assert.equal(reads, 2); assert.equal(posts[0].fields.q2, 'valuable old two');
  assert.equal(page.status().dataset.state, 'saved');
});

test('persistent failure has three bounded retries; focus can reconnect afterwards', async () => {
  let reads = 0, failed = true;
  const page = syncHarness(async () => { reads++; if (failed) throw new Error('offline'); return reply(saved); });
  await page.flush(4000); assert.equal(reads, 4); assert.equal(page.timers.size, 0);
  failed = false; page.events.get('focus')(); await page.flush();
  assert.equal(reads, 5); assert.equal(page.status().dataset.state, 'saved');
});

test('initial restore reconnects automatically even without another input event', async () => {
  let reads = 0;
  const page = syncHarness(async () => { if (++reads === 1) throw new Error('offline'); return reply(saved); });
  await page.flush(4000); assert.equal(reads, 2); assert.equal(page.fields[1].value, 'valuable old two');
  assert.equal(page.status().dataset.state, 'saved');
});

test('write failure rereads the file and retries the latest edit without erasing untouched fields', async () => {
  const posts = []; let reads = 0;
  const page = syncHarness(async (_url, options) => {
    if (options.method !== 'POST') { reads++; return reply(saved); }
    posts.push(JSON.parse(options.body)); if (posts.length === 1) throw new Error('write failed'); return reply({ ok: true });
  });
  await page.settled(); page.edit(0, 'retry me'); await page.flush();
  assert.equal(page.status().dataset.state, 'offline'); await page.flush(4000);
  assert.equal(reads, 2); assert.equal(posts.length, 2); assert.equal(posts[1].fields.q2, 'valuable old two');
  assert.equal(page.status().dataset.state, 'saved');
});

test('editing during a write schedules a second write with the latest answer', async () => {
  const posts = []; let finish;
  const page = syncHarness(async (_url, options) => {
    if (options.method !== 'POST') return reply(saved);
    posts.push(JSON.parse(options.body));
    if (posts.length === 1) return new Promise((done) => { finish = done; });
    return reply({ ok: true });
  });
  await page.settled(); page.edit(0, 'first'); await page.flush();
  page.edit(0, 'latest'); await page.flush(); finish(reply({ ok: true })); await page.flush();
  assert.equal(posts.length, 2); assert.equal(posts[1].fields.q1, 'latest');
  assert.equal(page.status().dataset.state, 'saved');
});

test('a newer explicit empty browser value survives reload and merges per field', async () => {
  const times = 'transformer-attention:0001-intro:field-updated-at', posts = [];
  const page = syncHarness(async (_url, options) => {
    if (options.method === 'POST') { posts.push(JSON.parse(options.body)); return reply({ ok: true }); }
    return reply(saved);
  }, new Map([[times, JSON.stringify({ q1: '2026-10-03T00:00:00Z', q2: '2026-09-01T00:00:00Z' })]]));
  await page.flush(); assert.deepEqual(posts[0].fields, { q1: '', q2: 'valuable old two' });
});

test('one newly timestamped field does not mark an untouched legacy field as edited', async () => {
  const prefix = 'transformer-attention:0001-intro:', posts = [];
  const page = syncHarness(async (_url, options) => {
    if (options.method === 'POST') { posts.push(JSON.parse(options.body)); return reply({ ok: true }); }
    return reply(saved);
  }, new Map([[prefix + 'updated-at', '2026-10-03T00:00:00Z'], [prefix + 'field-updated-at', JSON.stringify({ q1: '2026-10-03T00:00:00Z' })]]));
  page.fields[1].value = 'stale legacy browser answer'; await page.flush();
  assert.equal(posts[0].fields.q2, 'valuable old two');
});

test('confirmed clear before restore intentionally clears every field', async () => {
  let resolve; const posts = [];
  const page = syncHarness(async (_url, options) => {
    if (options.method === 'POST') { posts.push(JSON.parse(options.body)); return reply({ ok: true }); }
    return new Promise((done) => { resolve = done; });
  });
  page.document.dispatchEvent({ type: 'teach:answers-cleared' }); resolve(reply(saved)); await page.flush();
  assert.deepEqual(posts[0].fields, { q1: '', q2: '' });
});
