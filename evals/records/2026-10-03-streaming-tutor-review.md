# rc.6 紧凑流式答疑验收

日期：2026-10-03。基线：`4c6e5020b8a24535e61819b94c25df4cb315647f`。串行执行，未新增逐课教学功能，未调用付费提供商。

## 修改与原因

- 设置页通用 `.tutor-actions` 的上下外边距覆盖了模型行的零外边距，导致获取按钮偏移。修正选择器优先级并统一下拉框与按钮高度；640px 以下顺序堆叠。
- 原有设置反馈只区分 ready/error。新增 success/busy，获取、保存和连接测试成功使用绿色，编辑后恢复普通状态，错误使用红色。
- 答疑底栏改为输入框与发送按钮同行，删除常驻保存成功、自动保存与快捷键说明，正常状态隐藏提示行。保留键盘操作、输入法、草稿、引用、失败反馈和重试。
- 本地新增 `/api/tutor/chat-stream/<slug>`：模型 SSE 正文分段经过 NDJSON 转发，浏览器用同一本地 Markdown 组件节流排版。旧非流式端点及连接测试保留；同一次模型请求返回 JSON 时兼容处理，不重发、不模拟打字。
- 先保存问题，再发 pending；正文成功保存后发 done。上游中断保存部分正文为 incomplete，保存失败不发 done，读者断开不阻止服务端完成保存。共享组件、部署/输出规范、检查表和 Demo 同步为 `1.1.0-rc.6`。

## 最终结果

| 检查 | 结果 |
| --- | --- |
| Python 单元及本地服务集成 | 49/49 通过 |
| Node 串行回归，含真实 Edge 浏览器 | 17/17 通过 |
| Demo 结构检查 | 8 页通过 |
| Skill 元数据校验 | 通过 |
| Git diff 空白检查 | 通过 |

运行命令：

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
python -B -m unittest discover -s tests -p 'test_*.py'
python -B teach-pro/scripts/check_course.py example/competition-demo-zhi-jian-agent
node --test --test-concurrency=1 tests/lesson-toolbar.browser.cjs tests/tutor-experience.browser.cjs tests/tutor-markdown.browser.cjs tests/assessment-save.test.cjs tests/competition-demo-integrity.test.cjs tests/visual-ui.test.cjs tests/tutor-defaults.test.cjs
```

新增检查覆盖：中文 UTF-8/CRLF 跨字节与跨事件分块、心跳/usage-only、凭据跨事件遮蔽、思考字段隔离、工具调用拒绝、终止/length/异常/超时、正文与事件大小限制、JSON 单请求回退、部分记录重试、身份与并发拒绝、客户端断开后保存，以及最终磁盘写入失败不报告完成。

浏览器使用隔离课程副本、本地 Python 服务和明确标记的合成 SSE 提供商；14 次本地模拟操作，客户端异常 0。首段正文在请求仍忙碌时已经排版显示，三轮请求携带完整成对上下文；连接测试 payload 仍为 `stream: false`。旧聊天恢复、失败重试、预算截断、关窗后接收、历史滚动、输入法、引用、复制、导出和课节隔离全部通过。

页面测量：1440/960/641px 的模型下拉框与按钮顶底坐标一致，高度约 44.8px；640/390px 堆叠且无横向溢出。正常无引用、空输入时，桌面及手机答疑底栏约 63.4px，高度会随输入、引用或错误反馈变化。八张截图和测量摘要在仓库外 `competition-work/2026-10-03-settings-stream-qa`，已复核设置成功页、桌面/深色/手机对话及请求未完成的分段画面。

## 修复过程与边界

初次浏览器测试发现本机 Demo 已有忽略的课程聊天与设置。原测试复制整个目录，使隔离副本课程标识不匹配；改为复制时排除私有记录及缓存，并校验发布 Git 树不包含这些路径。原始本地记录未修改、未删除、未迁移，后续测试仅使用合成记录。另一回归发现新增 pending 事件会强制滚到底；已取消强制跳转，保留历史阅读位置。底栏错误占位和请求进行中无意义的重试按钮也已修正。

协议对照：[DeepSeek Chat Completions 的 SSE/delta/[DONE] 规范](https://api-docs.deepseek.com/api/create-chat-completion/)、[Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility)。本轮只做协议与合成接口验证，不把合成结果称为真实 DeepSeek 请求成功。

技能包从已提交 Git 树归档，保留 sh/command 的 755 权限，不纳入配置、聊天、作答或缓存，不覆盖旧 `skill/teach-pro.zip`。Word/视频仍是 rc.4 快照，未重录配音或画面。本轮不代表新版 TeleAgent 原生课程生成或真实学员学习效果验收；重新导入 Skill 后仍应做一次真实流式答疑检查。
