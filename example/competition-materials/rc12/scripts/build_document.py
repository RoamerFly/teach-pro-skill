"""Build the rc.15 competition description from the verified public showcase."""
from datetime import datetime, timezone
import json
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
    body(doc, '重邮FFBond  ·  校园生活赛道  ·  Teach Pro 1.1.0-rc.16  ·  2026年10月26日')
    heading(doc, '作品简介')
    body(doc, '大学生的系统学习常跨越数周乃至数月。课程、笔记、练习与 AI 对话分散在不同位置，学习中断后需要重新整理进度；遇到难点时，还需判断是继续新课还是补充基础。')
    body(doc, '学途智伴是一套自适应教学 Skill 技能包，把学习目标、课程与本地学习记录连接起来。先访谈和评估，再逐课生成网页教程；教学 AI 读取作答与疑难，调整下一课并按需提供独立补充课，让学生专注学习、作答和提问，减少反复说明背景与自行编排课程的负担。')
    picture(doc, 'course-home.png', '图 1  智鉴 Agent 课程首页', 'rc.12 课程首页显示学习入口、目标和正式课与补充课的展示进度')
    body(doc, '参赛案例为“智鉴 Agent：智能体开发与安全实战”。学习者从一次模型 API 调用入门，依次学习推理循环和安全工具契约，最终面向 AI 安全情报 Agent 项目。')

    heading(doc, '设计思路')
    heading(doc, '工作流程与系统架构', 2)
    picture(doc, 'teach-pro-workflow-architecture-v2-connected.png', '图 2  学习闭环与系统职责', '访谈、评估、逐课教学、作答、证据审阅与自适应续课；宿主教学 AI、浏览器、本地服务、可选 Tutor 与本地课程工作区分工')
    body(doc, '学员在宿主中调用 Skill，教学 AI 先访谈和评估，再生成一节课。学员在网页阅读、作答和提问；请求继续后，教学 AI 读取本地记录，决定下一课，并按需提供独立补充课。')
    body(doc, '教学 AI 负责教学决策与课程生成；课内 Tutor 结合整门已生成教材解释疑问，并标明当前提问课页；本地 Python 服务同步文件及问答请求。答案与聊天分别写入 learner-submissions 和 learner-chats，画像、路线与课程状态用 Markdown 保存，供新会话接续教学。')
    heading(doc, '依据学习证据续课', 2)
    body(doc, '教学 AI 读取作答和疑难，依据学生的识别、解释、应用和迁移表现调整目标、难度与练习支架。课内答疑补充理解线索，练习记录提供能力判断依据，让下一次教学接着上一次的实际表现推进。')
    heading(doc, '正式课和补充课分流', 2)
    body(doc, '正式课推进新目标，补充课巩固具体难点，两类课程独立记录。例如，安全工具契约正式课推进主线，关联补充课澄清“没有 Thought 就没有注入风险”的误解。')

    heading(doc, '使用说明')
    body(doc, '在支持 Skill 的教学平台导入 teach-pro 文件夹。明确学习主题后显式调用，让 AI 先评估基础；生成课程目录后，运行其中适合本机的课程启动器。')
    body(doc, '示例提示词：@teach-pro 我想系统学习 Agent 开发与安全，有基本 Python 和模型 API 使用经验，没有 Agent 项目；目标是独立开发安全的 AI 安全情报 Agent。每周约五小时，图解理解优先。先评估我的基础再开课。')
    for text in [
        '填写入门评估。基础、目标、偏好与时间自动保存到课程目录，教学 AI 读取后安排第一课。',
        '学习一节课。按图解和代码理解内容，在每道练习后直接作答并查看反馈；资源学习任务就地记录产出，课末只保留疑难。选看视频时先预测、暂停画图，再闭卷解释。',
        '继续下一课。在教学平台提出“读取本地学习记录，继续下一课”。AI 先处理疑难，再交付一节正式课，必要时配套补充课。',
    ]:
        body(doc, text, 'List Number')
    picture(doc, 'formal-supplement.png', '图 3  正式课与关联补充课分别展示', '首页分别列出三节正式课和第二课的独立补充页')
    body(doc, '课程启动器支持输入自动落盘；HTML 支持直接阅读和浏览器保存。Demo 提供完整展示课程，体验者的作答保存在自己的本地副本，后续可由教学 AI 读取并用于续课。')

    heading(doc, '课程设置与课内答疑')
    body(doc, '学习中遇到疑问，点击冻结栏左侧的“问 AI”。首次使用可从答疑窗口进入“连接答疑模型”，也可直接打开左侧置顶的“课程设置”。以 DeepSeek 为例，选取服务类型、输入 API Key、获取并选择模型，再保存并测试连接。连接全课程共用。')
    picture(doc, 'masked-key.png', '图 4  API Key 默认遮蔽  点击眼睛才显示', 'API Key 输入框处于 password 状态，图中使用无效演示值')
    body(doc, '默认记住此设备，启动器自动准备 keyring 运行依赖，系统凭据库存储密钥。API Key 输入默认遮蔽，眼睛按钮切换显示；模型连接全课程共用，切换课程后可直接继续答疑。')
    body(doc, '从答疑进入设置后，点击返回按钮即可回到原课。Tutor 默认结合整门已生成网页教材与本课最近对话回答，选文附带章节和所在段落；即使联系前课，也明确当前提问位置。正文与接口返回的思考分区流式显示。支持复制、修改问题、左右切换版本、重新生成与停止；聊天和图片／文本附件按课保存，供续课 AI 参考。')
    picture(doc, 'context-settings.png', '图 5  统一上下文设置', '整门已生成课程或仅当前课、参考答案、资源导学、本课对话轮数均可配置', width=6.9)
    body(doc, '上下文设置可选择整门教材或仅当前课，控制是否包含参考答案与资源导学，选择最近五轮、十轮或本课全部已完成对话。默认带入整门教材、参考答案和资源导学，保留最近五轮；保存后全课程共用。输入区可快捷选择本次模型与思考程度，上传、粘贴或拖入图片；教学 AI 管理路线与下一课。')

    heading(doc, '验证结果与参赛演示')
    body(doc, '通过可复现学习场景检验页面、作答保存、答疑与续课交付，配套记录支持逐项核对。')
    matrix(doc, ['验证对象', '已观察结果', '证据范围'], [
        ['页面与导航', '八页链接与锚点有效，三种视口无横向溢出', 'Windows 浏览器检查'],
        ['课程输入', '第三课答案落盘，新浏览器会话可恢复', '隔离副本合成输入'],
        ['下一轮交付', '新增正式第三课与第二课补充，记录独立', 'Codex 模拟与人工校核'],
        ['代码实战', '工具契约成功与拒绝路径通过，拒绝不执行', '课程离线样例'],
        ['资源导学', '两个中文视频提供精确链接和课内产出任务', '来源核对及交互检查'],
        ['课内模型连接', 'DeepSeek 模型获取、连接测试与两轮流式答疑成功', '已验收实录与接口记录'],
        ['答疑与教材上下文', '跨课定位、分支切换、附件重放与停止均可复核', '单测及隔离浏览器验证'],
        ['三端运行', '三端启动器及 keyring 凭据接口已提供', '启动器检查与 Windows 验收'],
    ], [1.42, 3.25, 2.23])
    heading(doc, '演示主线', 2)
    seconds = round(json.loads((ROOT / 'dialogue-video-audit.json').read_text(encoding='utf8'))['seconds'])
    body(doc, f'演示视频长 {seconds // 60} 分 {seconds % 60} 秒。从架构图和学习目标出发，展示评估、图解、代码与资源；遇到疑问后连接 DeepSeek，展示统一上下文设置，返回原课进行两轮真实答疑，再在题后作答、记录疑难并请求续课。正式课推进主线，补充课巩固难点。')
    heading(doc, '材料组织', 2)
    body(doc, '技能包包含教学规则、模板与运行资源，配套说明、架构图和视频。公开仓库保留版本与验证记录，课程目录保存个人学习进度。')
    hyperlink(doc, '项目仓库与验证记录', 'https://github.com/RoamerFly/teach-pro-skill')
    props = doc.core_properties
    props.title, props.author = '学途智伴技能说明', '重邮FFBond'
    props.subject = '作品简介 设计思路 使用说明'
    props.last_modified_by = '重邮FFBond'
    props.keywords = 'Teach Pro, 1.1.0-rc.16, 自适应教学, 整门教材上下文, 题后作答'
    props.comments = ''
    props.created = datetime(2026, 10, 5, tzinfo=timezone.utc)
    props.modified = datetime(2026, 10, 26, tzinfo=timezone.utc)
    doc.save(OUT)
    print(OUT)


if __name__ == '__main__':
    build()
