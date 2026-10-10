# 连贯箭头版参赛包发布验收

日期：2026-10-10。材料来源提交：`9ca559fecba967dd0b3322423d39191764a63f3d`，已推送 origin/main。

当前赛事目录：`competition-submission/competition_submit`。旧赛事目录完整保留于 `competition-submission/history/2026-10-10-before-connected-architecture/competition_submit`。

## 包内核对

- 完整 ZIP 214 项，清单 213 个文件。ZIP CRC、清单校验值、所有解压文件与包内字节一致；启动脚本 Unix 权限保持 0755。
- 与旧包相比，更新独立架构 PNG、五页 Word、视频及文件清单；README 只更新来源提交。新增当前架构材料验收记录，没有移除文件。
- 字幕、讲解脚本、课程 Demo、自适应教学案例及所有独立 Skill 文件均与旧包逐字节一致；独立 Skill 的 60 个文件没有变化。
- 现有完整案例增强复审报告与评分 JSON 原样保留并复制至新目录，没有重新计算分数。
- normal_use 日常版未修改。Git 中保留旧图片与历史材料记录。

| 发布文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| 重邮FFBond+学途智伴——大学生长期自适应学习智能体.zip | 19782029 | 99ee39000dbc463fa9a152bcbb9f5f12b0dd6659d731ad714c30682e7d08c5fe |
| teach-pro-1.1.0-rc.12.zip | 211387 | e914bbac06bd7b84f1860760752e2b1ef5e747651c7ab4dd3a39068426820981 |

逐文件差异、冻结运行组件校验及清单复核见 `2026-10-10-connected-architecture-package-audit.json`。Word 与视频验收细节见 `2026-10-10-connected-architecture-media.md`。
