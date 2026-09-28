(() => {
  'use strict';

  const fields = [...document.querySelectorAll('[data-save-key]')];
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
  const snapshot = () => ({ fields: Object.fromEntries(fields.map((field) => [field.dataset.saveKey, field.value])) });
  let ready = false;
  let changedBeforeReady = false;
  let timer = null;
  let chain = Promise.resolve();

  function persist() {
    if (!ready) { changedBeforeReady = true; return; }
    const body = JSON.stringify(snapshot());
    say('正在写入课程目录…', 'pending');
    chain = chain.catch(() => {}).then(async () => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        cache: 'no-store',
        body,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      say('已写入课程目录 · AI 下次对话可直接读取', 'saved');
    }).catch(() => { say('课程目录同步失败；答案仍保存在浏览器，可下载备份', 'offline'); });
  }

  function schedule(delay = 350) {
    if (!ready) { changedBeforeReady = true; return; }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; persist(); }, delay);
  }

  fields.forEach((field) => {
    field.addEventListener('input', () => schedule());
    field.addEventListener('change', () => schedule(0));
  });
  document.querySelectorAll('[data-save-clear]').forEach((button) => {
    button.addEventListener('click', () => schedule(0));
  });
  window.addEventListener('pagehide', () => {
    if (!timer || !ready || typeof navigator.sendBeacon !== 'function') return;
    clearTimeout(timer);
    navigator.sendBeacon(endpoint, new Blob([JSON.stringify(snapshot())], { type: 'application/json' }));
  });

  async function restore() {
    try {
      const response = await fetch(endpoint, { credentials: 'omit', cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const saved = await response.json();
      let localUpdated = null;
      try { localUpdated = window.localStorage.getItem(updatedKey); } catch {}
      const localNewer = localUpdated && (!saved.saved_at || Date.parse(localUpdated) > Date.parse(saved.saved_at));
      ready = true;
      if (changedBeforeReady || (localNewer && fields.some((field) => field.value))) {
        persist();
        return;
      }
      if (saved.fields && typeof saved.fields === 'object' && saved.saved_at) {
        fields.forEach((field) => {
          if (typeof saved.fields[field.dataset.saveKey] === 'string') {
            field.value = saved.fields[field.dataset.saveKey];
            try { window.localStorage.setItem(`${course}:${field.dataset.saveKey}`, field.value); } catch {}
          }
        });
        try { window.localStorage.setItem(updatedKey, saved.saved_at); } catch {}
        say('已从课程目录恢复 · AI 下次对话可直接读取', 'saved');
      } else {
        say('课程目录已连接；填写后自动同步给 AI', 'ready');
      }
    } catch {
      say('课程目录不可用；答案仅保存在浏览器，可下载备份', 'offline');
    }
  }

  restore();
})();
