# 学途智伴参赛材料

队伍：重邮FFBond。作品：学途智伴——大学生长期自适应学习智能体。校园生活赛道，当前基线为 Teach Pro 1.1.0-rc.4。

Skill 与公开 Demo 已更新至 rc.5 冻结课内工具栏；本目录的 Word、截图和视频仍为 rc.4 快照，待最终录制时同步。新版界面检查见[工具栏验收](../../evals/records/2026-10-03-lesson-toolbar-review.md)。

## 当前交付

- [技能说明文档](./学途智伴技能说明文档.docx)：七页，包含设计、架构、操作流程、真实答疑截图与验证结果，已渲染逐页复核。
- [新版画面版](./学途智伴演示画面版.mp4)：2 分 50.64 秒，12 个循序镜头，实际 DeepSeek Flash 配置及三轮答疑，**暂不含配音**。附[字幕](./学途智伴画面版字幕.srt)与[章节及请求诊断](./video-ui-chapters.json)。
- [智鉴 Agent Demo](../competition-demo-zhi-jian-agent/README.md)：八页，含三节校核课、入门评估、阅读中心与教学决策回放。
- [本轮验收记录](../../evals/records/2026-10-02-tutor-materials-review.md)：页面回归、真实接口、文档及画面检查分别记录。

课堂调整采用已观察的合成测试回放，展示课程经人工校核。设置截图使用无效演示值；视频中的问答来自真实接口，保留原始回答。真实学员长期效果与 macOS/Linux 实机启动不在本轮验证范围。

旧[配音视频](./学途智伴演示视频.mp4)及其字幕保持不变，供历史对照；它仍使用升级前界面，不作为当前提交候选。完成配音试听后，再与新版画面合成最终比赛视频。工作包会明确标记该状态，不能直接视为最终提交包。

## Word 重建

材料维护需要已有 Python/python-docx、Node/Playwright/Sharp 和 Edge/Chromium。它们不是学员课程运行依赖。

```powershell
node example/competition-materials/scripts/capture_materials.cjs
python example/competition-materials/scripts/build_document.py
python example/competition-materials/scripts/audit_document.py
```

截图在隔离副本采集，不改 Demo 作答、不调用模型。`TEACH_PRO_BROWSER`、`TEACH_PRO_PYTHON` 可指定运行路径；随附 Node 包用 `NODE_PATH` 解析。`assets/tutor-dialog.png` 来自本轮真实录制，需要单独替换，不能由合成回答冒充。

发布前渲染并检查全部页面。Windows 可用 Word 只读导出，再由文档技能的渲染器和 Poppler 生成页图：

```powershell
python example/competition-materials/scripts/render_with_word.py `
  example/competition-materials/学途智伴技能说明文档.docx <仓库外检查目录> `
  --renderer <render_docx.py绝对路径> --poppler <Poppler目录>
```

检查 PDF、页图和缓存不进入工作包。

## 真实画面录制

```powershell
node example/competition-materials/scripts/capture_live_video.cjs <会话目录> --live
python example/competition-materials/scripts/render_ui_video.py <会话目录>
python example/competition-materials/scripts/audit_video.py <仓库外检查目录> --ui
```

会话目录需有镜头时长计划 `voice-plan.json`；这里只读取时长，不制作音轨。`video-ui-scenes.json` 定义新版字幕。录制会实际获取模型、测试连接和发送三轮问题，共五次提供商请求，可能计费。

在私有交互终端通过不回显的标准输入提供密钥，不使用命令参数、环境变量或脚本保存。API Key 始终为 password，保存后输入框清空。原始录屏、合成作答、聊天和配置只保留在仓库外隔离目录。

剪辑使用真实操作录屏与同次采集的阅读停留截图；片尾为单独采集的当前架构卡。模型回答不重写，不把已有教学分支回放称为现场生成。字幕置于独立窄条，导出后完整解码，并逐一检查十二章节代表帧。

## 工作包

```powershell
python example/competition-materials/scripts/package_working_release.py <仓库外输出目录>
```

从已提交的 Git 版本打包 Skill、当前 Word、无配音画面版和公开 Demo，保留 Unix 执行权限，不读取本地学员文件或旧 `teach-pro.zip`。输出目录必须位于仓库之外；完成后核对包指纹并更新证据记录。
