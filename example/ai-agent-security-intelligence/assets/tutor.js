/* Optional lesson tutor. No API key in browser storage or generated HTML. */
(() => {
  'use strict';
  const lesson = location.pathname.split('/').pop()?.replace(/\.html$/i, '');
  const anchor = document.querySelector('#learning-input');
  if (!anchor || !location.pathname.includes('/lessons/') || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(lesson)) return;
  const section = document.createElement('section');
  section.id = 'lesson-tutor';
  section.className = 'content-section tutor-panel';
  // Fixed template only. All provider and model text is rendered with textContent.
  section.innerHTML = `<h2>课内 AI 答疑 <span class="resource-badge">可选</span></h2>
    <p class="resource-access">只围绕本课交流，不执行代码、不修改课程或自动生成下一课。模型回答不是掌握证据。</p>
    <p class="tutor-status" role="status" aria-live="polite">正在连接本地课程服务…</p>
    <p class="resource-access"><span data-tutor-model></span> <a data-tutor-settings-link>前往课程设置 →</a></p>
    <label class="tutor-consent"><input type="checkbox" data-tutor-consent> 我同意将本课正文与图注（不含折叠答案）、当前问题、选中文字和最近聊天发送给所选提供商；聊天原文自动保存到当前课程目录。请勿输入密钥、隐私或未授权材料。</label>
    <details class="tutor-context"><summary>查看将发送的本课上下文</summary><p class="resource-access" data-tutor-context-meta></p><pre class="tutor-context-text"></pre></details>
    <div class="tutor-messages" role="log" aria-label="本课答疑记录"></div>
    <label for="tutor-selection">附带的课文片段（可选）</label><div class="tutor-actions"><button type="button" data-tutor-selection>引用页面选中文字</button><button type="button" data-tutor-unselect>移除引用</button></div><p id="tutor-selection" class="tutor-selection"></p>
    <form class="tutor-question"><label for="tutor-message">向本课 AI 提问</label><textarea id="tutor-message" maxlength="4000" rows="4" placeholder="例如：模型提出动作和运行时授权有什么区别？"></textarea><div class="tutor-actions"><button type="submit">发送问题</button><button type="button" data-tutor-export>下载本课聊天备份</button><button type="button" data-tutor-clear>删除本课聊天</button></div></form>
    <p class="resource-access">聊天文件：learner-chats/当前课节.json。课程生成 AI 下次被你唤起时可读取；它不会在后台自动生成下一课。长对话仅带入最近 10 条成功消息，完整原文仍保留在本地；本课最多 100 轮。</p>`;
  anchor.before(section);
  section.querySelector('[data-tutor-settings-link]').href = '../settings.html?lesson=' + encodeURIComponent(lesson);
  const nav = document.querySelector('[data-toc]');
  if (nav) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = '#lesson-tutor'; link.textContent = '课内 AI 答疑'; item.append(link);
    const inputNav = nav.querySelector('a[href="#learning-input"]')?.closest('li');
    if (inputNav) inputNav.before(item); else nav.append(item);
  }
  const find = (selector) => section.querySelector(selector);
  const questionForm = find('.tutor-question');
  const consent = find('[data-tutor-consent]');
  const status = find('.tutor-status');
  const prompt = find('#tutor-message');
  let token = '', configured = false, busy = false, online = false, selection = '', configVersion = null;
  let record = { messages: [] };
  function say(text, error = false) { status.textContent = text; status.dataset.state = error ? 'error' : 'ready'; }
  function controls() {
    section.querySelectorAll('button').forEach(button => { button.disabled = !online || busy; });
    section.querySelectorAll('input, select, textarea').forEach(field => { field.disabled = !online || busy; });
    questionForm.querySelector('button[type="submit"]').disabled = !online || busy || !configured || !consent.checked;
  }
  async function api(route, body) {
    const options = { credentials: 'omit', cache: 'no-store', headers: { 'X-Teach-Token': token } };
    if (body !== undefined) { options.method = 'POST'; options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
    const response = await fetch('/api/tutor/' + route, options);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '本地答疑服务请求失败');
    return result;
  }
  function render(data) {
    record = data;
    const log = find('.tutor-messages');
    log.replaceChildren();
    for (const message of data.messages || []) {
      const box = document.createElement('article');
      box.className = 'tutor-message ' + (message.role === 'assistant' ? 'is-assistant' : 'is-user');
      const label = document.createElement('strong');
      label.textContent = (message.role === 'assistant' ? '答疑 AI' : '我') + (message.status !== 'complete' ? ' · ' + (message.status === 'pending' ? '未完成' : '请求失败') : '');
      const content = document.createElement('div'); content.textContent = message.content;
      box.append(label, content);
      if (message.error) { const error = document.createElement('p'); error.textContent = message.error; box.append(error); }
      log.append(box);
    }
    if (!data.messages?.length) { const empty = document.createElement('p'); empty.textContent = '本课暂无聊天；在课程设置中配置模型，并确认本课发送说明后即可提问。'; log.append(empty); }
    log.scrollTop = log.scrollHeight;
  }
  async function act(fn) {
    if (busy) return;
    busy = true; controls();
    try { await fn(); } catch (error) { say(error.message || '请求失败', true); }
    finally { busy = false; controls(); }
  }
  consent.addEventListener('change', controls);
  async function refreshConfig() {
    const bootstrap = await api('bootstrap');
    token = bootstrap.token;
    configured = bootstrap.configured;
    const version = JSON.stringify([token, configured, bootstrap.settings]);
    const changed = configVersion !== null && configVersion !== version;
    configVersion = version;
    if (changed) consent.checked = false;
    const current = bootstrap.settings || {};
    find('[data-tutor-model]').textContent = configured
      ? '当前模型：' + current.provider + ' / ' + current.model
      : '模型尚未启用；请到课程设置中配置或重新输入会话 Key。';
    return changed;
  }
  questionForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!prompt.value.trim() || !configured || !consent.checked) return;
    const message = prompt.value;
    act(async () => {
      // Recheck shared settings before sending, including changes in another tab.
      if (await refreshConfig() || !configured || !consent.checked) {
        say(configured ? '课程设置已变更；请重新确认本课发送说明后提问。' : '请先在课程设置中启用模型。', true);
        return;
      }
      say('正在请求模型；问题先写入本地记录，不会自动重试…');
      try {
        render(await api('chat/' + lesson, { message, selection, consent: true }));
        prompt.value = ''; say('回答与问题已写入本地聊天文件；课程生成 AI 下次可参考。');
      } catch (error) {
        try { render(await api('history/' + lesson)); } catch {}
        throw error;
      }
    });
  });
  find('[data-tutor-selection]').addEventListener('click', () => {
    const selected = window.getSelection();
    const main = document.querySelector('main');
    if (!selected || !main?.contains(selected.anchorNode) || !main.contains(selected.focusNode) || section.contains(selected.anchorNode) || section.contains(selected.focusNode)) {
      say('请先选中本课正文中的文字，再点击引用。', true); return;
    }
    selection = selected.toString().slice(0, 2000); find('.tutor-selection').textContent = selection;
  });
  find('[data-tutor-unselect]').addEventListener('click', () => { selection = ''; find('.tutor-selection').textContent = ''; });
  find('[data-tutor-clear]').addEventListener('click', () => {
    if (!window.confirm('永久删除本课聊天文件？不会删除练习答案或其他课节记录。建议先下载备份。')) return;
    act(async () => { render(await api('clear/' + lesson, { confirm: true })); say('本课聊天文件已删除；不可自动恢复，已有下载备份仍可保留。'); });
  });
  find('[data-tutor-export]').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = lesson + '-chat.json'; link.click(); URL.revokeObjectURL(url);
  });
  async function start() {
    controls();
    if (location.protocol !== 'http:' || location.hostname !== '127.0.0.1') {
      say('静态阅读模式：请通过当前系统的课程启动器打开本地服务后使用 AI 答疑。未启用模型请求或聊天同步。'); return;
    }
    try {
      await refreshConfig(); online = true;
      const ctx = await api('context/' + lesson);
      find('.tutor-context-text').textContent = ctx.text;
      find('[data-tutor-context-meta]').textContent = '本课正文 ' + ctx.text.length + ' 字；' + (ctx.truncated ? '超过长度上限，已截断。' : '未截断。') + ' 不自动读取学员画像、其他课程或外部网页。';
      render(await api('history/' + lesson));
      say(configured ? '本地答疑已连接；请确认发送说明后提问。' : '聊天可从本地恢复；请前往课程设置配置模型，服务重启后需重新输入 Key。');
      controls();
    } catch (error) { online = false; controls(); say('课内答疑不可用：' + error.message + '。核心课程仍可阅读。', true); }
  }
  window.addEventListener('focus', async () => {
    if (!online || busy) return;
    try {
      if (await refreshConfig()) say(configured ? '课程设置已更新；请重新确认本课发送说明。' : '模型会话未启用；请前往课程设置。');
    } catch (error) { configured = false; consent.checked = false; say(error.message, true); }
    controls();
  });
  start();
})();
