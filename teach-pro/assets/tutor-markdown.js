/* Local Markdown presentation. The chat file always retains the original text. */
(() => {
  'use strict';
  const base = new URL('.', document.currentScript.src);
  function load(file, available) {
    if (available()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('vendor/' + file, base).href;
      script.onload = () => available() ? resolve() : reject(new Error('回答排版组件未加载'));
      script.onerror = () => reject(new Error('回答排版组件未安装，请更新课程运行资产'));
      document.head.append(script);
    });
  }
  const ready = Promise.all([load('marked.umd.js', () => !!window.marked), load('purify.min.js', () => !!window.DOMPurify)]);
  // Keep the promise handled even when an empty conversation never renders Markdown.
  ready.catch(() => {});
  const escape = text => String(text).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  async function render(target, text) {
    await ready;
    const renderer = new window.marked.Renderer();
    renderer.html = token => escape(token.text);
    renderer.image = token => `<span>〔图片：${escape(token.text || '示意图')}〕</span>`;
    const html = window.marked.parse(text, { renderer, gfm: true, breaks: false, async: false });
    target.innerHTML = window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'del', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'span'],
      ALLOWED_ATTR: ['href', 'title', 'start', 'class'],
      ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false,
    });
    target.classList.add('tutor-markdown');
    target.querySelectorAll('h1, h2').forEach(heading => {
      const smaller = document.createElement(heading.tagName === 'H1' ? 'h3' : 'h4');
      smaller.append(...heading.childNodes); heading.replaceWith(smaller);
    });
    target.querySelectorAll('a').forEach(link => {
      try {
        const url = new URL(link.getAttribute('href'));
        if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) throw new Error();
        link.target = '_blank'; link.rel = 'noopener noreferrer';
      } catch { link.removeAttribute('href'); }
    });
    target.querySelectorAll('table').forEach(table => {
      const wrapper = document.createElement('div'); wrapper.className = 'tutor-table-wrap';
      wrapper.tabIndex = 0; wrapper.setAttribute('aria-label', '表格，可横向滚动');
      table.before(wrapper); wrapper.append(table);
    });
    target.querySelectorAll('pre').forEach(pre => {
      const wrapper = document.createElement('div'); wrapper.className = 'tutor-code-block';
      const tools = document.createElement('div'); tools.className = 'tutor-code-tools';
      const language = document.createElement('span');
      language.textContent = pre.querySelector('code')?.className.match(/language-([\w+-]+)/)?.[1] || '代码';
      const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = '复制代码';
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(pre.textContent); copy.textContent = '已复制'; }
        catch { copy.textContent = '请选中代码复制'; }
        setTimeout(() => { copy.textContent = '复制代码'; }, 1800);
      });
      tools.append(language, copy); pre.before(wrapper); wrapper.append(tools, pre);
    });
  }
  window.TutorMarkdown = { ready, render };
})();
