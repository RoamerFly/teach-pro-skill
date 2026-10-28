# 学途智伴 · Teach Pro Skill

面向系统学习、备考和技能提升的长期自适应教学 Skill。当前版本为 1.1.0-rc.17，先评估基础与目标，再逐课生成网页教程，依据本地作答与疑难安排后续正式课和独立补充课。

本版修复细粒度流式答疑在正文不长时误触512 KiB上限的问题，分离传输/事件/正文限额，保留真实超限保护与部分回答。已有课程更新答疑组件后，重启课程启动器并刷新网页；作答、聊天和模型配置无需清空。离线回归：`python scripts/test_response_limits.py`。

## 用途与价值

长期学习需要持续维护目标、基础、作答表现与未解决问题。资料和对话分散时，学习者需要重新整理进度、补充背景，并自行判断下一步学什么。

学途智伴把学习目标、课程与本地学习记录连接起来：课程启动器将作答和聊天保存到课程目录，教学 AI 在学员请求继续时读取记录，根据实际表现接续教学。

- 新会话接着本地课程状态教学，减少反复说明背景。
- 根据解释、应用和迁移等证据调整目标、难度与练习，回应具体疑难。
- 正式课推进新目标，独立补充课巩固难点，两类课程分别展示与记录。

学习者主要负责学习、作答和提问，教学 AI 维护路线与进度，减少自行编排长期课程的负担。

## 核心特性

课程采用直接、连贯的教学表达：讲清对象、机制、条件与做法，用例子和练习帮助理解。写作规则见 [教学文字规范](./WRITING-POLICY.md)。

- 任意学科自适应教学。
- 每课聚焦一个与 Mission 直接相关的紧密目标，并形成一个可感知的小胜利。
- 以理解、应用和迁移证据为进度依据；区分短期 Fluency Strength 与长期 Storage Strength。
- AI 内部状态使用 Markdown，学习者教程统一输出为 HTML 网页。
- 支持课程首页、可收起的紧凑目录、响应式布局、深浅色、折叠答案、代码复制和打印。课程可按学习主题选用语义化视觉风格与轻量背景纹理。
- 习题按主题需要加入，不强制机械堆题。
- 文档与视频资源按当天知识点精准推荐，优先中文和 B 站具体单集，不提供无关合集。
- 支持长期路线图、入门评估、学习记录、术语表、周期复盘和补救教学。
- 入门评估与练习在题后直接作答，课末只保留疑难记录；课程启动器模式自动同步到本地工作区，AI 下次对话直接读取。浏览器保存与 JSON 备份是断线回退。
- 用 Knowledge → Skills → Wisdom 组织学习层次，并通过主动回忆、间隔复习、变式和真实反馈提高长期保持与判断力。
- 使用“风险认知”而非按学科设置预先禁区。
- 支持超长课程文件增量写作：单次写不完时继续写入同一文件，不人为拆成多份。
- 选择题选项按字数、句式和信息密度保持等长/等价，避免格式泄露答案。
- 每课固定提醒学习者可以继续向教师追问、要求换一种解释或更多例子。
- Assets 采用 reuse-first：先复用，再扩展；避免课程页重复内联通用 CSS/JS。
- 默认仅显式调用 Teach，不允许隐式自动触发。
- 默认提供左侧置顶“课程设置”，AI 配置与答疑按需使用，不配置也能学习。支持主动获取模型列表并下拉选择，Key 默认遮蔽，可用系统凭据存储记住此设备；列表不可用时支持手动模型 ID。
- 课内答疑默认共享整门已生成教材，明确当前课与选文出处；统一上下文设置可调整教材范围、参考答案、资源导学和本课对话记忆。

## 启动课程

生成的课程可直接打开 `index.html` 静态阅读。要把作答自动写入课程目录，或启用可选课内 AI 答疑，须安装 Python 3.11+ 并从课程根目录启动本地服务：

| 系统 | 启动方式 |
| --- | --- |
| Windows | 双击 `start-course.cmd`，自动尝试 `python` 或 `py -3` |
| Linux 桌面 | 运行 `sh start-course.sh`；有执行权限时也可用 `./start-course.sh` |
| macOS | 双击 `start-course.command`；若系统阻止打开，可在终端运行 `sh start-course.command` |

无图形浏览器、WSL 或远程环境可运行 `python3 serve_course.py --no-browser`，再按终端显示的本机 URL 打开；Windows 也可用 `py -3 serve_course.py --no-browser`。服务只监听 `127.0.0.1`，不是可直接部署公网的服务器。静态模式仍能阅读，但浏览器保存的答案不会自动进入 AI 可读取的课程文件。

记住密钥统一使用 Python keyring 对接系统凭据存储。启动时自动检测，缺依赖时联网准备课程 `.teach-runtime/`，随后直接启动；后续复用，不改全局 Python。准备失败仍可阅读并选择会话模式；离线可加 `--session-only` 跳过准备。Linux 还需可用的桌面密钥环与 D-Bus。密钥不写入课程目录，复制或移动课程后需重新配置。

## Skill 包结构

中文名称与简介保存在 `SKILL.md` 的 `metadata.name_cn` / `metadata.description_cn`，教学入口仍为 `name` / `description`；`agents/openai.yaml` 保留中文界面名称与显式调用策略。

- `SKILL.md`：主行为规范。
- `COURSE-WORKSPACE-SPEC.md`：课程工作区结构。
- `LESSON-DELIVERY-POLICY.md`：正式课、补充课的交付、编号和展示。
- `TEACHING-MODES.md`：不同学科的教学模式。
- `HTML-OUTPUT-SPEC.md`：网页课程标准。
- `LOCAL-SYNC-SPEC.md`：本地答案同步与 AI 读取边界。
- `RESOURCE-SELECTION-POLICY.md`：精确资源推荐规则。
- `QUALITY-CHECKLIST.md`：交付前检查。
- `*-FORMAT.md`：内部状态和教学模板。
- `templates/`：课程首页、课程页、入门评估和参考页模板。
- `assets/`：默认网页样式和交互脚本。
- `scripts/check_course.py`：只读结构检查，定位属性、链接、题量和保存组件问题，并提示 SVG 颜色变量与缩放风险；不评判教学正确性或实际渲染效果。
- `agents/openai.yaml`：显式调用策略与界面元数据。
- [统计学最小示例](./references/examples/statistics/README.md)：访谈、评估、首课与续课的输入输出约定，可离线构建并检查页面，不需调用模型。
- [完整自适应案例](./references/examples/statistics-adaptive/README.md)：同一首课、两组模拟作答，对照新正式课的支持调整与独立补充课；附完整图解、迁移练习、资源导学和文件依据。

依赖来源与许可见 [本地排版依赖](./assets/vendor/README.md)；发布变化见 [版本记录](./CHANGELOG.md)。

交付后可运行 `python scripts/check_course.py <课程目录> --json`。脚本位于 Skill 包内，不需复制到课程；不会读取答案、聊天或模型密钥配置。

## 生成课程后的典型结构

```text
course-workspace/
├─ index.html
├─ settings.html          # 默认提供，AI 按需配置
├─ serve_course.py
├─ tutor_chat.py
├─ credential_store.py
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
