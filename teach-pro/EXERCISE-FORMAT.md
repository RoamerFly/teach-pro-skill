# Exercise Format

## 选择练习类型

根据目标选择，不要求每种都出现：

- 主动回忆
- 概念辨析
- 预测
- 找错与修复
- 半完成示例
- 独立应用
- 变式迁移
- 真实任务
- 作品改进
- 口语或动作实践

## HTML 结构建议

```html
<section class="exercise-card" data-difficulty="medium" data-exercise="open">
  <header>
    <span class="eyebrow">练习 2 · 迁移</span>
    <h3>题目标题</h3>
  </header>
  <p>题目正文……</p>
  <label for="lesson-0001-exercise-02">你的回答</label>
  <textarea id="lesson-0001-exercise-02" data-save-key="lesson-0001-exercise-02" rows="3" placeholder="写下推理、计算过程或作品说明。"></textarea>
  <details>
    <summary>查看提示</summary>
    <p>只提供下一步线索，不直接泄露答案。</p>
  </details>
  <details class="answer">
    <summary>查看答案与解析</summary>
    <p>答案……</p>
    <p><strong>为什么：</strong>……</p>
    <p><strong>常见错误：</strong>……</p>
  </details>
</section>
```

## 设计要求

- 每题明确要检测的能力。
- 每道开放题、即时练习或需提交的资源任务，在题干后直接提供带标签的回答框，位于提示和折叠解析之前；选择题在题下直接选择。多题分别保存，不要求回到页尾汇总或重复填写。开放练习容器标记 `data-exercise="open"`；示例中的编号按课程与题号替换为唯一值。
- 课末 `#learning-input` 只保留“本课疑难记录”和本页保存工具。所有题后字段继续使用 `data-save-key` 自动保存与同步；调整旧页面时只移动字段，保留原 `id` 和保存键，不丢弃已有答案或更改其题目含义。
- 难度来自知识本身，不来自含糊题意。
- 选择题错误选项必须代表真实可能的误区。
- 同题所有选项必须按可见长度、句式完整度与信息密度校准为等长/等价，防止通过格式泄露答案。语言自然且不损害干扰项质量时，进一步保持相同词数，并尽量缩小字符数差异；不得为了机械凑字数制造别扭表达或新的提示模式。
- 开放题提供检查清单或评分量规。
- 练习应逐步撤除支架。
- 迁移题至少改变一个关键条件。
- 现实任务给出完成标准和反馈入口。

## 反馈要求

反馈必须包含：

- 正确答案或合格标准。
- 正确的原因和关键步骤。
- 错误选择对应的误区。
- 下一次如何避免。
- 必要时提供一题新的补救检查。
