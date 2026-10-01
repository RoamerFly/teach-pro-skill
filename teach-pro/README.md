# 学途智伴 · Teach Pro Skill

一个面向任意知识与技能的长期 AI 私教 Skill。当前为 1.1.0-rc.3 稳定化候选：提供紧凑网页布局与逐课生成；在本地工作区可用时，学员答案自动写入课程目录，AI 下次对话直接读取并据此动态决定下一课。

## 核心特性

- 任意学科自适应教学。
- 每课聚焦一个与 Mission 直接相关的紧密目标，并形成一个可感知的小胜利。
- 以理解、应用和迁移证据为进度依据；区分短期 Fluency Strength 与长期 Storage Strength。
- AI 内部状态使用 Markdown，学习者教程统一输出为 HTML 网页。
- 支持课程首页、可收起的紧凑目录、响应式布局、深浅色、折叠答案、代码复制和打印。课程可按学习主题选用语义化视觉风格与轻量背景纹理。
- 习题按主题需要加入，不强制机械堆题。
- 文档与视频资源按当天知识点精准推荐，优先中文和 B 站具体单集，不提供无关合集。
- 支持长期路线图、入门评估、学习记录、术语表、周期复盘和补救教学。
- 入门评估和每课末尾均可输入；课程启动器模式自动同步到本地工作区，AI 下次对话直接读取。浏览器保存与 JSON 备份是断线回退。
- 用 Knowledge → Skills → Wisdom 组织学习层次，并通过主动回忆、间隔复习、变式和真实反馈提高长期保持与判断力。
- 使用“风险认知”而非按学科设置预先禁区。
- 支持超长课程文件增量写作：单次写不完时继续写入同一文件，不人为拆成多份。
- 选择题选项按字数、句式和信息密度保持等长/等价，避免格式泄露答案。
- 每课固定提醒学习者可以继续向教师追问、要求换一种解释或更多例子。
- Assets 采用 reuse-first：先复用，再扩展；避免课程页重复内联通用 CSS/JS。
- 默认仅显式调用 Teach，不允许隐式自动触发。
- 默认提供左侧置顶“课程设置”，AI 配置与答疑按需使用，不配置也能学习。支持主动获取模型列表并下拉选择，Key 默认遮蔽且不落盘；列表不可用时支持手动模型 ID。

## 启动课程

生成的课程可直接打开 `index.html` 静态阅读。要把作答自动写入课程目录，或启用可选课内 AI 答疑，须安装 Python 3.11+ 并从课程根目录启动本地服务：

| 系统 | 启动方式 |
| --- | --- |
| Windows | 双击 `start-course.cmd`，自动尝试 `python` 或 `py -3` |
| Linux 桌面 | 运行 `sh start-course.sh`；有执行权限时也可用 `./start-course.sh` |
| macOS | 双击 `start-course.command`；若系统阻止打开，可在终端运行 `sh start-course.command` |

无图形浏览器、WSL 或远程环境可运行 `python3 serve_course.py --no-browser`，再按终端显示的本机 URL 打开；Windows 也可用 `py -3 serve_course.py --no-browser`。服务只监听 `127.0.0.1`，不是可直接部署公网的服务器。静态模式仍能阅读，但浏览器保存的答案不会自动进入 AI 可读取的课程文件。

## Skill 包结构

- `SKILL.md`：主行为规范。
- `COURSE-WORKSPACE-SPEC.md`：课程工作区结构。
- `TEACHING-MODES.md`：不同学科的教学模式。
- `HTML-OUTPUT-SPEC.md`：网页课程标准。
- `LOCAL-SYNC-SPEC.md`：本地答案同步与 AI 读取边界。
- `RESOURCE-SELECTION-POLICY.md`：精确资源推荐规则。
- `QUALITY-CHECKLIST.md`：交付前检查。
- `*-FORMAT.md`：内部状态和教学模板。
- `templates/`：课程首页、课程页、入门评估和参考页模板。
- `assets/`：默认网页样式和交互脚本。
- `scripts/check_course.py`：只读结构检查，定位属性、链接、题量和保存组件问题；不评判教学正确性。
- `agents/openai.yaml`：显式调用策略与界面元数据。

交付后可运行 `python scripts/check_course.py <课程目录> --json`。脚本位于 Skill 包内，不需复制到课程；不会读取答案、聊天或模型密钥配置。

## 生成课程后的典型结构

```text
course-workspace/
├─ index.html
├─ settings.html          # 默认提供，AI 按需配置
├─ serve_course.py
├─ tutor_chat.py
├─ start-course.cmd / start-course.sh / start-course.command
├─ .gitignore
├─ learner-submissions/   # 本地生成，勿提交版本控制
├─ COURSE.md
├─ MISSION.md
├─ LEARNER-PROFILE.md
├─ ENTRY-ASSESSMENT.md
├─ ROADMAP.md
├─ RESOURCES.md
├─ GLOSSARY.md
├─ NOTES.md
├─ lessons/
├─ reference/
├─ practice/
│  └─ entry-assessment.html  # 学习者入门评估的固定路径
├─ learning-records/
├─ weekly-reviews/
└─ assets/
```

学习者从 `index.html` 进入课程。内部 Markdown 文件用于 AI 维护状态，不是主要教程页面。
