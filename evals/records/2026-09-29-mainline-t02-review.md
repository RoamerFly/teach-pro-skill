# 主线 T02：第 0001 课生成与内容复核

## 范围与证据状态

- 课程：`E:\A_Myskill\teach-pro\TeleAgentTest4\zhi-jian-agent`；TeleAgent 已基于已保存的入门评估生成 `lessons/0001-agent-loop-dataflow.html`，当前仅有这一节课。
- 入门评估保存文件的 7 个作答字段均非空（4 个选择、3 个开放）；本记录不包含原始答案、聊天、密钥或个人输入。开始与结束时该文件的 SHA-256 均为 `C0710C081FB6CAC891E7CD36FAE84CE076EBE7B148E7831976FDF49D270169C8`。
- 未发现第 0001 课的学员提交；不能判定已学习或掌握。客户端版本、生成模型与导入包指纹本轮未取得，后续复测应补记。
- `COURSE.md`、`ROADMAP.md`、课程首页和 `.teach-course.json` 把第 0001 课列为最近交付，尚无最近有作答课；没有提前交付第 0002 课。

## 原始产物观察与修订

| 项目 | 原始产物 | 本轮处理 | 复测边界 |
| --- | --- | --- | --- |
| 教学结构 | 一课、两张原创 SVG、三组选择题、七个课内保存字段、讲解与纸面追踪、两项一手阅读；视频缺席有具体说明 | 保留单课与教学结构 | 结构通过不代表概念正确或学习有效 |
| 消息角色 | 把 system/user/tool 描述成“平级”“无结构特权”，并把真实可成立的干扰项判错 | 改为角色有结构标记与指令优先级，但不把它当应用授权；重写安全题、反馈、图注、首页和内部记录 | 仅手工修订此产物；新生成课仍需验证 |
| 示例边界 | “数组永远只增不减”“API 不执行任何工具”“Agent 就是 while 循环”等被写成通用事实 | 限定为本课自定义函数 + 显式 history 的最小实现；说明托管工具、裁剪/摘要历史和其他完成条件 | 不用单一平台示例推断所有提供商 |
| 情报真实性 | 用虚构编号、产品与补丁结论讲“真实情报场景” | 明确标为虚构教学数据，不能作为漏洞情报使用 | 未做真实情报源核验 |
| 证据范围 | 课首同日回忆称“延迟回忆”；画像把自述写进“能独立完成” | 改为即时再提取；画像将 Python/API 经历保留为自述待核实 | 无长期保持或独立实作证据 |
| 资源 | 原始两项一手资料 | 核验 Anthropic Agent/Workflow 定义与 OpenAI Function calling 正文，增补官方角色优先级选读；课程资源中心同步为 3 项 | OpenAI 具体协议不等于所有提供商完全相同 |

这一轮的两条可迁移检查已加入 `teach-pro/QUALITY-CHECKLIST.md`：最小实现的适用范围，以及测验干扰项逐个反证。没有向 `SKILL.md` 叠加课程专属知识。课程页面与内部画像位于测试工作区，不在 Git 仓库；Git 提交记录的是 Skill 规则与复测证据，不能把人工修好的课页算成 TeleAgent 自动生成能力已修复。

一手依据：[Anthropic — Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)、[OpenAI — Text generation / Message roles and instruction following](https://developers.openai.com/api/docs/guides/text)、[OpenAI — Function calling](https://developers.openai.com/api/docs/guides/function-calling)、[OpenAI — Conversation state](https://developers.openai.com/api/docs/guides/conversation-state)、[OpenAI — Using tools](https://developers.openai.com/api/docs/guides/tools)。这些资料分别支持 Agent/Workflow 区分、角色层级、自定义函数的应用侧执行、历史管理与托管工具区别。

## 验证

- `py -3 -X utf8 teach-pro/scripts/check_course.py ../TeleAgentTest4/zhi-jian-agent --json`：`structurally_valid=true`，4 页，评估 4+3，0 个结构问题；脚本明确不执行语义审查。
- `py -3 -m unittest discover -s tests -p 'test_*.py' -v`：12 项通过。
- `quick_validate.py skill/teach-pro`：Skill valid。
- Edge/Playwright `sidebar-theme.browser.cjs`：课程首页、评估、设置的主题、折叠、移动/窄屏、打印、无远程请求和页面异常检查通过。
- Edge/Playwright 打开第 0001 课的 `file://` 页面，390px 视口安全题选 c 显示错误反馈，选 b 显示正确反馈；页面无水平溢出或 JS 异常。此项只测展示/交互，不测本地服务同步，更不代表真实学员作答。
- 原始课页备份在 Git 仓库外 `exploration/mainline-validation/t02-before-content-review/`；修订后、尚无第 0001 课作答的课程快照在 `exploration/mainline-validation/t03-baseline-after-first-lesson/`，其中含本地私人评估文件，均不发布。

## 下一步

请学员从课程启动器打开修订后的第 0001 课，按真实理解完成核心纸面追踪、解释题与疑难，确认页尾显示已写入课程目录。然后以同一课节为基线串行检验证据不足、具体误区和补救后证据三个续课分支，观察 AI 是否先回应疑难、再决定推进或补救。未观察到这些产物前，T03、自适应闭环、课程长期效果与参赛演示更新均保持未通过/未验证状态。
