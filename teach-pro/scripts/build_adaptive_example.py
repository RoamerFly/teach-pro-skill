"""Build an explicitly synthetic teaching showcase; no model or auto-grading calls."""
from __future__ import annotations

import argparse
from hashlib import sha256
from html import escape
import json
from pathlib import Path
import re
import shutil

from build_example import SKILL, build as build_minimal, render

SOURCE = SKILL / 'references/examples/statistics-adaptive'
FIRST = '0001-mean-and-median.html'
SECOND = '0002-spread-and-distance.html'
SUPPLEMENT = '0001-s01-median-positions.html'


def resources(lesson):
    records = json.loads((SOURCE / 'resources.json').read_text(encoding='utf-8'))['records']
    pieces = []
    for record in records:
        if record['lesson'] != lesson:
            continue
        content = (f'<article class="resource-card"><h3>{escape(record["priority"])} · '
                   f'<a href="{escape(record["url"], quote=True)}" target="_blank" rel="noopener noreferrer">'
                   f'{escape(record["title"])}</a></h3><p>{escape(record["publisher"])} · {escape(record["language"])}</p>'
                   f'<p><strong>看哪里：</strong>{escape(record["location"])}</p>'
                   f'<p><strong>任务：</strong>{escape(record["task"])}</p>'
                   f'<p>{escape(record["budget"])}。{escape(record["access"])}</p></article>')
        if record['priority'] in ('选看', '选读'):
            content = f'<details><summary>{escape(record["priority"])} · {escape(record["title"])}</summary>{content}</details>'
        pieces.append(content)
    return '<section id="resources" class="content-section resources"><h2>本课一手阅读与视频</h2>' + ''.join(pieces) + '</section>'


def navigation(prefix, has_second, has_supplement):
    items = f'<li><a href="{prefix}{FIRST}">第 1 课 · 均值与中位数</a>'
    if has_supplement:
        items += f'<ul class="lesson-supplements"><li><a href="{prefix}{SUPPLEMENT}">补充 · 排序位置与人数</a></li></ul>'
    items += '</li>'
    if has_second:
        items += f'<li><a href="{prefix}{SECOND}">第 2 课 · 比较分散程度</a></li>'
    return items


def base_values(key, label, has_second, has_supplement):
    return {
        'COURSE_TITLE': '校园消费统计', 'COURSE_SHORT_TITLE': '校园消费统计', 'COURSE_SLUG': key,
        'COURSE_PHASE': '观察与解释', 'PROGRESS_LABEL': '第 2 课已交付 · 待作答' if has_second else '第 1 课已交付 · 待作答',
        'COURSE_DESCRIPTION': label + '：用数字和图解读懂校园消费调查。',
        'PROGRESS_NOTE': '合成教学案例；交付、作答与能力判断分开记录。',
        'MISSION_HTML': '<p>为一组校园消费数据写出有范围的解释，能说明中心、分散程度及适用条件。</p>',
        'ROADMAP_HTML': '<article class="phase-card"><span class="phase-number">01</span><h3>描述数据</h3><p>中心与分散程度；当前按作答推进。</p></article><article class="phase-card"><span class="phase-number">02</span><h3>抽样与不确定性</h3><p>候选阶段，尚未生成课程。</p></article>',
        'COURSE_NAVIGATION': navigation('./lessons/', has_second, has_supplement),
        'CURRENT_PAGE_NAV': '<li><a href="#review">学习证据与下一步</a></li><li><a href="#mission">学习使命</a></li><li><a href="#roadmap">路线与阶段</a></li><li><a href="#lessons">课程列表</a></li>',
        'ADDITIONAL_FILES_NAV': '<nav class="sidebar-section" aria-label="相关文件"><a href="./practice/entry-assessment.html">入门评估</a><a href="./reference/decision-trace.html">案例依据与教学决策</a></nav>',
    }


def write_lesson(course, values, filename, number, title, description, body, model, review, minutes,
                 has_second, has_supplement, supplement=False):
    page = dict(values)
    page.update(LESSON_LABEL='第 1 课补充' if supplement else '第 ' + str(int(number)) + ' 课',
                LESSON_NUMBER=number, LESSON_TITLE=title, LESSON_DESCRIPTION=description,
                LESSON_KIND='supplement' if supplement else 'formal', RELATED_LESSON_NUMBER='0001' if supplement else '',
                LESSON_KIND_LABEL='补充课' if supplement else '正式课', ESTIMATED_TIME=minutes,
                PROGRESS_LABEL='本页已交付 · 待作答',
                ORIENTATION_AND_OBJECTIVES_HTML='<p>' + description + '</p>', LESSON_CONTENT_HTML=body,
                MENTAL_MODEL_HTML='<p>' + model + '</p>', REVIEW_PLAN_HTML='<p>' + review + '</p>',
                RESOURCES_HTML='' if supplement else resources(number),
                COURSE_NAVIGATION=navigation('./', has_second, has_supplement),
                ADDITIONAL_FILES_NAV='<nav class="sidebar-section" aria-label="相关文件"><a href="../practice/entry-assessment.html">入门评估</a><a href="../reference/decision-trace.html">案例依据与教学决策</a></nav>')
    page['CURRENT_PAGE_NAV'] = ('<li><a href="#orientation">本课目标</a></li><li><a href="#learning-input">本课疑难</a></li>')
    if number == '0002':
        page['PREVIOUS_LESSON_LINK'] = f'<a href="./{FIRST}">上一正式课</a>'
    elif supplement:
        page['PREVIOUS_LESSON_LINK'] = f'<a href="./{FIRST}">关联第 1 课</a>'
    if has_second and (number == '0001' or supplement):
        page['NEXT_LESSON_LINK_IF_GENERATED'] = f'<a href="./{SECOND}">第 2 课 · 比较分散程度</a>'
    text = render('lesson.html', page).replace('data-visual-theme="studio"', 'data-visual-theme="field"')
    # Keep the shared template; populate a useful lesson-local TOC from body headings.
    sections = re.findall(r'<section id="([\w-]+)">\s*<h2>([^<]+)</h2>', body)
    toc = ''.join(f'<li><a href="#{anchor}">{title}</a></li>' for anchor, title in sections)
    text = text.replace(page['CURRENT_PAGE_NAV'], toc + '<li><a href="#learning-input">本课疑难</a></li>')
    (course / 'lessons' / filename).write_text(text, encoding='utf-8')


def branch(course, case, source):
    build_minimal(course, 'lesson')
    has_second = case is not None
    has_supplement = bool(case and case['supplement'])
    label = case['label'] if case else '共同起点 · 访谈、评估与首课'
    key = 'statistics-adaptive-' + (case['id'] if case else 'start')
    values = base_values(key, label, has_second, has_supplement)
    interpretation = case['interpretation'] if case else '模拟评估回答能说明150÷5；中位数算法自述不清楚，暂从两种中心开始。'
    pending = case['pending'] if case else '第一课已交付，等你提交计算与解释后安排下一步。'
    values['REVIEW_AND_NEXT_HTML'] = f'<p><strong>{escape(label)}</strong> · 合成输入与预期交付。</p><p>{escape(interpretation)}</p><p>{escape(pending)}</p><p><a href="./reference/decision-trace.html">查看原始输入与决策依据</a></p>'
    cards = f'<h3>正式课</h3><div class="lesson-grid"><article class="lesson-card"><a href="./lessons/{FIRST}">第 1 课 · 均值与中位数</a></article>'
    if has_second:
        cards += f'<article class="lesson-card"><a href="./lessons/{SECOND}">第 2 课 · 比较分散程度</a><p>新目标，待作答。</p></article>'
    cards += '</div>'
    if has_supplement:
        cards += f'<h3>第 1 课相关内容补充课</h3><div class="lesson-grid"><article class="lesson-card"><a href="./lessons/{SUPPLEMENT}">排序位置与人数</a><p>已交付，误区是否纠正待复核。</p></article></div>'
    values['GENERATED_LESSON_CARDS'] = cards
    (course / 'index.html').write_text(render('course-index.html', values), encoding='utf-8')
    write_lesson(course, values, FIRST, '0001', '均值与中位数', '算出两个中心，解释替换和新增何时改变结果。',
                 (SOURCE / 'first-lesson.html').read_text(encoding='utf-8'),
                 '均值问总额如何分摊；中位数问排序中间在哪里。判断变化先检查人数和居中值。',
                 '明天不看正文，换一组数据解释替换与新增；三天后再复述两种中心的用途。', '约 30 分钟，资源选学另计', has_second, has_supplement)
    if has_second:
        if case['id'] == 'a':
            scaffold = '<p>再推一步：给每个消费值都加10元，均值也加10，所有“观测值−均值”的差不变，所以MAD不变。若全部金额改用分表示，每项差乘100，MAD也乘100；这是单位改变，不是消费变得更分散。</p>'
            transfer = '<p>比较16、18、20、22、24与10、20、20、20、30。自己建立距离表、计算MAD，并解释哪组更分散。然后给第一组全部加10，预测并核算MAD；若改用分作单位，应如何报告？</p><details><summary>完成后核对</summary><p>两组均值20，MAD分别2.4和4元。全部加10后，均值30、MAD仍2.4元；换成分，MAD为240分。差异应连同单位和同一指标报告。</p></details>'
        else:
            scaffold = '<div class="table-wrap"><table><caption>先把乙组的每项距离写出来</caption><thead><tr><th>金额</th><th>减去均值20</th><th>取距离</th></tr></thead><tbody><tr><td>0</td><td>−20</td><td>20</td></tr><tr><td>10</td><td>−10</td><td>10</td></tr><tr><td>20</td><td>0</td><td>0</td></tr><tr><td>30</td><td>10</td><td>10</td></tr><tr><td>40</td><td>20</td><td>20</td></tr></tbody></table></div><p>沿每行从左向右：先减均值，再去掉方向得到距离。把第三列的距离加起来，再除以五。这样每项距离都会计入结果；第二列带方向的差相加则会相互抵消。</p>'
            transfer = '<p>第一步：14、18、20、22、26的均值为20，请补齐距离6、2、__、__、6，再相加除以五。第二步换数据：12、16、20、24、28，自己求均值与MAD，并说明每个数的单位。</p><details><summary>完成后核对</summary><p>第一组距离6、2、0、2、6，MAD为16÷5=3.2元。第二组均值20，距离8、4、0、4、8，MAD为24÷5=4.8元。正负偏差虽然相加为零，实际距离并没有消失。</p></details>'
        answer = '<label for="lesson-evidence">你的计算与解释</label><textarea id="lesson-evidence" data-save-key="lesson-0002-evidence" rows="4"></textarea>'
        transfer = transfer.replace('<details>', answer + '<details>', 1)
        body = (SOURCE / 'second-lesson.html').read_text(encoding='utf-8').replace('{{SCAFFOLD_HTML}}', scaffold).replace('{{TRANSFER_HTML}}', transfer)
        write_lesson(course, values, SECOND, '0002', '比较分散程度', '用同刻度点图和平均绝对偏差，解释中心相同的数据为什么不同。', body,
                     '中心告诉你在哪里，分散程度告诉你离中心多远；MAD先算每项绝对距离再平均，比较时保留单位与点图。',
                     '明天换五个数计算MAD；三天后只看点图解释中心与分散的区别。下一目标依据新作答决定。',
                     '约 25 分钟，资源选学另计' if case['id'] == 'a' else '约 30 分钟，资源选学另计', True, has_supplement)
    if has_supplement:
        write_lesson(course, values, SUPPLEMENT, '0001-s01', '排序位置与人数', '换一种位置表示，区分替换与新增，并用新题复核。',
                     (SOURCE / 'supplement.html').read_text(encoding='utf-8'), '先数人数，再排序定位；固定人数也要检查居中值有没有变化。',
                     '本页练习后，隔一天换新数据复核；完成补充不自动代表误区已纠正。', '约 10 分钟', True, True, True)
    trace = ('<section id="trace"><h2>从原始输入到教学安排</h2><p>合成教学案例回放，不是宿主执行日志。原始题目与预期判断来自案例源文件。</p>'
             f'<p><strong>题目：</strong>{escape(source["question"])}</p><p><strong>条件：</strong>{escape(source["conditions"])}</p>')
    if case:
        trace += f'<blockquote><p>{escape(case["fields"]["lesson-0001-evidence"])}</p><p>疑难：{escape(case["fields"]["lesson-0001-questions"])}</p></blockquote>'
        trace += f'<p><strong>判断范围：</strong>{escape(interpretation)}</p><p><strong>新目标：</strong>{escape(case["next_goal"])}</p><p><strong>支持调整：</strong>{escape(case["scaffolding"])}</p><p><strong>待验证：</strong>{escape(pending)}</p>'
        (course / 'synthetic-inputs').mkdir()
        fixture = {'synthetic': True, 'case': case['id'], 'course': key, 'page': FIRST, 'saved_at': None,
                   'context_sha256': sha256((course / 'lessons' / FIRST).read_bytes()).hexdigest(),
                   'conditions': source['conditions'], 'fields': case['fields']}
        (course / 'synthetic-inputs/0001-answer.json').write_text(json.dumps(fixture, ensure_ascii=False, indent=2), encoding='utf-8')
        (course / 'learning-records').mkdir()
        record = f'# 合成案例的预期作答审阅\n\n来源：synthetic-inputs/0001-answer.json 的 fields。题目条件：{source["conditions"]}\n\n判断：{interpretation}\n\n教学安排：{case["next_goal"]}；{case["scaffolding"]}。\n\n待验证：{pending}\n不是实际学员成绩或教学AI已执行的结论。\n'
        (course / 'learning-records/0001-answer-review.md').write_text(record, encoding='utf-8')
        trace += '<p>文件对应：<code>synthetic-inputs/0001-answer.json</code> → <code>learning-records/0001-answer-review.md</code> → 画像、路线与首页。真实体验作答另由启动器保存到 <code>learner-submissions/</code>。</p>'
    else:
        trace += f'<p>初始请求：{escape(source["initial_request"])}</p><p>访谈回答：{escape(source["interview_reply"])}</p><p>模拟评估解释：{escape(source["entry_fields"]["entry-explanation"])}</p><p>{escape(interpretation)}</p><p>当前只交付首课；后续两个分支在展示总入口对照，不作为本课未来链接。</p>'
    trace += '</section>'
    reference = dict(values, REFERENCE_TITLE='案例依据与教学决策', REFERENCE_DESCRIPTION=label,
                     REFERENCE_CONTENT_HTML=trace, CURRENT_PAGE_NAV='<li><a href="#trace">输入与决策</a></li>',
                     COURSE_NAVIGATION=navigation('../lessons/', has_second, has_supplement), ADDITIONAL_FILES_NAV='')
    (course / 'reference').mkdir()
    (course / 'reference/decision-trace.html').write_text(render('reference.html', reference), encoding='utf-8')
    (course / 'COURSE.md').write_text(f'# 校园消费统计\n\n合成教学案例：{label}。\n视觉方向：field，适合观察数据与关系；同一主题内不随机换风格。\n当前正式课：' + ('0002' if has_second else '0001') + f'，待作答。\n关联补充：{SUPPLEMENT if has_supplement else "无"}。\n最近输入来源：合成案例文件，不是实际学员提交。\n{interpretation}\n{pending}\n', encoding='utf-8')
    (course / 'LEARNER-PROFILE.md').write_text(f'# 合成案例画像\n\n来源：cases.json访谈自述。会四则运算，每周两小时，先图后算；设备、日期和真实独立完成程度未知。\n\n本轮来源：合成案例文件。\n{interpretation}\n{pending}\n', encoding='utf-8')
    (course / 'ENTRY-ASSESSMENT.md').write_text('# 入门评估\n\n1 道选择题 + 1 道开放题。模拟回答：150÷5=30；中位数算法自述不清楚。仅作起点线索，是否看过解析未知。没有真实学员评估。\n', encoding='utf-8')
    (course / 'ROADMAP.md').write_text(f'# 候选路线\n\n中心 → 比较分散程度 → 抽样与不确定性。\n最新正式课：{"0002" if has_second else "0001"}，待作答；补充：{SUPPLEMENT if has_supplement else "无"}，不占正式课序号。\n{interpretation}\n{pending}\n后续主题仅候选，不生成链接。\n', encoding='utf-8')
    (course / 'RESOURCES.md').write_text('# 逐课资源记录\n\n核验日期2026-10-09。完整来源、任务、访问限制及核验程度见下列源数据；播放未实测，不声称精确时段核验。\n\n' + json.dumps(json.loads((SOURCE / 'resources.json').read_text(encoding='utf-8')), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    for file in course.rglob('*.html'):
        text = file.read_text(encoding='utf-8').replace('data-visual-theme="studio"', 'data-visual-theme="field"')
        text = text.replace('statistics-campus-example', key)
        if file.name == 'decision-trace.html':
            text = text.replace('<body>', '<body data-course-key="' + key + '">')
        file.write_text(text, encoding='utf-8')


def build(output: Path, selection='all'):
    if selection not in ('all', 'a', 'b'):
        raise ValueError('Unknown case')
    if output.exists() or output.is_symlink():
        raise ValueError('Output must be a new directory; existing work is never overwritten')
    output = output.resolve()
    if output.is_relative_to(SKILL):
        raise ValueError('Output must be outside the Skill folder')
    source = json.loads((SOURCE / 'cases.json').read_text(encoding='utf-8'))
    if source.get('synthetic') is not True or {case['id'] for case in source['cases']} != {'a', 'b'} or len(source['cases']) != 2:
        raise ValueError('Expected exactly two explicitly synthetic case definitions')
    output.mkdir(parents=True)
    branch(output / 'start', None, source)
    cases = [case for case in source['cases'] if selection == 'all' or case['id'] == selection]
    for case in cases:
        branch(output / ('case-' + case['id']), case, source)
    (output / 'assets').mkdir()
    for name in ('style.css', 'course.js'):
        shutil.copy2(SKILL / 'assets' / name, output / 'assets' / name)
    cards = '<article class="phase-card"><span class="phase-number">01</span><h2><a href="./start/index.html">共同起点</a></h2><p>访谈、评估与完整第一课；尚无首课作答。</p></article>'
    for case in cases:
        cards += f'<article class="phase-card"><span class="phase-number">{case["id"].upper()}</span><h2><a href="./case-{case["id"]}/index.html">{escape(case["label"])}</a></h2><p>{escape(case["interpretation"])}</p><p><strong>交付：</strong>第2课' + ('＋第1课补充' if case['supplement'] else '') + f'。</p><p>{escape(case["scaffolding"])}</p></article>'
    portal = '<!doctype html><html lang="zh-CN" data-theme="auto" data-visual-theme="field"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>学途智伴 · 自适应教学案例</title><meta name="description" content="同一目标、不同作答、不同教学支持"><link rel="stylesheet" href="./assets/style.css"></head><body><main class="content"><header class="course-hero"><div><span class="eyebrow">校园生活 · 合成案例回放</span><h1>同一目标，两种续课路径</h1><p>依次看共同起点、两组作答与续课结果。页面来自预写案例，不是模型现场生成。</p></div><div class="progress-panel"><strong>读懂数据，逐课推进</strong><p>共同首课：均值与中位数<br>正式续课：比较分散程度<br>差异支持：迁移练习／分步支架与补充</p></div></header><section class="content-section"><h2>从理解证据到下一步</h2><div class="phase-grid">' + cards + '</div></section><section class="content-section"><h2>怎么体验</h2><p>从上面的课程入口阅读和做题；要保存到文件或启用答疑，进入所选分支目录运行课程启动器。每个分支有独立的设置、记录与导航。点击“案例依据与教学决策”查看输入和判断；构建器不分析现场作答，也不自动续课。</p></section></main><script src="./assets/course.js"></script></body></html>'
    (output / 'index.html').write_text(portal, encoding='utf-8')
    (output / 'README.md').write_text('# 自适应教学案例\n\n打开index.html对照；每个分支独立启动。预写合成案例，不是宿主执行记录。原始模拟输入在各分支synthetic-inputs，真实体验输入自动写入learner-submissions，两者不合并。\n', encoding='utf-8')
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('--case', choices=('all', 'a', 'b'), default='all')
    args = parser.parse_args()
    try:
        print(build(args.output, args.case))
    except (OSError, ValueError) as error:
        parser.exit(2, f'{type(error).__name__}: {error}\n')
