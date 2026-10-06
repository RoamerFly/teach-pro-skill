# 最终参赛包交付检查

日期：2026-10-06。Skill 版本：1.1.0-rc.12。打包源码提交：`456c248b9e69e0d759596c26164670f34136d662`。本记录追加到后续提交，不回写或重新生成已验收的 ZIP。用户已认可当前师生演示，未代用户提交赛事官网。

## 交付

最终包：`重邮FFBond+学途智伴——大学生长期自适应学习智能体.zip`，16,181,455 字节，93 个文件。

SHA-256：`9e1e4553755313cfe6f5b68bb4fbc790929e1b682e5ecfbce43639679ff6ca35`。

独立 Skill 包：`teach-pro-1.1.0-rc.12.zip`，177,018 字节。

SHA-256：`b87a240c45d9c4cce8ac540b1d214505d935dfde8c57017e89044151ec857cfe`。

输出目录：仓库外 `competition-submission/2026-10-06-rc12`。旧交付 ZIP 未覆盖。自动生成的校验结果见同目录 `package-audit.json`，公开副本为本目录 `2026-10-06-submission-package-audit.json`。

## 检查结果

- ZIP CRC 与 92 个清单内文件的 SHA-256 均通过，另包含文件清单自身。
- Skill 与 Demo 的 start-course.sh、start-course.command 四个条目的 Unix 权限均为 755；独立 Skill 包也保留 755。
- 白名单包含完整 Skill 指令与资源、五页 Word、168.461333 秒师生视频、75 条字幕、讲解脚本、干净八页 Demo 及一份真实请求记录。
- 白名单与扫描排除原学员答案、聊天、模型配置、密钥、.teach-runtime、缓存和旧配音样本；第三方依赖许可证保留。
- PowerShell 解压到仓库外新目录后，使用包内 check_course.py 检查包内课程，八页通过。
- 执行包内 tool-contract.py：合法工具执行成功；权限不足、预算不足、参数类型错误分别返回 permission、budget、arguments 拒绝。
- 对解压后课程以 --session-only --no-browser 启动，首页、设置、评估、第一课四个路由 HTTP 200。读取第一课上下文成功，未配置模型时历史为空。
- 在该隔离副本 POST 一条合成入门回答，learner-submissions JSON 实际保存；停止本次测试启动的进程，重新启动并 GET 恢复，字段一致。
- 两次启动中模型均未配置，没有生成 learner-chats、模型配置文件或凭据。本轮未发送外部提供商请求；没有改动原学员目录。
- 解压运行后重新计算原 ZIP 哈希，与初次交付值一致；合成输入只存在于解压验收副本，未重新打进参赛包。
- 最终 Python 118 项：109 通过、9 项原生凭据环境相关跳过；打包守卫 6 项全通过。Node 29 项全通过。

Word 已使用官方文档渲染器、Word 只读导出适配器和打包 Poppler 渲染，五页逐页完整分辨率复核。视频为此前真实录制的已认可定稿，本轮独立确认格式与时长，未再合成配音或请求模型。Windows 解压运行通过；不将 ZIP 权限检查冒充 macOS/Linux 原生运行验收。

## 重建

在仓库根目录使用 Python 运行：

```powershell
python example/competition-materials/rc12/scripts/package_submission.py <新的仓库外输出目录> --ref 456c248b9e69e0d759596c26164670f34136d662
```

用 package-audit.json 核对源码提交、大小与 SHA-256。脚本拒绝覆盖已存在输出目录；不需要模型或配音凭据。压缩包不放入 Git，材料源文件、构建工具和交付校验值通过普通提交保留。
