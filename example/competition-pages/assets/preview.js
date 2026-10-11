/* Public showcase adapter only. The downloaded course retains its original runtime. */
(() => {
  'use strict';
  const root = new URL('../../', document.currentScript.src);
  const url = path => new URL(path, root).href;
  const link = (text, path) => { const a = document.createElement('a'); a.textContent = text; a.href = url(path); return a; };
  const tools = document.createElement('div'); tools.className = 'public-preview-tools';
  const badge = document.createElement('span'); badge.textContent = '在线示例'; tools.append(badge, link('作品入口', 'index.html'), link('下载课程 · 完整体验', 'index.html#experience'));
  const hero = document.querySelector('.lesson-hero, .course-hero');
  if (hero) hero.after(tools);
  const syncStatus = document.querySelector('.sync-status'); if (syncStatus) { syncStatus.textContent = '作答保存在当前浏览器'; syncStatus.dataset.state = 'ready'; }
  const settings = document.querySelector('[data-tutor-settings-page]');
  if (settings) {
    settings.replaceChildren();
    const title = document.createElement('h2'); title.textContent = '连接你的答疑模型';
    const intro = document.createElement('div'); intro.className = 'public-preview-intro';
    const p = document.createElement('p'); p.textContent = '下载示例课程并运行启动器后，在这里选择服务、输入密钥、获取模型和测试连接。设置全课程共用，问答基于当前课，聊天按课保存。';
    const actions = document.createElement('div'); actions.className = 'public-preview-links'; actions.append(link('下载示例课程 ↓', 'downloads/zhijian-agent-course.zip'), link('观看 DeepSeek 配置实录 ▷', 'index.html#video'));
    const image = document.createElement('img'); image.className = 'public-preview-image'; image.src = url('assets/settings-preview.png'); image.alt = '演示视频实录：DeepSeek 模型配置，API Key 保持遮蔽，获取模型后测试连接';
    intro.append(p, actions, image); settings.append(title, intro);
  }
  const opener = document.querySelector('.tutor-open');
  if (opener) {
    const dialog = document.createElement('dialog'); dialog.className = 'public-preview-dialog'; dialog.setAttribute('aria-label', '课内答疑演示与完整体验');
    const header = document.createElement('header'); const title = document.createElement('h2'); title.textContent = '课内答疑 · 演示与完整体验'; const close = document.createElement('button'); close.type = 'button'; close.textContent = '关闭'; close.addEventListener('click', () => dialog.close()); header.append(title, close);
    const p = document.createElement('p'); p.textContent = '在本地课程中连接自己的模型，即可围绕本课进行多轮流式问答。下图来自演示视频中的实际模型回答。';
    const image = document.createElement('img'); image.className = 'public-preview-image'; image.src = url('assets/tutor-preview.png'); image.alt = '操作实录：同学围绕 messages 的上下文连续提问，DeepSeek 返回实际回答';
    const actions = document.createElement('div'); actions.className = 'public-preview-links'; actions.append(link('下载课程，开始答疑 ↓', 'downloads/zhijian-agent-course.zip'), link('观看真实问答实录 ▷', 'index.html#video'));
    dialog.append(header, p, image, actions); document.body.append(dialog);
    opener.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); dialog.showModal(); }, true);
    dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  }
})();
