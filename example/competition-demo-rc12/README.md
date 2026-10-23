# 智鉴 Agent 比赛展示

Teach Pro 1.1.0-rc.14 的公开展示副本，主线为智能体开发与安全实战。保留原课程 URL 与作答标识，答疑组件支持长回答完整显示、自动输出预算与手动继续回答；本地运行旧副本需替换组件后重启服务、刷新网页。

从 `start-course.cmd` 启动 Windows 课程；macOS 使用 `start-course.command`，Linux 使用 `sh start-course.sh`。启动器会检查课程运行环境；设备密钥由系统凭据库管理。直接打开 `index.html` 可阅读，答案仅保存在浏览器。

## 展示内容

- 入门评估：六项简短回答，自动保存到本地。
- 三节正式课：API 调用、ReAct 循环、安全工具契约。
- 题后直接作答：开放练习和资源任务原位填写，课末只记录疑难；各题答案自动保存。
- 第二课补充：没有 Thought 仍有注入风险，按需学习。
- 课程设置：服务预设、遮蔽密钥、获取模型及设备记忆。
- 课内答疑：大弹窗、多轮流式回答、Markdown 显示、按课保存。
- 一手阅读与视频：按课目标导读论文、官方文档与中文视频；视频提供具体链接和选看任务，不放播放器。

本副本的课程已经整理完成，不代表打开页面就重新生成了三节课。自动续课由调用 Skill 的教学 AI 读取本地学习记录后执行；浏览器 Tutor 负责当前课答疑。

## 来源与证据

展示使用合成学习场景，内容经人工校核，不附真实学员答案、聊天或密钥。它不是新的 TeleAgent 行为测试，也不用于宣称学生长期学习效果。来源见 [PROVENANCE](./PROVENANCE.md)，新版说明与视频方案见 [参赛材料](https://github.com/RoamerFly/teach-pro-skill/tree/main/example/competition-materials/rc12)。

复制到新目录体验后，请保留自己的 `learner-submissions` 和 `learner-chats`，不要提交到公开仓库。
