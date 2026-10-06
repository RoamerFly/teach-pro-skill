# 高质量配音模型接入与开通阻碍

日期：2026-10-06。基线：d40df19。Skill 本体保持 1.1.0-rc.12，不改课程模板、学员记录或当前成片。串行执行，无子智能体。

## 用户反馈与处理

用户反馈上一版仍慢、语气生硬，要求换用更好的模型。本轮不继续增加 Qwen 原音的后期倍速，也不将短片时长下降作为自然度证据；准备百炼托管的 `MiniMax/speech-2.8-hd` 短样对比，先检验源合成再决定整片替换。

官方协议核验：北京公共域名可用，音色查询使用 `MiniMax/speech-2.8-turbo` 的 `get_voice/system`；合成使用 HD 模型、`voice_setting.speed`、可选情感、32kHz 单声道 WAV 和 hex 输出。参考[语音合成 API](https://help.aliyun.com/zh/model-studio/minimax-synchronous-speech-synthesis-api)、[音色查询](https://help.aliyun.com/zh/model-studio/sound-management)。较新的通用指南推荐空间专属域名，专用 API 文档仍列公共域名，实际请求已到达提供商并返回业务状态。

## 实际诊断

两次不同目的的请求：系统音色查询、按官方示例音色的短句 HD 合成；均 HTTP 400 / InvalidParameter，无自动重试。第一轮工具只保留状态码和错误代码。第二次受控诊断得到明确错误：`The product is not activated, please confirm that you have activated products and try again after activation.`

因此目前不能生成 HD 试听，不能声称已提升自然度。旧影片、试听、SRT、章节和当前口播计划均不覆盖。MiniMax 产品开通涉及用户账号授权与计费确认，需用户在百炼完成；不擅自开通、充值、接受协议或创建克隆音色。公开诊断只保留必要状态，不含密钥、签名 URL 或账户资源。

## 工具与离线验证

新增独立材料工具 `bailian_hd_speech.py`：隐藏读取凭据、公共官方端点、禁止重定向、不自动重试、错误详情去敏、只查询系统音色、限定短样长度与参数、校验完整 hex 音频后解码，原始音频及缓存保留仓库外。试听只统一响度，无后期语速和音高调整。

新增七项离线测试：原生语速/情感协议、自动情感省略、非法参数拒绝、文本与音色校验、完整 hex 保真、失败/空/部分音频拒绝、HTTP 错误原因保留且凭据/URL 去敏。Python 全套 104 项，95 项通过、9 项原生凭据环境测试跳过；Node 全套 29 项通过，git diff --check 通过。离线检查仅验证调用工具，未证明模型实际音质。

下一步：用户开通 MiniMax 语音产品后查询真实系统音色，选择符合师生角色的男女声，同一讲解短样对比原生语速与情感；听感确认后重建影片和字幕。本轮只提交接入准备与真实失败证据。
