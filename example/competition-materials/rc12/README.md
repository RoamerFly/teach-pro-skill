# rc.12 参赛材料

作品：学途智伴——大学生长期自适应学习智能体。队伍：重邮FFBond。版本：Teach Pro 1.1.0-rc.12。

2026-10-23 运行修订：当前发布器交付 rc.14 Skill 与课程组件，支持长回答完整显示与保存、自动输出预算和手动继续回答；本目录的 Word、视频和实录截图保留 rc.12 展示版本。当前课页采用题后原位作答，发布包 README 标明材料与运行版本。

## 用途与价值

大学生长期学习需要把课程、练习和疑难持续组织起来，并判断下一步学什么。学途智伴把学习目标、课程与本地学习记录连接起来，先评估起点，再逐课教学；教学 AI 在续课时读取作答，根据表现调整下一课，并按需配套独立补充课。

参赛展示围绕学生的实际操作展开：从目标与评估进入第一课，遇到问题进行课内答疑，保存解释与疑难，再依据记录续课。通过这条主线说明跨会话接续、作答证据驱动和主线／补充分流如何减少学习组织负担。

## 当前交付

- [新版 Demo](../../competition-demo-rc12/README.md)：三节正式课和一节关联补充课，八个页面。
- [Word 技能说明](./学途智伴技能说明文档.docx)：五页，设计思路部分加入工作流程架构图与职责说明，已通过 Word 导出并逐页复核。
- [工作流程架构图](./assets/teach-pro-workflow-architecture-v2-connected.png)：以箭头连接学习闭环、课程交付、课内答疑与本地记录，与 Word 和视频开场使用同一版本。
- [师生演示视频](./学途智伴师生演示视频.mp4)：177.86 秒，约 2 分 58 秒。开场用架构图讲解 Skill、学习记录与续课，随后展示完整学习过程。教师使用 A“阅历姐姐”HD 女声，学生使用 Andre 男声，字幕放在画面下方。
- [视频讲解脚本](./视频讲解脚本.md)：说明 Skill 技能包、教学宿主、课程工作区及课内答疑的关系，串联从学习目标到自适应续课的演示主线。
- [师生口播计划](./dialogue-plan.json)、[实际章节](./dialogue-video-chapters.json)、[配音检查](./audio/dialogue-voice-audit.json)：分角色维护解说；答疑教师配音使用实际返回的答案，仅去除 Markdown 标记。技术检查已完成，2026-10-06 用户认可当前演示并要求准备参赛包。
- 快速试听：[学生沉稳男声](./audio/学生沉稳男声.mp3)、[教师成熟女声](./audio/教师成熟女声.mp3)、[疑问引出答疑](./audio/学习疑问与答疑衔接.mp3)。
- [旧单人口播计划](./video-scenes.json)：旧连续旁白、男女声试样、字幕及[音频检查](./audio/voice-audit.json)保留作历史对照，不适配师生版。
- [情感配音试样](./audio/expressive-voice-audit.json)：百炼 Qwen 指令型语音，同一音色、同一段 Skill 开场对比“亲切讲解”和“同学分享”，实际时长与合成状态以检查记录为准；待试听选定，不覆盖完整旁白。
- [截图与浏览器检查](./capture-checks.json)：隔离副本采集，未调用模型；设置截图中的密钥为无效示例值。

2026-10-10 更新架构开场与 Word。参赛展示突出三个创新点：依据作答证据动态续课、正式课与补充课分流、通过本地文件跨会话接续教学。录制来源与技术检查见 `dialogue-video-audit.json` 和仓库验证记录。

## 参赛打包

提交包按“重邮FFBond+学途智伴——大学生长期自适应学习智能体.zip”命名，包含 Skill 文件夹、五页 Word、三分钟以内的配音字幕视频、架构图、干净课程 Demo、讲解脚本与验证记录。独立 Skill ZIP 同时生成，方便单独导入。

打包器只读取指定 Git 提交，保留 Unix 可执行权限，检查视频哈希、三分钟限制、凭据特征和逐文件校验值。输出目录必须在仓库外且尚不存在：

```powershell
python example/competition-materials/rc12/scripts/package_submission.py <新的输出目录> --ref <已提交版本>
```

查看输出目录中的 `package-audit.json` 核对源码版本、包大小及 SHA-256。重新构建必须使用新的目录，不覆盖既有交付。

### 日常版与赛事版

两个发布配置由同一提交派生，不修改日常 Skill 源码。日常版保留兼容格式；赛事版适配参考评审 v2.1 的四个顶层字段，将规范收纳到 `references/specs/`、模板收纳到 `assets/templates/` 并同步所有引用及示例构建路径。`agents/openai.yaml` 保留显式调用策略；共享样式、交互、服务、密钥组件与模板内容不变。

```powershell
python example/competition-materials/rc12/scripts/package_submission.py <日常版空目录> --ref <提交> --profile normal_use --skill-only --extract
python example/competition-materials/rc12/scripts/package_submission.py <赛事版空目录> --ref <提交> --profile competition_submit --extract
```

`--extract` 同时提供干净的可导入文件夹；不会合并或覆盖既有文件。`package-audit.json` 记录发布配置、路径迁移、源码与发布文件 SHA-256、视频时长和 ZIP 校验结果。赛事版的额外顶层中文字段不适用当前日常 Codex 校验器；不得标为通用格式校验通过。实际宿主导入、课程生成与参考评分仍需单独确认。

## 重建

在仓库根目录运行，使用已准备好的 Python、python-docx、Node、Playwright、Sharp 和浏览器。材料工具依赖与学员运行依赖分开。

### 师生版视频

当前架构开场可离线复现：`python scripts/update_architecture_opening.py <已验收录制工作区> <空的新工作目录>`，脚本相对本材料目录。它复用原第 1、11 段音轨，重新构建首镜、字幕与章节时间码，不调用提供商。第 2–13 镜头保持原编码；下面是原真实录制流程。

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
