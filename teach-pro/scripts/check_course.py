"""Read-only course structure checks. No learner files, network or semantic grading."""
from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass, field
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

VOID = set('area base br col embed hr img input link meta param source track wbr'.split())
COUNT_RE = re.compile(r'(\d+)\s*道选择题\s*(?:[+＋和、]|与)\s*(\d+)\s*道(?:开放|自述)题')
REQUIRED = ('index.html', 'settings.html', 'serve_course.py', 'tutor_chat.py',
            'assets/style.css', 'assets/course.js', 'assets/sync.js',
            'assets/tutor.js', 'assets/tutor-settings.js', 'assets/tutor-markdown.js',
            'assets/vendor/marked.umd.js', 'assets/vendor/purify.min.js',
            'assets/vendor/marked.LICENSE', 'assets/vendor/dompurify.LICENSE',
            'assets/vendor/dompurify.LICENSE-MPL')


@dataclass
class Node:
    tag: str
    attrs: dict
    line: int
    parent: Node | None = None
    children: list = field(default_factory=list)

    def descendants(self):
        for child in self.children:
            yield child
            yield from child.descendants()


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.nodes, self.stack, self.issues = [], [], []
        self.feed(text)
        self.close()
        if re.search(r'\{\{[A-Z][A-Z0-9_]*\}\}', text):
            self.issues.append((1, 'TEMPLATE', '仍有未替换的模板插槽'))
        if self.rawdata.strip().startswith('<'):
            self.issues.append((self.getpos()[0], 'HTML_ATTRIBUTE', '标签或引号未完整结束'))

    def handle_starttag(self, tag, attrs):
        line = self.getpos()[0]
        names = [name for name, _ in attrs]
        if len(names) != len(set(names)):
            self.issues.append((line, 'HTML_ATTRIBUTE', '存在重复属性'))
        if any(any(char in name for char in '\"\'<=`') for name in names):
            self.issues.append((line, 'HTML_ATTRIBUTE', '属性名异常；检查引号是否转义'))
        node = Node(tag, dict(attrs), line, self.stack[-1] if self.stack else None)
        if node.parent:
            node.parent.children.append(node)
        self.nodes.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.stack.pop()

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                return


def inspect_html(text):
    page = Page(text)
    ids, keys = set(), set()
    for node in page.nodes:
        for attribute, seen, code in [('id', ids, 'DUPLICATE_ID'), ('data-save-key', keys, 'SAVE_KEY')]:
            value = node.attrs.get(attribute)
            if value is not None:
                if not value or value in seen:
                    page.issues.append((node.line, code, '标识为空或重复'))
                seen.add(value)
        if 'data-quiz' not in node.attrs:
            continue
        children = list(node.descendants())
        radios = [child for child in children if child.tag == 'input' and child.attrs.get('type') == 'radio']
        values = [child.attrs.get('value') for child in radios]
        names = {child.attrs.get('name') for child in radios}
        if not radios or not all(values) or len(values) != len(set(values)) or len(names) != 1 or None in names or '' in names:
            page.issues.append((node.line, 'QUIZ_OPTIONS', '单选组需共用 name，且选项 value 非空、唯一'))
        if sum(child.attrs.get('data-correct') == 'true' for child in radios) != 1:
            page.issues.append((node.line, 'QUIZ_ANSWER', '单选题需恰好一个正确选项'))
        if not any('data-quiz-submit' in child.attrs for child in children) or not any('data-quiz-feedback' in child.attrs for child in children):
            page.issues.append((node.line, 'QUIZ_STRUCTURE', '提交按钮和反馈区须在测验容器内'))
    return page


def check_course(root):
    root = Path(root).resolve()
    if not root.is_dir():
        raise ValueError('课程目录不存在')
    issues, pages, texts = [], {}, {}

    def issue(file, line, code, message):
        issues.append({'file': file, 'line': line, 'code': code, 'message': message})

    def inside(file):
        return file.resolve().is_relative_to(root)

    for relative in REQUIRED:
        file = root / relative
        if not inside(file) or not file.is_file():
            issue(relative, 1, 'MISSING_COMPONENT', '默认课程组件不存在或位于课程目录之外')
    candidates = [root / 'index.html', root / 'settings.html']
    for folder in ('lessons', 'practice', 'reference'):
        directory = root / folder
        if inside(directory) and directory.is_dir():
            candidates.extend(sorted(directory.glob('*.html')))
    for file in candidates:
        if not file.is_file() or not inside(file):
            continue
        relative = file.relative_to(root).as_posix()
        text = file.read_text(encoding='utf-8-sig')
        texts[relative] = text
        page = inspect_html(text)
        pages[file.resolve()] = page
        for line, code, message in page.issues:
            issue(relative, line, code, message)
        sidebar = next((node for node in page.nodes if 'sidebar' in (node.attrs.get('class') or '').split()), None)
        nav = next((node for node in sidebar.descendants() if node.tag == 'nav'), None) if sidebar else None
        if not nav or 'course-settings-nav' not in (nav.attrs.get('class') or '').split():
            issue(relative, 1, 'SETTINGS_NAV', '左侧首个导航应为课程设置')
        elif not any(child.tag == 'a' and (file.parent / unquote(urlsplit(child.attrs.get('href') or '').path)).resolve() == root / 'settings.html' for child in nav.descendants()):
            issue(relative, nav.line, 'SETTINGS_NAV', '设置入口未指向当前课程 settings.html')
        if relative.startswith('lessons/'):
            if not any(node.attrs.get('id') == 'learning-input' for node in page.nodes):
                issue(relative, 1, 'TUTOR_ANCHOR', '缺少课末学习记录锚点')
            if not any(node.tag == 'script' and urlsplit(node.attrs.get('src') or '').path == '../assets/tutor.js' for node in page.nodes):
                issue(relative, 1, 'TUTOR_SCRIPT', '课页未加载默认答疑组件')
    for file, page in pages.items():
        relative = file.relative_to(root).as_posix()
        for node in page.nodes:
            for attribute in ('href', 'src'):
                value = node.attrs.get(attribute)
                if not value:
                    continue
                url = urlsplit(value)
                if url.scheme in ('https', 'http', 'mailto', 'data', 'tel') or value.startswith('//'):
                    continue  # Never fetch or claim verification of external resources.
                if url.scheme:
                    issue(relative, node.line, 'LINK_SCHEME', '链接使用不支持的协议')
                    continue
                destination = (file.parent / unquote(url.path)).resolve() if url.path else file
                if not inside(destination):
                    issue(relative, node.line, 'OUTSIDE_COURSE', '本地链接越出课程目录')
                elif not destination.is_file():
                    issue(relative, node.line, 'MISSING_LINK', '本地链接或资产目标不存在')
                elif url.fragment and destination in pages and not any(item.attrs.get('id') == unquote(url.fragment) for item in pages[destination].nodes):
                    issue(relative, node.line, 'MISSING_ANCHOR', '链接锚点不存在')
    assessment = pages.get((root / 'practice/entry-assessment.html').resolve())
    counts = None
    if assessment:
        for node in assessment.nodes:
            if 'data-quiz' in node.attrs and not node.attrs.get('data-save-key'):
                issue('practice/entry-assessment.html', node.line, 'ASSESSMENT_UNSAVED', '影响起点的评估选择题缺少作答保存标识')
        choice = sum('data-quiz' in node.attrs for node in assessment.nodes)
        opened = sum(node.tag == 'textarea' and 'data-save-key' in node.attrs for node in assessment.nodes)
        counts = {'choice': choice, 'open_inputs': opened}
        count_sources = dict(texts)
        file = root / 'ENTRY-ASSESSMENT.md'
        if inside(file) and file.is_file():
            count_sources['ENTRY-ASSESSMENT.md'] = file.read_text(encoding='utf-8-sig')
        for relative, text in count_sources.items():
            for match in COUNT_RE.finditer(unescape(re.sub(r'<[^>]*>', '', text)) if relative.endswith('.html') else text):
                if (int(match[1]), int(match[2])) != (choice, opened):
                    issue(relative, 1, 'ASSESSMENT_COUNT', '题型数量描述与评估页输入结构不一致')
    return {'structurally_valid': not issues, 'pages_checked': len(pages),
            'assessment_counts': counts, 'issues': issues,
            'semantic_review': 'not_performed',
            'limits': '不检查学员能力、概念正确性、外链可用性、播放器或真实模型连接；不读取答案、聊天或密钥配置。'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('course', type=Path)
    parser.add_argument('--json', action='store_true', help='print JSON; does not write a report file')
    args = parser.parse_args()
    try:
        report = check_course(args.course)
    except (ValueError, OSError) as error:
        print(json.dumps({'error': type(error).__name__, 'message': '无法读取课程公开文件'}, ensure_ascii=False))
        return 2
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"结构检查：{'通过' if report['structurally_valid'] else '未通过'}；页面：{report['pages_checked']}")
        for issue in report['issues']:
            print(f"{issue['file']}:{issue['line']} [{issue['code']}] {issue['message']}")
        print(report['limits'])
    return 0 if report['structurally_valid'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
