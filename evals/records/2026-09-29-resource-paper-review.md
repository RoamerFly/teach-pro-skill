# 主线 T02：论文导学补充与旧版对照

## 观察与原因

- 旧参考课 `D:\Agent\Project\learningWithTeach\agent-development-security-career\lessons\0001-agent-loop-and-trust-boundaries.html` 在“本课一手阅读与视频”中推荐 ReAct 原论文、OWASP 安全指南、OpenAI Academy 视频和 Agents SDK 文档；研究源头、工程映射与安全视角兼有。但旧版 Skill 只把“原始论文”列入优先级，论文卡没有明确限读范围与历史适用边界；视频公开页目前提示登录，不能据此宣称已核验播放或时长。
- 当前 Skill 的 `RESOURCES-FORMAT.md` 允许“论文”，但 `SKILL.md`、选择策略和逐课模板没有要求研究源头明确时做论文适配判断。Test4 第 0001 课原生成只给 Anthropic 博客与 OpenAI 工具调用文档；前一次人工修订增加角色文档后仍没有论文。这是资源选择规则的可迁移缺口，不是页面组件缺陷。

## 本轮决定

- 通用 Skill：在研究型概念课评估原始研究；有教学增益时只导读当前基础可完成的摘要、图或短方法段；否则记录延后/未选理由。不硬性规定每课论文数，不把历史论文当当前 API 或安全规范。
- Test4 第 0001 课：增加 [ReAct](https://arxiv.org/html/2210.03629v3) 为默认折叠的选读（摘要 + 图 1 的 1d 轨迹，约 10 分钟）。任务是映射 Act/Obs 与课内 T1/T2，并指出原图未解决的工具授权问题。保留 Anthropic 主读和两项官方协议选读，总计 1 项优先、3 项选读；学习者无需完成四项才能通过本课。
- 旧视频不照搬：目前 OpenAI Academy 公开页面提示登录，而且主题偏 Agents SDK；当前目标是框架无关循环。旧版的 OWASP 材料可在安全主题深化时按本课目标重新选择，不把所有旧链接堆到第一课。
- 学员作答字段与正确答案未变；论文产出复用原有 `0001-resources-output` 可选输入。此次修改的是已生成测试课和 Skill 规则，不是 TeleAgent 重新生成成功的证据。

## 核验

- 原论文 arXiv 记录、HTML 摘要、图 1 图注及 ReAct 交错机制的正文已核对；未声称逐表验证全部实验。官方 [arXiv 记录](https://arxiv.org/abs/2210.03629)、[论文 HTML](https://arxiv.org/html/2210.03629v3)。
- [OpenAI Academy 视频公开页](https://academy.openai.com/public/clubs/builders-etkn1/videos/unlock-agentic-power-with-the-agents-sdk)显示登录提示；本轮未验证视频实际播放或时长。
- `check_course.py`：4 页结构通过、0 个结构问题；不检查资源质量。
- Edge/Playwright：390px 视口展开论文选读，原文链接存在、正文内沿约 17px、整页无横向溢出或 JS 异常。
- 原课程仍仅有入门评估提交，没有第 0001 课的学员提交；未编辑该私人答案。

下一次实际新课生成时，需观察 AI 是否主动判断研究源头、是否给可完成的阅读片段及历史边界；本次人工补充不能单独证明 Skill 行为改善。
