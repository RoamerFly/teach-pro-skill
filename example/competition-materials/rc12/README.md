# rc.12 参赛材料

作品：学途智伴——大学生长期自适应学习智能体。队伍：重邮FFBond。版本：Teach Pro 1.1.0-rc.12。

## 当前交付

- [新版 Demo](../../competition-demo-rc12/README.md)：三节正式课和一节关联补充课，八个页面。
- [Word 技能说明](./学途智伴技能说明文档.docx)：五页，包含作品简介、设计思路、使用说明、设置与答疑、验证结果，已渲染并逐页复核。
- [视频讲解脚本](./视频讲解脚本.md)：从 Skill 技能包、TeleAgent 调用开始，依次展示生成的课程、DeepSeek 配置、两轮真实答疑和基于记录的续课；十一段分镜预算约 170 秒。
- [旁白计划](./video-scenes.json)：统一维护新版口播正文，完整配音待重制。旧约 156 秒连续旁白、男女声试样、字幕及[音频检查](./audio/voice-audit.json)保留作历史对照，不适配新版口播。
- [情感配音试样](./audio/expressive-voice-audit.json)：百炼 Qwen 指令型语音，同一音色、同一段 Skill 开场对比“亲切讲解”和“同学分享”，实际时长与合成状态以检查记录为准；待试听选定，不覆盖完整旁白。
- [截图与浏览器检查](./capture-checks.json)：隔离副本采集，未调用模型；设置截图中的密钥为无效示例值。

旧版文档和视频保留于上一级目录。Word 已完成首轮更新；新版讲解正文已明确作品的 Skill 定位，尚无新版完整配音与视频成片。最终制作时同步文档与新脚本，录制 rc.12 真实问答，重制旁白及字幕，通过成片检查后制作最终提交包。

## 重建

在仓库根目录运行，使用已准备好的 Python、python-docx、Node、Playwright、Sharp 和浏览器。材料工具依赖与学员运行依赖分开。

```powershell
node example/competition-materials/rc12/scripts/capture_and_check.cjs
node -e "require('sharp')('example/competition-materials/rc12/assets/architecture.svg',{density:180}).png().toFile('example/competition-materials/rc12/assets/architecture.png')"
python example/competition-materials/rc12/scripts/build_document.py
python example/competition-materials/rc12/scripts/audit_document.py
```

旁白制作需要 FFmpeg、ffprobe 与 edge-tts。它只处理公开讲解文字，不读取模型密钥或学员记录；语音合成会将讲解文字发送到在线语音服务。在仓库外创建工作目录后运行：

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
