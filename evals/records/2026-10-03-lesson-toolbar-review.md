# rc.5 冻结课内工具栏验收

日期：2026-10-03。基线：`410063bf6f4a3fa4280de6755a5725758c5b7148`。本轮串行执行，仅更新页面模板、共享样式与脚本、配套规范和展示副本，未扩展逐课教学主体。

## 变更

- 冻结栏位于内容区顶部，不跨入导航区；问 AI 是最左侧的唯一按钮，右侧为课次、标题及小字说明。
- 使用随课程主题和深浅色变化的浅底纹渐变、强调分隔线与轻阴影，与正文区分；阶段、时间和进度保留在栏下。
- 标题统一为“第 N 课 · 标题”，从模板课次或旧课文件名识别课次，去除已有前缀后添加，避免重复编号。
- 兼容侧栏折叠、正文锚点、旧标题区、长标题、窄屏及打印；共享组件和三节 Demo 同步。

## 检查结果

| 检查 | 结果 |
| --- | --- |
| Node 串行回归，含真实浏览器 | 17/17 通过 |
| Python 回归 | 37/37 通过 |
| Demo 结构 | 8 页通过 |
| Skill 元数据校验 | 通过 |
| Git diff 空白检查 | 通过 |

可复现命令，在仓库根目录使用已安装 Python、Node 与 Playwright：

```powershell
node --test --test-concurrency=1 tests/lesson-toolbar.browser.cjs tests/tutor-experience.browser.cjs tests/tutor-markdown.browser.cjs tests/assessment-save.test.cjs tests/competition-demo-integrity.test.cjs tests/visual-ui.test.cjs tests/tutor-defaults.test.cjs
python -B -m unittest discover -s tests -p 'test_*.py'
python -B teach-pro/scripts/check_course.py example/competition-demo-zhi-jian-agent
```

工具栏浏览器测试使用 Edge、隔离临时副本和本地文件：断言 sticky 几何位置、单按钮和单 H1、渐变/分隔线、课次去重、旧标题锚点保留、侧栏伸展、正文锚点避让、弹窗关闭后焦点和滚动位置恢复、320/390px 窄屏、深浅色/多主题、打印和禁用 JavaScript 的静态阅读。该工具栏测试外网请求为 0，客户端异常为 0；答疑回归使用本地合成提供商，不调用付费模型。

九张截图及 summary.json 位于仓库外 `competition-work/2026-10-03-toolbar-qa`。已目视检查桌面 Demo、滚动、侧栏折叠、深色、两种窄屏、旧课及无脚本视图。截图为 UI 验证，不作为原生 Agent 生成或学习效果证据。

首次回归的 Demo 完整性检查因前次 Python 验证产生的忽略缓存失败；已将该 `__pycache__` 可恢复地移至仓库外 QA 目录，随后设置 `PYTHONDONTWRITEBYTECODE=1` 并使用 `-B`，最终全套通过。未改动原始学员目录和学习记录。

## 发布边界

Skill 与 Demo 版本为 `1.1.0-rc.5`。Word 和无配音演示视频仍为 rc.4 快照，本轮未重新制作。新版 Skill 应重新导入 TeleAgent 后验证原生生成；本轮不声称该行为验收已完成。技能 ZIP 从已提交的 Git 树归档，不覆盖旧 `skill/teach-pro.zip`，不纳入本地配置、聊天、学员答案或缓存。
