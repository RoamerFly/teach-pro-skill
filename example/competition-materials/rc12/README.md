# rc.12 参赛材料

作品：学途智伴——大学生长期自适应学习智能体。队伍：重邮FFBond。版本：Teach Pro 1.1.0-rc.12。

## 当前交付

- [新版 Demo](../../competition-demo-rc12/README.md)：三节正式课和一节关联补充课，八个页面。
- [Word 技能说明](./学途智伴技能说明文档.docx)：五页，包含作品简介、设计思路、使用说明、设置与答疑、验证结果，已渲染并逐页复核。
- [师生演示视频](./学途智伴师生演示视频.mp4)：约 2 分 48 秒，十三段渐进演示，从学习目标到代码疑问，再连接答疑、追问和续课。教师保留已选定的 A“阅历姐姐”HD 女声，学生保留 Andre 男声；按新台词重新合成，不作后期提速。课程操作和 DeepSeek 两轮流式答疑重新实录，字幕放在课程画面下方。
- [视频讲解脚本](./视频讲解脚本.md)：说明 Skill 技能包与宿主、课程及答疑的关系。开场为调用方式示意，续课为已生成结果回放，课堂操作和提供商请求为本轮真实录制。
- [师生口播计划](./dialogue-plan.json)、[实际章节](./dialogue-video-chapters.json)、[配音检查](./audio/dialogue-voice-audit.json)：分角色维护解说；答疑教师配音使用实际返回的答案，仅去除 Markdown 标记。技术检查已完成，2026-10-06 用户认可当前演示并要求准备参赛包。
- 快速试听：[学生沉稳男声](./audio/学生沉稳男声.mp3)、[教师成熟女声](./audio/教师成熟女声.mp3)、[疑问引出答疑](./audio/学习疑问与答疑衔接.mp3)。
- [旧单人口播计划](./video-scenes.json)：旧连续旁白、男女声试样、字幕及[音频检查](./audio/voice-audit.json)保留作历史对照，不适配师生版。
- [情感配音试样](./audio/expressive-voice-audit.json)：百炼 Qwen 指令型语音，同一音色、同一段 Skill 开场对比“亲切讲解”和“同学分享”，实际时长与合成状态以检查记录为准；待试听选定，不覆盖完整旁白。
- [截图与浏览器检查](./capture-checks.json)：隔离副本采集，未调用模型；设置截图中的密钥为无效示例值。

当前师生版作为参赛定稿，Word 已同步其渐进流程、首次连接返回路径与真实两轮答疑，并重新渲染复核五页。旧版文档、视频与试听候选保留作历史对照，不随最终包提交。本轮没有重新执行 TeleAgent 技能导入或课程生成；用户认可当前演示不代表完成了音素级字幕强制对齐。

## 参赛打包

提交包按“重邮FFBond+学途智伴——大学生长期自适应学习智能体.zip”命名，包含 Skill 文件夹、五页 Word、2 分 48 秒配音字幕视频、干净课程 Demo、讲解脚本与验证记录。独立 Skill ZIP 同时生成，方便单独导入。

打包器只读取指定 Git 提交，保留 Unix 可执行权限，检查视频哈希、三分钟限制、凭据特征和逐文件校验值。输出目录必须在仓库外且尚不存在：

```powershell
python example/competition-materials/rc12/scripts/package_submission.py <新的输出目录> --ref <已提交版本>
```

查看输出目录中的 `package-audit.json` 核对源码版本、包大小及 SHA-256。重新构建必须使用新的目录，不覆盖既有交付。

## 重建

在仓库根目录运行，使用已准备好的 Python、python-docx、Node、Playwright、Sharp 和浏览器。材料工具依赖与学员运行依赖分开。

### 师生版视频

录制与合成串行执行。DeepSeek 和百炼凭据分别通过隐藏输入读取，只在进程内传递。工作目录位于仓库外；录制器复制干净 Demo，不读取原学员答案、聊天或配置。系统凭据服务可用时实际展示设备记忆，录制结束删除该隔离课程的临时凭据。

```powershell
python example/competition-materials/rc12/scripts/make_dialogue_video.py prepare <工作目录>
python example/competition-materials/rc12/scripts/make_dialogue_video.py record <工作目录>
python example/competition-materials/rc12/scripts/make_dialogue_video.py voice <工作目录>
python example/competition-materials/rc12/scripts/make_dialogue_video.py render <工作目录>
python example/competition-materials/rc12/scripts/make_dialogue_video.py audit <工作目录>
```

`prepare` 先合成台词并测量各句时间，不预生成模型回答。`record` 校验台词未变，按实测口播时点操作页面，包含四次真实提供商请求。`voice` 补充合成实际答案，复用其他缓存。录制从未连接模型的答疑入口开始，设置携带原课程定位，返回后自动打开同一课答疑窗口。

用 `TEACH_PRO_NODE`、`NODE_PATH`、`TEACH_PRO_BROWSER`、`TEACH_PRO_PYTHON` 指定录制所需 Node、Playwright、浏览器和课程 Python；音视频处理还需 FFmpeg/ffprobe。脚本不将凭据放入命令行参数，不使用合成模型接口；两轮回答和演示作答只保留在隔离工作区。

语音使用 Andre / Qwen3-TTS-Flash 与“阅历姐姐”/ MiniMax Speech 2.8 HD，均通过百炼合成。工具按模型选择协议，不向 HD 接口发送 Qwen 语气指令。修改解说后只生成缓存不匹配的片段，不自动重试；`voice --cached-only` 离线重建音轨和字幕，无需凭据。教师回答取实际保存的答案；问题变化时必须重新录制，不能重新标注旧答案。Flash 的已完成 PCM 若携带流式 WAV 长度占位头，仅在独立副本修正长度，原始音频与所有样本保留。

教师保留 A 的声线，按句设置 1.24–1.30 原生语速：接住提问、确认成功和肯定理解使用 happy，机制解释使用 calm，其他段落由模型匹配情感。学生保留 Andre，通过自然口语、思考句、疑问与领悟句重写台词；该音色不支持独立指令控制，`delivery` 只记录台词意图，不冒充提供商参数。两角色播放时长等于源时长，混音只统一响度，不改变音高或语速。报告按句记录情感、原生语速、播放倍率、时长和哈希。

剪辑保留连续操作，仅裁去动作完成后的尾部空等，不能跳过设置或提问中段；音轨时间线不得短于真实动作时长。设置镜头至少 14 秒，两轮答疑各至少 15 秒。模型回答返回后才开始相应答疑口播。字幕按实测语音片段分配句段，仍需人工复核同步。原始录屏、WAV、缓存和学习文件不随包提交。

### 文档与静态截图

```powershell
node example/competition-materials/rc12/scripts/capture_and_check.cjs
node -e "require('sharp')('example/competition-materials/rc12/assets/architecture.svg',{density:180}).png().toFile('example/competition-materials/rc12/assets/architecture.png')"
python example/competition-materials/rc12/scripts/build_document.py
python example/competition-materials/rc12/scripts/audit_document.py
```

### 高质量语音候选

高质量候选使用百炼托管的 `MiniMax/speech-2.8-hd`，直接设置原生语速和情感，试听不作后期倍速。2026-10-06 用户开通服务后，查询到 303 个系统音色并成功生成四段短样；此前未开通的失败记录仍保留于[连接记录](./audio/hd-connection-check.json)。用户已选定教师 A；学生 HD 候选未采用，当前影片保留 Andre 声线。

教师同文对比：[A · 成熟自然，已采用](./audio/teacher-wise-auto.mp3)、[B · 成熟活泼](./audio/teacher-wise-happy.mp3)、[C · 温柔自然](./audio/teacher-gentle-auto.mp3)，原生语速均为 1.30；[学生 HD 候选，未采用](./audio/student-college-calm.mp3)为 1.15。A/B 使用实际系统音色“阅历姐姐”，只改变是否显式设置 happy 情感；C 使用“温柔学姐”，学生候选使用“青年大学生”。[短样计划](./hd-audition-plan.json)与[音频检查](./audio/hd-audition-audit.json)记录完整参数、时长和哈希。短样与历史检查保留，整片听感和术语发音仍需试看。

独立工具使用官方北京公共端点与隐藏凭据输入，只查询系统音色，不创建或复刻音色：

```powershell
python example/competition-materials/rc12/scripts/bailian_hd_speech.py voices <工作目录>
python example/competition-materials/rc12/scripts/bailian_hd_speech.py audition <工作目录> --plan <短样计划.json>
```

短样计划包含公共讲解 `text` 与 `variants`；每个候选提供 `id`、实际系统音色 `voice`、原生 `speed`，可选 `emotion` 或独立 `text`。合成缓存匹配时不重复请求，`--cached-only` 可离线复核。原始 WAV 与缓存留在仓库外，输出 MP3 只统一响度。候选工具独立于整片构建；选定后更新师生口播计划并重新生成字幕与成片。协议见[MiniMax 同步语音合成](https://help.aliyun.com/zh/model-studio/minimax-synchronous-speech-synthesis-api)、[系统音色查询](https://help.aliyun.com/zh/model-studio/sound-management)。

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
