# 工作流程架构图加入参赛包

日期：2026-10-10。用户要求将已生成、人工核对的架构图加入参赛包。

## 范围

- 来源为已提交图像 `example/competition-materials/rc12/assets/teach-pro-workflow-architecture-v1.png`，PNG / RGB，1672 × 941。
- 完整 ZIP 的目标为 `参赛材料/学途智伴工作流程架构图.png`，并在包内 README 展示图像与简短导读。
- 使用固定文件白名单，只包含成品 PNG，不附带生成提示词、初稿或资产目录中的其他文件。架构图自动进入逐文件清单与发布审计。
- 打包继续读取指定 Git 提交，不读取工作区密钥、学员数据或运行缓存；旧提交没有该图时仍可构建。
- 不修改 Skill、课程页面、Word、视频或教学规则；版本仍为 1.1.0-rc.12。日常版不需要因参赛材料添加图像重发。
- 保留更新前完整赛事目录与复审文件。此图属于系统职责说明，不是新的模型行为或学习效果证据。

## 验证与发布

全量 Python 回归复测：136 项，127 通过，9 项原生凭据环境测试跳过。首次运行原有断流保存测试在两秒轮询内未等到模型回答，出现一次时序失败；独立复测该模块 15/15 通过，再次运行全量通过。未为此改动冻结 Runtime 或放宽测试断言。新白名单测试验证成品图的目标路径，并拒绝提示词及未列出的图片。

## 实际发布验收

源码提交 `b46cfb5314a5a00efcd6463fa665a1c8ce8568bd` 已推送 origin/main；从该提交生成完整包和解压目录，发布到仓库外 `competition-submission/competition_submit`。

- 完整包 212 项、文件清单 211 项。CRC、所有清单 SHA 与解压逐文件 SHA 一致；`.sh` / `.command` 保持 0755。
- 与上一包对照：仅新增 `参赛材料/学途智伴工作流程架构图.png`；原有文件只修改 README 与文件清单，其他全部逐字节一致，包括 Word、视频、字幕、智鉴 Demo 与统计学三分支。没有删除文件。
- 包内 PNG 与已核对原图相同：1672 × 941，1765747 字节，SHA-256 `b3bc1b3d0911b4752f56ce4b4d92f9f6ceee448305ddeb5941a3c70dff8ac5a7`；PNG 完整性和 README 图片路径检查通过。
- 独立 Skill ZIP 的全部 60 个文件与上一赛事版逐字节一致；ZIP SHA 改变仅涉及 Git 快照元数据，没有更改 Skill 内容。日常版目录未动。
- 用更新后的打包器重建历史 `2af3d9e` 提交：没有图像仍能构建，完整 ZIP SHA 与历史包 `5c6bd689eb906deedc56369f4e314be8a5d11b75a11fbe91b1dc24e792b9c231` 完全一致。
- 原赛事目录完整保留于 `competition-submission/history/2026-10-10-before-architecture-image/competition_submit`；完整案例增强复审报告与评分 JSON 原件保留在该目录，并以相同字节复制回当前目录。报告是原复审结果，本轮没有重新评分。

| 发布文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| 重邮FFBond+学途智伴——大学生长期自适应学习智能体.zip | 18189116 | 1f940ceecc18747d609ba0cbefdba97fe33cf17df592251437cc3167edd6bc7f |
| teach-pro-1.1.0-rc.12.zip | 211387 | c067f5de0394636cd073db164abbdf57b456e01a9ea14ec4bffc2b4d90e6d3fa |

完整发布审计见同目录 `2026-10-10-architecture-package-audit.json`。
