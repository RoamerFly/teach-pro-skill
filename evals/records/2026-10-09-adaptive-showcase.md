# 完整自适应教学案例增强

日期：2026-10-09。基线：4322ec4。沿用 1.1.0-rc.12，不修改已冻结教学主体、Runtime、网页模板或调用策略。

## 参考评审与取舍

用户提供的赛事适配版第三次参考复审为 96.5/S；评分数据逐项相加一致。主要提升来自顶层中文字段，不是新教学行为测试，亦非赛事官方分数。本轮不调整根目录或虚构电信专属场景，针对专家能看懂的教学质量与自适应证据补充完整案例。

## 新增内容

- `references/examples/statistics-adaptive/`：校园消费统计。保留最小组件示例；增加共同访谈／评估／首课及 A/B 两组明确标注的合成作答。
- 首课讲清均值与中位数、奇偶人数、替换与新增条件，附原创 SVG 图解、完整计算、练习、保存输入和逐课资源。
- 两组都进入“比较分散程度”新目标，完整讲解点图和平均绝对偏差。A 减少填表提示、增加平移及单位迁移；B 增加分步距离表、较短练习，并同轮提供独立的首课补充页。补充不占正式课号、不替代新课。
- 决策回放、画像、路线与首页使用同一判断范围，区分已交付、未作答、待验证。即时解释不是长期掌握；补充交付不是误区已纠正。
- 构建器 `scripts/build_adaptive_example.py` 使用已有模板与部署组件。三个快照共 19 个 HTML（入口 1、起点 5、A 6、B 7），不是生产中一次生成多课的规则。
- 模拟输入置于 `synthetic-inputs/`，真实体验输入由原服务写入 `learner-submissions/`，两者不合并。输出目录已存在或位于 Skill 内时拒绝覆盖。
- 完整参赛包自动包含可直接打开的 `自适应教学案例/index.html`，由同一已提交源码快照离线组装；独立 Skill 包包含源案例和构建脚本。

## 资源与核验范围

原始链接、阅读定位、学习任务、预算、访问限制、核验程度记录在 `resources.json`。核验日期 2026-10-09；仅链接，不复制外部图文、视频或字幕。

- OpenStax《Introductory Statistics 2e》2.5 中心、2.7 分散程度的公开正文已核验；2.7 用于分散程度的概念，不将标准差公式当 MAD 来源。
- Khan Academy 两段官方视频的发布信息及公开简介／索引已核验，未实测播放、不编造时长或精确秒段。中文合集无法核实精确对应内容，本例选用能确认发布者的原始视频。
- 核心推导与练习可在本课独立完成，不依赖外链。此入门目标不强塞论文。

## 验证

- Python：135 项，126 通过、9 项原生 Windows keyring 环境测试跳过。新增完整案例 5 项、发布适配新增 2 项均通过：数值独立复算、数据边界、两种支架、保存身份、路径与共享组件一致性、迁移后构建、可直接打开的打包页面及 Unix 权限。
- Node：29/29 通过；日常源码 quick_validate 通过；差异空白检查通过。赛事版按既定四字段／链接校验，不标为日常校验器兼容。
- 实际浏览器在新临时合成工作区执行：10 类交互检查通过，30 个宽度／明暗布局状态无整页溢出，页面错误 0、外部请求 0、模型调用 0。首课、补充页、新正式课分别写文件；重启并换全新浏览器上下文后恢复三页；原模拟输入未被覆盖；A/B 不串记录。
- 人工查看完整页面截图，核对原创图解、表格、资源链接与输入区域；总入口标题和说明面板随后整理，将随实际发布包再验。

## 复现

在 Skill 根目录：

```sh
python scripts/build_adaptive_example.py <尚不存在的目录>
python scripts/check_course.py <输出目录>/start --json
python scripts/check_course.py <输出目录>/case-a --json
python scripts/check_course.py <输出目录>/case-b --json
```

仓库测试命令：`python -m unittest discover -s tests -p 'test_*.py'`；浏览器脚本 `node tests/adaptive-example.browser.cjs`，需 Playwright 与本机浏览器。`EXAMPLE_SKILL_ROOT` 可指定解压后日常／赛事 Skill，`EXAMPLE_QA_DIR` 指定独立证据目录。

本轮静态与浏览器测试只证明预写案例的内容一致性及页面／文件操作，不证明 TeleAgent 新生成行为、真实学生学习效果或新评审得分。既有宿主行为证据与智鉴 Demo 保留；Word、视频无需因补充案例重录。

## 实际双版本发布验收

发布源码提交：`2af3d9e1751c387407fe3f6e6bdde4c101994a57`，已推送 origin/main。两个版均由该提交构建，Skill 各 60 个文件；日常源码字节一致，赛事版仍只作字段／路径适配，冻结的运行组件、模板和调用策略保持字节一致。

- 解压后的日常、赛事 Skill 各自执行完整案例浏览器脚本：均为 10 类交互、30 个布局状态通过，页面错误／外部请求／模型调用均 0。赛事解压包还执行原最小示例的 9 类浏览器回归，全部通过。
- 实际包内的 19 个完整案例页面重新检查，起点／A／B 分别 5／6／7 页，结构问题和 SVG 风险提示均 0；模拟输入的正文摘要与各自首课匹配。日常目录另提供同源构建的可阅读案例，不扩充独立 Skill ZIP 为整套工作区。
- 所有解压 Skill 文件匹配审计中的发布 SHA；三个 ZIP CRC、校验值、完整包内部清单与解压逐文件匹配，所有 `.sh` / `.command` 保持 0755。完整包 211 项，含可直接打开的案例；没有答案、聊天、配置或运行缓存目录。
- 原智鉴 Demo 8 页结构通过；在另一个 QA 副本启动 session-only 服务，四个页面路由、课内上下文、空聊天、合成答案写文件及重启恢复通过。没有接触交付目录的学员状态或提供商。
- Word SHA-256 `145156493ab4760cd8abb302b7eda0f5e2fc66e9849c078223b79f1544878665`、视频 `51fb962e98797095d9beea39f901f7893840f60ea32e54bab671bca1ce8c1d73` 与已接受材料一致，视频 168.461333 秒。
- 最新总入口、课页截图已查看，标题不再孤字换行；共享浅／深主题与内容图示可读。

交付位置仍为仓库外 `competition-submission/normal_use` 与 `competition-submission/competition_submit`。旧两版完整保留于 `competition-submission/history/2026-10-09-before-adaptive-showcase/`。旧复审报告与评分数据随其对应旧包保存，未删除或伪装为新案例版本评分。

| 发布文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| normal_use/teach-pro-1.1.0-rc.12.zip | 210327 | 2926858a5e771c505ae29620d19f549f7f76169908ba3b18fc20b09aa6f5fdd1 |
| competition_submit/teach-pro-1.1.0-rc.12.zip | 211387 | c42032292bc046791f628f31a14a7c4c7597b8045d1e959f59926233b2c626a1 |
| competition_submit/重邮FFBond+学途智伴——大学生长期自适应学习智能体.zip | 16601265 | 5c6bd689eb906deedc56369f4e314be8a5d11b75a11fbe91b1dc24e792b9c231 |

对应原始 JSON 为同目录 `2026-10-09-adaptive-{normal,competition}-package-audit.json`、`2026-10-09-adaptive-{normal,competition}-browser-audit.json` 及 `2026-10-09-adaptive-minimal-browser-audit.json`。

旧参考报告 SHA-256：`fbb0e663ed613199e4f758929ae7d202dce63d39e19af1a31b07a53f5c24bd3e`；旧评分 JSON：`5a2d6baeeafb655a6e7d16c388e729316c46c765bfaa8d730765efe5d9561945`。96.5/S 仅属于示例增强前赛事版；本轮没有新的宿主生成或参考复审结果。
