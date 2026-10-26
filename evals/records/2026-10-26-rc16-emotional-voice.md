# rc.16 师生情感配音全片重生成

日期：2026-10-26；Skill版本不变，本次只修订比赛媒体及重建工具。

- 本次32个语音片段全部新合成，均与旧版原音频SHA不同；总计32次成功的百炼语音合成，未用旧音轨或后期倍速。原问答仍为已录制DeepSeek回答在当前界面回放，没有新增问答请求。
- 教师：MiniMax/speech-2.8-hd / Chinese (Mandarin)_Wise_Women，原生语速1.27–1.30；学生：同模型 / Chinese (Mandarin)_Gentleman，原生语速1.19。happy用于接话/鼓励/领悟，surprised用于疑问/求证，其余按台词自动情感。制作意图元数据不冒充原生指令。
- 学生Qwen指令型号实际返回Model not exist，未声称其生效；改用已成功验证的HD男声。新凭据从用户指定本机文件读取，未写入脚本、日志、音频元数据或Git。
- 两轮实际回答朗读文本SHA与历史接口记录一致；说明台词改为自然口语，短回应和解释分段，换人间隔约250毫秒，段间约120毫秒。
- 170.741333秒，1440×900，25 fps，H.264/AAC；十三章，78条新字幕。32段源音频及完整成片解码通过；音频峰值−4.9dB，未削波；全部对白在各章时段内，无字幕重叠。26个章节代表帧目视通过，成片同步标记0帧。
- 48项视频/发布/公开构建与表演合同测试通过。主观听感留待用户试看，不以技术指标冒称已获认可。
- 使用说明Word未写具体音色，仍为rc.16且时长不变，保留现有五页文件；视频、字幕、讲解脚本、两角色试听和参数记录同步。

制作：`regenerate_expressive_voice.py`、`render_expressive_video.py`。实际公开台词计划：`example/competition-materials/rc12/emotional-performance-plan.json`；参数与源音频哈希：`audio/dialogue-voice-audit.json`。本地原始音频、旧版备份与帧检查在 `E:/A_Myskill/teach-pro/competition-work/2026-10-26-expressive-voice-v2/`。

官方参数：[MiniMax同步语音合成](https://help.aliyun.com/zh/model-studio/minimax-synchronous-speech-synthesis-api)。情感与语速均发送于voice_setting；calm为中性，本次不以强制calm控制长解释。
