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
