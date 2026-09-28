# Agent 开发与安全 Resources

下方旧清单沿用 2026-09-22 的历史核验记录，不代表本次全部重核验。普通概念课通常呈现 2–4 项互补资源，优先项 1–2 项，其余选读；当前课的实际导学与核验边界见下文。后续资料在进入对应阶段前重核验。

## 本课导学 · 2026-09-27

### ReAct: Synergizing Reasoning and Acting in Language Models
- URL：https://arxiv.org/abs/2210.03629
- 来源：Yao 等原始论文，v3（2023-03-10）；类型：论文与作者项目页；语言：英文。
- 角色：原理主读；优先 1；当前第 1 课。
- 定位：摘要及作者项目页 https://react-lm.github.io/ 的 Thought/Action/Observation 示例；不要求读实验表。
- 时间：阅读 15 分钟＋画图/解释 5 分钟。
- 任务：先预测单轮回答与循环的差别，观察动作和反馈交错，闭卷画循环并补运行时授权检查。
- 替代：本课五部分系统图与相同产出。
- 核验：2026-09-27，摘要、v3 元数据及作者项目页已读；未把论文全文标为已读。

### OWASP AI Agent Security Cheat Sheet
- URL：https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html#1-tool-security-least-privilege
- 来源：OWASP；类型：官方安全指南；语言：英文；滚动维护页面。
- 角色：安全映射；优先 2；当前第 1 课。
- 定位：1. Tool Security & Least Privilege、4. Human-in-the-Loop Controls。
- 时间：阅读 10 分钟＋项目图映射 5 分钟。
- 任务：把白名单、授权、人工审批放回系统图；写一条模型提出却应拒绝的动作规则。
- 替代：本课信任边界图与同一映射任务。
- 核验：2026-09-27，指定章节正文已读；第 9 节测试、门禁及证据部分用于项目阶段候选。

### Introduction to Agentic Workflows
- URL：https://academy.openai.com/public/clubs/builders-etkn1/videos/unlock-agentic-power-with-the-agents-sdk
- 来源：OpenAI Academy；类型：官方视频；语言：英文；页面发布 2025-08-07。
- 角色：视频精学；选学；当前第 1 课。
- 定位：公开简介描述 agents、tools、memory 与 Agents SDK；未验证精确时间段。
- 时间：自主观看预算 20 分钟＋产出 5 分钟；不是视频片长。
- 任务：看前画框架原语位置，工具/记忆话题处暂停标执行分界，看后修正图并指出应用仍负责的安全检查。
- 限制与替代：页面提示登录；字幕与播放未验证。不看视频可用本课原创图解完成同一产出。
- 核验：2026-09-27，标题、公开简介已读；不宣称完整内容核验。

### Building effective agents
- URL：https://www.anthropic.com/engineering/building-effective-agents
- 来源：Anthropic；类型：工程原文；语言：英文；发布 2024-12-19。
- 角色：进阶辨析；选读；当前第 1 课。
- 定位：What are agents?、When (and when not) to use agents。
- 时间：阅读 10 分钟＋辨析 5 分钟。
- 任务：为固定漏洞汇总和自适应证据追查分别选工作流/Agent，解释代价。
- 限制与替代：原页提示工具生态变化；只用于原理辨析，不用旧工具名单选型。离线用本课边界部分完成任务。
- 核验：2026-09-27，指定正文已读。

## 后续资源中心候选 · 2026-09-27

学员入口：reference/resource-learning-center.html。任务、预算、替代路径见该页；后续阶段不会因此自动解锁。

- 阶段二：Evaluating LLM Applications，OpenAI Academy，https://academy.openai.com/en/public/clubs/builders-etkn1/videos/ai-techniques-building-applications-with-evaluations 。公开简介核验，内容定位为测试设计、评分与开发生命周期；需登录，播放/字幕/分段未验证；观看 20＋产出 10 分钟预算。
- 阶段三：OWASP LLM Prompt Injection Prevention，https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html#remoteindirect-prompt-injection 。英文；Remote/Indirect Prompt Injection、Agent-Specific Defenses 正文已核验；阅读与产出 25 分钟。
- 阶段四：Designing Reliable Agent Architectures，OpenAI Academy，https://academy.openai.com/public/clubs/builders-etkn1/videos/ai-techniques-production-designing-reliable-agent-architectures-2025-12-11 。公开简介核验，涉及架构、编排、失败模式、护栏；需登录，完整播放/字幕/分段未验证；观看 20＋产出 10 分钟预算。
- 阶段五：MCP Architecture，https://modelcontextprotocol.io/specification/2025-11-25/architecture#core-components 。英文；固定 2025-11-25 版本，不宣称最新；Core Components、Design Principles 正文已核验；阅读与产出 25 分钟。
- 阶段六：OWASP 同上第 9 节，安全测试/门禁/证据正文已核验；阅读与测试设计 30 分钟。领域数据源 API、配额、条款本次未重核验，不提供现行接口保证。

## Agent engineering
- OpenAI Agents SDK Quickstart — https://openai.github.io/openai-agents-python/quickstart/ — 当前 Python SDK 入门、工具、handoff 与 trace。
- Tools — https://openai.github.io/openai-agents-python/tools/ — function tools 与工具类型。
- Guardrails — https://openai.github.io/openai-agents-python/guardrails/ — 输入、输出和工具护栏的执行边界。
- Testing — https://openai.github.io/openai-agents-python/testing/ — 无真实模型请求的确定性运行时测试。
- Tracing — https://openai.github.io/openai-agents-python/tracing/ — trace/span 与敏感数据配置。

## Agent security
- OWASP AI Agent Security Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html — 风险、最小权限、记忆、审批、监控与测试。
- OWASP LLM Prompt Injection Prevention Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html — 直接/间接/持久注入与纵深防御。
- NIST AI 600-1 — https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf — 生成式 AI 风险管理配置文件。
- MCP Architecture — https://modelcontextprotocol.io/specification/2025-11-25/architecture — host/client/server 与安全边界。

## Security intelligence
- CISA KEV — https://www.cisa.gov/known-exploited-vulnerabilities-catalog — 已知在野利用漏洞目录。
- NVD Vulnerabilities API — https://nvd.nist.gov/developers/vulnerabilities — CVE API 2.0。
- FIRST EPSS API — https://api.first.org/epss/ — EPSS 查询字段与限制。
- MITRE ATT&CK Enterprise Tactics — https://attack.mitre.org/tactics/ — 对手战术目标。

## Gaps
- 用户本地 Python 版本、包管理器和是否拥有可用模型 API 凭据尚未验证；课程核心实验不依赖外部凭据。
