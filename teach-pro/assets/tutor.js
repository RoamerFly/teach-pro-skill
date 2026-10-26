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
  const supplement = main.dataset.lessonKind === 'supplement' || /^\d+-s\d+-/.test(lesson);
  const number = Number(supplement ? (main.dataset.relatedLesson || lesson.match(/^(\d+)-/)?.[1]) : (entry.dataset.lessonNumber || lesson.match(/^(\d+)-/)?.[1]));
  const heading = context.querySelector('h1, .lesson-toolbar-title');
  if (heading && Number.isInteger(number) && number > 0) {
    const title = heading.textContent.trim().replace(/^第\s*(?:\d+|[一二三四五六七八九十百]+)\s*课(?:\s*补充)?\s*[·:：—-]\s*/, '');
    heading.textContent = '第 ' + number + ' 课' + (supplement ? '补充' : '') + ' · ' + title;
  }
  let kindLabel = main.querySelector('.lesson-kind-label');
  if (!kindLabel) { kindLabel = document.createElement('span'); kindLabel.className = 'lesson-kind-label'; details.prepend(kindLabel); if (!details.isConnected) entry.after(details); }
  kindLabel.textContent = supplement ? '补充课' : '正式课';
  for (const text of context.querySelectorAll('h1, .lesson-toolbar-title, .lead')) text.title = text.textContent.trim();
  const measure = () => document.documentElement.style.setProperty('--lesson-toolbar-height', Math.ceil(entry.getBoundingClientRect().height) + 'px');
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(entry);
  measure(); window.addEventListener('resize', measure);
  const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true">'+({copy:'<rect x="8" y="8" width="12" height="12" rx="3"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',edit:'<path d="m15 4 5 5M4 20l4-1L21 6l-5-5L3 14Z"/>',retry:'<path d="M20 8a8 8 0 1 0 0 8M20 2v6h-6"/>',left:'<path d="m15 6-6 6 6 6"/>',right:'<path d="m9 6 6 6-6 6"/>',attach:'<path d="M8 12v5a4 4 0 0 0 8 0V6a3 3 0 0 0-6 0v10a1 1 0 0 0 2 0V7"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',send:'<path d="m6 11 6-6 6 6M12 5v15"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',file:'<path d="M14 3H5v18h14V8Zm0 0v5h5M8 12h8M8 16h6"/>'}[name]||'')+'</svg>';
  const dialog=document.createElement('dialog');dialog.id='tutor-dialog';dialog.className='tutor-dialog';dialog.setAttribute('aria-labelledby','tutor-title');
  dialog.innerHTML=`<header class="tutor-header"><div class="tutor-heading"><span class="tutor-eyebrow">本课的学习对话</span><h2 id="tutor-title">课内答疑</h2></div><span class="tutor-connection" data-tutor-model></span><details class="tutor-more"><summary aria-label="更多操作">···</summary><div class="tutor-menu"><a data-tutor-settings>课程设置</a><button type="button" data-tutor-connect hidden>重新连接</button><button type="button" data-tutor-export>导出聊天记录</button><button type="button" data-tutor-clear>清空本课聊天</button></div></details><button type="button" class="tutor-icon" data-tutor-close aria-label="关闭答疑">×</button></header>
  <div class="tutor-conversation"><div class="tutor-messages" role="log" aria-label="本课答疑记录" aria-live="off"></div><button type="button" class="tutor-jump" hidden>查看最新消息 ↓</button></div>
  <form class="tutor-question"><div class="tutor-selection" hidden><span data-selection-text></span><button type="button" class="tutor-icon" data-tutor-unselect aria-label="移除引用">×</button></div><div class="tutor-composer"><div data-tutor-attachments class="tutor-attachments" hidden></div><label class="tutor-prompt-label" for="tutor-message">继续提问</label><div class="tutor-input-row"><textarea id="tutor-message" maxlength="4000" rows="1" placeholder="哪里还没想明白？" aria-label="向本课 AI 提问"></textarea><button type="submit" class="tutor-send" aria-label="发送问题">${icon('send')}</button></div><div class="tutor-composer-tools"><button type="button" class="tutor-icon" data-tutor-attach title="添加图片或文本附件" aria-label="添加附件">${icon('attach')}</button><input type="file" data-tutor-files multiple accept="image/png,image/jpeg,image/webp,image/gif,.txt,.md,.csv,.json,.py,.js,.ts,.html,.css,.xml,.yaml,.yml,.log" hidden><select data-tutor-model-select aria-label="本次答疑模型"></select><button type="button" class="tutor-icon" data-tutor-models title="获取模型列表" aria-label="获取模型列表">${icon('retry')}</button><select data-tutor-effort aria-label="思考程度"></select></div></div><p class="tutor-status" role="status" aria-live="polite" hidden></p></form>`;
  document.body.append(dialog);
  const find=q=>dialog.querySelector(q),opener=actions.querySelector('button'),prompt=find('#tutor-message'),log=find('.tutor-messages'),status=find('.tutor-status'),jump=find('.tutor-jump');
  find('[data-tutor-settings]').href=settings;find('.tutor-eyebrow').textContent=document.querySelector('main h1')?.textContent.trim().slice(0,80)||'本课的学习对话';
  const modelPicker=find('[data-tutor-model-select]'),effortPicker=find('[data-tutor-effort]');
  let token='',online=false,configured=false,busy=false,uploading=false,stopping=false,stopWanted=false,requestAccepted=false,requestId='',selection='',selectionSection='',record={messages:[]},composing=false,rendering=0,configVersion=null,configuration={},pickedModel='',pickedEffort='auto',destination='',attachments=[],editing=null,fileTarget='composer';
  const imageCache=new Map(),reasoningOpen=new Map();
  function say(message='',error=false){status.textContent=error?message:'';status.hidden=!error;status.dataset.state=error?'error':'ready';}
  const visible=data=>data.active_path?data.active_path.map(id=>data.messages.find(m=>m.id===id)).filter(Boolean):(data.messages||[]);
  const nearBottom=()=>log.scrollHeight-log.scrollTop-log.clientHeight<90;
  function latest(){log.scrollTop=log.scrollHeight;jump.hidden=true;}
  function controls(){
    const send=find('button[type="submit"]'),generating=busy&&!!requestId;
    send.disabled=generating?(stopping||stopWanted):!online||!configured||busy||uploading||(!prompt.value.trim()&&!attachments.length);
    send.innerHTML=icon(generating?'stop':'send');send.title=generating?'停止生成':'发送问题';send.setAttribute('aria-label',send.title);send.classList.toggle('is-stop',generating);
    for(const q of ['[data-tutor-clear]','[data-tutor-export]'])find(q).disabled=busy||!record.messages.length;
    find('[data-tutor-connect]').hidden=online;find('[data-tutor-connect]').disabled=busy;
    for(const el of dialog.querySelectorAll('[data-tutor-retry],[data-tutor-continue],[data-tutor-branch],[data-tutor-edit],[data-tutor-regenerate]'))el.disabled=busy||!online||(!el.dataset.tutorBranch&&!configured)||el.dataset.edge==='true';
    for(const el of [modelPicker,effortPicker,find('[data-tutor-models]'),find('[data-tutor-attach]')])el.disabled=busy||uploading||!online||!configured;
    find('.tutor-question').setAttribute('aria-busy',String(busy));
  }
  async function api(route,body){
    const options={credentials:'omit',cache:'no-store',headers:{'X-Teach-Token':token}};
    if(body!==undefined){options.method='POST';options.headers['Content-Type']='application/json';options.body=JSON.stringify(body);}
    const response=await fetch('/api/tutor/'+route,options),result=await response.json();if(!response.ok)throw new Error(result.error||'课程服务请求失败');return result;
  }
  function capabilities(){
    const model=modelPicker.value||configuration.model||'',meta=configuration.model_catalog?.find(m=>m.id===model)||{};
    let levels=meta.effort?.supported_levels||[];
    if(!levels.length){if(configuration.kind==='deepseek'&&['deepseek-flash','deepseek-v4-pro'].includes(model))levels=['low','high','max'];else if(/^(o[134](?:-|$)|gpt-[56])|reasoner|thinking|qwen3|gpt-oss|deepseek-r1/i.test(model))levels=['low','medium','high'];}
    const values=['auto',...(configuration.kind==='deepseek'||meta.thinking_toggle?['none']:[]),...levels],labels={auto:'思考：自动',none:'思考：关闭',minimal:'思考：极低',low:'思考：低',medium:'思考：中',high:'思考：高',xhigh:'思考：很高',max:'思考：最高'};
    effortPicker.replaceChildren(...[...new Set(values)].map(v=>new Option(labels[v]||v,v)));if(!values.includes(pickedEffort))pickedEffort='auto';effortPicker.value=pickedEffort;effortPicker.hidden=values.length===1;
  }
  function pickers(saved){
    const previousDefault=configuration.model;
    if(!pickedModel||pickedModel===previousDefault)pickedModel=saved.model||'';
    configuration=saved;const next=JSON.stringify([saved.kind,saved.base_url]);if(destination&&destination!==next){pickedModel='';pickedEffort='auto';}destination=next;
    const items=[...(saved.model_catalog||[])];if(saved.model&&!items.some(m=>m.id===saved.model))items.unshift({id:saved.model,name:saved.model});
    modelPicker.replaceChildren(...items.map(m=>new Option(m.name||m.id,m.id)));if(!items.length)modelPicker.add(new Option('未连接模型',''));
    if(!items.some(m=>m.id===pickedModel))pickedModel=saved.model||'';modelPicker.value=pickedModel;capabilities();
  }
  modelPicker.addEventListener('change',()=>{pickedModel=modelPicker.value;pickedEffort='auto';capabilities();find('[data-tutor-model]').textContent=pickedModel;});effortPicker.addEventListener('change',()=>{pickedEffort=effortPicker.value;});
  find('[data-tutor-models]').addEventListener('click',async()=>{if(busy)return;busy=true;controls();try{await api('models',{kind:configuration.kind,base_url:configuration.base_url,mode:configuration.mode});await refreshConfig();say();}catch(e){say(e.message,true);}finally{busy=false;controls();}});
  async function imageUrl(item){if(!imageCache.has(item.id))imageCache.set(item.id,(async()=>{const r=await fetch('/api/tutor/attachment/'+encodeURIComponent(item.id),{headers:{'X-Teach-Token':token},cache:'no-store',credentials:'omit'});if(!r.ok)throw new Error('图片无法读取');return URL.createObjectURL(await r.blob());})());return imageCache.get(item.id);}
  function showAttachments(parent,items,remove){
    parent.replaceChildren();parent.hidden=!items.length;
    for(const item of items){const card=document.createElement('div');card.className='tutor-attachment';const name=document.createElement('span');name.textContent=item.name;name.title=item.name;
      if(item.mime?.startsWith('image/')){const img=document.createElement('img');img.alt=item.name;card.append(img);imageUrl(item).then(url=>{if(img.isConnected)img.src=url;}).catch(()=>{});}else{const mark=document.createElement('span');mark.innerHTML=icon('file');card.append(mark);}
      card.append(name);if(remove){const close=button('close','移除附件：'+item.name,()=>remove(item.id));card.append(close);}parent.append(card);
    }
  }
  function draftAttachments(){showAttachments(find('[data-tutor-attachments]'),attachments,id=>{attachments=attachments.filter(a=>a.id!==id);draftAttachments();controls();});}
  function chooseFiles(target='composer'){fileTarget=target;find('[data-tutor-files]').click();}
  async function upload(files,target='composer'){
    if(!files.length||busy||uploading)return;const previous=target==='edit'?editing?.attachments||[]:attachments;
    if(files.length+previous.length>8||[...files,...previous].reduce((sum,f)=>sum+(f.size||f.bytes||0),0)>20*1024*1024){say('本次可添加 8 个附件，总大小 20 MB。',true);return;}
    uploading=true;controls();try{
      const payload=[];for(const file of files){const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});payload.push({name:file.name,data});}
      const result=await api('upload',{files:payload});if(target==='edit'&&editing){editing.attachments.push(...result.attachments);await render(record);}else{attachments.push(...result.attachments);draftAttachments();}say();
    }catch(e){say(e.message||'附件上传失败',true);}finally{uploading=false;find('[data-tutor-files]').value='';controls();}
  }
  find('[data-tutor-attach]').addEventListener('click',()=>chooseFiles());find('[data-tutor-files]').addEventListener('change',e=>upload([...e.target.files],fileTarget));
  dialog.addEventListener('paste',e=>{if(e.clipboardData?.files.length){e.preventDefault();upload([...e.clipboardData.files],e.target.closest('.tutor-edit')?'edit':'composer');}});
  dialog.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();find('.tutor-composer').classList.add('is-dragging');}});
  dialog.addEventListener('dragleave',e=>{if(!dialog.contains(e.relatedTarget))find('.tutor-composer').classList.remove('is-dragging');});
  dialog.addEventListener('drop',e=>{find('.tutor-composer').classList.remove('is-dragging');if(e.dataTransfer.files.length){e.preventDefault();upload([...e.dataTransfer.files],e.target.closest('.tutor-edit')?'edit':'composer');}});
  async function streamChat(body,receive){
    const response=await fetch('/api/tutor/chat-stream/'+lesson,{method:'POST',credentials:'omit',cache:'no-store',headers:{'X-Teach-Token':token,'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!response.ok){const result=await response.json();throw new Error(result.error||'课程服务请求失败');}
    if(!response.headers.get('Content-Type')?.includes('application/x-ndjson')||!response.body)throw new Error('请更新课程流式组件。');
    const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let buffer='',finished=false;
    try{while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});let end;
      while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!line.trim())continue;const item=JSON.parse(line);if(item.event==='error')throw new Error(item.data.error||'回答中断');if(!['pending','delta','reasoning','done'].includes(item.event))throw new Error('流式数据不兼容');await receive(item.event,item.data);if(item.event==='done')finished=true;}if(done)break;
    }if(!finished||buffer.trim())throw new Error('回答中断，可重新回答。');}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  }
  function button(name,label,action){const b=document.createElement('button');b.type='button';b.className='tutor-icon-action';b.innerHTML=icon(name);b.title=label;b.setAttribute('aria-label',label);b.addEventListener('click',action);return b;}
  async function copy(text,b){try{await navigator.clipboard.writeText(text);b.dataset.copied='true';b.title='已复制';setTimeout(()=>{b.dataset.copied='';b.title=b.getAttribute('aria-label');},1500);}catch{say('无法访问剪贴板，可选中文字复制。',true);}}
  function reasoningBlock(text,id,seconds){const d=document.createElement('details');d.className='tutor-reasoning';d.hidden=!text;d.open=reasoningOpen.get(id)||false;const h=document.createElement('summary');h.textContent='已思考'+(seconds?' · '+seconds+' 秒':'');const content=document.createElement('div');content.className='tutor-reasoning-body';content.textContent=text;d.append(h,content);d.addEventListener('toggle',()=>reasoningOpen.set(id,d.open));return d;}
  function branchTools(message,tools,data){
    if(!message.id)return;const siblings=data.messages.filter(m=>m.role===message.role&&(m.parent_id??null)===(message.parent_id??null));if(siblings.length<2)return;
    const index=siblings.findIndex(m=>m.id===message.id),nav=document.createElement('span');nav.className='tutor-versions';
    for(const [direction,offset] of [['left',-1],['right',1]]){const b=button(direction,offset<0?'上一个版本':'下一个版本',()=>switchBranch(siblings[index+offset].id));b.dataset.tutorBranch=message.id;b.disabled=index+offset<0||index+offset>=siblings.length;b.dataset.edge=String(b.disabled);if(offset===1){const counter=document.createElement('span');counter.textContent=(index+1)+' / '+siblings.length;nav.append(counter);}nav.append(b);}tools.append(nav);
  }
  async function render(data,forceBottom=false){
    const revision=++rendering,follow=forceBottom||nearBottom(),position=log.scrollTop;record=data;const fragment=document.createDocumentFragment(),items=visible(data),lastUser=[...items].reverse().find(m=>m.role==='user');
    for(const message of items){
      const box=document.createElement('article');box.className='tutor-message '+(message.role==='assistant'?'is-assistant':'is-user');box.dataset.messageId=message.id||'';
      const label=document.createElement('div');label.className='tutor-message-label';label.textContent=message.role==='assistant'?'答疑 AI':'你';box.append(label);
      if(editing&&editing.id===message.id){
        box.classList.add('is-editing');const edit=document.createElement('div');edit.className='tutor-edit';const area=document.createElement('textarea');area.value=editing.text;area.maxLength=4000;area.setAttribute('aria-label','修改问题');area.addEventListener('input',()=>editing.text=area.value);
        const files=document.createElement('div');files.className='tutor-attachments';showAttachments(files,editing.attachments,id=>{editing.attachments=editing.attachments.filter(a=>a.id!==id);render(record);});
        const buttons=document.createElement('div');buttons.className='tutor-edit-actions';buttons.append(button('attach','为修改的问题添加附件',()=>chooseFiles('edit')));
        const cancel=document.createElement('button');cancel.type='button';cancel.textContent='取消';cancel.addEventListener('click',()=>{editing=null;render(record);});const submit=document.createElement('button');submit.type='button';submit.textContent='发送';submit.className='button--primary';submit.addEventListener('click',()=>{if(editing&&!busy&&!uploading)send(editing.text,{edit_id:editing.id,attachments:editing.attachments.map(a=>a.id),selection:message.selection||'',selection_section:message.selection_context?.section||''});});buttons.append(cancel,submit);edit.append(area,files,buttons);box.append(edit);
      }else{
        if(message.reasoning){const thought=reasoningBlock(message.reasoning,message.id,message.diagnostics?.reasoning_ms?Math.max(1,Math.round(message.diagnostics.reasoning_ms/1000)):null);try{await(await markdown).render(thought.lastElementChild,message.reasoning);}catch{}box.append(thought);}
        const body=document.createElement('div');body.className='tutor-message-body';body.textContent=message.content;box.append(body);
        if(message.role==='assistant'){try{await(await markdown).render(body,message.content);}catch{body.className='tutor-plain';}}
        if(message.attachments?.length){const files=document.createElement('div');files.className='tutor-attachments';showAttachments(files,message.attachments);box.append(files);}
        if(message.status!=='complete'&&!(message.status==='pending'&&busy)&&(message.role==='assistant'||!items.some(m=>m.role==='assistant'&&m.reply_to===message.id))){const note=document.createElement('p');note.className='tutor-message-note';note.textContent=message.status==='stopped'?'已停止生成':message.error||message.note||'回答尚未完成';box.append(note);}
        const tools=document.createElement('div');tools.className='tutor-message-tools';const duplicate=button('copy',message.role==='assistant'?'复制回答':'复制问题',()=>copy(message.content,duplicate));tools.append(duplicate);
        if(message.role==='user'&&message.id){const edit=button('edit','修改问题',()=>{editing={id:message.id,text:message.content,attachments:[...(message.attachments||[])]};render(record).then(()=>{const input=log.querySelector('.tutor-edit textarea');input?.focus({preventScroll:true});});});edit.dataset.tutorEdit=message.id;tools.append(edit);}
        if(message.role==='assistant'&&message.id){const regenerate=button('retry','重新生成',()=>send(items.find(m=>m.id===message.reply_to)?.content||'重新回答',{regenerate_id:message.id}));regenerate.dataset.tutorRegenerate=message.id;tools.append(regenerate);}
        if(message===items.at(-1)&&message.role==='assistant'&&['incomplete','stopped'].includes(message.status)&&message.content&&message.reply_to){const resume=document.createElement('button');resume.type='button';resume.className='tutor-text-action';resume.dataset.tutorContinue=message.reply_to;resume.textContent='继续回答';resume.addEventListener('click',()=>send('请继续回答',{continue_id:message.reply_to}));tools.append(resume);}
        if(message===lastUser&&['failed','incomplete','pending','stopped'].includes(message.status)&&message.id&&!(message.status==='pending'&&busy)){const retry=document.createElement('button');retry.type='button';retry.className='tutor-text-action';retry.dataset.tutorRetry=message.id;retry.textContent='重新回答';retry.addEventListener('click',()=>send(message.content,{retry_id:message.id}));tools.append(retry);}
        branchTools(message,tools,data);box.append(tools);
      }fragment.append(box);
    }
    if(!items.length){const empty=document.createElement('div');empty.className='tutor-empty';empty.innerHTML='<span class="tutor-empty-mark" aria-hidden="true">✦</span><h3>把疑问留在这一课</h3><p>从一个没理解的概念开始，或选中课文，再点“问 AI”。</p><div class="tutor-suggestions"></div>';
      if(configured){for(const text of ['用一个具体例子解释本课核心概念','帮我区分本课容易混淆的两个概念','给我一道检查理解的小题']){const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',()=>{prompt.value=text;grow();controls();prompt.focus();});empty.querySelector('.tutor-suggestions').append(b);}}else{const a=document.createElement('a');a.href=settings;a.className='button button--primary';a.textContent='连接答疑模型';empty.append(a);}fragment.append(empty);
    }
    if(revision!==rendering)return;log.replaceChildren(fragment);if(follow)latest();else{log.scrollTop=position;jump.hidden=false;}controls();
  }
  async function switchBranch(id){if(busy||uploading)return;editing=null;busy=true;controls();try{await render(await api('branch/'+lesson,{message_id:id}));say();}catch(e){say(e.message,true);}finally{busy=false;controls();}}
  async function refreshConfig(){const r=await api('bootstrap');token=r.token;configured=r.configured;const version=JSON.stringify([token,configured,r.settings]),changed=configVersion!==null&&configVersion!==version;configVersion=version;pickers(r.settings||{});find('[data-tutor-model]').textContent=configured?pickedModel:'未连接模型';find('[data-tutor-model]').dataset.connected=String(configured);return changed;}
  async function stop(){if(!requestId||stopping)return;stopWanted=true;if(!requestAccepted){controls();return;}stopping=true;controls();try{await api('stop/'+lesson,{request_id:requestId});}catch(e){if(busy&&!e.message.includes('已结束'))say(e.message,true);}finally{stopping=false;controls();}}
  async function send(message,options={}){
    if(busy||uploading||(!message.trim()&&!(options.attachments||attachments).length))return;
    const operation=Object.keys(options).some(k=>k.endsWith('_id')),sentFiles=options.attachments??(operation?[]:attachments.map(a=>a.id)),sentSelection=options.selection??(operation?'':selection);
    busy=true;requestId=crypto.randomUUID();stopping=false;stopWanted=false;requestAccepted=false;controls();let body,thoughtBody,thoughtDetails,draft='',thoughtDraft='',timer,painting=Promise.resolve(),active=true,accepted=false,firstThought=0,bodyStarted=false;
    const paint=()=>{timer=null;const text=draft,thinking=thoughtDraft;painting=painting.then(async()=>{if(!active||!body?.isConnected)return;const follow=nearBottom(),position=log.scrollTop;try{if(text)await(await markdown).render(body,text);else body.textContent=thinking?'':'···';if(thinking){thoughtDetails.hidden=false;await(await markdown).render(thoughtBody,thinking);}}catch{body.textContent=text;thoughtBody.textContent=thinking;}if(follow)latest();else{log.scrollTop=position;jump.hidden=false;}});};
    try{
      await refreshConfig();if(!configured)throw new Error('先在课程设置中连接模型。');say();if(stopWanted)return;
      await streamChat({message,selection:sentSelection,selection_section:options.selection_section??(sentSelection?selectionSection:''),attachments:sentFiles,model:modelPicker.value,reasoning_effort:effortPicker.value||'auto',request_id:requestId,expected_leaf:record.active_leaf??null,...options},async(event,data)=>{
        if(event==='pending'){
          accepted=true;requestAccepted=true;if(options.edit_id)editing=null;await render(data);
          if(!operation){if(prompt.value===message){prompt.value='';grow();}attachments=[];draftAttachments();selection='';selectionSection='';showSelection();}
          const box=document.createElement('article');box.className='tutor-message is-assistant is-streaming';const label=document.createElement('div');label.className='tutor-message-label';label.textContent='答疑 AI';thoughtDetails=reasoningBlock('',requestId);thoughtBody=thoughtDetails.lastElementChild;body=document.createElement('div');body.textContent='···';box.append(label,thoughtDetails,body);log.append(box);if(nearBottom())latest();if(stopWanted)await stop();
        }else if(event==='delta'||event==='reasoning'){
          if(typeof data.text!=='string'||!body)throw new Error('流式内容格式不兼容。');
          if(event==='reasoning'){if(!firstThought){firstThought=performance.now();thoughtDetails.open=true;}thoughtDraft+=data.text;thoughtDetails.querySelector('summary').textContent='思考中…';}
          else{if(!bodyStarted){bodyStarted=true;if(firstThought){thoughtDetails.querySelector('summary').textContent='已思考 · '+Math.max(1,Math.round((performance.now()-firstThought)/1000))+' 秒';thoughtDetails.open=false;}}draft+=data.text;}
          if(!timer)timer=setTimeout(paint,60);
        }else{clearTimeout(timer);active=false;await painting;await render(data);say();}
      });
    }catch(e){clearTimeout(timer);active=false;await painting;try{const restored=await api('history/'+lesson);await render(restored);accepted||=visible(restored).some(m=>m.role==='user'&&m.content===message);}catch{}
      const tail=visible(record).at(-1);say(tail&&['incomplete','stopped'].includes(tail.status)?'':e.message||'连接中断',true);
    }finally{clearTimeout(timer);active=false;busy=false;requestId='';stopping=false;stopWanted=false;requestAccepted=false;controls();}
  }
  function grow(){prompt.style.height='auto';prompt.style.height=Math.min(prompt.scrollHeight,96)+'px';}
  prompt.addEventListener('input',()=>{grow();controls();});prompt.addEventListener('compositionstart',()=>composing=true);prompt.addEventListener('compositionend',()=>composing=false);
  prompt.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&!composing&&e.keyCode!==229){e.preventDefault();if(!busy&&!find('button[type="submit"]').disabled)send(prompt.value);}});
  find('.tutor-question').addEventListener('submit',e=>{e.preventDefault();if(busy&&requestId)stop();else if(!find('button[type="submit"]').disabled)send(prompt.value);});
  function showSelection(){find('.tutor-selection').hidden=!selection;find('[data-selection-text]').textContent=selection;}
  function captureSelection(){const selected=window.getSelection();if(selected?.rangeCount&&main?.contains(selected.anchorNode)&&main.contains(selected.focusNode)&&!entry.contains(selected.anchorNode)&&!dialog.contains(selected.anchorNode)){const text=selected.toString().trim();if(text){selection=text.slice(0,2000);const n=selected.getRangeAt(0).commonAncestorContainer,e=n.nodeType===Node.ELEMENT_NODE?n:n.parentElement;selectionSection=e?.closest('[id]')?.id||'';}}showSelection();}
  async function open(){if(dialog.open)return;captureSelection();dialog.showModal();grow();prompt.focus({preventScroll:true});if(online&&!busy)try{await refreshConfig();await render(await api('history/'+lesson),true);say();}catch(e){say(e.message,true);}controls();}
  opener.addEventListener('pointerdown',captureSelection);opener.addEventListener('click',open);find('[data-tutor-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{find('.tutor-more').open=false;opener.focus({preventScroll:true});});dialog.addEventListener('cancel',e=>{if(find('.tutor-more').open){e.preventDefault();find('.tutor-more').open=false;find('.tutor-more summary').focus();}});
  dialog.addEventListener('click',e=>{if(!e.target.closest('.tutor-more'))find('.tutor-more').open=false;});find('[data-tutor-unselect]').addEventListener('click',()=>{selection='';selectionSection='';showSelection();prompt.focus();});jump.addEventListener('click',latest);log.addEventListener('scroll',()=>{if(nearBottom())jump.hidden=true;});
  find('[data-tutor-export]').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=lesson+'-chat.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);find('.tutor-more').open=false;});
  find('[data-tutor-clear]').addEventListener('click',async()=>{find('.tutor-more').open=false;if(busy||!confirm('清空本课聊天？此操作无法撤销，练习答案和其他课节不受影响。'))return;busy=true;controls();try{editing=null;await render(await api('clear/'+lesson,{confirm:true}),true);say();}catch(e){say(e.message,true);}finally{busy=false;controls();}});
  const nav=document.querySelector('[data-toc]');if(nav){const li=document.createElement('li'),a=document.createElement('a');a.href='#lesson-tutor';a.textContent='课内 AI 答疑';li.append(a);nav.append(li);a.addEventListener('click',e=>{e.preventDefault();open();});}
  window.addEventListener('hashchange',()=>{if(location.hash==='#lesson-tutor')open();});
  async function start(){controls();if(location.protocol!=='http:'||location.hostname!=='127.0.0.1'){say('运行课程启动器后，即可使用 AI 答疑。',true);await render(record);return;}try{await refreshConfig();online=true;await render(await api('history/'+lesson),true);say();}catch(e){online=false;say('课程服务未连接：'+e.message,true);await render(record);}controls();}
  find('[data-tutor-connect]').addEventListener('click',start);window.addEventListener('focus',async()=>{if(!online||busy)return;try{await refreshConfig();controls();}catch(e){configured=false;say(e.message,true);controls();}});
  window.addEventListener('beforeunload',()=>{for(const value of imageCache.values())value.then(URL.revokeObjectURL).catch(()=>{});});
  start().then(()=>{if(location.hash==='#lesson-tutor')open();});
})();
