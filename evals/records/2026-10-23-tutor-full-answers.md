# rc.14 长回答完整显示与手动继续

日期：2026-10-23。接续 rc.13 的计数修复，本次按用户选择取消本地对正常回答的主动截断。

## 实现

- `tutor_chat.py` 不再按正文字符数、SSE 总量／单事件体积、JSON 回答大小或固定总时长停止读取。HTTPS/TCP 连接等待30秒；模型请求发出后采用120秒无数据等待，持续有数据时不因总用时而中止。
- `tutor.js` 同步移除24000字与32 MiB传输闸门。保存原始全文，长回答和超过旧8 MiB门槛的聊天文件可重读；不改课文与练习保存键。
- 高级输出预算默认留空，配置存 null，请求省略 token 参数。显式正整数原样发送，已有4096等设置保留。连接测试仍128 token。DeepSeek 参数依据[官方 Chat Completions 文档](https://api-docs.deepseek.com/api/create-chat-completion/)于本日核验；模型服务端仍有自己的输出和上下文边界。
- 正常回答没有状态标签。确实断流只在回答末尾简短提示一次，问题区和输入区不重复提示。文件内 complete/incomplete 等事实状态保留，供教学 AI 区分未解决疑问。
- 最近一条中断回答支持手动“继续回答”，把原问题、选文与全部已收正文带入新请求，保留未发送草稿；不自动重试或继续。继续请求保存 continues 关联；旧问题和已收正文不覆盖。继续失败后重试仍带原上下文。
- 模型列表、请求来源检查、HTTPS/DNS 校验、密钥遮蔽与 keyring 不变。日常版与赛事版使用相同运行组件。

## 可复现验证

仓库根目录执行：

```sh
python -B -X utf8 -m unittest discover -s tests
python -B -X utf8 teach-pro/scripts/test_response_limits.py
node --test tests/competition-rc12-integrity.test.cjs
node tests/tutor-response-limits.browser.cjs
node tests/pages-course-inline.browser.cjs
```

浏览器脚本使用现有 Playwright、Edge 和 Python，在临时课程副本内运行回环模拟服务；没有真实密钥、原学员文件或付费模型请求。可通过 TEACH_PRO_PYTHON、TEACH_PRO_BROWSER、NODE_PATH 配置本机工具路径。

- 全量 Python 179项：170通过、9条件跳过。包括12项自动预算／长记录／继续请求测试；原25项响应测试保留，随包40项回归分别对 Skill 与 Demo 执行通过。
- 合成浏览器：3153字／936739传输字节、40000 Unicode码点、100000字正文、2098084字节单事件场景、16817426字节流及大于5 MiB的JSON回退均正常完成。
- 首段在请求完成前显示；刷新后的聊天文件逐字节不变。真实EOF断流保留8字，只有一处末尾提示；点击继续时原问题／正文送到模拟接口，输入草稿保留，不点击就不新增请求。
- 浏览器另用33 MiB NDJSON填充模拟旧前端传输门槛，正文正常显示，无超限提示。该填充是模拟元数据，不是33 MiB教学正文。
- 9次回环模型模拟请求、0次外网／真实提供商请求、0页面脚本错误。模拟与真实模型验证分开，不将本轮写成新的 TeleAgent 生成或学习成效评测。
- quick_validate、JS语法与两项Demo运行字节一致性检查通过。独立发布与公网下载的实际版本、摘要和清单在同日 rc.14 发布记录中核验。

## 升级

更新已有课程时，成组同步 `tutor_chat.py`、`assets/tutor.js`、`assets/tutor-settings.js`，并将定制 settings.html 的输出预算字段改为可留空；保留课程标识、课文、聊天、作答和配置。重启服务，再刷新网页。单独导入新版 Skill 不自动改写其他课程副本。

旧显式输出预算不会自动删除；需要模型默认预算时，在课程设置 → 高级设置中清空输出 token 预算，再保存并启用。其他模型参数和设备密钥保持原样。本次不生成下一课、不写入用户提供的外部 D盘课程。
