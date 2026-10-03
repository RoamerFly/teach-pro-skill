# rc.7 学习记录稳定化验收

日期：2026-10-03。基线：`1ac1d1370ba4097f37cf876f3bd9f614108b47da` / rc.6。串行执行，未使用子智能体、真实密钥或付费模型请求。

## 缺陷与修复

- 延迟文件恢复时编辑一项，旧实现会把其他尚未恢复的空白字段写回。现在逐字段合并，以本次编辑及逐字段浏览器时间戳保留新值，其余恢复文件；明确清空的空值也可跨刷新恢复，不复活旧答案。
- 首次 GET 失败后旧实现始终未 ready，后续输入不触发写入。现在请求限时八秒，失败最多自动重试三次（1/2/4 秒）；输入、focus 或 online 可重新连接。POST 失败先重读文件再合并，写入期间的新编辑另行顺序保存，不以旧快照报告最终成功。
- 清空使用原生简短确认「确定清空本页答案与疑难记录吗？」。取消不改字段、不写文件；只有确认后 course.js 才发出清空事件给 sync.js。确认同时清除测验反馈。
- 改选答案立即清除上一轮正确/错误提示，再次检查才显示对应新反馈。
- 真实录制脚本等待 chat-stream，不重发模型请求。页面结束接收后读取受会话凭证保护的实际聊天文件接口，核对当前问题、reply_to、非空正文和 complete；不把部分或历史无关回答当成功。
- 八页综合验收移除已经删除的预览/同意框断言，以未配置弹窗入口和服务端正文提取检查替代。测试连接和下载改用项目已有 Playwright，课程运行依赖不变。

共享 assets 与公开 Demo 字节一致，版本为 1.1.0-rc.7。教学主体不扩展；主 SKILL.md 未增加规则。输出规范、本地同步规范和质量清单按职责原地更新。

## 最终结果

| 检查 | 结果 |
| --- | --- |
| Python 单元及本地服务集成 | 49/49 通过 |
| Node 串行单元及 Edge 浏览器回归 | 31/31 通过 |
| 独立八页综合 Demo 检查 | 通过；390/1366px 共 16 个布局，无横向溢出 |
| Demo 结构 / Skill 校验 / diff 空白 | 全部通过 |

命令（通过环境变量指定本机 Node/Python/Edge 路径）：

```powershell
python -B -m unittest discover -s tests -p 'test_*.py'
node --test --test-concurrency=1 tests/lesson-toolbar.browser.cjs tests/tutor-experience.browser.cjs tests/tutor-markdown.browser.cjs tests/learner-sync.browser.cjs tests/capture-response.test.cjs tests/assessment-save.test.cjs tests/competition-demo-integrity.test.cjs tests/visual-ui.test.cjs tests/tutor-defaults.test.cjs
node tests/competition-demo.browser.mjs <仓库外截图目录>
python -B teach-pro/scripts/check_course.py example/competition-demo-zhi-jian-agent
```

新增回归覆盖：恢复前输入、只编辑一个字段、首次恢复失败后的自动重连、三次重试上限与焦点恢复、写入失败补同步、写入中连续编辑、空值跨刷新、旧版浏览器字段迁移、取消无写入、确认清空、断线清空后刷新、改选反馈重置。

浏览器均用隔离副本和合成输入。八页检查验证评估六个字段同步/恢复/导出/清空、课末疑难隔离、未配置答疑不发模型请求、设置预设地址及 password/text/password 遮蔽切换。Tutor 合成接口的 14 次本地操作继续通过，并用实际流式请求验证录制记录读取组件；无远端请求、客户端异常 0。

截图与 JSON 摘要在仓库外 `competition-work/2026-10-03-stability-qa/{sync,tutor,toolbar,demo}`。清空后的页面截图已目视复核；二次确认的取消与确认通过真实浏览器 dialog 事件验证。原始 TeleAgent 产物、本机 Demo 的私有作答/聊天/配置均未修改。

## 修复过程与验收边界

首次录制组件回归发现 Chromium 对已消费流的 CDP response.body 不一定可用，改为等待页面完成并核对实际保存记录，无模型重发。旧综合工具在当前 Node 原生 WebSocket/Undici 中出现内部断言；换用现有 Playwright CDP 后，又定位下载目录与浏览器上下文不匹配，改为实际 download 事件读取。上述失败均属于维护工具，最终完整复跑通过，不隐去初次失败。

未重录完整真实 DeepSeek 视频；本轮只验证录制请求和记录核对组件。Word/视频仍为 rc.4 快照，配音未处理。手机长标题展开、刷新恢复未发送草稿未纳入本轮四项稳定化修复。rc.7 可进入新版 TeleAgent 评估→第一课→续课验收，但这些测试不证明原生课程内容关卡或真实学习效果通过。
