"""Rebuild the rc.12 competition description from the verified public showcase."""
from datetime import datetime, timezone
from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '学途智伴技能说明文档.docx'


def body(doc, text, style=None):
    return doc.add_paragraph(text, style)


def heading(doc, text, level=1):
    p = doc.add_heading(text, level)
    if level == 1 and text != '作品简介':
        p.paragraph_format.page_break_before = True
    return p


def picture(doc, file, caption, alt, width=6.9):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.keep_with_next = True
    shape = p.add_run().add_picture(str(ROOT / 'assets' / file), width=Inches(width))
    shape._inline.docPr.set('descr', alt)
    p = body(doc, caption)
    p.paragraph_format.space_after = Pt(9)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in p.runs:
        run.font.size = Pt(10)
        run.font.color.rgb = RGBColor.from_string('43536A')


def matrix(doc, headers, records, widths):
    table = doc.add_table(rows=1, cols=len(headers))
    table.autofit = False
    for col, width in zip(table.columns, widths):
        col.width = Inches(width)
    table.rows[0]._tr.get_or_add_trPr().append(OxmlElement('w:tblHeader'))
    for cells, values in [(table.rows[0].cells, headers)] + [(table.add_row().cells, row) for row in records]:
        for cell, text, width in zip(cells, values, widths):
            cell.width = Inches(width)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            p = cell.paragraphs[0]
            p.text = text
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.18
            for run in p.runs:
                run.font.size = Pt(10.5)
            props = cell._tc.get_or_add_tcPr()
            borders = OxmlElement('w:tcBorders')
            for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
                element = OxmlElement('w:' + edge)
                for name, value in [('val', 'single'), ('sz', '4'), ('color', 'D9D9D9')]:
                    element.set(qn('w:' + name), value)
                borders.append(element)
            props.append(borders)
            margins = OxmlElement('w:tcMar')
            for edge in ('top', 'left', 'bottom', 'right'):
                element = OxmlElement('w:' + edge)
                element.set(qn('w:w'), '100')
                element.set(qn('w:type'), 'dxa')
                margins.append(element)
            props.append(margins)
    for i, row in enumerate(table.rows):
        for cell in row.cells:
            shade = OxmlElement('w:shd')
            shade.set(qn('w:fill'), '253F5B' if i == 0 else ('F0F4F8' if i % 2 == 0 else 'FFFFFF'))
            cell._tc.get_or_add_tcPr().append(shade)
            if i == 0:
                for run in cell.paragraphs[0].runs:
                    run.font.bold = True
                    run.font.color.rgb = RGBColor(255, 255, 255)
    body(doc, '')


def hyperlink(doc, text, url):
    p = doc.add_paragraph()
    rel = doc.part.relate_to(url, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink', is_external=True)
    link = OxmlElement('w:hyperlink')
    link.set(qn('r:id'), rel)
    run = OxmlElement('w:r')
    props = OxmlElement('w:rPr')
    color = OxmlElement('w:color')
    color.set(qn('w:val'), '2456A6')
    props.append(color)
    run.append(props)
    content = OxmlElement('w:t')
    content.text = text
    run.append(content)
    link.append(run)
    p._p.append(link)


def build():
    doc = Document()
    section = doc.sections[0]
    section.page_width, section.page_height = Inches(8.5), Inches(11)
    section.left_margin = section.right_margin = Inches(.8)
    section.top_margin = section.bottom_margin = Inches(.7)
    for name, size in [('Normal', 11), ('Title', 22), ('Subtitle', 11), ('Heading 1', 17), ('Heading 2', 12)]:
        style = doc.styles[name]
        style.font.name = 'Microsoft YaHei'
        style.font.size = Pt(size)
        style.font.color.rgb = RGBColor(0, 0, 0)
        style.font.italic = False
        for border in style._element.findall('.//' + qn('w:pBdr')):
            border.getparent().remove(border)
        fonts = style._element.get_or_add_rPr().get_or_add_rFonts()
        for attr in ('ascii', 'hAnsi', 'eastAsia', 'cs'):
            fonts.set(qn('w:' + attr), 'Microsoft YaHei')
        for attr in ('asciiTheme', 'hAnsiTheme', 'eastAsiaTheme', 'cstheme'):
            fonts.attrib.pop(qn('w:' + attr), None)
        style.paragraph_format.space_after = Pt(7)
        style.paragraph_format.line_spacing = 1.2
    doc.styles['Heading 1'].paragraph_format.space_before = Pt(4)
    doc.styles['Heading 2'].paragraph_format.space_before = Pt(9)
    doc.styles['Normal'].paragraph_format.widow_control = True
    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    footer.add_run('学途智伴  |  ')
    field = OxmlElement('w:fldSimple')
    field.set(qn('w:instr'), 'PAGE')
    footer._p.append(field)
    for run in footer.runs:
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(0, 0, 0)

    body(doc, '学途智伴技能说明', 'Title')
    body(doc, '学途智伴——大学生长期自适应学习智能体', 'Subtitle')
    body(doc, '重邮FFBond  ·  校园生活赛道  ·  Teach Pro 1.1.0-rc.12  ·  2026年10月5日')
    heading(doc, '作品简介')
    body(doc, '学途智伴是一套面向大学生自主学习的 Skill。它先了解基础、目标和时间安排，再逐课生成可阅读、可作答的网页教程；依据保存的练习答案和疑难，调整下一节正式课，并按需配套独立补充课。')
    body(doc, '大学生长期学习常遇到路线过大、遇到难点无人解释、新会话丢失进度的问题。本作品把评估、讲解、练习和续课连接在同一个本地课程目录中，让教学 AI 能接着上一次的学习记录继续教。')
    picture(doc, 'course-home.png', '图 1  智鉴 Agent 课程首页', 'rc.12 课程首页显示学习入口、目标和正式课与补充课的展示进度')
    body(doc, '参赛案例为“智鉴 Agent：智能体开发与安全实战”。学习者从一次模型 API 调用入门，依次学习推理循环和安全工具契约，最终面向 AI 安全情报 Agent 项目。')

    heading(doc, '设计思路')
    body(doc, '系统把教学决策、学习工作区和可选答疑分开。Skill 约束教学 AI 的工作流程；网页负责呈现和输入；本地服务保存记录，并代网页连接答疑模型。')
    picture(doc, 'architecture.png', '图 2  教学协议与本地学习记录的关系', '教学 AI 读取本地工作区决定下一轮课程，可选 Tutor 将课内对话保存到同一工作区')
    heading(doc, '依据学习证据续课', 2)
    body(doc, '下一课不是按序号自动翻页。教学 AI 先读取当前作答和疑难，区分识别正确、能解释、能应用和能迁移的证据。课内答疑可补充理解线索，但不能把 AI 给出的答案直接记为学生已经掌握。')
    heading(doc, '正式课和补充课分流', 2)
    body(doc, '正式课推进新目标，补充课处理上节课的具体问题。针对“没有 Thought 就没有注入风险”的误解，下一轮配套安全工具契约正式课与补充页。两类课程独立记录，不必先完成补充才能进入正式课。')
    heading(doc, '理解优先的课程内容', 2)
    body(doc, '图解先建立关系，再用代码和练习验证理解。论文、文档与视频按目标选取，标明定位、预算和产出；视频只用链接，选读折叠。各页风格一致，支持冻结工具栏和折叠导航。')
    heading(doc, '跨会话的文件连续性', 2)
    body(doc, '评估和答案写入 learner-submissions，对话按课写入 learner-chats；课程状态、画像和路线使用 Markdown 文件。教学 AI 在新的会话中读取这些文件即可接续，不要求学生重新复述完整学习过程。')

    heading(doc, '使用说明')
    body(doc, '在支持 Skill 的教学平台导入 teach-pro 文件夹。明确学习主题后显式调用，让 AI 先评估基础；生成课程目录后，运行其中适合本机的课程启动器。')
    body(doc, '示例提示词：@teach-pro 我想系统学习 Agent 开发与安全，有基本 Python 和模型 API 使用经验，没有 Agent 项目；目标是独立开发安全的 AI 安全情报 Agent。每周约五小时，图解理解优先。先评估我的基础再开课。')
    for text in [
        '填写入门评估。基础、目标、偏好与时间自动保存到课程目录，教学 AI 读取后安排第一课。',
        '学习一节课。按图解和代码理解内容，完成练习并查看反馈；选看视频时，先预测、暂停画图，再闭卷解释，把产出和疑难写在页尾。',
        '继续下一课。在教学平台提出“读取本地学习记录，继续下一课”。AI 先处理疑难，再交付一节正式课，必要时配套补充课。',
    ]:
        body(doc, text, 'List Number')
    picture(doc, 'formal-supplement.png', '图 3  正式课与关联补充课分别展示', '首页分别列出三节正式课和第二课的独立补充页')
    body(doc, '从启动器打开时，输入自动落盘；直接打开 HTML 可以阅读，答案只保存在浏览器。公开 Demo 已整理好展示课程，体验者的新作答由自己的本地副本保存。')

    heading(doc, '课程设置与课内答疑')
    body(doc, 'AI 设置统一位于左侧导航顶部，连接全课程共用。以 DeepSeek 为例，选取服务类型会自动填充基础地址；输入 API Key 后，点击“获取模型”，从返回的列表选择模型，再保存并测试连接。具体模型以实际接口返回为准。')
    picture(doc, 'masked-key.png', '图 4  API Key 默认遮蔽  点击眼睛才显示', 'API Key 输入框处于 password 状态，图中使用无效演示值')
    body(doc, '默认记住此设备，启动器准备 keyring 运行依赖，由系统凭据库存储密钥。页面配置文件不保存明文 Key；断开连接与删除已保存密钥分别处理。录制演示时不点击显示密钥。')
    body(doc, '返回课程后，冻结栏左侧的“问 AI”打开居中大弹窗。Tutor 结合本课正文与最近对话回答，支持多轮交流、流式显示和 Markdown 排版；输入与发送位于同一行。聊天按课保存，续课教学 AI 可以读取。')
    picture(doc, 'tutor-dialog.png', '图 5  课内答疑入口与紧凑输入区', '新版答疑弹窗的未连接状态，本图不包含模型生成回答', width=5.8)
    body(doc, '课内 Tutor 解释当前课，生成课程的教学 AI 管理路线与下一课。这两个入口职责不同；不连接 Tutor 也能完成阅读、练习与本地作答。')

    heading(doc, '验证结果与参赛演示')
    body(doc, '验证保留原始失败和人工修订记录。当前 Demo 使用合成学习场景，课程内容经人工校核；它用于展示教学流程，不将合成作答记为真实学生成绩。')
    matrix(doc, ['验证对象', '已观察结果', '证据范围'], [
        ['页面与导航', '八页链接与锚点有效，三种视口无横向溢出', 'Windows 浏览器检查'],
        ['课程输入', '第三课答案落盘，新浏览器会话可恢复', '隔离副本合成输入'],
        ['下一轮交付', '新增正式第三课与第二课补充，记录独立', 'Codex 模拟与人工校核'],
        ['代码实战', '工具契约成功与拒绝路径通过，拒绝不执行', '课程离线样例'],
        ['资源导学', '两个中文视频提供精确链接和课内产出任务', '来源核对及交互检查'],
        ['课内模型连接', '历史模型获取、测试与多轮真实回答成功', '历史证据；新版需重录'],
        ['三端运行', '三端启动器及 keyring 凭据接口已提供', '实机验收限 Windows'],
    ], [1.42, 3.25, 2.23])
    heading(doc, '演示主线', 2)
    body(doc, '三分钟内依次展示评估、图解与资源导学、DeepSeek 设置和真实课内答疑，再展示答案保存与正式课和补充课的分流结果。配置和问答使用真实接口；已整理课程明确作为回放，不把静态展示剪成实时生成。')
    heading(doc, '材料组织', 2)
    body(doc, '技能包包含 SKILL.md、教学参考、模板与运行资源，配套说明文档和演示视频。公开仓库保留版本和验证记录，学员答案、聊天及模型凭据不随包发布。')
    hyperlink(doc, '项目仓库与技能入口', 'https://github.com/RoamerFly/teach-pro-skill')
    hyperlink(doc, '合成大学生续课验证记录', 'https://github.com/RoamerFly/teach-pro-skill/blob/main/evals/records/2026-10-05-simulated-college-learning.md')
    props = doc.core_properties
    props.title, props.author = '学途智伴技能说明', '重邮FFBond'
    props.subject = '作品简介 设计思路 使用说明'
    props.last_modified_by = '重邮FFBond'
    props.keywords = 'Teach Pro, 1.1.0-rc.12, 自适应教学, 正式课与补充课'
    props.comments = ''
    props.created = props.modified = datetime(2026, 10, 5, tzinfo=timezone.utc)
    doc.save(OUT)
    print(OUT)


if __name__ == '__main__':
    build()
