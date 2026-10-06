# 首页 Hero 明暗主题修复

日期：2026-10-06。版本：1.1.0-rc.12，局部样式补丁，不新增主体功能。

## 发现与修正

- 用户提供的统计学首页复用了当前共享 CSS，文件 SHA256 与修复前 Skill 资产一致；问题来自共享样式，不是该课程独有的生成错误。
- 修复前浏览器实测：studio / systems / reading / field 的 Hero 渐变在浅色和深色模式中完全相同。横幅及标题、标签、进度说明用了固定深色背景与浅色文字。
- Hero 改用已有明暗色板的渐变、正文与次级文字、边框；纹理沿用各视觉方向的形状，着色跟随 accent。标签和进度区使用不透明 surface 保持可读。
- 桌面限制进度列比例，长标题和说明自然换行；窄屏保持单列。打印隐藏纹理。
- 保留阶段数字徽标使用的品牌深色，避免浅色 Hero 修复降低徽标对比度。
- 更新共享 CSS、两个公开 Demo 的同名资产、HTML 输出规范及用户本次指定课程的 CSS。未修改课程正文、学员答案、聊天、模型设置或凭据。

## 可复现检查

使用 Node.js、Playwright、Microsoft Edge，在隔离副本中只读取首页 HTML / CSS，阻止脚本执行与外部网络请求。没有调用模型或读写原始学员记录。

```powershell
node tests/course-hero-theme.browser.cjs
$env:HERO_COURSE_ROOT = '<待检查课程绝对路径>'
node tests/course-hero-theme.browser.cjs
node tests/roadmap-layout.browser.cjs
node tests/navigation-experience.browser.cjs
node tests/lesson-toolbar.browser.cjs
```

Node 环境须能解析 playwright，可通过 NODE_PATH 指向现有依赖；浏览器可通过 TEACH_PRO_BROWSER 指定。HERO_QA_DIR 指定私有截图和审计输出；HERO_BASELINE=1 仅用于复现旧版问题，不是验收模式。

结果：

- Hero 模板夹具：99 个状态通过；本次统计学首页隔离副本：99 个状态通过。
- 覆盖四种视觉方向、浅色/深色、随系统切换、手动选择优先于系统、1440 / 1024 / 768 / 390 / 320px、16 / 32px 根字号及打印。
- 校验渐变、标题色与纹理随模式变化，标题与进度分列/分行，无整页横向溢出、文本不越出 Hero；正文颜色与渐变端点及实色标签/进度底色对比度均 ≥4.5。该数值是 CSS 颜色检查，不是对每个装饰纹理像素的采样。
- 路线布局回归：99 个状态通过，阶段标签不遮盖标题。
- 导航体验浏览器回归通过，跨页滚动、快捷返回、四主题与窄屏无回退；顶部课内工具栏浏览器回归通过。
- Node 单元/完整性检查：29 项通过。
- Python 回归：118 项，109 项通过、9 项平台原生凭据测试跳过。
- 结构检查：本次课程 4 页、比赛 Demo 8 页均通过；Skill 基础验证通过。
- Hero 与路线浏览器测试均无外部请求、无页面脚本异常；浅色/深色截图已人工查看。

## 证据边界

本轮验证共享网页组件的可读性和主题响应，不证明课程教学内容正确、学员已掌握或 TeleAgent 再生成行为通过。无需重写已生成课文；已有课程只更新 CSS。后续新课程需使用更新后的 Skill 资产。

已认可的 Word 和 168.46 秒演示视频不重制；视频中的此前视觉样式不影响功能演示，本轮打包继续沿用这些材料。

## 参赛包同步

- 源码提交：`3a8fb28be99b2f0578e6ba25faa7005e06e5e6c9`，已推送 main。
- 新包位于仓库外 `competition-submission/2026-10-06-rc12-hero-theme-fix/`；旧包保留，不覆盖。
- 包校验记录见 [2026-10-06-hero-theme-package-audit.json](./2026-10-06-hero-theme-package-audit.json)：CRC、清单 SHA256、启动器 Unix 755 权限及视频时长核验通过，共 93 项。
- 解压副本的比赛 Demo：8 页结构通过，Hero 浏览器 99 状态通过。本地服务实测首页/设置/评估/第一课路由、课文上下文、合成答案写入与服务重启恢复通过；AI 保持未配置，未调用模型或设备凭据。
- 原始 ZIP 在副本测试后校验未改变；完整参赛包 SHA256：`a5174cb66b77e39b33d38e62b496aa0817efa299d13f2a4c227a75dc8ef3ef3d`。
