# rc.16 情感配音版发布验收

2026-10-26。材料提交：`cecf42e7d4a2f710b864942b6e7c26ec51c65bc7`。

- 上传文件 `competition-submission/competition_submit/页面上传材料/重邮FFBond+学途智伴——大学生长期自适应学习智能体.mp4` 已替换，SHA-256为 `8cb33013bf1c2f286259860ba3805f44e9d26ac89599de8f28396fb51fa88a85`。
- 师生32段声音全部重新合成，百炼MiniMax Speech 2.8 HD，原生emotion/speed生效；字幕78条，170.741333秒。全片解码、峰值−4.9dB、26帧视觉检查和无同步标记验证通过，主观听感待用户试看。
- 48项视频/发布/公开构建和表演合同测试通过；原始问答文本哈希保持一致，没有新增问答模型请求。新增语音合成成功32次。
- 日常版与赛事版从同一提交重新打包，运行组件一致。赛事完整包223项，CRC、manifest和解压副本校验通过，Unix启动器0755。
- Word仍为rc.16且演示时长不变，保留五页原文件。上传视频、独立技能包和相关说明均同步。
- 旧材料完整保存在 `competition-submission/history/2026-10-26-before-rc16-emotional-voice/`。
- GitHub Pages工作流 `40315187176` 成功；在线build-audit提交匹配，实际下载比对视频、Skill与课程ZIP、第一课HTML、tutor.js、上下文设置图及答疑展示图，共7项通过。

文件大小、SHA、源版本和在线校验详情见 [发布数据](./2026-10-26-rc16-emotional-release-audit.json)。逐段原生参数、语速、时长及音频哈希见 `example/competition-materials/rc12/audio/dialogue-voice-audit.json`。
