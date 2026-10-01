# 比赛 Demo 校核与运行验收

日期：2026-10-01。队伍：重邮FFBond。作品：学途智伴——大学生长期自适应学习智能体。

## 交付与范围

新增 `example/competition-demo-zhi-jian-agent/` 独立展示副本，共八页：首页、评估、三节课、设置、阅读中心、教学决策回放。主体版本保持 1.1.0-rc.3；没有修改 teach-pro 下的指令、模板或运行时。

沿 Teach Pro 的逐课结构、资源导学和本地同步规范整理已有逐次生成课程。共享 CSS、四个 JS、两份 Python 与三个启动器逐字节匹配冻结基线；新增 demo.css 仅调整展示首页编排及横幅对比度。

原 Test5、三分支提交、旧 example 和比赛材料均保留。公开副本不含原始作答、聊天、配置、真实画像或掌握成绩；状态标记无实际提交。浏览器测试只写独立临时副本。

## 内容校核

- 第一课删除原始评估引语及单选答对推断；将命名示例换为虚构称呼，模拟回复不写成真实 API 输出。
- 限定 Chat Completions 示例的上下文范围，区分历史传入与服务商留存；修正遗漏 assistant 必定无法解析指代的错误推断。
- `print(response)` 合法，但不符合“只显示摘要”的目标；练习区分参数错误、密钥管理与结果呈现。
- 第二课去除原始作答引语，用合成误区摘要组织补救。第三课保留既有人工修订，新增展示说明与跨课入口。
- 五项一手资源重新打开指定正文：DeepSeek、ReAct、Anthropic、OWASP、OpenAI。论文只核验摘要与 PDF 图注文字，没有宣称全文或图像细节已审查。
- 增加 ReAct 短阅读与产出任务，选读默认折叠；没有复制论文图、增加空播放器或将旧视频视为新录成片。

资源位置与学习预算见 [RESOURCES.md](../../example/competition-demo-zhi-jian-agent/RESOURCES.md)。G3 原生生成的内容失败判定保持不变，不能以手工整理后的课程替代模型行为成绩。

## 自动与浏览器结果

环境：Windows、Node v24.15.0、本机 Edge headless、Python。浏览器脚本不依赖 Playwright；它是维护者测试工具，不是课程运行依赖。

| 检查 | 实际结果 |
| --- | --- |
| 仓库 Node 单元测试 | 14/14 通过；新增四项检查运行资产、页面身份、空白发布状态与课程数量 |
| 仓库 Python 单元测试 | 15/15 通过；新增三项检查课内代码，循环覆盖四种停止分支 |
| 课程结构 | 八页通过，局部路径与必要组件检查通过 |
| 静态布局 | 八页 × 390/1366px，共十六次；无横向溢出，390px scrollWidth=390，1366px scrollWidth=1351 |
| 本地服务 | 八页 HTTP 200；仅本机回环服务 |
| 选择题 | 评估四题、第一课三题、第二/三课各两题，共十一题；错误/正确反馈不同，刷新恢复选项 |
| 展开答案与侧栏 | 三课展开段落有内缩；桌面收起/展开恢复；每页一个主题面板 |
| 入门评估同步 | 六字段自动落盘；清空浏览器缓存后从文件恢复；导出六字段；清空同步到文件 |
| 疑难与隔离 | 第三课疑难自动落盘，未改变评估文件 |
| 未配置 Tutor | 当前课上下文可加载，发送禁用、聊天为空，合成作答未进入上下文 |
| DeepSeek 设置 | 自动填地址；Key 默认 password，小眼睛 text/password 切换；未同意时获取/测试禁用 |
| 浏览器异常与远端请求 | 页面异常 0，浏览器远端请求 0；没有执行远端模型获取、连接测试或聊天 |

第三课本地 mock 检查消息角色与调用 ID 配对、模拟区间、目标拒绝/允许。循环用桩函数覆盖 stop、length、content_filter 与八轮上限；无网络或真实邮件行为。八轮每轮两项意味着十六次模拟执行，不把轮数当调用次数上限。

截图逐项目视检查：首页桌面/窄屏、评估桌面/窄屏、三课深色图解、设置页。发现首页横幅的说明文字对比不足，修正展示 CSS 后复测。截图和完整 QA 报告位于仓库外 `exploration/mainline-validation/competition-demo-qa/`；不发布临时答案与浏览器缓存。

发布权限检查：展示副本的 start-course.sh、start-course.command 均在 Git 索引标为 100755。用最终展示暂存树归档的独立验权 ZIP，两项 Unix 创建标记为 3，模式均为 0o100755，未含作答、聊天或配置。此测试归档不是最终参赛包；文件为仓库外 `exploration/mainline-validation/competition-demo-20261001-final-permission-check.zip`，SHA256 为 `9C338D0DE12B65820EF6BB30DD606A81880A72FC94ADC6D51FCE34B6CEEEDE44`。

复现命令，从仓库根目录运行：

```powershell
node --test tests/*.test.cjs
python -X utf8 -m unittest discover -s tests -p 'test_*.py'
python -X utf8 teach-pro/scripts/check_course.py example/competition-demo-zhi-jian-agent
node tests/competition-demo.browser.mjs "仓库外截图目录"
```

浏览器测试可通过 TEACH_PRO_BROWSER、TEACH_PRO_PYTHON 指定已安装的浏览器和解释器。测试结束保留独立临时副本便于复核，不碰原始课程。

## 尚未验证与后续材料

本轮未调用真实提供商、验证模型获取与实际聊天、进行 macOS/Linux 启动或长期学习效果测试。执行权限仅在 Git/ZIP 元数据层核验，不能替代三端实机运行。原生三分支结论仍见 [G3 最后分支复核](./2026-10-01-test5-g3-recovery-review.md)。

接下来用同一 Demo 更新说明 Word，再按 175 秒分镜录制新视频。视频中的 DeepSeek 成功画面须实际操作并记录，不补造；密钥始终遮蔽。旧 Word、旧视频与最终压缩包尚未在本轮替换。
