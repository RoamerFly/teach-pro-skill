"""Build a two-page spoken-answer rehearsal handout from the verified Q&A bank."""
from pathlib import Path
import json
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT=Path(__file__).resolve().parent

def build():
    data=json.loads((ROOT/'答辩问答.json').read_text('utf8'))
    doc=Document();section=doc.sections[0]
    section.page_width=Cm(21);section.page_height=Cm(29.7)
    section.left_margin=section.right_margin=Cm(2)
    section.top_margin=section.bottom_margin=Cm(1.65)
    section.header_distance=section.footer_distance=Cm(.7)
    for name,size in [('Normal',11.5),('Title',18),('Heading 1',14),('Heading 2',12)]:
        style=doc.styles[name];style.font.name='Microsoft YaHei';style.font.size=Pt(size);style.font.color.rgb=RGBColor(0,0,0)
        fonts=style._element.get_or_add_rPr().get_or_add_rFonts();fonts.set(qn('w:eastAsia'),'Microsoft YaHei')
        for key in ['asciiTheme','hAnsiTheme','eastAsiaTheme','cstheme']:
            fonts.attrib.pop(qn('w:'+key),None)
        for border in list(style._element.iter(qn('w:pBdr'))):
            border.getparent().remove(border)
        for size_cs in style._element.iter(qn('w:szCs')):size_cs.set(qn('w:val'),str(int(size*2)))
        style.paragraph_format.line_spacing=1.12
    doc.styles['Normal'].paragraph_format.space_after=Pt(6)
    doc.styles['Heading 1'].paragraph_format.space_before=Pt(10)
    doc.styles['Heading 1'].paragraph_format.space_after=Pt(6)
    doc.styles['Heading 2'].paragraph_format.space_before=Pt(8)
    doc.styles['Heading 2'].paragraph_format.space_after=Pt(4)
    doc.styles['Title'].paragraph_format.space_after=Pt(9)
    for name in ['Heading 1','Heading 2']:doc.styles[name].font.bold=True
    footer=section.footer.paragraphs[0];footer.alignment=2
    footer.add_run('学途智伴  重邮FFBond  ')
    field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');footer._p.append(field)
    for run in footer.runs:run.font.size=Pt(9)
    doc.add_paragraph(data['title'],'Title')
    doc.add_paragraph(data['introduction'])
    p=doc.add_paragraph();p.add_run('记忆主线  ').bold=True;p.add_run(data['memory_cue'])
    doc.add_paragraph('优先排练的四题','Heading 1')
    def add(row):
        doc.add_paragraph(f"{row['id']}  {row['question']}",'Heading 2')
        p=doc.add_paragraph(row['answer']);p.paragraph_format.keep_together=True
    for row in data['core']:add(row)
    doc.add_page_break()
    doc.add_paragraph('常见追问','Heading 1')
    for row in data['follow_up']:add(row)
    doc.add_paragraph('排练方法','Heading 2');doc.add_paragraph(data['rehearsal'])
    doc.core_properties.title=data['title'];doc.core_properties.author='重邮FFBond'
    doc.save(ROOT/'两分钟答辩准备.docx')
    lines=['# '+data['title'],'',data['introduction'],'','**记忆主线：**'+data['memory_cue'],'','## 优先排练的四题','']
    for group,title in [(data['core'],None),(data['follow_up'],'常见追问')]:
        if title:lines+=['## '+title,'']
        for row in group:
            lines += [f"### {row['id']}. {row['question']}",'',row['answer'],'','记忆词：'+row['cue'],'']
    lines+=['## 排练方法','',data['rehearsal'],'']
    (ROOT/'两分钟答辩准备.md').write_text('\n'.join(lines),'utf8')
    print(json.dumps({'questions':len(data['core'])+len(data['follow_up']),
                      'answer_characters':[len(x['answer']) for x in data['core']+data['follow_up']]},ensure_ascii=False))

if __name__=='__main__':build()
