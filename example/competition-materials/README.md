# 学途智伴参赛材料

队伍：重邮FFBond。作品：学途智伴——大学生长期自适应学习智能体。校园生活赛道，Skill 基线为 Teach Pro 1.1.0-rc.3。

## 当前交付

[技能说明文档](./学途智伴技能说明文档.docx) 共六页，涵盖作品简介、设计思路、技术实现、使用说明、DeepSeek 设置与验证结果。采用[已校核的智鉴 Agent Demo](../competition-demo-zhi-jian-agent/README.md)，含一张架构图和三张重新采集的操作截图。

材料使用已观察的合成测试结果；展示课经人工校核。设置截图只输入无效演示值，未获取模型或发起连接请求。真实模型成功、三端启动与长期学习效果不计入本轮结果。

当前完成 Demo 和 Word；新视频及最终提交压缩包尚未制作。本目录不覆盖仓库外 competition-work 中的旧材料。[Word 验收记录](../../evals/records/2026-10-01-competition-document-review.md)列出版本、文件指纹和检查结果。

## 重建与检查

使用已有的 Python 环境及 python-docx。截图采集另需 Node、Playwright、Sharp 和本机 Edge/Chromium；这些是材料维护工具，不是课程运行依赖。Codex 工作区使用随附依赖，避免另装包。

```powershell
node example/competition-materials/scripts/capture_materials.cjs
python example/competition-materials/scripts/build_document.py
python example/competition-materials/scripts/audit_document.py
```

截图脚本在临时副本运行课程，不修改公开 Demo 作答；可用 TEACH_PRO_BROWSER 和 TEACH_PRO_PYTHON 指定浏览器与解释器，随附 Node 包通过 NODE_PATH 解析。生成器以 assets 中的架构图和截图为输入，输出同一份 Word。

Word 发布前必须渲染并逐页检查。Windows 无随附 LibreOffice 时，可用本机 Microsoft Word 的只读导出，再交由文档技能的 render_docx.py 和随附 Poppler 生成页图：

```powershell
python example/competition-materials/scripts/render_with_word.py `
  example/competition-materials/学途智伴技能说明文档.docx <仓库外检查目录> `
  --renderer <文档技能的render_docx.py绝对路径> --poppler <随附Poppler目录>
```

这条路径只打开待验收文档，不调用桌面 LibreOffice。PDF、页图与临时浏览器缓存只用于检查，不加入提交包。重新生成后应复核文件指纹，更新验收记录，再提交推送。
