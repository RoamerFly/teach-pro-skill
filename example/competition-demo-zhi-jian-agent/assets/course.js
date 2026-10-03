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
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'sidebar-close';
    closeButton.textContent = '×';
    closeButton.setAttribute('aria-label', '关闭课程导航');
    closeButton.addEventListener('click', () => { closeSidebar(); navToggle.focus(); });
    sidebar.prepend(closeButton);
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
  const themes = [['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色']];
  const validTheme = (value) => themes.some(([theme]) => theme === value);
  root.dataset.theme = validTheme(savedTheme) ? savedTheme : validTheme(root.dataset.theme) ? root.dataset.theme : 'auto';

  const shell = document.querySelector('.page-shell');
  if (sidebar && shell) {
    const collapseKey = `course-sidebar-collapsed:${document.body.dataset.courseKey || 'default'}`;
    const collapseButton = sidebar.querySelector('.sidebar-collapse') || document.createElement('button');
    collapseButton.type = 'button';
    collapseButton.className = 'sidebar-collapse';
    collapseButton.setAttribute('aria-controls', 'course-sidebar');
    const updateCollapse = (collapsed) => {
      shell.classList.toggle('is-sidebar-collapsed', collapsed);
      collapseButton.setAttribute('aria-expanded', String(!collapsed));
      collapseButton.setAttribute('aria-label', collapsed ? '展开左侧导航' : '收起左侧导航');
      collapseButton.title = collapsed ? '展开左侧导航' : '收起左侧导航';
      collapseButton.textContent = collapsed ? '☰' : '‹';
    };
    if (!collapseButton.isConnected) sidebar.prepend(collapseButton);
    let savedCollapse = false;
    if (storage) { try { savedCollapse = storage.getItem(collapseKey) === '1'; } catch {} }
    updateCollapse(savedCollapse);
    collapseButton.addEventListener('click', () => {
      const collapsed = !shell.classList.contains('is-sidebar-collapsed');
      updateCollapse(collapsed);
      if (storage) { try { storage.setItem(collapseKey, collapsed ? '1' : '0'); } catch {} }
    });
  }

  if (sidebar && !sidebar.querySelector('.theme-control')) {
    // Only navigation scrolls; the theme card remains in the sidebar footer.
    const scroll = document.createElement('div');
    scroll.className = 'sidebar-scroll';
    [...sidebar.children].forEach((child) => {
      if (!child.classList.contains('sidebar-collapse') && !child.classList.contains('sidebar-close')) scroll.appendChild(child);
    });
    sidebar.appendChild(scroll);
    sidebar.classList.add('has-theme-control');

    const control = document.createElement('details');
    control.className = 'theme-control';
    const current = document.createElement('summary');
    current.className = 'theme-current';
    const caption = document.createElement('span');
    caption.className = 'theme-caption';
    caption.textContent = '页面外观';
    const label = document.createElement('span');
    label.className = 'theme-current-label';
    current.appendChild(caption);
    current.appendChild(label);
    const options = document.createElement('div');
    options.className = 'theme-options';
    options.setAttribute('role', 'group');
    options.setAttribute('aria-label', '页面主题');
    const buttons = themes.map(([value, name]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'theme-option';
      button.dataset.themeValue = value;
      button.textContent = name;
      button.addEventListener('click', () => {
        root.dataset.theme = value;
        if (storage) { try { storage.setItem('course-theme', value); } catch {} }
        updateTheme();
        control.open = false;
        current.focus();
      });
      options.appendChild(button);
      return button;
    });
    const updateTheme = () => {
      label.textContent = themes.find(([value]) => value === root.dataset.theme)[1];
      current.setAttribute('aria-label', '页面外观：' + label.textContent + '，选择主题');
      buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.themeValue === root.dataset.theme)));
    };
    control.appendChild(current);
    control.appendChild(options);
    control.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && control.open) {
        event.preventDefault();
        event.stopPropagation();
        control.open = false;
        current.focus();
      }
    });
    document.addEventListener('click', (event) => {
      if (control.open && !control.contains(event.target)) control.open = false;
    });
    sidebar.appendChild(control);
    updateTheme();
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
    quiz.addEventListener('change', () => {
      feedback.className = 'quiz-feedback';
      feedback.textContent = '';
    });

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
  const saveStatus = document.querySelector('[data-save-status]');
  const status = (message) => { if (saveStatus) saveStatus.textContent = message; };
  const updatedKey = `${storagePrefix}:${pageId}:updated-at`;
  const fieldTimesKey = `${storagePrefix}:${pageId}:field-updated-at`;
  const markUpdated = (keys, now) => {
    let times = {};
    try { times = JSON.parse(storage.getItem(fieldTimesKey) || '{}'); } catch {}
    if (!times || typeof times !== 'object' || Array.isArray(times)) times = {};
    keys.forEach((key) => { times[key] = now; });
    storage.setItem(fieldTimesKey, JSON.stringify(times));
    storage.setItem(updatedKey, now);
  };
  if (!storage && saveFields.length) status('当前浏览器无法本地保存；请查看课程目录同步状态或下载备份');
  if (storage) {
    try {
      saveFields.forEach((field) => {
        const value = storage.getItem(`${storagePrefix}:${field.dataset.saveKey}`);
        if (value !== null) setFieldValue(field, value);
      });
      const updated = storage.getItem(updatedKey);
      if (updated && saveFields.some((field) => fieldValue(field))) status(`浏览器副本已恢复 · ${new Date(updated).toLocaleString()}`);
    } catch { status('本地记录读取失败；仍可导出当前答案'); }
  }
  saveFields.forEach((field) => field.addEventListener('input', () => {
    if (!storage) return;
    try {
      const key = `${storagePrefix}:${field.dataset.saveKey}`;
      const value = fieldValue(field);
      if (value) storage.setItem(key, value); else storage.removeItem(key);
      const now = new Date();
      markUpdated([field.dataset.saveKey], now.toISOString());
      status(`浏览器副本已保存 · ${now.toLocaleString()}`);
    } catch { status('浏览器副本保存失败；请查看课程目录同步状态或下载备份'); }
  }));
  saveFields.filter(isChoiceGroup).forEach((field) => field.addEventListener('change', () => {
    if (!storage) return;
    try {
      const value = fieldValue(field);
      const key = `${storagePrefix}:${field.dataset.saveKey}`;
      if (value) storage.setItem(key, value); else storage.removeItem(key);
      const now = new Date();
      markUpdated([field.dataset.saveKey], now.toISOString());
      status(`浏览器副本已保存 · ${now.toLocaleString()}`);
    } catch { status('浏览器副本保存失败；请查看课程目录同步状态或下载备份'); }
  }));
  document.querySelectorAll('[data-save-clear]').forEach((button) => button.addEventListener('click', () => {
    if (!window.confirm('确定清空本页答案与疑难记录吗？')) return;
    saveFields.forEach((field) => {
      if (storage) { try { storage.removeItem(`${storagePrefix}:${field.dataset.saveKey}`); } catch {} }
      setFieldValue(field, '');
    });
    document.querySelectorAll('[data-quiz-feedback]').forEach((feedback) => {
      feedback.className = 'quiz-feedback';
      feedback.textContent = '';
    });
    if (storage) { try { markUpdated(saveFields.map((field) => field.dataset.saveKey), new Date().toISOString()); } catch {} }
    status('已清空本页答案');
    document.dispatchEvent(new CustomEvent('teach:answers-cleared'));
  }));
  document.querySelectorAll('[data-save-export]').forEach((button) => button.addEventListener('click', () => {
    let savedAt = null;
    if (storage) { try { savedAt = storage.getItem(updatedKey); } catch {} }
    const payload = { course: storagePrefix, page: pageId, exported_at: new Date().toISOString(), saved_at: savedAt, fields: {} };
    saveFields.forEach((field) => { payload.fields[field.dataset.saveKey] = fieldValue(field); });
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${storagePrefix}-${pageId}-answers.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status('备份已下载；课程目录同步成功时无需上传');
  }));
})();
