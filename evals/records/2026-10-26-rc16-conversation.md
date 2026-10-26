# rc.16 分支与图文答疑

日期：2026-10-26。新增能力保存在 Skill 共享组件中，Demo 复制同一运行文件。

## 行为

- 问题与回答支持复制；修改旧问题建立新分支，重新生成创建回答版本，左右切换可恢复各分支后续消息。服务按父链构建当前上下文，分支和当前路径保存为 schema 2；schema 1 只读迁移不改文件，后续写入保留原记录。
- 停止按钮经独立同源接口关闭指定请求的上游 socket，保留正文、思考与草稿。关闭窗口继续接收和保存，只有主动停止才取消。
- 模型与思考程度仅覆盖本次请求，认证目的地与课程默认配置仍在统一设置页。服务模型列表的输入模态和程度元数据用于选择；未知模型保留自动。
- 提供商返回的思考文本与正文独立流式显示、折叠、Markdown 排版和本地保存；未返回思考时没有虚构内容。图片上传、粘贴、拖入及 UTF-8 文本／代码附件均关联到消息分支，历史重放不混入兄弟分支附件。

## 可复现检查

```text
python -B -m unittest discover -s tests -p "test_*.py"
python -B teach-pro/scripts/test_response_limits.py
node tests/tutor-conversation.browser.cjs
node --test tests/tutor-experience.browser.cjs
node tests/tutor-response-limits.browser.cjs
```

浏览器使用真实本地课程服务和本机合成 SSE／JSON 接口，没有真实模型、付费语音或外网请求。检查包括复制、编辑／重新生成、版本切换与刷新恢复、请求上下文、附件内容块、思考与正文分区、实际停止上游、草稿与手机深浅色布局。长回答检查覆盖 3153 字正文与较大协议开销、40000 Unicode 码点、100000 字正文、长事件、长传输、JSON 回退、真实中断及显式继续；完整保留旧测试范围。

Word 同步 rc.16 使用说明，经 Word 只读导出和五页图片复核。当前 170.741333 秒视频保留已认可配音与真实答疑，本日已更新上下文设置及题后作答镜头；新分支／附件控件以当前课程和说明为准，没有将模拟接口录成真实提供商答复。

接口对照：[DeepSeek 思考模式](https://api-docs.deepseek.com/guides/thinking_mode/)、[模型能力元数据](https://api-docs.deepseek.com/api/list-models/)、[OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)、[Ollama 兼容接口](https://docs.ollama.com/api/openai-compatibility)。不同服务的实际模型能力和返回字段仍由其接口决定。

本轮汇总：216 项 Python 测试中 207 项通过、9 项按环境条件跳过；新增分支／附件／思考单测 17 项。可移植长回答测试 40 项通过。浏览器新增功能 6 组深浅色／宽度布局通过，主动停止本机模拟上游约 65 ms；请求开始前的早停不再触发后续模型请求。详见同目录 conversation-audit.json。
