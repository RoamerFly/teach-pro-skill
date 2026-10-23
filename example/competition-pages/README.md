# 作品访问入口

GitHub Pages 发布首页、智鉴 Agent 课程、统计学完整自适应案例、演示视频与下载入口。公开地址：<https://roamerfly.github.io/teach-pro-skill/>。

网页提供静态浏览与浏览器内作答保存。原课程启动器提供本地自动写文件、模型配置与课内答疑；下载包保留原始课程文件。网页展示适配只应用于 Pages 构建输出，不修改 Skill 或课程源码，也不伪造在线模型回答。

2026-10-17 智鉴课程源码已按最新版 Skill 调整为题后原位作答，课末只保留疑难；网页版与下载课程使用同一课文快照。历史操作视频、封面和实录截图不随页面布局重新录制。

2026-10-23 下载的 Skill 与课程运行组件升级 rc.13，修复流式传输限额误判和 Unicode 计数；静态网页不新增模型调用。既有本地课程替换答疑组件后需重启服务并刷新网页，学习记录与配置保留。

在仓库根目录运行 `python scripts/build_public_demo.py <新输出目录> --ref HEAD`。课程、技能、视频和架构图来自指定的已提交快照；入口页来自当前源码。构建只选择公开材料，并检查密钥模式、禁止目录与本地引用。

`assets/course-preview.png`、`settings-preview.png`、`tutor-preview.png` 是已验收视频中的真实课程操作帧。`cover.html` 是可复现封面布局，不合成课程内容。

`.github/workflows/pages.yml` 在 main 更新时构建并发布；部署目录不含仓库历史、学员记录、本机设置或凭据。完整参赛文件继续使用 `competition-submission/competition_submit` 的赛事版；本目录是在线展示层，不维护第二套 Skill。
