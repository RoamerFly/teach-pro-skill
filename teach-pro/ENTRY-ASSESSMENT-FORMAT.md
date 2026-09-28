# ENTRY-ASSESSMENT.md Format

入门评估用于定位起点，不是制造挫败感。题量应尽可能少，但足以判断先修能力和最近发展区。

```md
# Entry Assessment: {主题}

## Assessment purpose
{本次要判断哪些前置能力，以及为什么。}

## Evidence sources
- 用户自述：
- 简短问答：
- 示例任务或作品：
- 现有文件/成绩/项目：

## Findings
### Confirmed strengths
- {能力 + 证据}

### Partial knowledge
- {能力 + 能做到什么 + 卡在哪里}

### Missing prerequisites
- {缺口 + 对后续的影响}

### Misconceptions
- {具体错误模型}

## Starting level
{用描述性语言说明起点，不仅写初级/中级/高级。}

## Immediate teaching implication
- 第一阶段应从：
- 暂时跳过：
- 需要优先补救：

## Confidence
- 高置信：
- 中置信：
- 尚需后续验证：
```

## 规则

- 不使用大量超纲题来“测水平”。
- 用户已经提供足够证据时，不重复测试。
- 对身体、创作、语言等能力，可用作品、录像、自述和现实反馈，但明确证据边界。

## 学习者网页评估

- 学习者页面固定为 `practice/entry-assessment.html`；上面的 `ENTRY-ASSESSMENT.md` 是 AI 内部状态，两者不可混淆或放在同一路径。
- 每道需要作答的题目后提供有明确 `<label>` 的输入框；开放解释、代码或疑问使用 `<textarea data-save-key="entry-...">`。
- 使用共享 `assets/course.js` 在当前浏览器自动保存、重新打开时恢复；本地运行环境可用时再由 `assets/sync.js` 自动写入课程工作区。提供清空本页与可选备份导出、可读的同步状态。学习记录不得提交到仓库或发送到远程服务。
- 参考标准默认折叠，题面先于答案；自述可作为起点信息，但不能直接判定已掌握。
- 页面须明示：AI 不能读取浏览器私有存储；但能在下一次对话中读取已经自动同步到当前本地工作区的记录。直接打开 HTML 或同步失败时，才需要学员上传备份或粘贴答案。
- 学员未提交答案时，将评估结果标为待验证，不臆测表现；可继续已生成的第一课，再根据真实证据调整后续课程。
