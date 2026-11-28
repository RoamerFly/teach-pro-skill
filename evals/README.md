# 验证与教学行为案例

## 运行与发布检查

在仓库根目录运行：

```sh
python -X utf8 -B -m unittest discover -s tests -p "test_*.py"
python -X utf8 -B teach-pro/scripts/test_response_limits.py
node --test tests/course-demo-integrity.test.cjs
```

检查覆盖课程结构、题后输入、启动器、作答同步、上下文、流式对话、分支与附件、凭据适配、双版本打包、校验值和引用完整性。跨平台检查由 `.github/workflows/release.yml` 执行。

## 教学行为检查

使用独立课程目录和模拟学员，按 [三项教学关卡](./teaching-gates.md) 验证访谈、第一课和动态续课。[概念条件复核标准](./concept-boundary-rubric.md)用于核对解释、图注、例题与练习的一致性。

- [TeleAgent 高等数学运行记录](./records/2026-11-27-teleagent-live.json)：自然学习请求、访谈、网页作答、补充课与新正式课。
- [Python 3.10 兼容性记录](./records/2026-11-28-python310-compatibility.json)：运行、启动、凭据存储和重启恢复。
- [统计学自适应案例](../teach-pro/references/examples/statistics-adaptive/README.md)：同一首课、不同模拟作答与后续教学安排，可本地构建。

以上运行记录保留产生时的版本与测试条件。模拟学员的运行验证与真实学员的长期学习效果分别记录。

浏览器脚本位于 `tests/*.browser.cjs`，按需使用已有 Playwright 与浏览器；通过 `TEACH_PRO_PYTHON` 和 `TEACH_PRO_BROWSER` 指定本地运行环境。测试使用独立临时副本，原始学习记录留在课程工作区。
