"""Package example tests: deterministic outputs, no teaching-model claims."""
import importlib.util
from pathlib import Path
import re
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / 'teach-pro'


def load(name, file):
    import sys
    spec = importlib.util.spec_from_file_location(name, file)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


builder = load('example_builder', SKILL / 'scripts/build_example.py')
checker = load('example_checker', SKILL / 'scripts/check_course.py')


class SkillExampleTests(unittest.TestCase):
    def test_assessment_and_lesson_stages_have_valid_distinct_outputs(self):
        with tempfile.TemporaryDirectory(prefix='teach-example-test-') as temp:
            for stage, count in (('assessment', 3), ('lesson', 4)):
                course = builder.build(Path(temp) / stage, stage)
                report = checker.check_course(course)
                self.assertTrue(report['structurally_valid'], report['issues'])
                self.assertEqual(report['pages_checked'], count)
                self.assertEqual(report['assessment_counts'], {'choice': 1, 'open_inputs': 1})
                self.assertEqual(len(list(course.glob('lessons/*.html'))), count - 3)
                for name in ('learner-submissions', 'learner-chats', '.tutor-settings.json', '.teach-runtime'):
                    self.assertFalse((course / name).exists())
                for page in course.rglob('*.html'):
                    self.assertNotRegex(page.read_text(encoding='utf-8'), r'\{\{[A-Z_]+\}\}')
                self.assertEqual((course / 'assets/style.css').read_bytes(), (SKILL / 'assets/style.css').read_bytes())
                self.assertIn('data-course-key="statistics-campus-example"', (course / 'settings.html').read_text(encoding='utf-8'))

    def test_builder_refuses_overwrite_or_invalid_stage(self):
        with tempfile.TemporaryDirectory(prefix='teach-example-test-') as temp:
            path = Path(temp) / 'existing'
            path.mkdir()
            marker = path / 'preserve.txt'
            marker.write_text('unchanged')
            with self.assertRaises(ValueError):
                builder.build(path)
            self.assertEqual(marker.read_text(), 'unchanged')
            with self.assertRaises(ValueError):
                builder.build(Path(temp) / 'unused', 'invalid')
            self.assertFalse((Path(temp) / 'unused').exists())
        with self.assertRaises(ValueError):
            builder.build(SKILL / 'output-that-must-not-exist')

    def test_skill_document_links_resolve_within_package(self):
        # Validate links to maintained package resources, not historical repo records.
        for file in SKILL.rglob('*.md'):
            for target in re.findall(r'\]\(([^)]+)\)', file.read_text(encoding='utf-8')):
                if '://' in target or target.startswith('#'):
                    continue
                target = target.split('#')[0]
                if '*' in target or '{' in target:
                    continue
                path = (file.parent / target).resolve()
                self.assertTrue(path.is_relative_to(SKILL), f'{file.name}: {target}')
                self.assertTrue(path.is_file(), f'{file.name}: {target}')

    def test_all_example_sources_and_dependency_provenance_are_discoverable(self):
        entry = (SKILL / 'SKILL.md').read_text(encoding='utf-8')
        for target in ('./README.md', './CHANGELOG.md', './assets/vendor/README.md', './references/examples/statistics/README.md'):
            self.assertIn(f']({target})', entry)
        example = (builder.EXAMPLE / 'README.md').read_text(encoding='utf-8')
        for target in ('./assessment-questions.html', './lesson-body.html'):
            self.assertIn(f']({target})', example)


if __name__ == '__main__':
    unittest.main()
