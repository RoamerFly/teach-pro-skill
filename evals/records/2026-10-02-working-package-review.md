# rc.4 参赛工作包验收

来源提交：`ea595f7ec8d9733bc3b08ecb7009818bce7ecb59`，已推送 origin/main。输出在仓库外 `competition-work/2026-10-02-delivery`，不覆盖已有 `skill/teach-pro.zip`。

打包命令：

```powershell
python -X utf8 example/competition-materials/scripts/package_working_release.py ../competition-work/2026-10-02-delivery --ref ea595f7
```

| 产物 | 字节 | SHA256 |
| --- | ---: | --- |
| teach-pro-1.1.0-rc.4.zip | 155466 | 26535FE9C507992E100FE43264CE355FCC832B0B91302F87BF78A938E6B26FAD |
| 重邮FFBond+学途智伴——大学生长期自适应学习智能体.zip | 5883833 | 26DAD2C7AEF1B4149B1207F24765D921929B9A53C15350C6F1E3D65B0181C8B5 |

技能包包含 teach-pro 的已提交内容、配套资源及本地 Markdown 依赖许可。参赛工作包包含该技能 ZIP、七页 Word、新版无配音画面及字幕、章节诊断、八页公开 Demo 和提交前说明。

检查通过：两包 CRC 完整性；内层 Skill 的 assets/start-course.sh 与 assets/start-course.command 模式 755；外层课程 Demo 的两启动器同为 755。仅读取 Git 树，未读取原生学员目录、本地配置或未跟踪 ZIP。排除 learner-submissions、learner-chats、.tutor-settings.json、__pycache__，文本密钥扫描无命中。文档与视频指纹同 [材料验收](2026-10-02-tutor-materials-review.md)。

工作包状态明确为 review-only / voice pending；不包含旧界面的配音视频，不作为最终比赛提交包。阶段 5 样音及最终音画合成未执行。没有向比赛官网提交或上传。
