"""Write the complete 12-slide rehearsal script from the same source as slide notes."""
import json
from pathlib import Path
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT=Path(__file__).resolve().parent


def clock(seconds):
    return f'{seconds//60:02d}:{seconds%60:02d}'


def build():
    data=json.loads((ROOT/'路演内容.json').read_text(encoding='utf-8'))
    assert len(data['slides'])==12 and sum(s['seconds'] for s in data['slides'])==data['content_seconds']
    doc=Document()
    section=doc.sections[0]
    section.page_width=Cm(21);section.page_height=Cm(29.7)
    section.left_margin=section.right_margin=Cm(2)
    section.top_margin=section.bottom_margin=Cm(1.65)
    for name,size in [('Normal',11.5),('Title',19),('Heading 1',13),('Subtitle',10)]:
        style=doc.styles[name]
        style.font.name='Microsoft YaHei';style.font.size=Pt(size);style.font.color.rgb=RGBColor(0,0,0)
        style.font.italic=False
        style._element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'),'Microsoft YaHei')
        style.paragraph_format.space_after=Pt(5)
        style.paragraph_format.line_spacing=1.22
    doc.styles['Heading 1'].paragraph_format.space_before=Pt(9)
    doc.styles['Heading 1'].paragraph_format.keep_with_next=True
    for style_name in ('Title','Subtitle','Heading 1'):
        for border in doc.styles[style_name]._element.findall('.//'+qn('w:pBdr')):
            border.getparent().remove(border)
    footer=section.footer.paragraphs[0];footer.alignment=WD_ALIGN_PARAGRAPH.RIGHT
    footer.add_run('学途智伴  8分钟路演稿  ')
    field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');footer._p.append(field)
    for run in footer.runs:run.font.size=Pt(9)
    doc.add_paragraph('学途智伴决赛精简演讲稿','Title')
    doc.add_paragraph('重邮FFBond  一人主讲  12页  排练目标6分15秒  含60秒演示','Subtitle')
    lead=doc.add_paragraph('第8页配合60秒静音操作片段讲解。时间包含播放、停顿与翻页，排练时按全程计时。')
    for run in lead.runs:run.font.size=Pt(9.5)
    md=['# 学途智伴决赛精简演讲稿','', '重邮FFBond｜一人主讲｜8分钟工作版','',
        '正文配合12页幻灯片，按6分15秒排练，8分钟场次预留1分45秒。第8页按60秒操作片段配合本人讲解。','']
    elapsed=0
    for index,item in enumerate(data['slides'],1):
        if index in (5,9):doc.add_page_break()
        end=elapsed+item['seconds']
        title=f'第{index}页  {item["title"]}'
        doc.add_paragraph(title,'Heading 1')
        timing=f'{clock(elapsed)}—{clock(end)}  ·  {item["seconds"]}秒'
        p=doc.add_paragraph(timing)
        for run in p.runs:run.font.size=Pt(9);run.font.color.rgb=RGBColor.from_string('526674')
        doc.add_paragraph(item['speech'])
        p=doc.add_paragraph('动作提示  '+item['cue'])
        p.paragraph_format.space_after=Pt(7)
        for run in p.runs:run.font.size=Pt(9);run.font.color.rgb=RGBColor.from_string('526674')
        md.extend([f'## {title}', '',timing,'',item['speech'],'','动作提示  '+item['cue'],''])
        elapsed=end
    props=doc.core_properties;props.title='学途智伴决赛精简演讲稿';props.author='重邮FFBond';props.last_modified_by='重邮FFBond';props.subject='8分钟单人路演';props.comments=''
    doc.save(ROOT/'学途智伴决赛演讲稿_8分钟.docx')
    (ROOT/'学途智伴决赛演讲稿_8分钟.md').write_text('\n'.join(md),encoding='utf-8')
    print(json.dumps({'slides':12,'seconds':elapsed,'spoken_characters':sum(len(s['speech']) for s in data['slides'])},ensure_ascii=False))


if __name__=='__main__':build()
