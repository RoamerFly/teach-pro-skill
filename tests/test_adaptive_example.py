"""Reproducible teaching-case artifacts; not evidence of model decisions."""
import hashlib
import importlib.util
import json
from pathlib import Path
import statistics
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'teach-pro/scripts/build_adaptive_example.py'
sys.path.insert(0, str(SCRIPT.parent))
try:
    spec = importlib.util.spec_from_file_location('adaptive_example', SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
finally:
    sys.path.pop(0)


def mad(values):
    center = statistics.mean(values)
    return statistics.mean(abs(value - center) for value in values)


class AdaptiveExampleTests(unittest.TestCase):
    def test_full_showcase_structure_and_frozen_runtime(self):
        with tempfile.TemporaryDirectory(prefix='teach-adaptive-test-') as temporary:
            output = module.build(Path(temporary) / 'showcase')
            self.assertEqual(len(list(output.rglob('*.html'))), 19)
            for branch, count in (('start', 5), ('case-a', 6), ('case-b', 7)):
                course = output / branch
                result = subprocess.run([sys.executable, '-X', 'utf8', '-B',
                                         str(SCRIPT.parent / 'check_course.py'), str(course), '--json'],
                                        capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual(json.loads(result.stdout)['pages_checked'], count)
                for name in ('style.css', 'course.js', 'sync.js', 'tutor.js', 'tutor-settings.js', 'tutor-markdown.js'):
                    self.assertEqual((course / 'assets' / name).read_bytes(), (ROOT / 'teach-pro/assets' / name).read_bytes())
                for name in ('serve_course.py', 'tutor_chat.py', 'credential_store.py'):
                    self.assertEqual((course / name).read_bytes(), (ROOT / 'teach-pro/assets' / name).read_bytes())
                for forbidden in ('learner-submissions', 'learner-chats', '.tutor-settings.json', '.teach-runtime'):
                    self.assertFalse((course / forbidden).exists())
                self.assertNotIn('{{', (course / 'lessons' / module.FIRST).read_text(encoding='utf-8'))
                for page in course.rglob('*.html'):
                    text = page.read_text(encoding='utf-8')
                    self.assertIn('data-visual-theme="field"', text)
                    self.assertIn('data-course-key="statistics-adaptive-', text)

    def test_branch_evidence_context_and_support_are_distinct(self):
        with tempfile.TemporaryDirectory(prefix='teach-adaptive-evidence-') as temporary:
            output = module.build(Path(temporary) / 'showcase')
            for case in ('a', 'b'):
                course = output / ('case-' + case)
                fixture = json.loads((course / 'synthetic-inputs/0001-answer.json').read_text(encoding='utf-8'))
                self.assertTrue(fixture['synthetic'])
                self.assertIsNone(fixture['saved_at'])
                self.assertEqual(fixture['course'], 'statistics-adaptive-' + case)
                self.assertEqual(fixture['context_sha256'], hashlib.sha256((course / 'lessons' / module.FIRST).read_bytes()).hexdigest())
                self.assertIn('教学后即时练习', fixture['conditions'])
                trace = (course / 'reference/decision-trace.html').read_text(encoding='utf-8')
                self.assertIn(fixture['fields']['lesson-0001-evidence'], trace)
                self.assertIn('synthetic-inputs/0001-answer.json', trace)
                self.assertIn('新课', (course / 'LEARNER-PROFILE.md').read_text(encoding='utf-8'))
            a = (output / 'case-a/lessons' / module.SECOND).read_text(encoding='utf-8')
            b = (output / 'case-b/lessons' / module.SECOND).read_text(encoding='utf-8')
            self.assertIn('改用分作单位', a)
            self.assertNotIn('先把乙组的每项距离', a)
            self.assertIn('先把乙组的每项距离', b)
            self.assertIn('第一步：14、18、20', b)
            self.assertFalse((output / 'case-a/lessons' / module.SUPPLEMENT).exists())
            supplement = (output / 'case-b/lessons' / module.SUPPLEMENT).read_text(encoding='utf-8')
            self.assertIn('data-lesson-kind="supplement" data-related-lesson="0001"', supplement)
            self.assertIn('data-save-key="lesson-0001-s01-evidence"', supplement)
            self.assertIn('data-save-key="lesson-0002-evidence"', b)
            self.assertIn('第 2 课', supplement)

    def test_numeric_examples_and_counterexamples_independently(self):
        source = json.loads((module.SOURCE / 'cases.json').read_text(encoding='utf-8'))
        data = source['task_data']
        self.assertEqual([statistics.mean(data[key]) for key in ('original', 'replacement', 'addition')], [40, 265, 232])
        self.assertEqual([statistics.median(data[key]) for key in ('original', 'replacement', 'addition')], [25, 25, 30])
        self.assertAlmostEqual(mad([18, 20, 20, 20, 22]), .8)
        self.assertEqual(mad([0, 10, 20, 30, 40]), 12)
        for values in ([0, 0, 0, 4, 6], [0, 0, 1, 1, 8]):
            self.assertEqual(statistics.mean(values), 2)
            self.assertAlmostEqual(mad(values), 2.4)
        self.assertAlmostEqual(mad([16, 18, 20, 22, 24]), 2.4)
        self.assertEqual(mad([10, 20, 20, 20, 30]), 4)
        self.assertAlmostEqual(mad([14, 18, 20, 22, 26]), 3.2)
        self.assertAlmostEqual(mad([12, 16, 20, 24, 28]), 4.8)
        self.assertEqual(statistics.median([5, 9, 13, 21, 520]), 13)
        self.assertEqual(statistics.median([5, 9, 13, 21, 52, 520]), 17)

    def test_selection_and_output_guards(self):
        with tempfile.TemporaryDirectory(prefix='teach-adaptive-guard-') as temporary:
            root = Path(temporary)
            output = module.build(root / 'single', 'a')
            self.assertTrue((output / 'case-a').is_dir())
            self.assertFalse((output / 'case-b').exists())
            original = (output / 'index.html').read_bytes()
            with self.assertRaises(ValueError):
                module.build(output)
            self.assertEqual((output / 'index.html').read_bytes(), original)
            with self.assertRaises(ValueError):
                module.build(root / 'unknown', 'invalid')
            self.assertFalse((root / 'unknown').exists())
        with self.assertRaises(ValueError):
            module.build(ROOT / 'teach-pro/never-create-adaptive')
        self.assertFalse((ROOT / 'teach-pro/never-create-adaptive').exists())

    def test_resources_are_precise_link_only_and_honestly_scoped(self):
        resources = json.loads((module.SOURCE / 'resources.json').read_text(encoding='utf-8'))
        self.assertEqual(len(resources['records']), 4)
        for record in resources['records']:
            self.assertTrue(record['url'].startswith('https://'))
            for key in ('task', 'location', 'budget', 'access', 'verification', 'reason'):
                self.assertTrue(record[key])
        for number in ('0001', '0002'):
            html = module.resources(number)
            self.assertIn('本课一手阅读与视频', html)
            self.assertIn('rel="noopener noreferrer"', html)
            self.assertNotIn('<iframe', html)
            self.assertNotIn('<video', html)


if __name__ == '__main__':
    unittest.main()
