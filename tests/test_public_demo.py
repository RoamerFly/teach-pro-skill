import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('public_demo', ROOT / 'scripts/build_public_demo.py')
MODULE = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(MODULE)

class PublicDemoTests(unittest.TestCase):
    def test_browser_course_records_not_selected(self):
        with self.assertRaises(ValueError): MODULE.check_public('course/learner-submissions/a.json', b'{}')
    def test_runtime_not_selected(self):
        with self.assertRaises(ValueError): MODULE.check_public('course/.teach-runtime/key', b'{}')
    def test_credential_pattern_rejected(self):
        with self.assertRaises(ValueError): MODULE.check_public('a.txt', b'sk-' + b'x' * 32)
    def test_private_key_rejected(self):
        with self.assertRaises(ValueError): MODULE.check_public('a.txt', b'-----BEGIN PRIVATE KEY-----')
    def test_relative_links(self):
        MODULE.validate({'index.html': b'<a href="course/index.html#go">go</a>', 'course/index.html': b'<a href="../index.html">back</a>'})
    def test_missing_link_rejected(self):
        with self.assertRaises(ValueError): MODULE.validate({'index.html': b'<img src="missing.png">'})
    def test_project_absolute_link_rejected(self):
        with self.assertRaises(ValueError): MODULE.validate({'index.html': b'<a href="/course/">go</a>'})
    def test_external_links_allowed(self):
        MODULE.validate({'index.html': b'<a href="https://example.com/">go</a>'})
    def test_adapter_is_only_in_showcase(self):
        self.assertFalse((ROOT / 'teach-pro/assets/preview.js').exists())
        self.assertIn('downloaded course retains its original runtime', (ROOT / 'example/competition-pages/assets/preview.js').read_text(encoding='utf-8'))

if __name__ == '__main__': unittest.main()
