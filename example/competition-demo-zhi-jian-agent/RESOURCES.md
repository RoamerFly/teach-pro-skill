# 智鉴 Agent · 展示资源库

核验日期：2026-10-01。以下均实际打开正文；论文只核验摘要和图注文字，不宣称全文精读。时间为指定片段与产出的预算。

| 资源与位置 | 类型/语言/用途 | 任务与产出 | 预算、访问与范围 |
| --- | --- | --- | --- |
| [DeepSeek 首次调用 API](https://api-docs.deepseek.com/zh-cn/#调用对话-api)，调用对话 API 的 Python 示例 | 官方文档/中文；第一课优先接口对照 | 找地址、模型、messages、取结果，记一处差异到证据 2 | 10 分钟；公开可读；真实调用需有效凭据，本轮未运行 |
| [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)，摘要、PDF 第 2 页图 1 与图注 | 原始论文/英文，ICLR 2023，arXiv v3；第一课选读方法来源 | 四行“待核实问题 → 查询 → 观察 → 下一步”，写进证据 1 | 15 分钟；公开；核验摘要和图注文字，非全文/图像细节；不代表当前接口或授权规范 |
| [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)，What are agents? 与 Agents | 作者机构原文/英文；第一课选读工程对照 | 区分固定工作流与模型参与决策的循环，写一句到证据 1 | 约 10–15 分钟；公开可读；非具体框架教程 |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html#validate-the-permissions-on-every-request)，Introduction、Validate the Permissions on Every Request | 安全规范/英文；第二课选读权限映射 | 解释目标允许仍需任务与内容检查，补入证据 2 | 5 分钟；公开可读；课内有中文解释 |
| [OpenAI Function calling](https://developers.openai.com/api/docs/guides/function-calling#the-tool-calling-flow)，The tool calling flow、Defining functions，Chat Completions 格式 | 官方文档/英文；第三课选读数据流与声明 | 核对三步职责和 required，写进证据 2 | 15 分钟；公开可读；不混用 Responses 字段，不代表 DeepSeek 真实工具调用已验证 |

## 选择记录与缺口

第一课保留官方实现、工程解释，补研究源头，优先项仅一项，其余折叠。第二课聚焦授权补救，只选短安全规范；第三课以接口指南解释字段和消息关联，不再重复增加论文负担。

本次没有选定外部视频；已有原创图解与模拟足以支撑这些静态关系的解释。没有新增空播放器，不复制旧示例未重新校核的视频。短讲解视频在比赛录制阶段单独制作，不能计作外部一手推荐。

后续框架与项目资源在进入对应阶段前核验，不提前堆未学内容。阅读/观看本身不记掌握。
