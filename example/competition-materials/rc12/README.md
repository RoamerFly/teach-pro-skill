# rc.12 参赛材料

作品：学途智伴——大学生长期自适应学习智能体。队伍：重邮FFBond。版本：Teach Pro 1.1.0-rc.12。

## 当前交付

- [新版 Demo](../../competition-demo-rc12/README.md)：三节正式课和一节关联补充课，八个页面。
- [Word 技能说明](./学途智伴技能说明文档.docx)：五页，包含作品简介、设计思路、使用说明、设置与答疑、验证结果，已渲染并逐页复核。
- [视频讲解脚本](./视频讲解脚本.md)：175 秒目标分镜，包含 DeepSeek 配置与两轮真实答疑的录制要求。
- [截图与浏览器检查](./capture-checks.json)：隔离副本采集，未调用模型；设置截图中的密钥为无效示例值。

旧版文档和视频保留于上一级目录。本轮没有新视频成片，不使用旧界面录像宣称 rc.12 已录制。下一步按新版脚本完成真实问答录屏、自然配音、字幕与成片检查，之后制作最终提交包。

## 重建

在仓库根目录运行，使用已准备好的 Python、python-docx、Node、Playwright、Sharp 和浏览器。材料工具依赖与学员运行依赖分开。

```powershell
node example/competition-materials/rc12/scripts/capture_and_check.cjs
node -e "require('sharp')('example/competition-materials/rc12/assets/architecture.svg',{density:180}).png().toFile('example/competition-materials/rc12/assets/architecture.png')"
python example/competition-materials/rc12/scripts/build_document.py
python example/competition-materials/rc12/scripts/audit_document.py
```

通过 `TEACH_PRO_PYTHON`、`TEACH_PRO_BROWSER` 和 `NODE_PATH` 指定已安装依赖。截图服务在隔离副本以 session-only 模式运行，不安装密钥依赖、不保存凭据、不发送模型请求；设备记忆的检查沿用专门凭据测试，不以截图状态替代。

Word 发布前必须渲染并逐页检查；本机采用既有 Word 只读导出适配器加文档渲染器和 Poppler，检查页图保留在仓库外。截图、架构图和公开 Demo 可复用；学员记录、模型设置及密钥不随材料提交。
