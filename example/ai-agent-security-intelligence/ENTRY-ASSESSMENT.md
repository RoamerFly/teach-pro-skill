# Entry Assessment: Agent 开发与安全

## Assessment purpose
用少量任务判断 Python 工程、API、状态机、测试与安全边界的起点，决定后续课程是否需要先补前置，以及哪些主题应提前或延后。

## Evidence sources
- 用户自述：基础 Python；会调用大模型 API；没有 Agent 项目经验。
- 简短问答与代码任务：见 `practice/entry-assessment.html`。

## Findings
### Confirmed strengths
- 能使用基础 Python 并调用模型 API（用户自述，尚待作品验证）。

### Partial knowledge
- API 调用经验可迁移到模型适配器，但结构化输出、异常语义与测试尚未验证。

### Missing prerequisites
- Agent 控制循环、工具契约、状态/记忆区分、威胁建模和安全评测从零讲起。

### Misconceptions
- 暂无证据，不预设。

## Starting level
具备编程与模型调用入口，但还未形成 Agent 系统设计与安全工程能力。

## Immediate teaching implication
- 第一阶段应从：可视化系统模型和离线最小运行时开始。
- 暂时跳过：复杂框架、多 Agent 和生产部署。
- 需要优先补救：若评估显示 dataclass、异常、JSON、unittest 不熟，在后续相应实战前安排定向补课。

## Confidence
- 高置信：无 Agent 项目经验；偏好图解；每周约 5 小时。
- 中置信：Python 与 API 基础足以进入课程。
- 尚需后续验证：代码测试、HTTP、安全和情报领域能力。
