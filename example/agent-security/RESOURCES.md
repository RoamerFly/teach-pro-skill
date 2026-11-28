# 智鉴 Agent · 资源与逐课导学

## 既有阅读资源

各课阅读的定位、预计时间与产出任务见对应 HTML。沿用资料的核验范围见 PROVENANCE.md，不将本轮视频补充日期套用到旧资料。

- 第一课：DeepSeek 首次调用；选读 ReAct 与 Agent 原理。
- 第二课：ReAct 原始论文；选读 Building effective agents。
- 第三课：Python json、OWASP LLM01；选读 Toolformer 摘要。

## Knowledge · 视频

### video-lee-agent · AI Agent 原理讲座

- 类型 / 来源 / 语言：视频；李宏毅，台湾大学 2025 年机器学习课程；中文。
- URL：https://www.youtube.com/watch?v=M2Yg1kwPpts
- 来源核对：https://speech.ee.ntu.edu.tw/~hylee/ml/2025-spring.php 的 3/7 AI Agent 条目直接链接此视频。
- 对应知识点 / 阶段：第 1 课，从单次调用到模型、工具和环境反馈。
- 精确位置：具体单集，按“使用工具”主题定位；未核验精确时间段和整集片长，不填写时间戳。
- 预计时间：选看 8 分钟、画图与解释 4 分钟，共约 12 分钟；是自主学习预算。
- 推荐原因 / 角色 / 优先级：专家原始中文讲解，提供不同于代码和论文的解释路径；视频精学，选看、默认折叠。
- 任务与产出：先预测模型自述是否证明工具执行；暂停画模型、应用、工具及请求/结果箭头；看后闭卷说明调用提议、执行与历史管理的职责，填入 lesson-0001-evidence-explain。
- 适用版本 / 最后核验：2025 年课程；2026-10-05。
- 核验程度：官方课表、链接对应关系与 YouTube 标题；没有实际播放或逐段核验，字幕、登录要求与时间段未知。官方讲义链接已确认，但 PDF 本轮抓取超时，不冒充已读讲义。
- 访问与替代：YouTube 网络可用性因设备环境而异；官方课表可查讲义，本课图 3 与正文可独立完成同一产出。不下载或重新打包外部视频。

### video-datawhale-react · Hello-Agents 第四章：智能体范式构建（上）

- 类型 / 来源 / 语言：视频；B 站发布者“二次元的Datawhale”；中文。
- 平台原题：Agent开发必学的神级项目！Hello-Agents第四章：智能体范式构建（上）。学员页使用精简题名，不沿用营销修饰。
- URL：https://www.bilibili.com/video/BV12Z63BCEn6/?p=1
- 来源核对：平台公开接口 https://api.bilibili.com/x/web-interface/view?bvid=BV12Z63BCEn6 返回 code=0、同一 BV、发布者、简介、copyright=1、单 P；简介关联 Datawhale 官方 Hello-Agents 项目。copyright 字段仅作平台原始发布标记，不视为再分发授权。
- 对应知识点 / 阶段：第 2 课，ReAct 的循环组织、工具结果进入后续上下文。
- 精确位置：P1，主题定位 ReAct；平台元数据全长 1374 秒（22 分 54 秒），精确观看时间段未核验。
- 预计时间：选看 10 分钟、画两轮与迁移 5 分钟，共约 15 分钟；不要求看完整集或学习其他范式。
- 推荐原因 / 角色 / 优先级：中文原始教程从基本模型调用进入经典范式，与先原理后框架的路线匹配；视频精学 / 实作对照，选看、默认折叠。
- 任务与产出：先预测超时后的决策依据；暂停画两轮并标出模型提议、程序执行和结果；迁移到安全情报查询，写出超时后的继续或停止判断，填入 lesson-0002-evidence。
- 适用版本 / 最后核验：平台发布时间 2026-01-27（UTC）；2026-10-05。
- 核验程度：平台元数据和公开简介、项目 README 与第四章正文的 4.2 ReAct 部分；网页抓取受限，没有实际播放，字幕与登录要求未知。不据简介声称视频展示了本课的超时案例或授权校验。
- 访问与替代：B 站具体 BV / P；若受限，读 https://github.com/datawhalechina/hello-agents/blob/main/docs/chapter4/第四章%20智能体经典范式构建.md#42-react 或本课完整示范。章节可用于循环实现对照，不作为权限检查或可见 Thought 忠实性的依据。

## 逐课资源决策 · 2026-10-05

- 0001：选入 video-lee-agent；保留 DeepSeek 主读和 ReAct、Anthropic 选读。视频提供中文解释路径，不替代调用示范，资源产出复用课末证据框。
- 0002：选入 video-datawhale-react；保留 ReAct 主读和 Anthropic 选读。按 ReAct 主题缩小观看范围，其他范式延后；不将教程示例视为本课程真实执行或学员掌握证据。
- 0003：评估 Microsoft 的 [Tool Use Design Pattern 官方课页](https://github.com/microsoft/ai-agents-for-beginners/blob/main/04-tool-use/README.md)及其链接的 https://www.youtube.com/watch?v=vieRiPRx-gI ，本课未选：英文配套视频尚未播放核验；本课聚焦解析、类型、授权的区别，现有代码走查与 Python / OWASP 指定片段更直接。视频留作进入框架阶段前的候选，不在学员页说明取舍。
- 0002-s01：复用关联正式课的视频评估，本轮不新增视频任务；补充目标是区分“不输出 Thought”和“不受注入”，正式课的视频不提供已验证的针对性演示。保留短情境与练习，不增加重复观看负担。
- 论文范围：既有 ReAct 与 Toolformer 指定片段继续使用，其核验日期和发表状态见课页及 PROVENANCE.md；本轮不新增论文、不重新声明核验全文。

## Gaps

- 两个选看视频均未完成播放器和字幕验证，不能标为播放验收通过；正式录屏前在参赛设备确认可打开。无视频访问条件时使用已给出的课内等价任务，不要求学员排查网络才能继续。
