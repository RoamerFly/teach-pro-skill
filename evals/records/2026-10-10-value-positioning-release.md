# 双版本用途与价值发布校核

日期：2026-10-10。版本：1.1.0-rc.12。

## 来源与交付

日常版与赛事版均从提交 `1b526481956abefedff3037d4bf6efdfdbfcd101` 构建。发布目录分别为工作区的 `competition-submission/normal_use` 与 `competition-submission/competition_submit`。旧目录完整移入 `competition-submission/history/2026-10-10-before-value-positioning`，未删除任何交付或学员文件。

更新内容为长期学习的用途与价值说明：连接目标、课程和本地记录，按作答接续教学，正式课推进主线、独立补充课处理难点。没有新增功能、修改课程生成协议或提高历史评审分数。

## 校核结果

- 相关回归 41 项全部通过：双版本发布 8 项、架构材料 6 项、提交包 10 项、讲解视频工具 17 项。
- 两版独立 Skill 各 60 个文件。与旧版相比均只变化 SKILL.md、README.md、CHANGELOG.md 三份说明文档；模板、运行组件、评估夹具和显式调用策略未变化。
- 赛事完整包为 215 个文件项，清单列明其中 214 项。新增用途整理记录，同步三份 Skill 说明、Word、包内 README 与清单；其他文件字节一致。
- ZIP CRC、逐文件摘要、解压产物、两版共同源码及运行资源一致性通过。`.sh` 与 `.command` 启动器保留 0755；Windows Git 对普通源文件未记录的模式由 ZIP 使用默认 0600，不将其误报为显式权限。
- 发布到最终目录后，再次校验全部 ZIP 摘要。复审报告与评分 JSON 原样复制保留，与历史目录逐字节一致。
- Word 保持五页，五页渲染逐页目视通过。视频、字幕、讲解脚本、架构图与课程 Demo 未变化；视频仍为 177.861333 秒。本轮没有新增 TeleAgent、模型或配音调用。

## 交付摘要

| 交付 | 字节数 | SHA-256 |
| --- | ---: | --- |
| 日常版 Skill ZIP | 210855 | `461e671ccd4a5dc2c7659210b542fcde21f188fbf36b15710d4f3ee0e747be03` |
| 赛事版 Skill ZIP | 211903 | `9f81b6e90963922fd38c1a00d359b05fa804ea2c4aa31ac665bb516879ebd2b4` |
| 赛事完整 ZIP | 19784610 | `3e54bcc8b84d4ae3ee83e96acc51ebb1685ca2131c9f5251470031620e64d8d6` |

完整发布器审计及新旧包差异见 [发布审计 JSON](./2026-10-10-value-positioning-release-audit.json)，文案与 Word 校核范围见 [用途整理记录](./2026-10-10-value-positioning.md)。依赖缺失导致官方 quick_validate.py 未完成，不计入通过项；发布器 frontmatter／引用校验和上述回归均通过。
