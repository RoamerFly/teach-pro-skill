# 学途智伴参赛材料

队伍：重邮FFBond。作品：学途智伴——大学生长期自适应学习智能体。校园生活赛道，Skill 基线为 Teach Pro 1.1.0-rc.3。

## 当前交付

[技能说明文档](./学途智伴技能说明文档.docx) 共六页，涵盖作品简介、设计思路、技术实现、使用说明、DeepSeek 设置与验证结果。采用[已校核的智鉴 Agent Demo](../competition-demo-zhi-jian-agent/README.md)，含一张架构图和三张重新采集的操作截图。

说明文档中的展示课经人工校核，教学分支采用已观察的合成测试结果；文档内设置截图使用无效演示值。最新视频另行录制真实 DeepSeek Flash 配置与多轮课内答疑。长期学习效果及三端启动不计入本轮验证。

当前完成 Demo、Word 和[新版演示视频](./学途智伴演示视频.mp4)。视频约 2 分 51 秒，12 个顺序镜头、一条连续中文旁白，另附[字幕文件](./学途智伴演示字幕.srt)和[章节时间](./video-chapters.json)。主线为入门评估、图解学习、发现疑问、配置模型、真实问答与澄清、本地保存、课程调整。最终提交包尚未制作，Word 的操作截图与材料状态将在定稿时同步。[Word 验收](../../evals/records/2026-10-01-competition-document-review.md)与[最新视频验收](../../evals/records/2026-10-01-competition-live-video-review.md)列出文件指纹和检查结果；[上一版视频记录](../../evals/records/2026-10-01-competition-video-review.md)保留历史状态。

## 重建与检查

使用已有的 Python 环境及 python-docx。截图采集另需 Node、Playwright、Sharp 和本机 Edge/Chromium；这些是材料维护工具，不是课程运行依赖。Codex 工作区使用随附依赖，避免另装包。

```powershell
node example/competition-materials/scripts/capture_materials.cjs
python example/competition-materials/scripts/build_document.py
python example/competition-materials/scripts/audit_document.py
```

截图脚本在临时副本运行课程，不修改公开 Demo 作答；可用 TEACH_PRO_BROWSER 和 TEACH_PRO_PYTHON 指定浏览器与解释器，随附 Node 包通过 NODE_PATH 解析。生成器以 assets 中的架构图和截图为输入，输出同一份 Word。

Word 发布前必须渲染并逐页检查。Windows 无随附 LibreOffice 时，可用本机 Microsoft Word 的只读导出，再交由文档技能的 render_docx.py 和随附 Poppler 生成页图：

```powershell
python example/competition-materials/scripts/render_with_word.py `
  example/competition-materials/学途智伴技能说明文档.docx <仓库外检查目录> `
  --renderer <文档技能的render_docx.py绝对路径> --poppler <随附Poppler目录>
```

这条路径只打开待验收文档，不调用桌面 LibreOffice。PDF、页图与临时浏览器缓存只用于检查，不加入提交包。重新生成后应复核文件指纹，更新验收记录，再提交推送。

## 视频维护

`video-scenes.json` 管理分镜与讲稿；素材和检查帧写入仓库外的会话目录。制作需已有 edge-tts 环境、FFmpeg/ffprobe、Playwright 和 Edge；这些不是 Skill 或课程运行依赖。旁白只向在线语音服务发送公开讲稿，不读取学员数据或密钥。

```powershell
python example/competition-materials/scripts/build_video_voice.py <会话目录> --tts-packages <已有edge-tts包目录>
node example/competition-materials/scripts/capture_live_video.cjs <会话目录> --live
python example/competition-materials/scripts/render_video.py <会话目录>
python example/competition-materials/scripts/audit_video.py <仓库外检查目录>
```

真实录制需在私有交互终端通过标准输入提供密钥，输入不回显；不把密钥放入命令参数、环境变量或脚本。`--live` 明确启用提供商请求，可能计费。脚本使用隔离课程副本与合成作答，通过课程界面实际获取模型、保存配置、测试连接并完成三轮问答，检查聊天落盘。Flash 的本轮输出上限为 4096。配置输入始终为 password，不点击小眼睛；停止服务后忘记内存密钥。原始录屏、聊天、配置与学员文件只在仓库外保留。

旁白使用 Yunxi Neural 连续合成，保留自然停顿并统一响度，不加速音频。镜头按句子边界与绝对帧时间对齐；仅剪短请求等待，模型回答不重写。字幕位于课程画面下方独立窄条，导出后完整解码、检查时间轴并提取所有章节代表帧。音色与术语读音由用户播放确认。旧 `capture_video.cjs` 对应 Git 历史中的离线预览讲稿，不用于当前真实答疑版本。
