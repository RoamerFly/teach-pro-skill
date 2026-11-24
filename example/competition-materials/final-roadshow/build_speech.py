"""Generate a speech-only script matching the ten PowerPoint notes."""
import json
from pathlib import Path
from docx import Document
from docx.shared import Cm, Pt
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parent


def build():
    data = json.loads((ROOT / '路演内容.json').read_text(encoding='utf8'))
    speeches = [slide['speech'] for slide in data['slides']]
    document = Document()
    section = document.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.left_margin = section.right_margin = Cm(2)
    section.top_margin = section.bottom_margin = Cm(1.8)
    style = document.styles['Normal']
    style.font.name = 'Microsoft YaHei'
    style.font.size = Pt(12)
    style._element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'), 'Microsoft YaHei')
    style.paragraph_format.line_spacing = 1.4
    style.paragraph_format.space_after = Pt(13)
    for index, speech in enumerate(speeches):
        if index == 5:
            document.add_page_break()
        paragraph = document.add_paragraph(speech)
        paragraph.paragraph_format.keep_together = True
    document.core_properties.title = '学途智伴决赛演讲稿'
    document.core_properties.author = '重邮FFBond'
    document.save(ROOT / '学途智伴决赛演讲稿_8分钟.docx')
    (ROOT / '学途智伴决赛演讲稿_8分钟.md').write_text('\n\n'.join(speeches) + '\n', encoding='utf8')
    print(json.dumps({'slides': len(speeches), 'spoken_characters': sum(map(len, speeches))}))


if __name__ == '__main__':
    build()
