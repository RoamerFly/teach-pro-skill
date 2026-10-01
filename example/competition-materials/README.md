# 学途智伴参赛材料

队伍：重邮FFBond。作品：学途智伴——大学生长期自适应学习智能体。校园生活赛道，Skill 基线为 Teach Pro 1.1.0-rc.3。

## 当前交付

[技能说明文档](./学途智伴技能说明文档.docx) 共六页，涵盖作品简介、设计思路、技术实现、使用说明、DeepSeek 设置与验证结果。采用[已校核的智鉴 Agent Demo](../competition-demo-zhi-jian-agent/README.md)，含一张架构图和三张重新采集的操作截图。

材料使用已观察的合成测试结果；展示课经人工校核。设置截图只输入无效演示值，未获取模型或发起连接请求。真实模型成功、三端启动与长期学习效果不计入本轮结果。

当前完成 Demo、Word 和[新版演示视频](./学途智伴演示视频.mp4)。视频为 2 分 41 秒，16 个镜头、自然语速中文旁白与 66 条分句字幕，另附[字幕文件](./学途智伴演示字幕.srt)和[章节时间](./video-chapters.json)。DeepSeek 配置及课内答疑为流程预览，未展示真实模型连接或回答；最终提交压缩包尚未制作。本目录不覆盖仓库外 competition-work 中的旧材料。[Word 验收](../../evals/records/2026-10-01-competition-document-review.md)与[视频验收](../../evals/records/2026-10-01-competition-video-review.md)列出文件指纹和检查结果。

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
node example/competition-materials/scripts/capture_video.cjs <会话目录>
python example/competition-materials/scripts/render_video.py <会话目录>
python example/competition-materials/scripts/audit_video.py <仓库外检查目录>
```

录制脚本使用隔离课程副本、合成作答和无效演示密钥，禁止提供商请求。视频始终将字幕放在课程画面下方的独立窄条中；导出后完整解码并逐镜头检查。修改讲稿须重做旁白与录制，不用语音加速挤入三分钟。

补录真实答疑时，在隔离课程中手动完成：选择 DeepSeek → 输入自己的密钥并保持遮蔽 → 确认提供商使用说明 → 获取模型并下拉选择 → 保存 → 测试连接 → 返回第一课并确认本课发送范围 → 提问。测试和答疑可能计费；只录制实际成功结果，不在聊天或提交材料中提供密钥。停止服务会忘记内存密钥；本地配置与聊天不发布。
