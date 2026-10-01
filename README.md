# 学途智伴 · Teach Pro

面向长期学习的自适应教学 Skill。先评估基础与目标，再逐节生成网页课程，根据作答、实践成果和疑难持续调整教学。

当前版本：**1.1.0-rc.3**。教学主体功能冻结，进入比赛展示与验收阶段。

## 核心特性

- **自适应教学**：建立学员画像与学习路线，依据学习证据选择下一课。
- **一次一课**：聚焦当前目标，配合示范、练习、反馈与定向补救。
- **图文与视频**：支持流程图、架构图、内嵌视频和字幕。
- **主题化页面**：按学习主题选择课程级视觉风格与灵活版式，侧栏可折叠。
- **资源导学**：精选一手阅读与视频，标明学习位置、用途和任务。
- **本地学习记录**：自动保存作答、疑难与聊天，供课程生成 AI 参考。
- **课内 AI 答疑**：统一配置模型服务，结合当前课程上下文交流。

## 快速开始

### 安装 Skill

在 Codex 中请求 Skill Installer 安装：

```text
$skill-installer 从 https://github.com/RoamerFly/teach-pro-skill 安装 teach-pro 目录。
```

手动安装时，将完整的 `teach-pro/` 目录放入目标环境的技能目录。Codex 的安装与发现方式见 [官方技能文档](https://learn.chatgpt.com/docs/build-skills)。

### 创建课程

显式调用 `teach-pro`，提供学习目标、已有基础和可投入时间：

```text
$teach-pro
我想学习数据分析，目标是独立完成一份分析报告。
我会基本 Python，每周可投入五小时，偏好图解和逐步讲解。
请评估基础、规划路线并生成第一课。
```

在课程工作区继续讨论、提交练习或请求下一课。AI 会读取已同步的学习记录，处理疑难并调整后续课程。

### 运行课程

本地服务需要 **Python 3.11+**，使用标准库，无需额外安装依赖。在生成的课程目录中启动：

| 平台 | 启动方式 |
| --- | --- |
| Windows | 双击 `start-course.cmd` |
| macOS | 双击 `start-course.command` |
| Linux | 运行 `sh start-course.sh` |

启动后，作答和聊天会保存到课程目录。直接打开 `index.html` 可静态阅读；自动文件保存与 AI 答疑需要本地服务。

## 课程示例

[比赛 Demo：智鉴 Agent](./example/competition-demo-zhi-jian-agent/README.md) 包含入门评估、三节校核课程、一手阅读中心、教学决策回放与统一模型设置。围绕“建立原理 → 定向补救 → 推进新目标”展示逐课教学。

```sh
git clone https://github.com/RoamerFly/teach-pro-skill.git
cd teach-pro-skill/example/competition-demo-zhi-jian-agent
```

随后使用对应平台的启动器打开课程。此 Demo 为人工校核的展示副本；三分支决策来自合成场景实测，后续课节依据新作答生成。

[早期课程与项目案例](./example/ai-agent-security-intelligence/README.md) 保留字幕视频和安全情报实验代码，供对照使用。

## AI 答疑与隐私

每门课程默认提供左侧置顶“课程设置”，无需配置 AI 也能学习。需要课内答疑时，再启动本地服务并配置服务、API Key 和模型。支持 OpenAI-compatible、OpenAI、DeepSeek、Ollama 与自定义地址，以及主动获取模型列表。

- API Key 默认遮蔽，仅保存在服务进程内存中，重启后重新输入。
- 云端答疑会发送确认的课程上下文与对话，连接测试可能计费。
- 作答、聊天和本地配置已加入忽略规则，请勿提交密钥或敏感资料。

本地服务仅面向单用户本机使用。课内答疑与课程生成相互独立，更新 Skill 不会自动更新已生成的课程。

## 项目结构

```text
teach-pro/     Skill 指令、课程模板与运行资源
example/       课程案例与实验代码
evals/         合成案例与可复现检查
```

在仓库根目录发布 Skill ZIP 时从 Git 归档，保留 macOS/Linux 启动脚本的可执行权限：

```sh
git archive --format=zip --prefix=teach-pro/ --output=teach-pro-1.1.0-rc.3.zip HEAD:teach-pro
```

行为验收以[三项稳定化关卡](./evals/competition-gates.md)为准；三种续课决策已观察，原生内容仍有失败项。展示校核与运行检查见 [Demo 验收记录](./evals/records/2026-10-01-competition-demo-review.md)。

## 文档与反馈

- [Skill 使用说明](./teach-pro/README.md)
- [课程工作区规范](./teach-pro/COURSE-WORKSPACE-SPEC.md)
- [资源选择策略](./teach-pro/RESOURCE-SELECTION-POLICY.md)
- [本地同步规范](./teach-pro/LOCAL-SYNC-SPEC.md)
- [AI 答疑规范](./teach-pro/LOCAL-TUTOR-SPEC.md)
- [评测方案与合成案例](./evals/README.md)
- [更新记录](./teach-pro/CHANGELOG.md)

由 [RoamerFly](https://github.com/RoamerFly) 维护。问题反馈与改进建议请提交 [Issue](https://github.com/RoamerFly/teach-pro-skill/issues)。
