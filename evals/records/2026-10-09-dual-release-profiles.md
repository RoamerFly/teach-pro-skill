# 日常使用版与赛事提交版

日期：2026-10-09。基线：c8ba131。用户要求将日常版与赛事版分别发布到仓库外 `competition-submission/normal_use` 与 `competition-submission/competition_submit`；初赛线上自动化与专家综合评审、TOP20 晋级为用户提供的信息，未在本轮独立核验。

## 依据与范围

参考评审 v2.1 复审为 92.5/S，JSON 逐项求和一致。该成绩不是赛事官方评分或独立安全审计。报告明确要求顶层 `name_cn` / `description_cn`，与当前日常校验器的顶层字段白名单冲突，因此使用显式发布配置，不修改日常教学源码。

- `normal_use`：Skill 文件与指定 Git 提交逐字节一致；中文信息继续位于 metadata，目录和宿主元数据保持原状。
- `competition_submit`：中文字段平铺到 frontmatter 顶层；描述突出大学生课程学习、备考与项目能力提升。根目录只保留 SKILL、README、CHANGELOG；18 份教学规范与 VERSION 收入 `references/specs/`，页面模板迁入 `assets/templates/`。
- 全部相对 Markdown 链接、模板路径及示例构建器引用随迁移更新。工作区内的 COURSE/MISSION 等状态文件、课节生成路径与页面资产 URL 不迁移。
- `agents/openai.yaml` 保留，显式调用策略不变；不为目录分删除实际宿主元数据，不虚构电信专属场景。
- 样式、交互、服务、凭据组件、模板内容和结构检查器逐字节不变。Word、视频、Demo 使用同一已接受快照，未重录或重新生成。

## 复现

在仓库根目录运行，输出目录须在仓库外且为空或尚不存在：

```sh
python example/competition-materials/rc12/scripts/package_submission.py <日常版目录> --ref <提交> --profile normal_use --skill-only --extract
python example/competition-materials/rc12/scripts/package_submission.py <赛事版目录> --ref <提交> --profile competition_submit --extract
```

发布只读取已提交 Git 快照，不读取本地学员文件、密钥或缓存。重复生成拒绝覆盖已有交付；ZIP 保留 shell 启动器 0755。两个包附逐文件来源与发布校验值；比赛完整包另有内部文件清单。

## 验证

- 新增 profile 回归：日常字节一致、顶层四字段、迁移后引用、教学正文等价、运行与模板不变、错误路径拒绝、禁止覆盖；赛事版构建 assessment/lesson 两阶段并检查 3/4 页。
- 全量 Python：128 项，119 通过，9 项原生凭据环境测试跳过；新增 profile 6 项均通过。Node：29/29。日常源码通过当前 quick_validate；`git diff --check` 通过。实际 ZIP 解压后的浏览器交互与材料完整性将在下方追加结果。
- 不声称新赛事包已导入 TeleAgent、已执行教学生成或获得更高分。新包须由同一参考评审工具复审；赛事四字段格式不能标为日常通用校验通过。

## 实际交付验收

两个版本从 `dbcf90113fb3236e231a2d4940b51e6ee607f69d` 构建，发布到用户指定的 normal_use 与 competition_submit 空目录；未覆盖历史包或旧评审报告。

- 每版 53 个 Skill 文件。日常版全部与提交字节一致；赛事版迁移 25 个路径，其中 19 个规范/版本文件和 6 个模板。10 个文件发生文字变化，仅涉及元数据、路径引用、发布说明和示例构建路径。
- 两版解压文件逐项匹配发布校验值；赛事完整包 97 项，CRC、内部文件清单及 shell 启动器 0755 全部通过。
- 解压后的两版分别运行 `skill-example.browser.cjs`，各 9 类交互检查通过，包含 6 个宽度/明暗布局状态；外部请求 0，页面错误 0。测试在临时合成副本，不写入交付 Skill 或 Demo。赛事版首课截图人工查看，图文、导航、冻结栏与输入区可读。
- 日常解压 Skill：quick_validate 通过。赛事版：同一校验器仅因额外顶层中文字段拒绝，属于已明确的配置差异，不标为通过；赛事四字段和实际引用由 profile 验证器检查通过。
- 赛事解压 Demo：8 页结构检查通过；独立 QA 副本的四条页面路由、课内上下文、空聊天、合成作答写入与重启恢复通过。全程 session-only，无凭据安装、存储或提供商请求。实际交付目录没有学员答案、聊天、模型配置或运行缓存。
- Word SHA-256 `145156493ab4760cd8abb302b7eda0f5e2fc66e9849c078223b79f1544878665`、视频 `51fb962e98797095d9beea39f901f7893840f60ea32e54bab671bca1ce8c1d73` 与已接受材料一致；视频仍为 168.461333 秒，不需因本轮打包适配重录。

ZIP 校验值：

| 发布文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| normal_use/teach-pro-1.1.0-rc.12.zip | 187296 | 3c9b8d1b8ed3ba955aac0d1af59cca778b9ff620d50e9ef0e168e63b440d8ddf |
| competition_submit/teach-pro-1.1.0-rc.12.zip | 188346 | ccc7c354e0364ef698f9d9f6ef68e6f27fb8a1f1b3e090c2e10c19d6ccdce99c |
| competition_submit/重邮FFBond+学途智伴——大学生长期自适应学习智能体.zip | 16193687 | 2c73bfa937ada35153af5e90fdbe1c79233e2a8003dba14672ffc7b38d23f2c8 |

对应校验数据见同目录的 `2026-10-09-normal-use-package-audit.json`、`2026-10-09-competition-submit-package-audit.json` 与两份 profile browser audit。新的赛事评分尚未产生；92.5 为适配前版本的参考复审分数。
