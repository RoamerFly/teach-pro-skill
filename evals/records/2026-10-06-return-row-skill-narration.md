# 设置页操作栏与 Skill 讲解收尾

日期：2026-10-06。基线：ce39a0a，Teach Pro 1.1.0-rc.12。串行完成，无子智能体。

## 修改

- 设置页返回入口原为 absolute，导航收起按钮为 sticky，偏移量无法保证同高对齐。共享 course.js 将两者放入 `.sidebar-actions`；CSS 使用正常 flex 布局、统一高度及间距，长标题省略。窄屏关闭导航按钮与返回入口同行；折叠时只保留展开按钮。
- 同步两套公开 Demo 的 course.js/style.css，更新 HTML 输出规范。不改课文、原始作答、聊天和配置，不修改 TeleAgent 测试目录。
- 重写十一段口播与分镜：Skill 包组成、TeleAgent 导入与调用、启动生成课程、逐课学习、可选 DeepSeek 答疑、保存记录及请求续课。明确智鉴为课程案例，课程生成 AI 与课内答疑各司其职。
- 全文 752 字符，170 秒仅为镜头预算。旧完整旁白和字幕保留历史对照，README 明确不适配新正文；本次未制作完整配音或成片，Word 后续最终同步。

## 实际验证

- Node 单元测试：29/29 通过；增加两项音频工具测试后 Python 全套 88 项，79 项通过、9 项原生凭据环境测试跳过。
- `tests/navigation-experience.browser.cjs`：真实 Edge，无外部请求、无页面 JS 错误；检查桌面操作栏顶边/高度误差小于 1px，间距 5–8px，键盘顺序、目录滚动、收起/展开、长标题省略，以及 390/320px 抽屉同行对齐。原有滚动恢复、设置状态隔离、四视觉主题明暗/系统模式、返回目的地与 file 模式回归通过。
- `tests/sidebar-theme.browser.cjs`：底部主题卡、键盘、折叠、评估/设置、手机/横屏、打印均通过。初次调用缺少 Playwright 浏览器路径；指定已安装 Edge 后通过，无安装。
- Skill quick_validate 通过；初次系统 Python 默认 GBK 读取失败，设置进程 PYTHONUTF8 后通过。
- rc.12 八页结构检查通过。已人工查看桌面浅色与 320px 深色操作栏截图。浏览器截图和检查 JSON 保存在仓库外 `competition-work/2026-10-06-return-row-qa`、`2026-10-06-return-row-theme-qa`。

## 情感配音

用用户已授权的百炼凭据串行请求 Qwen3-TTS-Instruct-Flash / Serena / 北京，两次请求均获得新的 WAV；内容为新版 Skill 开场，语气分别是亲切讲解、同学分享。密钥只进入隐藏终端输入及进程内存，不进入文件、命令行参数或公开材料。

首次执行在第二段 MP3 峰值检查时遇到 FFmpeg 的中文路径输出与系统 GBK 解码冲突，未完成报告。修正工具为显式 UTF-8，并增加 `--cached-only`，严格匹配缓存后离线检查；未重复请求提供商。

两段 MP3 时长 29.920 / 30.480 秒，完整解码通过，峰值均 -2.4 dB；哈希及口播保存在公开 expressive-voice-audit.json。报告 verification_mode 为 cached_only、该次新增请求为 0；之前源 WAV 合成请求共 2 次。主观听感及英文发音仍待试听，不据技术检查宣称真人感已验收。

本轮没有请求 DeepSeek、生成新课程或验证真实学习成果。完整视频的真实问答与最终音画验收仍按新版分镜执行。
