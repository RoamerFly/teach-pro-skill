# Tutor 体验与参赛材料验收

日期：2026-10-02。候选版本：Teach Pro 1.1.0-rc.4。队伍：重邮FFBond。工作串行完成；本轮不制作或优化配音。

## 功能与回归

已完成响应分类、按完整回合带入近期上下文、关联重试、Markdown 排版、大尺寸弹窗与精简设置。课程页只保留“问 AI”入口，删除长勾选和上下文预览；设置集中在左侧置顶课程设置，地址、预算与思考模式折叠到高级设置。

阶段提交：`87d34b9` 响应处理，`55b7b11` 本地 Markdown，`f1c2afe` 弹窗和设置，`0f78b60` 规范与 Demo 集成。各提交均已推送 main，保留普通历史。

本次最终回归：Python unittest 37/37；Node 串行测试 16/16；八页 Demo 结构检查和 skill-creator quick_validate 通过。Demo 与 Skill 共享运行资产逐字节一致。课程按钮、弹窗、浅深色、1440/1280/390px 布局、中文输入法、引用、复制、备份、重试、未完成回答、刷新恢复、跨课隔离与跨标签模型切换均有浏览器验证。

浏览器回归使用本地合成上游，数据标记 simulated，不把它计为真实模型调用。完整命令：

```powershell
python -X utf8 -m unittest discover -s tests -p 'test_*.py'
node --test --test-concurrency=1 tests/tutor-experience.browser.cjs tests/tutor-markdown.browser.cjs tests/assessment-save.test.cjs tests/competition-demo-integrity.test.cjs tests/visual-ui.test.cjs tests/tutor-defaults.test.cjs
python -X utf8 teach-pro/scripts/check_course.py example/competition-demo-zhi-jian-agent
```

Python 标准库是课程服务的运行依赖。Playwright、Sharp、python-docx、Word 和 FFmpeg 是验证或材料维护工具，不要求学员安装。

## 独立真实 DeepSeek 验证

用户重新授权后，在仓库外的隔离 Demo 副本录制。共五次提供商请求，不使用合成响应替代：

| 操作 | 本地状态 | 总用时 | 正文字符 | 结束原因 | 输入/输出 token |
| --- | --- | --- | --- | --- | --- |
| 获取模型 | 200 | 394 ms | — | — | — |
| 测试连接 | 200 | 687 ms | — | — | — |
| 第一次答疑 | 200 | 1413 ms | 219 | stop | 4427 / 123 |
| 第二次追问 | 200 | 1206 ms | 160 | stop | 4592 / 94 |
| 第三次澄清 | 200 | 1109 ms | 146 | stop | 4743 / 84 |

实际列表包含 deepseek-flash、deepseek-v4-pro。选择 Flash，聊天预算 4096，显式关闭思考；连接测试使用独立预算。三轮分别讨论校园公告、邮箱与权限、系统提示与运行时授权。聊天文件检查为三个提问和三个 complete 回答，同一课节上下文版本；最后一轮明确区分提示词与程序权限。模型原始回答未改写，第一轮类比的简化表述由第三轮追问澄清。

三次诊断均为 has_reasoning=false，正文非空。公开诊断见 [章节记录](../../example/competition-materials/video-ui-chapters.json)。未重现旧“接口未返回兼容的文本回答”；原失败响应未取得，因此不能断言预算耗尽是唯一根因。修复分别覆盖思考空正文、length、异常结构、部分正文、认证/限流/网络等分支，模拟测试与这次真实成功分开记录。

密钥仅用于隔离服务进程内存，输入保持 password，不点击小眼睛；保存后清空输入框，停止服务后不保存密钥。公开文件、Git、Word、视频和工作包均不包含该密钥。原始作答、聊天、连接参数和录屏留在仓库外，不覆盖 TeleAgentTest* 原件。

## Word

[说明文档](../../example/competition-materials/学途智伴技能说明文档.docx) 更新到 rc.4：七个章节、五张注释图片、三张表、三个公开来源链接。新增真实弹窗截图，重采简化后的设置页面，架构图采用“点击发送带入课文与问题”，删除重复勾选及预览步骤。

使用 Microsoft Word 只读导出 PDF，再由文档技能 render_docx.py/Poppler 生成 160 dpi 页图，人工逐页检查全部七页。修复初稿两条来源链接溢出到第八页；最终无孤立尾页、表格截断或文字遮挡。

SHA256：`57984D09BD02101A8EF8B51F905C51C2070C19D3496E776C39BF90566EFEEB80`。

## 画面与字幕

[新版无配音画面版](../../example/competition-materials/学途智伴演示画面版.mp4)：170.64 秒，1440×900，25fps，H.264/yuv420p，无音轨，4,718,874 字节。34 条字幕，十二章全部提取代表帧并人工复核；另检查输入密钥中间帧。FFmpeg 完整解码通过，字幕时间不重叠、不超过片长。

字幕位于下方 90px 独立条，教学画面保留 1440×810，不覆盖课程正文。操作录屏与阅读停留截图来自同次真实录制；片尾单独采集当前架构卡并在章节记录标记 current_architecture_card，不冒充模型响应。模型回答不重写；已有教学分支明确标记合成测试回放，不称为本次现场生成。

SHA256：`8DA85E8304DAE8C8AD5CF83BDE597C8307CF31A4DBE83C78C5FBC705C9893E2C`。

旧配音视频、讲稿和音轨保持不变，供 Git 历史对照，不作为当前提交候选。按用户要求，样音、自然语气优化及最终音画合成留到配音阶段，当前工作包不能直接作为最终比赛成片提交。

## 发布与验证范围

打包器只读取已提交 Git 树，输出到仓库外，排除本地学员答案、聊天、配置、缓存和旧 ZIP。Skill 与 Demo 的 sh/command Git 模式为 100755；工作包生成时检查 ZIP 中 755 权限、CRC 与隐私排除。发布指纹在打包后的单独记录补充。

本轮证明 Runtime、页面与材料链路可用，不把手工校核 Demo 或静态检查当作原生 Agent 课文质量、无人干预闭环或长期学习效果的证明。macOS/Linux 实机启动仍未验证；既有教学评测原生失败项保留。
