# Course Workspace Specification

## 必需结构

```text
<course-root>/
├─ .teach-course.json          # 机器可读课程标记，可选但推荐
├─ COURSE.md                   # 人类可读课程标记
├─ MISSION.md                  # 学习使命
├─ LEARNER-PROFILE.md          # 学习者画像
├─ ENTRY-ASSESSMENT.md         # 入门评估与先修判断
├─ ROADMAP.md                  # 分阶段路线图
├─ RESOURCES.md                # 已核验资源库
├─ GLOSSARY.md                 # 已掌握术语
├─ NOTES.md                    # 持久偏好与工作笔记
├─ index.html                  # 学习者入口
├─ settings.html               # 默认提供；统一课程设置，AI 按需配置
├─ serve_course.py             # 本机自动同步服务；有本地执行环境时提供
├─ start-course.cmd            # Windows 启动器；复制到课程根目录
├─ start-course.sh             # Linux 启动器；复制到课程根目录
├─ start-course.command        # macOS 启动器；复制到课程根目录
├─ .gitignore                  # 合并 templates/course.gitignore；保护学员原文与配置
├─ learner-submissions/        # 学员原始答案；本地生成，不入版本控制
├─ tutor_chat.py               # 默认配套：课内答疑服务模块
├─ credential_store.py         # 三端系统凭据接口；密钥存储在课程目录之外
├─ learner-chats/              # 可选：每课原始聊天 JSON；不入版本控制或发布
├─ .tutor-settings.json        # 可选：本地非密钥设置；不入发布包
├─ .teach-runtime/             # 可选：keyring 隔离环境；本机安装，不入发布包
├─ lessons/                    # 正式课与关联补充网页
│  ├─ 0001-*.html
│  ├─ 0001-s01-*.html          # 按需补充，不占正式课序号
│  └─ 0002-*.html              # 仅在上一课证据评估后生成
├─ reference/                  # 长期速查网页
├─ practice/
│  └─ entry-assessment.html   # 学习者入门评估；固定路径
├─ learning-records/           # 有证据的学习记录
├─ weekly-reviews/             # 周期复盘
├─ media/                      # 可选：本地视频、字幕与海报
└─ assets/
   ├─ style.css
   ├─ course.js
   ├─ sync.js
   ├─ tutor.js                # 默认提供：课内答疑组件，未配置不发请求
   ├─ tutor-settings.js       # 默认提供：独立设置页的模型配置组件
   ├─ tutor-markdown.js       # 默认提供：回答排版模块
   ├─ vendor/                # 固定本地排版依赖及许可证，完整复制
   └─ *.svg                    # 可选：原创图解
```

## 命名规则

- 工作区：简短、唯一、dash-case。
- 正式课：`lessons/NNNN-dash-case.html`；补充课：`lessons/NNNN-sSS-dash-case.html`。分类、稳定标识和旧课兼容见 [LESSON-DELIVERY-POLICY.md](./LESSON-DELIVERY-POLICY.md)。
- 学习记录：`learning-records/NNNN-dash-case.md`。
- 参考页：`reference/dash-case.html`，仅在内容稳定且可复用时创建。
- 长期资源中心：适用时用 `reference/resource-learning-center.html`；链接到当前课导学和阶段候选资源，未来阶段不提供未生成课链接。它与内部 `RESOURCES.md` 分工：前者给学员导学，后者保留核验与选择记录。
- 图片：使用语义化名称，不使用 `image1.png`。
- 视频、字幕和海报使用相同语义主名，放在 `media/`；只有实际使用时才创建该目录。

## 路径规则

- 学习者入门评估固定生成在 `practice/entry-assessment.html`，不可移到课程根目录。与内部教学状态文件 `ENTRY-ASSESSMENT.md` 区分；模板中的 `../assets/`、`../index.html` 和本地服务的 `practice/` 页面白名单均以此为前提。
- 所有链接使用相对路径，确保整个文件夹移动后仍能打开。
- `COURSE.md` 记录课程级视觉方向和选择理由；所有页面根元素使用同一 `data-visual-theme`，并与学员可自行切换的 `data-theme` 明暗模式分开。未选择时保留模板的 `studio` 默认值。
- `lessons/` 中引用资产通常使用 `../assets/style.css`。
- `index.html` 中引用资产通常使用 `./assets/style.css`。
- 不允许链接到父目录以外的课程文件。

## 状态一致性

新增课程后必须同步：

1. `index.html` 的课程卡片和进度。
2. `COURSE.md` 的当前正式课、关联补充页及最近有作答页面。
3. `ROADMAP.md` 的主线进度和补充状态，补充页不推进正式课计数。
4. 必要时更新 `RESOURCES.md` 和 `GLOSSARY.md`。
5. 只有获得理解证据时才新增学习记录。

## 逐课工作流

- 首次只创建第一课；路线图记录候选主题和能力门槛，不提前写完整后续课程。
- 学习者在入门评估及每道练习后原位作答，课末只填写疑难；可用本地服务时所有字段自动同步到 `learner-submissions/`，浏览器副本用于恢复。
- AI 在下次对话中读取上一正式课及相关补充页的已同步记录，处理疑难、判断证据；请求续课时生成一节新正式课并按需同轮交付补充页，不用补充替代主线。同步不可用时才需要学员导出或粘贴。
- 新课生成后才加入首页和课程导航。未生成的候选主题不应显示为可点击链接。
- 原始答案与 `learning-records/` 分开；后者只记录 AI 有依据判断后的能力证据。
