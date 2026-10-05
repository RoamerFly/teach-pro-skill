(() => {
  'use strict';

  const fields = [...document.querySelectorAll('[data-save-key]')];
  const isChoiceGroup = (field) => field.matches?.('[data-quiz]');
  const fieldValue = (field) => isChoiceGroup(field)
    ? (field.querySelector('input[type="radio"]:checked')?.value || '')
    : field.value;
  const setFieldValue = (field, value) => {
    if (isChoiceGroup(field)) {
      field.querySelectorAll('input[type="radio"]').forEach((input) => { input.checked = value !== '' && input.value === value; });
    } else {
      field.value = value;
    }
  };
  if (!fields.length) return;
  const page = location.pathname.split('/').pop()?.replace(/\.html?$/i, '') || '';
  const baseStatus = document.querySelector('[data-save-status]');
  if (!baseStatus || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(page)) return;
  const syncStatus = document.createElement('span');
  syncStatus.className = 'sync-status';
  syncStatus.setAttribute('aria-live', 'polite');
  baseStatus.parentNode.appendChild(syncStatus);
  const say = (message, state) => {
    syncStatus.textContent = message;
    syncStatus.dataset.state = state;
  };

  if (location.protocol !== 'http:' || location.hostname !== '127.0.0.1') {
    say('仅浏览器保存；从课程启动器打开后，AI 才能自动读取', 'offline');
    return;
  }

  const endpoint = `/api/submissions/${encodeURIComponent(page)}`;
  const course = document.body?.dataset.courseKey || 'teach-course';
  const updatedKey = `${course}:${page}:updated-at`;
  const snapshot = () => ({ fields: Object.fromEntries(fields.map((field) => [field.dataset.saveKey, fieldValue(field)])) });
  const timesKey = `${course}:${page}:field-updated-at`;
  const dirty = new Map();
  let ready = false, restoring = false, writing = false, revision = 0, timer = null, retryTimer = null, retries = 0;
  const mark = (field) => dirty.set(field.dataset.saveKey, ++revision);
  const stopRetry = () => { clearTimeout(retryTimer); retryTimer = null; };
  async function request(options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(endpoint, { credentials: 'omit', cache: 'no-store', ...options, signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timeout); }
  }
  function retry() {
    if (retryTimer || retries >= 3) return;
    retryTimer = setTimeout(() => { retryTimer = null; restore(); }, 1000 * 2 ** retries++);
  }
  function schedule(delay = 350) {
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; if (ready) persist(); else restore(); }, delay);
  }
  async function persist() {
    if (!ready || writing || !dirty.size) return;
    writing = true;
    const changes = new Map(dirty), body = JSON.stringify(snapshot());
    say('正在写入课程目录…', 'pending');
    try {
      await request({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      for (const [key, value] of changes) if (dirty.get(key) === value) dirty.delete(key);
      retries = 0; stopRetry();
      if (!dirty.size) say('已写入课程目录 · AI 下次对话可直接读取', 'saved');
    } catch {
      ready = false;
      say('课程目录同步失败；答案仍保存在浏览器，可下载备份', 'offline'); retry();
    } finally {
      writing = false;
      if (ready && dirty.size) schedule(0);
    }
  }
  async function restore() {
    if (restoring || writing || ready) return;
    restoring = true;
    try {
      const saved = await request();
      if (!saved || !saved.fields || typeof saved.fields !== 'object' || Array.isArray(saved.fields)) throw new Error('invalid record');
      let localUpdated = null, times = {};
      try {
        localUpdated = window.localStorage.getItem(updatedKey);
        times = JSON.parse(window.localStorage.getItem(timesKey) || '{}');
      } catch {}
      if (!times || typeof times !== 'object' || Array.isArray(times)) times = {};
      const newer = (time) => Boolean(time && (!saved.saved_at || Date.parse(time) > Date.parse(saved.saved_at)));
      const legacyNewer = !Object.keys(times).length && newer(localUpdated);
      for (const field of fields) {
        const key = field.dataset.saveKey;
        // Preserve individual edits, including explicit empty values, not a pre-restore blank form.
        if (!dirty.has(key) && (newer(times[key]) || (legacyNewer && fieldValue(field)))) mark(field);
        if (dirty.has(key)) continue;
        if (typeof saved.fields[key] === 'string') {
          setFieldValue(field, saved.fields[key]);
          if (saved.saved_at) times[key] = saved.saved_at;
          try { window.localStorage.setItem(`${course}:${key}`, fieldValue(field)); } catch {}
        }
      }
      try {
        window.localStorage.setItem(timesKey, JSON.stringify(times));
        if (!dirty.size && saved.saved_at) window.localStorage.setItem(updatedKey, saved.saved_at);
      } catch {}
      ready = true; stopRetry();
      if (dirty.size) schedule(0);
      else {
        retries = 0;
        say(saved.saved_at ? '已从课程目录恢复 · AI 下次对话可直接读取' : '课程目录已连接；填写后自动同步给 AI', saved.saved_at ? 'saved' : 'ready');
      }
    } catch {
      say('课程目录不可用；答案仅保存在浏览器，可下载备份', 'offline'); retry();
    } finally { restoring = false; }
  }
  function edited(field, delay) { mark(field); retries = 0; stopRetry(); schedule(delay); }
  fields.forEach((field) => {
    field.addEventListener('input', () => edited(field, 350));
    field.addEventListener('change', () => edited(field, 0));
  });
  // Only course.js emits this event, after the learner confirms clearing.
  document.addEventListener('teach:answers-cleared', () => { fields.forEach(mark); retries = 0; stopRetry(); schedule(0); });
  const reconnect = () => { if (!ready && !restoring && !writing) { retries = 0; stopRetry(); restore(); } };
  window.addEventListener('focus', reconnect); window.addEventListener('online', reconnect);
  window.addEventListener('pagehide', () => {
    if (!ready || writing || !dirty.size || typeof navigator.sendBeacon !== 'function') return;
    clearTimeout(timer);
    navigator.sendBeacon(endpoint, new Blob([JSON.stringify(snapshot())], { type: 'application/json' }));
  });
  restore();
})();
