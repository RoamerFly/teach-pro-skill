# rc.9：统一 keyring 与设备凭据恢复

日期：2026-10-04。串行执行；本轮不请求真实模型，不使用真实密钥。

## 范围

- `credential_store.py` 使用同一套 keyring set/get/delete 接口，替代未发布的三个底层适配器。仅接收 keyring 内置本机系统凭据后端，链式选择也不回退到明文文件、远端服务或空后端。
- 设置页增加紧凑的“记住此设备”。启动恢复仅读取本机凭据，不请求模型，不把 Key 回填网页或写入课程配置。课程绝对路径与服务目的地绑定。
- 普通断开保留凭据，重启仍保持暂停；原配置留空保存可重新启用。删除凭据须确认，取消不改变文件。
- 可选安装命令 `--install-keyring` 将 `keyring==25.7.0` 安装到课程 `.teach-runtime/`，三端启动器优先复用；不改全局 Python。无依赖仍可使用会话模式。
- 模板、部署清单、公开 Demo、忽略规则与检查器同步。教学主体不扩展，Word/视频未重制。

## 验证结果

本机 Windows、Python 3.13、Edge/Playwright。系统凭据测试使用唯一合成课程及合成 Key，结束后删除对应测试凭据；不清理其他凭据。

| 检查 | 结果及边界 |
| --- | --- |
| Python 单元/集成 | 安装 keyring 的隔离环境 70/70；无 keyring 环境 62 通过、8 原生凭据测试跳过，证明核心服务与会话模式不依赖安装 |
| Node 测试 | 27/27；公开 Demo 与共享组件一致性、模板约束及已有回归 |
| 原生凭据浏览器测试 | 1/1；真实 Windows WinVaultKeyring、3 次实际进程重启、留空恢复、断开持久暂停、取消/确认删除、浅深色与手机；合成本机提供商仅收到 1 次主动答疑请求 |
| 答疑体验浏览器回归 | 1/1；模拟服务覆盖模型获取、遮蔽、状态颜色、真实 SSE 分片、多轮历史、重试、Markdown、输入法、关闭中接收及手机紧凑输入区 |
| 实际 Windows 启动器 | 当前验收课程的 `.cmd --no-browser` 启动成功，bootstrap 返回 WinVaultKeyring 可用；仅读状态，不发送模型请求，结束后仅停止本次创建的进程树 |
| 结构检查 | 公开 Demo 8 页、现有验收课程 5 页均通过且无视觉提示；不代表内容语义或学习效果通过 |
| Skill / Git | Skill validator 与 diff check 通过；sh/command 保持 Git 100755 |

macOS Keychain、Linux Secret Service/KWallet 的公共调用契约、后端筛选及异常处理由模拟测试覆盖；**尚未在 macOS/Linux 原生系统验证**。Linux 需要可用且解锁的桌面密钥环与对应 D-Bus 支持。

当前验收课程已同步运行组件并安装课程隔离依赖；两课正文、三份作答、一份聊天与既有配置共 7 个文件的 SHA-256 均保持不变。原有进程内存 Key 无法从文件迁移，学员需在新版服务首次输入并保存一次。运行环境、配置、作答、聊天和截图不发布到 Git。

## 复测

在仓库根目录运行，Python 原生凭据项使用已安装固定版本 keyring 的环境；浏览器项需要测试用 Node/Playwright/Edge，不增加学员运行依赖。

```text
python -B -m unittest discover -s tests -p "test_*.py"
node --test --test-concurrency=1 tests/*.test.cjs
node --test --test-concurrency=1 tests/credentials.browser.cjs
node --test --test-concurrency=1 tests/tutor-experience.browser.cjs
python -B teach-pro/scripts/check_course.py example/competition-demo-zhi-jian-agent --json
```

浏览器脚本通过 `TEACH_PYTHON` 选择测试环境，`TUTOR_QA_DIR` 指向仓库外输出目录。本次截图与结果在 `competition-work/2026-10-04-keyring-qa`、`competition-work/2026-10-04-keyring-ui-regression`；原生测试结果记录后端身份和计数，不记录密钥。

## 未完成项

本轮没有重新执行 TeleAgent 原生生成，也没有替代第二课内容修订、真实学员续课或最终比赛材料验收。重新制作说明文档与视频时，应演示首次保存、关闭服务、重启免输 Key；输入仍保持遮蔽。
