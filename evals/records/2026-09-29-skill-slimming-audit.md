# Teach Pro 入口指令去重审查

## 判断与范围

- `SKILL.md` 同时列出完整工作区、逐课章节、选择题细则和 HTML/同步/答疑实施要点；这些已有专门规范，重复加载会增加上下文成本，也可能在后续改版时产生不一致。
- `HTML-OUTPUT-SPEC.md`、`LOCAL-SYNC-SPEC.md`、`LOCAL-TUTOR-SPEC.md` 与模板/运行时资产承载具体页面和安全契约；本轮不为缩包删减。`QUALITY-CHECKLIST.md` 虽有交叉内容，但用途是交付验收，保留独立检查项。
- README、版本记录、课程案例和运行时 CSS/JS/Python 不属于本轮入口指令去重；没有动学员提交、聊天、配置或密钥。

## 变更

只精简 `teach-pro/SKILL.md`：

| 重复内容 | 保留的权威位置 |
| --- | --- |
| 完整课程目录与文件说明 | `COURSE-WORKSPACE-SPEC.md` |
| 每课 11 步章节展开、输入细节 | `DAILY-LESSON-FORMAT.md` |
| 选择题等长、题型与反馈细则 | `EXERCISE-FORMAT.md`、`HTML-OUTPUT-SPEC.md` |
| 资源数量、精确定位、视频与论文核验 | `RESOURCE-SELECTION-POLICY.md`、`RESOURCES-FORMAT.md` |
| 视觉方向、媒体、页面组件和增量写作细则 | `HTML-OUTPUT-SPEC.md` |
| 文件同步与课程设置/答疑实施细则 | `LOCAL-SYNC-SPEC.md`、`LOCAL-TUTOR-SPEC.md` |

入口仍明确：一次一课、按真实证据决定推进/补救、必要时读论文原始片段、学员页不写资源取舍辩解、默认提供设置与答疑入口、Key/发送授权边界、静态可读与本地同步状态。详细规则通过任务位置处的链接按需读取。

按 PowerShell 读取的文本计，`SKILL.md` 从 259 行、9653 字符降为 204 行、7892 字符；约减少 21% 行数、18% 字符。运行时代码、模板、资源规范和验收清单未变，包体积不是本轮目标。

## 验证与边界

- 所有 `SKILL.md` 相对 Markdown 引用均指向现有文件；`git diff --check` 无问题。
- `quick_validate.py`：`Skill is valid!`。Windows 默认 GBK 解码失败后以 `PYTHONUTF8=1` 重跑通过，这是验证器运行环境编码问题，不是 Skill 文件无效。
- `python -m unittest discover -s tests`：12 项通过；Test4 智鉴 Agent 课程 `check_course.py`：4 页结构通过。
- 本轮只有指令去重，没有让 TeleAgent 重新生成课程；上述检查不能证明模型在新入口下的资源导学或逐课决策行为不退化。后续用同一智鉴 Agent 条件做新生成回归，再决定是否进一步精简细则。
