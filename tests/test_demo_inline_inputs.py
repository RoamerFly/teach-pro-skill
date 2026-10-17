import re
import subprocess
import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'teach-pro/scripts'))
from check_course import inspect_html, check_course
DEMO = ROOT / 'example/competition-demo-rc12'

class DemoInlineInputTests(unittest.TestCase):
    def test_all_four_lessons_are_valid_without_grouped_footer_answers(self):
        report = check_course(DEMO)
        self.assertTrue(report['structurally_valid'], report['issues'])
        self.assertFalse(report['visual_warnings'], report['visual_warnings'])
        for file in (DEMO / 'lessons').glob('*.html'):
            text = file.read_text(encoding='utf-8')
            page = inspect_html(text)
            footer = next(n for n in page.nodes if n.attrs.get('id') == 'learning-input')
            self.assertEqual(sum(n.tag == 'textarea' for n in footer.descendants()), 1)
            self.assertIn('本课疑难记录', text)
            self.assertNotIn('课末证据框', text)

    def test_pre_migration_ids_and_keys_survive(self):
        for file in (DEMO / 'lessons').glob('*.html'):
            before = subprocess.check_output(['git', 'show', 'd72deb6:' + file.relative_to(ROOT).as_posix()], cwd=ROOT).decode('utf-8')
            after = file.read_text(encoding='utf-8')
            for attribute in ('id', 'data-save-key'):
                pattern = attribute + r'="([^"]+)"'
                self.assertLessEqual(set(re.findall(pattern, before)), set(re.findall(pattern, after)))

    def test_open_cards_have_individual_answer_fields(self):
        for file in (DEMO / 'lessons').glob('*.html'):
            page = inspect_html(file.read_text(encoding='utf-8'))
            for node in page.nodes:
                if 'exercise-card' not in (node.attrs.get('class') or '').split(): continue
                children = list(node.descendants())
                if any('data-quiz' in n.attrs for n in children): continue
                self.assertTrue(any(n.tag == 'textarea' and n.attrs.get('data-save-key') for n in children), (file.name, node.line))

if __name__ == '__main__': unittest.main()
