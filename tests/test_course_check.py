import importlib.util
import json
import re
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'teach-pro/scripts/check_course.py'
spec = importlib.util.spec_from_file_location('course_check', SCRIPT)
checker = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = checker
spec.loader.exec_module(checker)


def nav(prefix='./'):
    return f'<aside class="sidebar"><nav class="course-settings-nav"><a href="{prefix}settings.html">设置</a></nav></aside>'


def quiz(index=1):
    return (f'<div data-quiz data-save-key="q{index}">'
            f'<input type="radio" name="q{index}" value="a" data-correct="true">'
            f'<input type="radio" name="q{index}" value="b">'
            '<button data-quiz-submit>检查</button><p data-quiz-feedback></p></div>')


class CourseCheckTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        for name in checker.REQUIRED:
            file = self.root / name
            file.parent.mkdir(exist_ok=True)
            file.write_text(nav() if name.endswith('.html') else '', encoding='utf-8')
        (self.root / 'practice').mkdir()
        self.assessment = self.root / 'practice/entry-assessment.html'
        self.assessment.write_text(nav('../') + quiz() + '<textarea data-save-key="explanation"></textarea>', encoding='utf-8')
        (self.root / 'ENTRY-ASSESSMENT.md').write_text('1 道选择题 + 1 道开放题', encoding='utf-8')

    def tearDown(self):
        self.temp.cleanup()

    def codes(self, report):
        return {issue['code'] for issue in report['issues']}

    def test_raw_attribute_quotes_are_detected_and_escaped_quotes_pass(self):
        raw = '<textarea placeholder="解释"关键概念"和例子"></textarea>'
        self.assertIn('HTML_ATTRIBUTE', {item[1] for item in checker.inspect_html(raw).issues})
        escaped = '<textarea placeholder="解释&quot;关键概念&quot;和例子"></textarea>'
        self.assertEqual(checker.inspect_html(escaped).issues, [])
        duplicate = '<input value="first" value="second">'
        self.assertIn('HTML_ATTRIBUTE', {item[1] for item in checker.inspect_html(duplicate).issues})

    def test_counts_come_from_inputs_and_inconsistent_descriptions_fail(self):
        (self.root / 'index.html').write_text(nav() + '<p>4 道选择题和 1 道开放题</p>', encoding='utf-8')
        report = checker.check_course(self.root)
        self.assertEqual(report['assessment_counts'], {'choice': 1, 'open_inputs': 1})
        self.assertIn('ASSESSMENT_COUNT', self.codes(report))

    def test_quiz_sibling_controls_and_ambiguous_values_are_detected(self):
        text = quiz().replace('value="b"', 'value="a"').replace('<button data-quiz-submit>检查</button>', '')
        text += '<button data-quiz-submit>错误位置</button>'
        codes = {item[1] for item in checker.inspect_html(text).issues}
        self.assertTrue({'QUIZ_OPTIONS', 'QUIZ_STRUCTURE'} <= codes)
        self.assertIn('SAVE_KEY', {item[1] for item in checker.inspect_html(quiz() + quiz()).issues})

    def test_missing_assets_external_local_paths_and_missing_anchors_fail(self):
        (self.root / 'index.html').write_text(nav() + '<img src="assets/missing.svg"><a href="../private.html">越界</a><a href="#absent">锚点</a>', encoding='utf-8')
        (self.root / 'tutor_chat.py').unlink()
        self.assertTrue({'MISSING_COMPONENT', 'MISSING_LINK', 'OUTSIDE_COURSE', 'MISSING_ANCHOR'} <= self.codes(checker.check_course(self.root)))

    def test_defaults_and_lesson_components_are_checked(self):
        (self.root / 'lessons').mkdir()
        file = self.root / 'lessons/0001-intro.html'
        file.write_text(nav('../') + '<section id="learning-input"></section>', encoding='utf-8')
        self.assertIn('TUTOR_SCRIPT', self.codes(checker.check_course(self.root)))
        file.write_text(file.read_text(encoding='utf-8') + '<script src="../assets/tutor.js"></script>', encoding='utf-8')
        self.assertTrue(checker.check_course(self.root)['structurally_valid'])
        self.assessment.write_text(nav('../') + quiz().replace(' data-save-key="q1"', ''), encoding='utf-8')
        self.assertIn('ASSESSMENT_UNSAVED', self.codes(checker.check_course(self.root)))

    def test_read_only_and_private_files_never_read(self):
        private = ['learner-submissions/entry-assessment.json', 'learner-chats/0001-intro.json', '.tutor-settings.json']
        for name in private:
            file = self.root / name
            file.parent.mkdir(exist_ok=True)
            file.write_bytes(b'\xffPRIVATE_DATA_NOT_HTML')
        original = Path.read_text

        def guarded(file, *args, **kwargs):
            if file.relative_to(self.root).as_posix() in private:
                raise AssertionError('Private file accessed')
            return original(file, *args, **kwargs)

        before = {file.relative_to(self.root): file.read_bytes() for file in self.root.rglob('*') if file.is_file()}
        with patch.object(Path, 'read_text', guarded):
            report = checker.check_course(self.root)
        self.assertTrue(report['structurally_valid'])
        after = {file.relative_to(self.root): file.read_bytes() for file in self.root.rglob('*') if file.is_file()}
        self.assertEqual(before, after)

    def test_structural_pass_does_not_claim_semantic_or_provider_validation(self):
        (self.root / 'index.html').write_text(nav() + '<p>点积只取决于方向。</p>', encoding='utf-8')
        report = checker.check_course(self.root)
        self.assertTrue(report['structurally_valid'])
        self.assertEqual(report['semantic_review'], 'not_performed')

    def test_reusable_quiz_fragment_keeps_style_and_behavior_structure(self):
        template = (SCRIPT.parents[1] / 'templates/quiz.html').read_text(encoding='utf-8')
        for correct in ('A', 'B'):
            values = {'QUIZ_SAVE_KEY': 'entry-q1', 'QUIZ_NAME': 'q1', 'QUIZ_CORRECT_ANSWER': correct,
                      'OPTION_A_IS_CORRECT': str(correct == 'A').lower(), 'OPTION_B_IS_CORRECT': str(correct == 'B').lower(),
                      'OPTION_A_FEEDBACK': '解释 A', 'OPTION_B_FEEDBACK': '解释 B', 'OPTION_A_TEXT': '选项 A', 'OPTION_B_TEXT': '选项 B'}
            html = re.sub(r'\{\{([A-Z_]+)\}\}', lambda match: values[match[1]], template)
            page = checker.inspect_html(html)
            self.assertEqual(page.issues, [])
            self.assertEqual(sum('quiz-options' in (node.attrs.get('class') or '').split() for node in page.nodes), 1)
            self.assertEqual(sum('quiz-option' in (node.attrs.get('class') or '').split() for node in page.nodes), 2)
            button = next(node for node in page.nodes if 'data-quiz-submit' in node.attrs)
            self.assertIn('quiz-submit', button.attrs['class'].split())

    def test_cli_exit_status_matches_machine_readable_report(self):
        result = subprocess.run([sys.executable, '-X', 'utf8', str(SCRIPT), str(self.root), '--json'], capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(result.returncode, 0)
        self.assertTrue(json.loads(result.stdout)['structurally_valid'])
        (self.root / 'settings.html').unlink()
        result = subprocess.run([sys.executable, '-X', 'utf8', str(SCRIPT), str(self.root), '--json'], capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(result.returncode, 1)
        self.assertFalse(json.loads(result.stdout)['structurally_valid'])

    def test_missing_markdown_dependency_is_a_deployment_failure(self):
        (self.root / 'assets/vendor/purify.min.js').unlink()
        report = checker.check_course(self.root)
        self.assertFalse(report['structurally_valid'])
        self.assertTrue(any('purify.min.js' in str(issue) for issue in report['issues']))

    def test_svg_fallback_and_wide_text_are_review_hints_not_semantic_failures(self):
        html = (nav() + '<link rel="stylesheet" href="assets/style.css">'
                '<figure class="visual-figure"><svg viewBox="0 0 720 460">'
                '<rect fill="var(--unknown-bg, #fff)"></rect>'
                '<text fill="var(--text)">图中文字</text></svg></figure>')
        (self.root / 'assets/style.css').write_text(':root { --text: #111; }', encoding='utf-8')
        (self.root / 'index.html').write_text(html, encoding='utf-8')
        report = checker.check_course(self.root)
        self.assertTrue(report['structurally_valid'])
        self.assertEqual(report['semantic_review'], 'not_performed')
        self.assertEqual({w['code'] for w in report['visual_warnings']}, {'SVG_COLOR_VAR', 'SVG_TEXT_SCALE'})
        self.assertIn('--unknown-bg', report['visual_warnings'][0]['message'])
        self.assertNotIn('--text', report['visual_warnings'][0]['message'])

    def test_svg_local_tokens_and_wide_container_clear_hints(self):
        html = (nav() + '<link rel="stylesheet" href="assets/style.css">'
                '<style>svg { --custom-fill: #fff; }</style>'
                '<figure class="visual-figure visual-figure--wide">'
                '<svg viewBox="0,0,720,460"><rect fill="var(--surface-2)"></rect>'
                '<text style="fill:var(--custom-fill)">文字</text></svg></figure>')
        (self.root / 'assets/style.css').write_text(':root { --surface-2: #eee; }', encoding='utf-8')
        (self.root / 'index.html').write_text(html, encoding='utf-8')
        self.assertEqual(checker.check_course(self.root)['visual_warnings'], [])

    def test_svg_hints_never_read_external_outside_or_private_styles(self):
        html = nav() + ''.join(f'<link rel="stylesheet" href="{url}">' for url in
                              ['https://example.test/styles.css', '../outside.css',
                               'learner-chats/private.css', 'assets/../learner-chats/private.css'])
        html += '<svg viewBox="invalid"><text fill="var(--unverified, #fff)">文字</text></svg>'
        private = self.root / 'learner-chats/private.css'
        private.parent.mkdir()
        private.write_bytes(b'\xffPRIVATE')
        (self.root / 'index.html').write_text(html, encoding='utf-8')
        original = Path.read_text
        def guarded(file, *args, **kwargs):
            if file == private:
                raise AssertionError('private stylesheet read')
            return original(file, *args, **kwargs)
        with patch.object(Path, 'read_text', guarded):
            report = checker.check_course(self.root)
        self.assertEqual([w['code'] for w in report['visual_warnings']], ['SVG_COLOR_VAR'])

    def test_no_svg_has_no_visual_warnings(self):
        self.assertEqual(checker.check_course(self.root)['visual_warnings'], [])


if __name__ == '__main__':
    unittest.main()
