"""Exercise placement and persistence keys, independent of lesson wording."""
import sys
import tempfile
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'teach-pro/scripts'))
from build_example import build as build_minimal
from build_adaptive_example import build as build_adaptive
from check_course import inspect_html, check_course

class InlineExerciseTests(unittest.TestCase):
    def test_built_lessons_keep_answers_at_questions_and_footer_only_questions(self):
        with tempfile.TemporaryDirectory() as temp:
            minimal = build_minimal(Path(temp) / 'minimal', 'lesson')
            adaptive = build_adaptive(Path(temp) / 'adaptive')
            lessons = list(minimal.glob('lessons/*.html')) + list(adaptive.glob('*/lessons/*.html'))
            self.assertEqual(len(lessons), 7)
            for file in lessons:
                page = inspect_html(file.read_text(encoding='utf-8'))
                self.assertEqual(page.issues, [], str(file))
                footer = next(n for n in page.nodes if n.attrs.get('id') == 'learning-input')
                fields = [n for n in footer.descendants() if n.tag == 'textarea']
                self.assertEqual(len(fields), 1, str(file))
                self.assertTrue(fields[0].attrs['data-save-key'].endswith('-questions'))
                exercise = next(n for n in page.nodes if n.attrs.get('id') == 'lesson-evidence')
                self.assertIsNot(exercise.parent, footer)
                self.assertTrue(exercise.attrs['data-save-key'].endswith('-evidence'))
                self.assertFalse(any(n is exercise for n in footer.descendants()))
                self.assertNotIn('页尾', file.read_text(encoding='utf-8'))
            for course in [minimal, *(adaptive / p for p in ('start', 'case-a', 'case-b'))]:
                report = check_course(course)
                self.assertTrue(report['structurally_valid'], report['issues'])
                self.assertNotIn('GROUPED_ANSWERS', {w['code'] for w in report['visual_warnings']})

    def test_checker_detects_missing_hidden_and_unlabeled_answer_fields(self):
        cases = [('<p>题目</p>', 'EXERCISE_INPUT'),
                 ('<p>题目</p><details><summary>答案</summary></details><label for="x">回答</label><textarea id="x" data-save-key="x"></textarea>', 'EXERCISE_INPUT_ORDER'),
                 ('<p>题目</p><textarea id="x" data-save-key="x"></textarea>', 'EXERCISE_INPUT_LABEL')]
        for content, code in cases:
            with tempfile.TemporaryDirectory() as temp:
                course = build_minimal(Path(temp) / 'course', 'lesson')
                page = next((course / 'lessons').glob('*.html'))
                text = page.read_text(encoding='utf-8').replace('<article class="lesson-body">', '<article class="lesson-body"><section data-exercise="open">' + content + '</section>')
                page.write_text(text, encoding='utf-8')
                self.assertIn(code, {i['code'] for i in check_course(course)['issues']})

if __name__ == '__main__': unittest.main()
