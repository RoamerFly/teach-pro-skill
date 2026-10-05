# rc.12 参赛材料更新

日期：2026-10-05。主体基线：`c817dbde19df24a4fbd9a7607b358a081ee46990`，Teach Pro 1.1.0-rc.12。串行执行，无子智能体。本轮仅整理展示与参赛材料，Skill 主体与版本不变。

## 交付

- `example/competition-demo-rc12`：八页，三节正式课、一节第二课补充、评估、设置、阅读中心和首页。运行时复用当前 Skill；首页、导航和少量衔接文字人工整理。
- `example/competition-materials/rc12/学途智伴技能说明文档.docx`：五页、五张附有替代文字的图片、一张验证矩阵，包含简介、设计和使用流程。
- `example/competition-materials/rc12/视频讲解脚本.md`：175 秒目标分镜与连续旁白，包含真实 DeepSeek 配置和两轮问答的录制要求；不是已完成成片。
- 根 README 和材料索引指向新版，旧 Demo、文档与视频保留不覆盖。

## 浏览器与结构检查

`capture_and_check.cjs` 使用隔离副本，Windows 上的无头 Edge，课程服务为 session-only。提供商请求 0，外部浏览器请求 0。

- 八页相对链接和本页锚点有效，无页面脚本错误。
- 320、390、1280px 三种视口均无横向页面溢出。
- 初始页面无已作答选择题；密钥为 password，默认记住设备，DeepSeek 预设地址正确。
- 第三课合成答案通过真实本地提交端点保存，新的浏览器会话从文件恢复成功。只测试新副本，不改最终验收的原学员记录。
- 十二个主要运行文件与 Skill 字节一致；vendor 文件直接复制。补充页分类、关联编号与独立保存键通过检查。
- `check_course.py`：八页结构通过，评估 4 道选择题与 2 个开放输入，无结构问题和视觉警告；该工具不做教学语义判断。
- Node 单元与结构测试：29/29 通过。
- Python：运行 81 项，72 项通过，9 项原生 Windows keyring 检查因本轮文档工具 Python 没有可用原生后端而跳过；不记为设备存储实测通过。

新增 macOS/Linux 启动文件的 Git 模式均为 100755。暂存路径只含新版公开 Demo、材料、索引和测试，不含学员记录、聊天、配置或现有未跟踪的 teach-pro.zip。新增 HTML 的尾随空格已清理；diff whitespace 检查仅排除原样复制的 DOMPurify MPL 许可证，其原文件第 38 行已有一个行尾空格，许可证保持字节不变。

浏览器截图与哈希见 `example/competition-materials/rc12/capture-checks.json`。完整设备凭据能力沿用此前专门测试，不以本轮 session-only 截图替代。

## 文档渲染

使用本机加载的依赖包 Python、python-docx 和 Poppler。直接执行包内 `render_docx.py` 首次因无 bundled LibreOffice 失败；使用已有 Word 只读导出适配器替换 PDF 转换步骤，仍由包内渲染器生成 PNG，未使用桌面 LibreOffice、未修改托管工具文件。

第一轮发现默认标题边框、独立换页符产生空白页、最后段落溢出。第二轮删除标题样式边框，改用章节标题的 page-break-before，调整图片与表格内容。最终五页全部打开检查：无空白页、文字截断、表格错位或标题下装饰线；正文仍为 11pt，没有靠缩小字重排。

`audit_document.py` 检查通过：五节、五图、一表，黑色标题层级、图片替代文字、表格边框及重复表头、rc.12 元数据、无修订和密钥样式字符串。

最终 DOCX SHA256：`8f5e90cfdc671f773eec1336377c3735864db80dfdae7c446b84e980d667011d`。

QA 页图和 PDF 在仓库外 `competition-work/2026-10-05-materials-qa/docx-v2`，不作为参赛附件提交。

## 教学内容与来源

第一课与评估取自旧公开 Demo；第二课取自最终验收正式课，移除原学员答案和聊天缺口描述；第三课与第二课补充取自已记录的 Codex 合成大学生续课测试，人工校核后展示。没有新增 TeleAgent 运行或真实学生学习结果。

本轮重新访问 [ReAct 摘要](https://arxiv.org/abs/2210.03629)、[Toolformer v1 摘要](https://arxiv.org/abs/2302.04761v1)、[Python json 文档](https://docs.python.org/3.13/library/json.html)、[OWASP LLM01](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)。其他资源沿用之前的核验日期，不宣称本轮完整核验所有外链。

## 下一阶段

按脚本重录当前 Demo 的真实配置与两轮流式问答，制作自然连续旁白、字幕和 ≤180 秒成片，再检查与打最终提交包。旧视频仍是历史快照；本轮未上传或使用真实密钥，没有将静态课文、合成输入或历史回答冒充新的接口成功。
