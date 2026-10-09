"""Build a synthetic teaching fixture with the shipped templates; no model calls."""
from __future__ import annotations

import argparse
from pathlib import Path
import re
import shutil

SKILL = Path(__file__).resolve().parents[1]
EXAMPLE = SKILL / 'references/examples/statistics'
LESSON = '0001-mean-and-median.html'


def render(template: str, values: dict[str, str]) -> str:
    text = (SKILL / 'templates' / template).read_text(encoding='utf-8')
    return re.sub(r'\{\{([A-Z_]+)\}\}', lambda match: values.get(match[1], ''), text)


def build(output: Path, stage: str = 'assessment') -> Path:
    if stage not in ('assessment', 'lesson'):
        raise ValueError('Unknown example stage')
    if output.is_symlink() or output.exists():
        raise ValueError('Output must be a new directory')
    output = output.resolve()
    if output.is_relative_to(SKILL):
        raise ValueError('Output must be outside the Skill folder')
    values = {
        'COURSE_TITLE': '校园消费统计', 'COURSE_SHORT_TITLE': '校园消费统计',
        'COURSE_SLUG': 'statistics-campus-example',
        'COURSE_DESCRIPTION': '读懂校园消费调查：从均值与中位数开始。',
        'ASSESSMENT_DESCRIPTION': '1 道选择题 + 1 道开放题，用计算和解释定位起点。',
        'PROGRESS_LABEL': '入门评估待作答' if stage == 'assessment' else '第 1 课已交付 · 待作答',
        'PROGRESS_NOTE': '合成教学示例；能力状态待真实作答验证。',
        'MISSION_HTML': '<p>用自己的话解释调查中的典型消费数字，并选择合适的统计量。</p>',
        'REVIEW_AND_NEXT_HTML': '<p>当前没有学员记录。先完成入门评估，再让教学 AI 读取本地作答。</p>',
        'ROADMAP_HTML': '<article class="phase-card"><span class="phase-number">01</span><h3>描述数据</h3><p>均值、中位数与分布；后续主题依据作答决定。</p></article>',
        'ASSESSMENT_QUESTIONS_WITH_LABELED_TEXTAREAS_AND_COLLAPSED_CRITERIA': (EXAMPLE / 'assessment-questions.html').read_text(encoding='utf-8'),
        'LESSON_LABEL': '第 1 课', 'LESSON_TITLE': '均值与中位数',
        'LESSON_DESCRIPTION': '理解两个典型数字，并解释极端值在什么条件下影响它们。',
        'LESSON_NUMBER': '0001', 'LESSON_KIND': 'formal', 'LESSON_KIND_LABEL': '正式课',
        'COURSE_PHASE': '描述数据', 'ESTIMATED_TIME': '约 20 分钟',
        'ORIENTATION_AND_OBJECTIVES_HTML': '<p>今天只解决一个问题：同一组数据，均值与中位数为什么可能不同？学完能算出它们，并解释一次高值变化的影响。</p>',
        'LESSON_CONTENT_HTML': (EXAMPLE / 'lesson-body.html').read_text(encoding='utf-8'),
        'MENTAL_MODEL_HTML': '<p>均值把总额平均分摊，中位数找排序后的中间位置。判断极端值影响前，先看人数与中间位置是否改变。</p>',
        'REVIEW_PLAN_HTML': '<p>明天不看正文，用自己的话解释两种统计量；再自拟一组数据，分别改变最大值与样本数，核查结果。</p>',
    }
    assessment_link = '<nav class="sidebar-section" aria-label="相关文件"><a href="{prefix}practice/entry-assessment.html">入门评估</a></nav>'
    values['ADDITIONAL_FILES_NAV'] = assessment_link.format(prefix='./')
    values['CURRENT_PAGE_NAV'] = '<li><a href="#review">学习证据与下一步</a></li><li><a href="#roadmap">路线与阶段</a></li>'
    if stage == 'lesson':
        values['COURSE_NAVIGATION'] = f'<li><a href="./lessons/{LESSON}">第 1 课 · 均值与中位数</a></li>'
        values['GENERATED_LESSON_CARDS'] = f'<h3>正式课</h3><div class="lesson-grid"><article class="lesson-card"><a href="./lessons/{LESSON}">第 1 课 · 均值与中位数</a><p>待作答；后续课尚未生成。</p></article></div>'
    output.mkdir(parents=True)
    assets = output / 'assets'
    assets.mkdir()
    for name in ('style.css', 'course.js', 'sync.js', 'tutor.js', 'tutor-settings.js', 'tutor-markdown.js'):
        shutil.copy2(SKILL / 'assets' / name, assets / name)
    shutil.copytree(SKILL / 'assets/vendor', assets / 'vendor', ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    for name in ('serve_course.py', 'tutor_chat.py', 'credential_store.py', 'start-course.cmd', 'start-course.sh', 'start-course.command'):
        shutil.copy2(SKILL / 'assets' / name, output / name)
        if name.endswith(('.sh', '.command')):
            (output / name).chmod(0o755)
    shutil.copy2(SKILL / 'templates/course.gitignore', output / '.gitignore')
    settings = (SKILL / 'assets/course-settings.html').read_text(encoding='utf-8')
    settings = settings.replace('<body class="settings-page">', '<body class="settings-page" data-course-key="statistics-campus-example">')
    (output / 'settings.html').write_text(settings, encoding='utf-8')
    (output / 'index.html').write_text(render('course-index.html', values), encoding='utf-8')
    (output / 'practice').mkdir()
    (output / 'practice/entry-assessment.html').write_text(render('entry-assessment.html', values), encoding='utf-8')
    if stage == 'lesson':
        values['ADDITIONAL_FILES_NAV'] = assessment_link.format(prefix='../')
        values['COURSE_NAVIGATION'] = f'<li><a href="./{LESSON}" aria-current="page">第 1 课 · 均值与中位数</a></li>'
        values['CURRENT_PAGE_NAV'] = '<li><a href="#intuition">先看直觉</a></li><li><a href="#calculation">完整计算</a></li><li><a href="#boundary">条件与边界</a></li><li><a href="#learning-input">答案与疑难</a></li>'
        (output / 'lessons').mkdir()
        (output / 'lessons' / LESSON).write_text(render('lesson.html', values), encoding='utf-8')
    (output / 'COURSE.md').write_text(f'# 校园消费统计\n\n合成页面夹具，非宿主执行结果。\n视觉方向：studio。\n阶段：{stage}。能力待验证，无学员记录。\n', encoding='utf-8')
    (output / 'ENTRY-ASSESSMENT.md').write_text('# 入门评估\n\n1 道选择题 + 1 道开放题。尚无学员作答，结果待验证。\n', encoding='utf-8')
    state_files = {
        'MISSION.md': '# 学习使命\n\n合成场景：读懂校园消费调查，能解释并选择典型数字。\n',
        'LEARNER-PROFILE.md': '# 学习者画像\n\n合成输入中的自述：大学生，会基本四则运算；分不清均值和中位数。每周两小时，先看图再算。\n没有真实作答，能力均待验证。\n',
        'ROADMAP.md': '# 候选路线\n\n描述数据 → 分布与离散程度 → 抽样与不确定性。\n' + ('当前只交付入门评估。\n' if stage == 'assessment' else '当前正式课：0001，尚未作答；后续正式课与补充页未生成。\n'),
        'RESOURCES.md': '# 资源记录\n\n本夹具离线构建，未执行资源检索或核验。宿主真实生成课程时应按资源策略评估阅读与视频。\n',
        'GLOSSARY.md': '# 已掌握术语\n\n尚无能力证据，不将正文中的术语记为已掌握。\n',
        'NOTES.md': '# 教学偏好\n\n合成场景：先图解再计算。\n',
    }
    for name, text in state_files.items():
        (output / name).write_text(text, encoding='utf-8')
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('--stage', choices=('assessment', 'lesson'), default='assessment')
    args = parser.parse_args()
    try:
        print(build(args.output, args.stage))
    except (OSError, ValueError) as error:
        parser.exit(2, f'{type(error).__name__}: {error}\n')
