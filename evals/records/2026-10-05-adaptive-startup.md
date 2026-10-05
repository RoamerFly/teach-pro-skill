# rc.11：普通启动自动准备密钥存储

日期：2026-10-05。依据学员“启动脚本自适应”的要求修正实现；rc.10 仅复用已有环境，缺依赖仍要求手动安装，因此是 Skill 配套实现缺口，不归因于 TeleAgent。

## 变更

- 三端启动器共用 Python 服务入口，自动检查固定版本 keyring 的存在与导入。缺少时创建课程 `.teach-runtime/`、安装、导入核验并继续启动，无需额外命令或第二次启动；就绪时不重复安装。
- pip 非交互安装限时 60 秒，连接超时 10 秒、重试一次，导入核验限时 10 秒。失败显示简短结果并继续打开课程；不将依赖失败说成密钥保存成功，下次启动可重新准备。
- 只改课程环境，不改全局 Python，不自动安装系统级 Python/桌面密钥环，不在网页请求中下载包。`--session-only` 可跳过准备，旧 `--install-keyring` 作为维护兼容入口保留，正常界面不再要求输入它。
- Skill 部署规范、启动资源、公开 Demo 与现有验收课程同步。现有课程五个启动组件先备份，课程正文、三份作答、一份聊天和非密钥配置共七个文件 SHA-256 不变。

## 验证

Windows/Python 3.13/Edge。首次启动测试使用全新合成课程与无 keyring 的 Python，**实际联网安装**课程隔离依赖，不使用真实 Key，不请求真实模型。结束仅移除本次临时环境/进程，保留 QA 记录。

| 项目 | 结果 |
| --- | --- |
| 普通启动浏览器测试 | 1/1；`start-course.cmd --no-browser` 自动创建环境、安装且仅准备一次，页面默认勾选可用；第二次启动无安装步骤；原 Python 的 prefix 与 keyring 安装版本均不变 |
| Windows 凭据浏览器回归 | 1/1；原生保存、多次实际重启恢复、断开保持、取消/确认删除、旧会话默认值及手机/深浅色，模型请求仅合成回环服务 |
| 会话答疑浏览器回归 | 1/1；显式跳过准备验证无依赖提示及会话模式，同时覆盖模型列表、测试、流式、多轮、Markdown、输入法、历史与重试 |
| 学员记录浏览器回归 | 1/1；读取延迟、网络中断、恢复、取消清空等原流程仍可用；sh/command 通过 Git Bash 语法检查，不作为 Unix 原生运行证明 |
| Python | 已安装环境 78/78；无 keyring 环境 69 通过、9 原生项跳过。新增默认准备、就绪不重装、参数保留、限时失败与离线跳过检查 |
| Node | 27/27，公开 Demo 共用运行组件等 |
| 结构/Skill | Demo 8 页、现有课程 5 页结构检查无问题及视觉提示；Skill validator、diff check 通过 |

QA 在仓库外 `competition-work/2026-10-05-auto-runtime-qa`、`competition-work/2026-10-05-auto-runtime-credentials-qa`、`competition-work/2026-10-05-auto-runtime-session-qa`。运行文件备份在 `competition-work/2026-10-05-auto-runtime-backup`；环境、密钥和学员数据不发布。

## 复测与边界

```text
python -B -m unittest discover -s tests -p "test_*.py"
node --test --test-concurrency=1 tests/runtime-bootstrap.browser.cjs
node --test --test-concurrency=1 tests/credentials.browser.cjs
node --test --test-concurrency=1 tests/tutor-experience.browser.cjs
```

首次准备测试使用 `BOOTSTRAP_PYTHON` 选择未装 keyring 的 Python，需要网络与 Windows。凭据回归通过 `TEACH_PYTHON` 选择已安装环境；其他 UI 夹具使用 `--session-only`，不因界面回归反复下载依赖。

macOS/Linux 共用实现但尚未原生实机验证；Linux 的系统密钥环/D-Bus 仍是平台条件。未重跑 TeleAgent 原生课程生成，也未重制 Word/视频，不据本轮运行测试宣称教学内容或比赛全部验收通过。
