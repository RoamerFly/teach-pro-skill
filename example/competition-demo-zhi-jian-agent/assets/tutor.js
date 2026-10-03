/* Per-lesson modal conversation; credentials belong to the local course service. */
(() => {
  'use strict';
  const lesson = location.pathname.split('/').pop()?.replace(/\.html$/i, '');
  const anchor = document.querySelector('#learning-input');
  if (!anchor || !location.pathname.includes('/lessons/') || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(lesson)) return;
  const markdown = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = new URL('tutor-markdown.js', document.currentScript.src).href;
    script.onload = () => resolve(window.TutorMarkdown); script.onerror = () => reject(new Error('请更新课程回答排版资产')); document.head.append(script);
  });
  markdown.catch(() => {});
  const settings = '../settings.html?lesson=' + encodeURIComponent(lesson);
  const main = anchor.closest('main');
  const entry = main.querySelector('.lesson-hero') || document.createElement('header');
  if (!entry.id) entry.id = 'lesson-tutor'; entry.classList.add('lesson-toolbar'); entry.setAttribute('aria-label', '本课工具栏');
  const meta = entry.querySelector('.lesson-meta') || (entry.nextElementSibling?.matches('.lesson-meta.lesson-status') ? entry.nextElementSibling : null);
  let context = entry.querySelector('.lesson-toolbar-context');
  if (!context) {
    context = document.createElement('div'); context.className = 'lesson-toolbar-context';
    for (const child of [...entry.childNodes]) if (child !== meta) context.append(child);
    if (!context.textContent.trim()) {
      const title = main.querySelector('h1') || document.createElement('span');
      if (title.tagName !== 'H1') { title.className = 'lesson-toolbar-title'; title.textContent = document.title; }
      const note = main.querySelector('.lead') || document.createElement('p'); note.classList.add('lead');
      if (!note.textContent.trim()) note.textContent = document.querySelector('meta[name="description"]')?.content || '围绕本课理解、练习与讨论'; context.append(title, note);
    }
    entry.append(context);
  }
  let actions = entry.querySelector('.lesson-toolbar-actions');
  if (!actions) { actions = document.createElement('div'); actions.className = 'lesson-toolbar-actions'; }
  if (entry.id !== 'lesson-tutor') actions.id = 'lesson-tutor';
  actions.innerHTML = '<button type="button" class="tutor-open" aria-haspopup="dialog" aria-controls="tutor-dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 3v-3a2 2 0 0 1-2-2V6a2 2 0 0 1 3-2Z"/><path d="M7 9h10M7 13h6"/></svg>问 AI</button>';
  entry.prepend(actions); main.classList.add('lesson-page'); main.prepend(entry);
  const details = document.createElement('div'); details.className = 'lesson-details';
  for (const item of [context.querySelector('.eyebrow'), context.querySelector('.hero-facts'), meta]) if (item) { if (item === meta) item.classList.add('lesson-status'); details.append(item); }
  if (details.childNodes.length) entry.after(details);
  const heading = context.querySelector('h1, .lesson-toolbar-title'), number = Number(entry.dataset.lessonNumber || lesson.match(/^(\d+)-/)?.[1]);
  if (heading && Number.isInteger(number) && number > 0) heading.textContent = '第 ' + number + ' 课 · ' + heading.textContent.trim().replace(/^第\s*(?:\d+|[一二三四五六七八九十百]+)\s*课\s*[·:：—-]\s*/, '');
  for (const text of context.querySelectorAll('h1, .lesson-toolbar-title, .lead')) text.title = text.textContent.trim();
  const measure = () => document.documentElement.style.setProperty('--lesson-toolbar-height', Math.ceil(entry.getBoundingClientRect().height) + 'px');
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(entry);
  measure(); window.addEventListener('resize', measure);
  const dialog = document.createElement('dialog'); dialog.id = 'tutor-dialog'; dialog.className = 'tutor-dialog'; dialog.setAttribute('aria-labelledby', 'tutor-title');
  dialog.innerHTML = `<header class="tutor-header"><div class="tutor-heading"><span class="tutor-eyebrow">本课的学习对话</span><h2 id="tutor-title">课内答疑</h2></div><span class="tutor-connection" data-tutor-model></span><details class="tutor-more"><summary aria-label="更多操作">···</summary><div class="tutor-menu"><a data-tutor-settings>课程设置</a><button type="button" data-tutor-connect hidden>重新连接</button><button type="button" data-tutor-export>导出聊天记录</button><button type="button" data-tutor-clear>清空本课聊天</button></div></details><button type="button" class="tutor-icon" data-tutor-close aria-label="关闭答疑">×</button></header>
    <div class="tutor-conversation"><div class="tutor-messages" role="log" aria-label="本课答疑记录" aria-live="off"></div><button type="button" class="tutor-jump" hidden>查看最新消息 ↓</button></div>
    <form class="tutor-question"><div class="tutor-selection" hidden><span data-selection-text></span><button type="button" class="tutor-icon" data-tutor-unselect aria-label="移除引用">×</button></div><label class="tutor-prompt-label" for="tutor-message">继续提问</label><div class="tutor-input-row"><textarea id="tutor-message" maxlength="4000" rows="1" placeholder="哪里还没想明白？" aria-label="向本课 AI 提问"></textarea><button type="submit" class="tutor-send" aria-label="发送问题">发送 <span aria-hidden="true">↑</span></button></div><p class="tutor-status" role="status" aria-live="polite" hidden></p></form>`;
  document.body.append(dialog);
  const find = selector => dialog.querySelector(selector); find('[data-tutor-settings]').href = settings;
  find('.tutor-eyebrow').textContent = document.querySelector('main h1')?.textContent.trim().slice(0, 80) || '本课的学习对话';
  const opener = actions.querySelector('button'), prompt = find('#tutor-message'), log = find('.tutor-messages'), status = find('.tutor-status'), jump = find('.tutor-jump');
  let token = '', online = false, configured = false, busy = false, selection = '', record = { messages: [] }, composing = false, configVersion = null, rendering = 0;
  function say(message = '', error = false) { status.textContent = error ? message : ''; status.dataset.state = error ? 'error' : 'ready'; status.hidden = !error; }
  function controls() {
    find('button[type="submit"]').disabled = !online || !configured || busy || !prompt.value.trim();
    find('[data-tutor-clear]').disabled = !online || busy || !record.messages.length;
    find('[data-tutor-export]').disabled = busy || !record.messages.length;
    find('[data-tutor-connect]').hidden = online; find('[data-tutor-connect]').disabled = busy;
    dialog.querySelectorAll('[data-tutor-retry]').forEach(button => { button.disabled = !online || !configured || busy; });
    find('.tutor-question').setAttribute('aria-busy', String(busy));
    find('button[type="submit"]').setAttribute('aria-label', busy ? '正在生成回答' : '发送问题');
    find('button[type="submit"]').textContent = busy ? '···' : '发送 ↑';
  }
  async function api(route, body) {
    const options = { credentials: 'omit', cache: 'no-store', headers: { 'X-Teach-Token': token } };
    if (body !== undefined) { options.method = 'POST'; options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
    const response = await fetch('/api/tutor/' + route, options), result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error || '课程服务请求失败'), { diagnostics: result.diagnostics });
    return result;
  }
  async function streamChat(body, receive) {
    const response = await fetch('/api/tutor/chat-stream/' + lesson, { method: 'POST', credentials: 'omit', cache: 'no-store',
      headers: { 'X-Teach-Token': token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) { const result = await response.json(); throw new Error(result.error || '课程服务请求失败'); }
    if (!response.headers.get('Content-Type')?.includes('application/x-ndjson') || !response.body) throw new Error('请更新课程的流式答疑组件。');
    const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
    let buffer = '', finished = false, bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        bytes += value?.byteLength || 0; if (bytes > 10 * 1024 * 1024) throw new Error('答疑记录过大，请备份后整理。');
        buffer += decoder.decode(value, { stream: !done });
        let end;
        while ((end = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, end); buffer = buffer.slice(end + 1); if (!line.trim()) continue;
          const item = JSON.parse(line);
          if (item.event === 'error') throw new Error(item.data.error || '回答中断，可重新回答。');
          if (!['pending', 'delta', 'done'].includes(item.event)) throw new Error('流式答疑数据不兼容。');
          await receive(item.event, item.data); if (item.event === 'done') finished = true;
        }
        if (done) break;
      }
      if (!finished || buffer.trim()) throw new Error('回答中断，可重新回答。');
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  const nearBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 90;
  function latest() { log.scrollTop = log.scrollHeight; jump.hidden = true; }
  async function render(data, forceBottom = false) {
    const revision = ++rendering, follow = forceBottom || nearBottom(), position = log.scrollTop; record = data;
    const fragment = document.createDocumentFragment(), latestUser = [...(data.messages || [])].reverse().find(item => item.role === 'user');
    for (const message of data.messages || []) {
      const box = document.createElement('article'); box.className = 'tutor-message ' + (message.role === 'assistant' ? 'is-assistant' : 'is-user');
      const label = document.createElement('div'); label.className = 'tutor-message-label'; label.textContent = message.role === 'assistant' ? '答疑 AI' : '你';
      const body = document.createElement('div'); body.textContent = message.content; box.append(label, body);
      if (message.role === 'assistant') {
        try { await (await markdown).render(body, message.content); } catch { body.textContent = message.content; body.className = 'tutor-plain'; }
        const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'tutor-text-action'; copy.textContent = '复制回答';
        copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(message.content); copy.textContent = '已复制'; } catch { copy.textContent = '请选中正文复制'; } }); box.append(copy);
      }
      if (message.status !== 'complete' && !(message.status === 'pending' && busy)) {
        const note = document.createElement('p'); note.className = 'tutor-message-note'; note.textContent = message.error || message.note || (message.status === 'pending' ? (busy ? 'AI 正在思考怎么讲解…' : '上次对话尚未完成，可重试。') : '回答尚未完成'); box.append(note);
      }
      if (message.role === 'user' && message === latestUser && ['failed', 'incomplete', 'pending'].includes(message.status) && message.id && !(message.status === 'pending' && busy)) {
        const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'tutor-text-action'; retry.dataset.tutorRetry = message.id; retry.textContent = '重新回答'; retry.addEventListener('click', () => send(message.content, message.id, message.selection || '')); box.append(retry);
        if (message.diagnostics && Object.keys(message.diagnostics).length) {
          const details = document.createElement('details'); details.className = 'tutor-diagnostics'; const summary = document.createElement('summary'); summary.textContent = '请求详情'; const diagnostic = document.createElement('pre'); diagnostic.textContent = JSON.stringify(message.diagnostics, null, 2); details.append(summary, diagnostic); box.append(details);
        }
      }
      fragment.append(box);
    }
    if (!data.messages?.length) {
      const empty = document.createElement('div'); empty.className = 'tutor-empty'; empty.innerHTML = '<span class="tutor-empty-mark" aria-hidden="true">✦</span><h3>把疑问留在这一课</h3><p>从一个没理解的概念开始，或选中课文，再点“问 AI”。</p><div class="tutor-suggestions"></div>';
      if (configured) for (const text of ['用一个具体例子解释本课核心概念', '帮我区分本课容易混淆的两个概念', '给我一道检查理解的小题']) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = text; button.addEventListener('click', () => { prompt.value = text; grow(); controls(); prompt.focus(); }); empty.querySelector('.tutor-suggestions').append(button);
      } else { const link = document.createElement('a'); link.href = settings; link.className = 'button button--primary'; link.textContent = '连接答疑模型'; empty.append(link); }
      fragment.append(empty);
    }
    if (revision !== rendering) return;
    log.replaceChildren(fragment); if (follow) latest(); else { log.scrollTop = position; jump.hidden = false; } controls();
  }
  async function refreshConfig() {
    const result = await api('bootstrap'); token = result.token; configured = result.configured;
    const version = JSON.stringify([token, configured, result.settings]), changed = configVersion !== null && configVersion !== version; configVersion = version;
    find('[data-tutor-model]').textContent = configured ? result.settings.model : '未连接模型'; find('[data-tutor-model]').dataset.connected = String(configured); return changed;
  }
  async function send(message, retryId, selected = selection) {
    if (busy || !message.trim()) return; busy = true; controls();
    let body, draft = '', timer, painting = Promise.resolve(), active = true, accepted = false;
    const paint = () => {
      timer = null; const text = draft;
      painting = painting.then(async () => {
        if (!active || !body?.isConnected) return;
        const follow = nearBottom(), position = log.scrollTop;
        try { await (await markdown).render(body, text); } catch { body.textContent = text; body.className = 'tutor-plain'; }
        if (follow) latest(); else { log.scrollTop = position; jump.hidden = false; }
      });
    };
    try {
      await refreshConfig(); if (!configured) { say('先在课程设置中连接模型。', true); return; } say();
      if (!retryId) await render({ ...record, messages: [...record.messages, { role: 'user', content: message, status: 'pending' }] });
      await streamChat({ message, selection: selected, ...(retryId ? { retry_id: retryId } : {}) }, async (event, data) => {
        if (event === 'pending') {
          accepted = true; await render(data);
          if (!retryId && prompt.value === message) { prompt.value = ''; selection = ''; showSelection(); grow(); }
          const box = document.createElement('article'); box.className = 'tutor-message is-assistant is-streaming';
          const label = document.createElement('div'); label.className = 'tutor-message-label'; label.textContent = '答疑 AI';
          body = document.createElement('div'); body.textContent = '···'; box.append(label, body); log.append(box); if (nearBottom()) latest();
        } else if (event === 'delta') {
          if (typeof data.text !== 'string' || !body || draft.length + data.text.length > 24000) throw new Error('流式正文格式不兼容。');
          draft += data.text; if (!timer) timer = setTimeout(paint, 60);
        } else {
          clearTimeout(timer); active = false; await painting; await render(data); say();
        }
      });
    } catch (error) {
      clearTimeout(timer); active = false; await painting;
      try { const restored = await api('history/' + lesson); await render(restored); accepted ||= restored.messages.some(item => item.role === 'user' && item.content === message); } catch {}
      if (accepted && !retryId && prompt.value === message) { prompt.value = ''; grow(); } say(error.message || '连接中断，请稍后重试。', true);
    } finally { clearTimeout(timer); active = false; busy = false; if (record.messages.some(item => item.status === 'pending')) await render(record); controls(); }
  }
  function grow() { prompt.style.height = 'auto'; prompt.style.height = Math.min(prompt.scrollHeight, 96) + 'px'; }
  prompt.addEventListener('input', () => { grow(); controls(); }); prompt.addEventListener('compositionstart', () => { composing = true; }); prompt.addEventListener('compositionend', () => { composing = false; });
  prompt.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !composing && event.keyCode !== 229) { event.preventDefault(); if (!find('button[type="submit"]').disabled) send(prompt.value); } });
  find('.tutor-question').addEventListener('submit', event => { event.preventDefault(); if (!find('button[type="submit"]').disabled) send(prompt.value); });
  function showSelection() { find('.tutor-selection').hidden = !selection; find('[data-selection-text]').textContent = selection; }
  function captureSelection() { const selected = window.getSelection(), main = document.querySelector('main'); if (selected && main?.contains(selected.anchorNode) && main.contains(selected.focusNode) && !entry.contains(selected.anchorNode)) { const text = selected.toString().trim(); if (text) selection = text.slice(0, 2000); } showSelection(); }
  async function open() {
    if (dialog.open) return; captureSelection(); dialog.showModal(); grow(); prompt.focus({ preventScroll: true });
    if (online && !busy) try { await refreshConfig(); await render(await api('history/' + lesson), true); say(configured ? '可以开始提问' : '先连接模型，随时可以返回课文。'); } catch (error) { say(error.message, true); } controls();
  }
  opener.addEventListener('pointerdown', captureSelection); opener.addEventListener('click', open); find('[data-tutor-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { find('.tutor-more').open = false; opener.focus({ preventScroll: true }); });
  dialog.addEventListener('cancel', event => { if (find('.tutor-more').open) { event.preventDefault(); find('.tutor-more').open = false; find('.tutor-more summary').focus(); } });
  dialog.addEventListener('click', event => { if (!event.target.closest('.tutor-more')) find('.tutor-more').open = false; });
  find('[data-tutor-unselect]').addEventListener('click', () => { selection = ''; showSelection(); prompt.focus(); }); jump.addEventListener('click', latest); log.addEventListener('scroll', () => { if (nearBottom()) jump.hidden = true; });
  find('[data-tutor-export]').addEventListener('click', () => { const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = lesson + '-chat.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); find('.tutor-more').open = false; });
  find('[data-tutor-clear]').addEventListener('click', async () => {
    find('.tutor-more').open = false; if (busy || !window.confirm('清空本课聊天？此操作无法撤销，练习答案和其他课节不受影响。')) return; busy = true; controls();
    try { await render(await api('clear/' + lesson, { confirm: true }), true); say('本课聊天已清空'); } catch (error) { say(error.message, true); } finally { busy = false; controls(); }
  });
  const nav = document.querySelector('[data-toc]');
  if (nav) { const item = document.createElement('li'), link = document.createElement('a'); link.href = '#lesson-tutor'; link.textContent = '课内 AI 答疑'; item.append(link); nav.append(item); link.addEventListener('click', event => { event.preventDefault(); open(); }); }
  window.addEventListener('hashchange', () => { if (location.hash === '#lesson-tutor') open(); });
  async function start() {
    controls();
    if (location.protocol !== 'http:' || location.hostname !== '127.0.0.1') { say('运行课程启动器后，即可使用 AI 答疑。', true); await render(record); return; }
    try { await refreshConfig(); online = true; await render(await api('history/' + lesson), true); say(configured ? '可以开始提问' : '在课程设置中连接答疑模型'); }
    catch (error) { online = false; say('课程服务未连接：' + error.message, true); await render(record); } controls();
  }
  find('[data-tutor-connect]').addEventListener('click', start);
  window.addEventListener('focus', async () => { if (!online || busy) return; try { if (await refreshConfig()) { await render(record); say(configured ? '模型设置已更新' : '请重新连接答疑模型'); } } catch (error) { configured = false; say(error.message, true); } controls(); });
  start().then(() => { if (location.hash === '#lesson-tutor') open(); });
})();
