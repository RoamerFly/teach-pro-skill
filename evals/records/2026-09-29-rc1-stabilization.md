# 1.1.0-rc.1 稳定化记录

## 范围与结论

冻结 Teach Pro 的主体功能。本轮只修正 Test5 展示产物、建立三项行为关卡，并核对发布包权限。Test5 的人工修订不作为 Skill 自动生成能力的通过证据；第一课与动态续课仍待新生成复测。

## Test5 产物修订

产物目录：`E:\A_Myskill\teach-pro\TeleAgentTest5`，不在 Git 仓库内。修订前的 SHA-256：

| 文件 | 修订前 SHA-256 | 修订内容 |
| --- | --- | --- |
| `practice/entry-assessment.html` | `C4E4405214A05FF39E33F482DEEF0AE29407733A46C9D9D955880341F7F43F20` | 空白回答只记为无证据；环境变量反馈不再保证密钥不进命令历史；工具型 Agent 的题面加范围。 |
| `MISSION.md` | `5FFD5A7E9FC061BCA5BA617B1B77560A51A02C817F6CDF60BA30006D16CEF4C9` | 删除未经确认的工作项目背景。 |
| `index.html` | `F6BD8E6D70189A08D2E45E9B7320B5707AA6970FF3A2B3A42E3AC7B7E7C086CB` | 同步删除首页中的未确认背景。 |

浏览器复核：隔离 Edge 会话，实际 390px 视口，`scrollWidth=390`；四道选择题与六个保存键可用，修订后的反馈可见，静态文件模式准确提示仅保存在浏览器。本轮没有写入原课程学员提交，也没有生成第一课。`check_course.py` 对三页结构检查通过，但不判断教学语义。

## 源码与权限

源码中的 `teach-pro/assets/start-course.sh` 和 `teach-pro/assets/start-course.command` 均为 Git mode `100755`、LF 行尾。从 Git 树执行 `git archive --format=zip --prefix=teach-pro/ HEAD:teach-pro` 的测试 ZIP 中，两项 Unix mode 均为 `100755`。现存未跟踪的 `teach-pro.zip` 两项为 `100666`，不覆盖或提交；发布须使用 README 中的归档命令，并在产出后再次核对。

## 验证与未完成项

- `quick_validate.py`：通过。
- Node 测试：10/10 通过；Python 单元测试：12/12 通过。
- G1：结构与交互通过，原生生成文案有偏差，整体未通过；人工修订后页面可供学习，不改变此判定。
- G2/G3：未运行。没有课程作答或动态续课证据。
- 比赛 Demo、Word、视频和最终提交包：待行为关卡有可复核结果后据实更新；不沿用旧材料冒充候选版验证。
