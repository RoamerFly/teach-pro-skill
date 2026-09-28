/* Course-wide model settings only; no lesson context or chat is read here. */
(() => {
  'use strict';
  const section = document.querySelector('[data-tutor-settings-page]');
  if (!section) return;
  const form = section.querySelector('.tutor-config');
  const consent = section.querySelector('[data-settings-consent]');
  const status = section.querySelector('.tutor-status');
  const current = section.querySelector('[data-settings-current]');
  const test = section.querySelector('[data-settings-test]');
  const fetchModels = section.querySelector('[data-settings-models]');
  const forget = section.querySelector('[data-settings-forget]');
  const kind = form.elements.kind;
  const model = form.elements.model;
  const manual = section.querySelector('[data-model-manual]');
  const keyToggle = section.querySelector('[data-key-toggle]');
  const protocol = section.querySelector('[data-settings-protocol]');
  let kinds = {};
  let token = '', online = false, configured = false, busy = false;
  const lesson = new URLSearchParams(location.search).get('lesson');
  if (/^[a-z0-9][a-z0-9-]{0,79}$/.test(lesson || '')) {
    document.querySelectorAll('[data-settings-return]').forEach(link => {
      link.href = './lessons/' + lesson + '.html#lesson-tutor';
      link.textContent = '返回本课答疑 →';
    });
  }
  function say(message, error = false) { status.textContent = message; status.dataset.state = error ? 'error' : 'ready'; }
  function controls() {
    section.querySelectorAll('button, input, select').forEach(field => { field.disabled = !online || busy; });
    form.querySelector('button[type="submit"]').disabled = !online || busy || !consent.checked;
    fetchModels.disabled = !online || busy || !consent.checked;
    test.disabled = !online || busy || !configured || !consent.checked;
    forget.disabled = !online || busy;
  }
  async function api(route, body) {
    const options = { credentials: 'omit', cache: 'no-store', headers: { 'X-Teach-Token': token } };
    if (body !== undefined) { options.method = 'POST'; options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
    const response = await fetch('/api/tutor/' + route, options);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '课程设置请求失败');
    return result;
  }
  function showCurrent(result) {
    const saved = result.settings || {};
    current.textContent = result.configured
      ? '当前已启用：' + (kinds[saved.kind]?.label || '自定义') + ' · ' + saved.provider + ' / ' + saved.model + '。所有课节共享此连接。'
      : '模型会话未启用；保存配置后可在各课答疑。服务重启后需重新输入 Key。';
  }
  function showProtocol() {
    const preset = kinds[kind.value];
    protocol.textContent = preset ? preset.note + ' 请求：POST /chat/completions；输出上限参数：' + preset.token_parameter + '；非流式文本。' : '启动本地课程服务后可查看服务类型对应的协议规范。';
  }
  function setModels(items, selected = '') {
    model.replaceChildren();
    model.add(new Option(items.length ? '请选择模型' : '请先获取模型', ''));
    for (const item of items) model.add(new Option(item.name === item.id ? item.id : item.name + ' · ' + item.id, item.id));
    if (selected && !items.some(item => item.id === selected)) model.add(new Option(selected + (items.length ? '（未在本次列表中）' : '（已保存，可刷新列表核对）'), selected));
    model.add(new Option('手动填写模型 ID…', '__manual__'));
    model.value = selected || '';
    syncManual();
  }
  function syncManual() {
    const active = model.value === '__manual__';
    manual.hidden = !active;
    form.elements.model_manual.disabled = !active;
    form.elements.model_manual.required = active;
  }
  function hideKey() {
    form.elements.api_key.type = 'password';
    keyToggle.setAttribute('aria-pressed', 'false');
    keyToggle.setAttribute('aria-label', '显示 API Key');
    keyToggle.title = '显示 API Key';
  }
  model.addEventListener('change', syncManual);
  keyToggle.addEventListener('click', () => {
    const showing = form.elements.api_key.type === 'password';
    form.elements.api_key.type = showing ? 'text' : 'password';
    keyToggle.setAttribute('aria-pressed', String(showing));
    keyToggle.setAttribute('aria-label', showing ? '隐藏 API Key' : '显示 API Key');
    keyToggle.title = showing ? '隐藏 API Key' : '显示 API Key';
  });
  function applyPreset() {
    const preset = kinds[kind.value];
    if (!preset) return;
    if (kind.value !== 'custom') {
      form.elements.base_url.value = preset.base_url;
      form.elements.mode.value = preset.mode;
      form.elements.provider.value = preset.label;
    }
    form.elements.api_key.value = '';
    hideKey();
    setModels([]);
    showProtocol();
  }
  kind.addEventListener('change', applyPreset);
  async function act(fn) {
    if (busy) return;
    busy = true; controls();
    try { await fn(); } catch (error) { say(error.message || '请求失败', true); }
    finally { busy = false; controls(); }
  }
  consent.addEventListener('change', controls);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!online || busy || !consent.checked) return;
    const data = Object.fromEntries(new FormData(form));
    if (data.model === '__manual__') data.model = data.model_manual.trim();
    delete data.model_manual;
    data.max_tokens = Number(data.max_tokens); data.consent = true;
    act(async () => {
      try {
        const result = await api('config', data);
        configured = result.configured; showCurrent(result);
        say('设置已保存；所有课节共用此连接，Key 仅在服务内存中。可测试连接或返回课程提问。');
      } finally { form.elements.api_key.value = ''; data.api_key = ''; hideKey(); }
    });
  });
  function edited(event) {
    if (event.target === consent) return;
    configured = false; consent.checked = false;
    say('表单已修改，尚未应用；课程仍使用上次已保存的连接。请确认说明并重新保存。');
    controls();
  }
  form.addEventListener('input', edited);
  form.addEventListener('change', edited);
  fetchModels.addEventListener('click', () => act(async () => {
    const data = { kind: kind.value, base_url: form.elements.base_url.value.trim(), mode: form.elements.mode.value,
      api_key: form.elements.api_key.value, consent: true };
    say('正在获取模型列表（不发送课程内容）…');
    const result = await api('models', data);
    setModels(result.models || []);
    say(result.message + (result.models.length ? '请选择模型，然后保存设置。' : '列表为空，可手动填写模型 ID。'));
    data.api_key = '';
  }));
  test.addEventListener('click', () => act(async () => {
    say('正在测试兼容接口（可能计费）…');
    const result = await api('test', {}); say(result.message);
  }));
  forget.addEventListener('click', () => act(async () => {
    await api('forget', {}); configured = false; form.elements.api_key.value = ''; hideKey(); consent.checked = false;
    showCurrent({ configured: false }); say('会话密钥已忘记；所有课节暂停答疑，已有聊天仍保留。');
  }));
  async function start() {
    controls();
    if (location.protocol !== 'http:' || location.hostname !== '127.0.0.1') {
      say('静态阅读模式：请通过当前系统的课程启动器打开本地服务后配置 AI。当前不保存配置或请求模型。'); return;
    }
    try {
      const result = await api('bootstrap'); token = result.token; configured = result.configured; online = true;
      kinds = result.kinds || {};
      for (const [key, value] of Object.entries(result.settings || {})) {
        if (form.elements[key] && key !== 'api_key' && key !== 'model') form.elements[key].value = value;
      }
      setModels([], result.settings?.model || '');
      if (!result.settings || !Object.keys(result.settings).length) applyPreset();
      else { kind.value = result.settings.kind || 'custom'; showProtocol(); }
      showCurrent(result); say('课程设置已连接；非密钥配置已恢复，API Key 不会回显。');
    } catch (error) { say('课程设置不可用：' + error.message + '。核心课程仍可阅读。', true); }
    controls();
  }
  start();
})();
