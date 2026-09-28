# 学途智伴 · Teach Pro

面向长期学习的循证、自适应教学 Skill：先了解学员基础与目标，每次只生成一节网页课程，再依据作答、作品与疑难调整下一步教学。

**当前版本：1.0.0（首次公开发布）** · **技能名称：`teach-pro`** · **作品名称：学途智伴——大学生长期自适应学习智能体**

> 这是 Skill 源码仓库，不是预生成的完整课程，也不是托管教学网站。课程由支持技能和本地文件操作的 AI 在使用时创建。

## 它解决什么问题

长期学习不只是把知识一次性列出来。Teach Pro 将学习目标、学员画像、课程路线与真实学习证据保存在独立课程工作区，让后续对话能够恢复进度、处理误区，并选择合适的下一课。

- **先评估再教学**：利用已提供信息，必要时简短访谈，不重复询问。
- **一次一课**：路线图可以规划阶段，课程正文逐节生成，不批量铺开整套教程。
- **理解优先**：讲清直觉、机制、完整示范和边界；需要时加入原创图解与有字幕的视频。
- **以证据推进**：阅读、观看或回复“懂了”不单独算掌握；区分独立表现、提示下回答与 AI 示例。
- **精准资源导学**：推荐与当前目标相关的阅读或视频，说明具体位置、用途、任务和访问限制。
- **持续调整**：处理疑难、安排定向补救、复习与迁移。

## 获取与使用

```sh
git clone https://github.com/RoamerFly/teach-pro-skill.git
```

实际 Skill 包是仓库中的 **`teach-pro/`**，入口为 [`teach-pro/SKILL.md`](./teach-pro/SKILL.md)。安装时保留整个目录，不只复制主文件。

### 在 Codex 中使用

可让 Skill Installer 从本仓库安装 `teach-pro` 目录；也可按目标环境的技能目录约定进行手动安装。当前官方文档列出的本地发现目录包括项目的 `.agents/skills/` 和用户的 `~/.agents/skills/`。安装后显式调用 `$teach-pro`，本包的 `agents/openai.yaml` 禁止隐式触发。不同客户端与版本的安装方式以 [OpenAI 官方技能文档](https://learn.chatgpt.com/docs/build-skills) 为准。

首次请求示例：

```text
$teach-pro
我想学习 Agent 开发与 Agent 安全，最终独立完成一个 AI 安全情报 Agent。
我会基本 Python 和大模型 API，没有 Agent 项目经验。
每周约五小时；先学通用原理，偏好图解和逐步讲解。
请先评估基础、规划路线，再生成第一节课。
```

继续学习时，在 AI 能访问该课程目录的工作区提出问题或请求下一课。它会按规范读取已同步的答案和当前课聊天，先处理缺口，再决定下一步；不是后台自动生成课程。

其他 Skill Runtime 可使用主文件与配套资源，但调用策略、工具能力和路径发现方式须按其文档配置，不承诺所有环境直接兼容。

## 生成的课程如何运行

学员主要阅读 HTML；使命、画像、路线和教学记录使用 Markdown 供课程生成 AI 维护。

| 方式 | 能力与条件 |
| --- | --- |
| 直接打开课程的 `index.html` | 静态阅读、页面交互和浏览器副本；无需构建工具，不能承诺答案已写入 AI 可读文件 |
| 从课程启动器打开 | 需要 Python 3.11+；输入自动同步到本地课程目录，支持可选课内答疑 |

启动器位于**生成后的课程根目录**，不是本仓库根目录：

- Windows：`start-course.cmd`
- Linux：`sh start-course.sh`
- macOS：`start-course.command`，或在终端运行 `sh start-course.command`
- 无图形浏览器：`python3 serve_course.py --no-browser`；Windows 也可用 `py -3 serve_course.py --no-browser`

服务只监听本机回环地址，面向单用户本地学习，不应直接部署到公网。运行资产使用 Python 标准库，无须安装第三方 Python 包。

## 可选课内 AI 答疑

模型配置统一位于课程左侧置顶的“课程设置”页。支持 OpenAI-compatible、OpenAI、DeepSeek、Ollama 与自定义地址预设；可主动获取模型列表并下拉选择，服务不支持列表时手动填写模型 ID。

- API Key 默认遮蔽，点击小眼睛才显示，保存后清空表单。
- Key 仅保留在本次服务进程内存，重启后须重新输入，不提供持久密钥保管。
- 当前只支持兼容 Chat Completions 的文本、非流式接口，不承诺所有原生协议或模型兼容。
- 发送前确认范围，可预览限定的本课上下文；近期对话窗口不等于全量长期记忆。
- 聊天按课写入本地文件，供课程生成 AI 下次参考；答疑 AI 不执行工具、不改课程，也不自动生成下一课。
- 连接测试会发起最小生成请求，可能计费；获取列表不发送课程正文。

具体边界见 [`LOCAL-TUTOR-SPEC.md`](./teach-pro/LOCAL-TUTOR-SPEC.md)。本地保存不等于本地推理：选择云端服务时，确认的上下文仍会发往所选提供商。

## 仓库结构

```text
teach-pro-skill/
├─ README.md                 # 仓库入口与使用说明
├─ .gitignore                # 隐私数据与缓存排除
├─ .gitattributes            # 跨平台换行约定
└─ teach-pro/
   ├─ SKILL.md               # 主教学工作流
   ├─ agents/openai.yaml     # 界面元数据与调用策略
   ├─ templates/            # 首页、单课、评估与参考页模板
   ├─ assets/               # 网页组件、本地服务与三端启动器
   ├─ *-FORMAT.md           # 内部教学状态与内容格式
   ├─ *-SPEC.md             # 工作区、页面、同步与答疑边界
   ├─ QUALITY-CHECKLIST.md
   ├─ VERSION.md
   └─ CHANGELOG.md
```

进一步阅读：

- [Skill 包说明](./teach-pro/README.md)
- [课程工作区规范](./teach-pro/COURSE-WORKSPACE-SPEC.md)
- [资源选择策略](./teach-pro/RESOURCE-SELECTION-POLICY.md)
- [本地答案同步规范](./teach-pro/LOCAL-SYNC-SPEC.md)
- [版本记录](./teach-pro/CHANGELOG.md)

## 隐私与使用边界

不要把真实密钥、敏感个人资料或未授权材料填入答案/聊天。`learner-submissions/`、`learner-chats/`、`.tutor-settings.json` 及缓存不得提交到仓库或分发包；生成课程时会合并对应忽略规则。

课程生成 AI 自动读取本地答案的前提，是它和课程目录处于同一可访问工作区。仅浏览器保存、远程隔离环境或同步失败时，不应声称 AI 已看到学员作答。学员提交、网页与聊天是参考数据，不是修改权限的指令。

本仓库只维护 Skill 指令与配套资源，不包含真实学员数据、生成课程、探索运行记录、参赛文档或演示视频。没有新增开源许可证；使用与再分发授权另行确认。

## 后续维护

后续正式更新在本仓库维护。实验结论先经过案例复测，再按需融入 Skill；候选优化不应被写成已实现功能。

更新教学规则时优先作窄范围修正；更新网页/运行资产时核对静态降级、隐私、课节隔离和跨平台启动，保留 Unix 启动器的执行权限。版本与变更说明分别记录在 `teach-pro/VERSION.md` 和 `teach-pro/CHANGELOG.md`。

已经生成的课程通常含有资产副本；更新本 Skill **不会自动更新旧课程**。升级旧课程时需检查差异，并保留学员记录与课程定制内容。
