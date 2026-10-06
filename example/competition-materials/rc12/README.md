# rc.12 参赛材料

作品：学途智伴——大学生长期自适应学习智能体。队伍：重邮FFBond。版本：Teach Pro 1.1.0-rc.12。

## 当前交付

- [新版 Demo](../../competition-demo-rc12/README.md)：三节正式课和一节关联补充课，八个页面。
- [Word 技能说明](./学途智伴技能说明文档.docx)：五页，包含作品简介、设计思路、使用说明、设置与答疑、验证结果，已渲染并逐页复核。
- [师生演示视频](./学途智伴师生演示视频.mp4)：约 2 分 30 秒，学生 Andre 男声、教师 Elias 女声；教师语气明快、亲切，节奏更接近日常交谈。录制真实课程操作及 DeepSeek 两轮流式答疑，字幕放在课程画面下方。
- [视频讲解脚本](./视频讲解脚本.md)：说明 Skill 技能包与宿主、课程及答疑的关系。开场为调用方式示意，续课为已生成结果回放，课堂操作和提供商请求为本轮真实录制。
- [师生口播计划](./dialogue-plan.json)、[实际章节](./dialogue-video-chapters.json)、[配音检查](./audio/dialogue-voice-audit.json)：分角色维护解说；答疑教师配音使用实际返回的答案，仅去除 Markdown 标记。技术检查已完成，主观听感待试看。
- 快速试听：[学生沉稳男声](./audio/学生沉稳男声.mp3)、[教师成熟女声](./audio/教师成熟女声.mp3)。
- [旧单人口播计划](./video-scenes.json)：旧连续旁白、男女声试样、字幕及[音频检查](./audio/voice-audit.json)保留作历史对照，不适配师生版。
- [情感配音试样](./audio/expressive-voice-audit.json)：百炼 Qwen 指令型语音，同一音色、同一段 Skill 开场对比“亲切讲解”和“同学分享”，实际时长与合成状态以检查记录为准；待试听选定，不覆盖完整旁白。
- [截图与浏览器检查](./capture-checks.json)：隔离副本采集，未调用模型；设置截图中的密钥为无效示例值。

旧版文档和视频保留于上一级目录。师生版已完成首版录制、合成与技术检查；最终提交前确认听感、术语发音和字幕同步，并将说明文档与最终视频同步。本轮没有重新执行 TeleAgent 技能导入或课程生成。

## 重建

在仓库根目录运行，使用已准备好的 Python、python-docx、Node、Playwright、Sharp 和浏览器。材料工具依赖与学员运行依赖分开。

### 师生版视频

录制与合成串行执行。DeepSeek 和百炼凭据分别通过隐藏输入读取，只在进程内传递。工作目录位于仓库外；录制器复制干净 Demo，不读取原学员答案、聊天或配置。系统凭据服务可用时实际展示设备记忆，录制结束删除该隔离课程的临时凭据。

```powershell
python example/competition-materials/rc12/scripts/make_dialogue_video.py record <工作目录>
python example/competition-materials/rc12/scripts/make_dialogue_video.py voice <工作目录>
python example/competition-materials/rc12/scripts/make_dialogue_video.py render <工作目录>
python example/competition-materials/rc12/scripts/make_dialogue_video.py audit <工作目录>
```

用 `TEACH_PRO_NODE`、`NODE_PATH`、`TEACH_PRO_BROWSER`、`TEACH_PRO_PYTHON` 指定录制所需 Node、Playwright、浏览器和课程 Python；后两步还需 FFmpeg/ffprobe。脚本不将凭据放入命令行参数。录制包含四次真实提供商请求，不使用合成模型接口；两轮回答和演示作答只保留在隔离工作区。

语音使用官方音色 Andre / Qwen3-TTS-Flash 与 Elias / Qwen3-TTS-Instruct-Flash。修改解说后只生成缓存不匹配的片段，不自动重试；`voice --cached-only` 离线重建音轨和字幕，无需凭据。教师回答取实际保存的答案；问题变化时必须重新录制，不能重新标注旧答案。Flash 的已完成 PCM 若携带流式 WAV 长度占位头，仅在独立副本修正长度，原始音频与所有样本保留。

教师通过语气指令重新合成，再用保音高的 `atempo` 作小幅节奏调整：教师 1.08、学生 1.04。原始语音保留，字幕和混音采用调整后文件的实测时长；语音报告分别记录源时长、播放时长、倍率和哈希。设置镜头至少 14 秒，两轮答疑镜头各至少 15 秒，不改变真实录屏播放速度。若仍超过三分钟，精简解说，不继续提高倍率。字幕按句段分配在实测语音片段内，仍需人工复核同步；章节记录说明等待剪短和阅读停留。只发布最终 MP4、SRT、章节和去敏检查记录，原始录屏、WAV、缓存和学习文件不随包提交。

### 文档与静态截图

```powershell
node example/competition-materials/rc12/scripts/capture_and_check.cjs
node -e "require('sharp')('example/competition-materials/rc12/assets/architecture.svg',{density:180}).png().toFile('example/competition-materials/rc12/assets/architecture.png')"
python example/competition-materials/rc12/scripts/build_document.py
python example/competition-materials/rc12/scripts/audit_document.py
```

### 高质量语音候选

当前影片仍为 Qwen 师生版。高质量候选使用百炼托管的 `MiniMax/speech-2.8-hd`，直接设置原生语速和情感，试听不作后期倍速。2026-10-06 用户开通服务后，查询到 303 个系统音色并成功生成四段短样；此前未开通的失败记录仍保留于[连接记录](./audio/hd-connection-check.json)。

教师同文对比：[A · 成熟自然](./audio/teacher-wise-auto.mp3)、[B · 成熟活泼](./audio/teacher-wise-happy.mp3)、[C · 温柔自然](./audio/teacher-gentle-auto.mp3)，原生语速均为 1.30；[学生沉稳提问](./audio/student-college-calm.mp3)为 1.15。A/B 使用实际系统音色“阅历姐姐”，只改变是否显式设置 happy 情感；C 使用“温柔学姐”，学生使用“青年大学生”。[短样计划](./hd-audition-plan.json)与[音频检查](./audio/hd-audition-audit.json)记录完整参数、时长和哈希。听感确认前不替换整片，不把模型名或技术检查当作自然度验收。

独立工具使用官方北京公共端点与隐藏凭据输入，只查询系统音色，不创建或复刻音色：

```powershell
python example/competition-materials/rc12/scripts/bailian_hd_speech.py voices <工作目录>
python example/competition-materials/rc12/scripts/bailian_hd_speech.py audition <工作目录> --plan <短样计划.json>
```

短样计划包含公共讲解 `text` 与 `variants`；每个候选提供 `id`、实际系统音色 `voice`、原生 `speed`，可选 `emotion` 或独立 `text`。合成缓存匹配时不重复请求，`--cached-only` 可离线复核。原始 WAV 与缓存留在仓库外，输出 MP3 只统一响度。先对比成熟女声与沉稳男声，再重建整片，当前成片和口播计划不因候选试验改变。协议见[MiniMax 同步语音合成](https://help.aliyun.com/zh/model-studio/minimax-synchronous-speech-synthesis-api)、[系统音色查询](https://help.aliyun.com/zh/model-studio/sound-management)。

### 历史单人旁白

旧方案使用 FFmpeg、ffprobe 与 edge-tts，仅处理公开讲解文字。在仓库外创建工作目录后运行：

```powershell
python example/competition-materials/scripts/build_video_voice.py <工作目录> --script example/competition-materials/rc12/video-scenes.json --tts-packages <edge-tts安装目录>
python example/competition-materials/rc12/scripts/build_voice_samples.py <工作目录>/samples --tts-packages <edge-tts安装目录>
```

将生成的 `audio/narration.mp3` 复制为 `rc12/audio/连续旁白候选.mp3`，将两段试样复制为 `女声试样.mp3` 和 `男声试样.mp3`，再执行离线检查和字幕导出：

```powershell
python example/competition-materials/rc12/scripts/audit_voice.py <工作目录>
```

字幕候选对应旁白音轨，不是最终影片时间码。试听或更换音色后，重新生成连续旁白和检查记录；不要只替换 MP3 留下过期字幕。

### 情感型配音试样

用 `expressive-voice-plan.json` 分开维护口播与语气指令。北京和新加坡使用各自地域的 API Key；默认北京。通过 `DASHSCOPE_API_KEY` 进程环境变量或隐藏输入读取密钥，不在命令行参数、缓存和报告中存储。工具仅依赖 Python 标准库及 FFmpeg/ffprobe：

```powershell
python example/competition-materials/rc12/scripts/build_expressive_samples.py <工作目录> --key-stdin
```

工具串行生成两段，不自动重试；已成功且脚本未变的原始音频可复用。统一试听音量，不修改语速、音高或停顿。公开交付只复制 MP3 和 `expressive-voice-audit.json`；原始 WAV、缓存和工作目录不随包发布。听感确定后再制作完整旁白与重新对齐字幕。

本地检查中断后可用 `--cached-only` 离线复核，无需密钥、不重新请求语音；缓存必须与当前文字、语气和地域匹配。报告中的 `new_synthesis_requests` 仅统计该次执行，离线复核为零，不表示源音频未经过合成。

协议来源：[Qwen-TTS API](https://help.aliyun.com/zh/model-studio/qwen-tts-api)、[音色列表](https://help.aliyun.com/zh/model-studio/qwen-tts-voice-list)。

通过 `TEACH_PRO_PYTHON`、`TEACH_PRO_BROWSER` 和 `NODE_PATH` 指定已安装依赖。截图服务在隔离副本以 session-only 模式运行，不安装密钥依赖、不保存凭据、不发送模型请求；设备记忆的检查沿用专门凭据测试，不以截图状态替代。

Word 发布前必须渲染并逐页检查；本机采用既有 Word 只读导出适配器加文档渲染器和 Poppler，检查页图保留在仓库外。截图、架构图和公开 Demo 可复用；学员记录、模型设置及密钥不随材料提交。
