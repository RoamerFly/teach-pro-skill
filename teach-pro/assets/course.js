(() => {
  'use strict';

  const root = document.documentElement;
  const sidebar = document.getElementById('course-sidebar');
  const navToggle = document.querySelector('.nav-toggle');

  const closeSidebar = () => {
    if (!sidebar || !navToggle) return;
    sidebar.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  };

  if (sidebar && navToggle) {
    navToggle.addEventListener('click', () => {
      const open = sidebar.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
    });

    sidebar.addEventListener('click', (event) => {
      if (event.target.closest('a') && window.matchMedia('(max-width: 900px)').matches) {
        closeSidebar();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeSidebar();
    });
  }

  let storage;
  try { storage = window.localStorage; } catch { storage = null; }
  let savedTheme = null;
  if (storage) { try { savedTheme = storage.getItem('course-theme'); } catch {} }
  if (savedTheme) root.dataset.theme = savedTheme;

  if (sidebar && !sidebar.querySelector('.theme-control')) {
    const select = document.createElement('select');
    select.className = 'theme-control';
    select.setAttribute('aria-label', '页面主题');
    select.innerHTML = '<option value="auto">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option>';
    select.value = root.dataset.theme || 'auto';
    select.addEventListener('change', () => {
      root.dataset.theme = select.value;
      if (storage) { try { storage.setItem('course-theme', select.value); } catch {} }
    });
    sidebar.appendChild(select);
  }

  document.querySelectorAll('pre').forEach((pre) => {
    if (pre.querySelector('.copy-code')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-code';
    button.textContent = '复制';
    button.addEventListener('click', async () => {
      const code = pre.querySelector('code')?.innerText || pre.innerText;
      try {
        await navigator.clipboard.writeText(code);
        button.textContent = '已复制';
      } catch {
        button.textContent = '复制失败';
      }
      setTimeout(() => { button.textContent = '复制'; }, 1400);
    });
    pre.appendChild(button);
  });

  const tocLinks = [...document.querySelectorAll('[data-toc] a[href^="#"]')];
  const tocTargets = tocLinks
    .map((link) => document.getElementById(decodeURIComponent(link.hash.slice(1))))
    .filter(Boolean);

  if ('IntersectionObserver' in window && tocTargets.length) {
    const linkById = new Map(tocLinks.map((link) => [decodeURIComponent(link.hash.slice(1)), link]));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;
      tocLinks.forEach((link) => link.classList.remove('is-active'));
      const active = linkById.get(visible.target.id);
      if (active) active.classList.add('is-active');
    }, { rootMargin: '-12% 0px -72% 0px', threshold: [0, 1] });
    tocTargets.forEach((target) => observer.observe(target));
  }

  document.querySelectorAll('[data-quiz]').forEach((quiz) => {
    const submit = quiz.querySelector('[data-quiz-submit]');
    const feedback = quiz.querySelector('[data-quiz-feedback]');
    if (!submit || !feedback) return;

    submit.addEventListener('click', () => {
      const selected = quiz.querySelector('input[type="radio"]:checked');
      if (!selected) {
        feedback.className = 'quiz-feedback is-visible is-wrong';
        feedback.textContent = '请先选择一个答案。';
        return;
      }

      const isCorrect = selected.dataset.correct === 'true';
      const correctText = quiz.dataset.correctAnswer || '请查看解析中的正确答案';
      const explanation = selected.dataset.feedback || quiz.dataset.explanation || '';
      feedback.className = `quiz-feedback is-visible ${isCorrect ? 'is-correct' : 'is-wrong'}`;
      feedback.innerHTML = `<strong>${isCorrect ? '回答正确' : '还需要调整'}</strong><p>正确答案：${correctText}</p><p>${explanation}</p>`;
    });
  });

  const storagePrefix = document.body?.dataset.courseKey || 'teach-course';
  const pageId = location.pathname.split('/').pop()?.replace(/\.html?$/i, '') || 'page';
  const saveFields = [...document.querySelectorAll('[data-save-key]')];
  const saveStatus = document.querySelector('[data-save-status]');
  const status = (message) => { if (saveStatus) saveStatus.textContent = message; };
  const updatedKey = `${storagePrefix}:${pageId}:updated-at`;
  if (!storage && saveFields.length) status('当前浏览器无法本地保存；请查看课程目录同步状态或下载备份');
  if (storage) {
    try {
      saveFields.forEach((field) => {
        const value = storage.getItem(`${storagePrefix}:${field.dataset.saveKey}`);
        if (value !== null) field.value = value;
      });
      const updated = storage.getItem(updatedKey);
      if (updated && saveFields.some((field) => field.value)) status(`浏览器副本已恢复 · ${new Date(updated).toLocaleString()}`);
    } catch { status('本地记录读取失败；仍可导出当前答案'); }
  }
  saveFields.forEach((field) => field.addEventListener('input', () => {
    if (!storage) return;
    try {
      const key = `${storagePrefix}:${field.dataset.saveKey}`;
      if (field.value) storage.setItem(key, field.value); else storage.removeItem(key);
      const now = new Date();
      storage.setItem(updatedKey, now.toISOString());
      status(`浏览器副本已保存 · ${now.toLocaleString()}`);
    } catch { status('浏览器副本保存失败；请查看课程目录同步状态或下载备份'); }
  }));
  document.querySelectorAll('[data-save-clear]').forEach((button) => button.addEventListener('click', () => {
    saveFields.forEach((field) => {
      if (storage) { try { storage.removeItem(`${storagePrefix}:${field.dataset.saveKey}`); } catch {} }
      field.value = '';
    });
    if (storage) { try { storage.removeItem(updatedKey); } catch {} }
    status('已清空本页答案');
  }));
  document.querySelectorAll('[data-save-export]').forEach((button) => button.addEventListener('click', () => {
    let savedAt = null;
    if (storage) { try { savedAt = storage.getItem(updatedKey); } catch {} }
    const payload = { course: storagePrefix, page: pageId, exported_at: new Date().toISOString(), saved_at: savedAt, fields: {} };
    saveFields.forEach((field) => { payload.fields[field.dataset.saveKey] = field.value; });
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${storagePrefix}-${pageId}-answers.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status('备份已下载；课程目录同步成功时无需上传');
  }));
})();
