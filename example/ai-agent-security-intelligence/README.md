# 智鉴 Agent：智能体开发与安全实战

Teach Pro 的课程案例，以 AI 安全情报 Agent 为学习目标，将智能体开发原理与安全设计贯穿同一条学习路线。

## 启动

需要 Python 3.11+，无需安装第三方依赖。在本目录中使用对应启动器：

| 平台 | 启动方式 |
| --- | --- |
| Windows | 双击 `start-course.cmd` |
| macOS | 双击 `start-course.command` |
| Linux | 运行 `sh start-course.sh` |

浏览器会自动打开课程首页。课程左侧的“课程设置”提供模型配置，作答与聊天由本地服务保存。停止服务可按 `Ctrl+C`。

也可直接打开 `index.html` 静态阅读；自动文件保存与 AI 答疑需要本地服务。无图形环境可运行 `python3 serve_course.py --no-browser`，Windows 可用 `py -3` 替代 `python3`。

## 示例内容

- 入门评估、学员画像、学习目标与阶段路线。
- 第一课：Agent 系统模型、工具执行与信任边界。
- 原创图解、字幕视频和一手资源导学。
- 课程设置、课内 AI 答疑与本地学习记录。
- 使用合成数据的安全情报 Agent 实验。

当前正式课节为 `lessons/0001-agent-system-model.html`。`legacy-lesson-drafts/` 保留早期草稿，不代表已完成教学或已掌握内容。继续学习时，使用 Teach Pro 读取本目录的反馈，再决定下一课。

## 实验代码

实验使用本地合成数据与脚本化模型，无需 API Key，不访问网络。在本目录运行：

```sh
python labs/secure_cti_agent/app.py
python -m unittest discover -s labs/secure_cti_agent -p test_runtime.py
```

macOS 与 Linux 可使用 `python3`，Windows 也可使用 `py -3`。

## 文件导航

| 路径 | 内容 |
| --- | --- |
| `index.html` | 课程首页 |
| `COURSE.md` | 当前进度与课程状态 |
| `ROADMAP.md` | 阶段学习路线 |
| `lessons/` | 正式课节 |
| `practice/` | 入门评估与项目评价 |
| `reference/` | 资源导学与参考页面 |
| `assets/`、`media/` | 网页组件、图解与视频 |
| `labs/` | 实验代码与合成数据 |
| `legacy-lesson-drafts/` | 历史课节草稿 |

本地作答、聊天、模型配置与缓存不纳入版本管理。API Key 仅保存在服务进程内存中；云端答疑会将确认的上下文发送至所选服务。
