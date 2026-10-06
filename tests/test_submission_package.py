"""Offline submission guard tests; no credentials or learner data involved."""
import importlib.util
import io
from pathlib import Path
import unittest
from zipfile import ZipFile

SCRIPT = Path(__file__).resolve().parents[1] / 'example/competition-materials/rc12/scripts/package_submission.py'
spec = importlib.util.spec_from_file_location('submission', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SubmissionGuardTests(unittest.TestCase):
    def test_private_and_traversal_paths_rejected(self):
        for name in ('../outside.md', '/outside.md', 'C:/outside.md', 'a\\b.md',
                     'a/learner-chats/chat.json', 'a/learner-submissions/answer.json',
                     'a/.teach-runtime/python.exe', 'a/.tutor-settings.json', 'a/.env'):
            with self.subTest(name=name), self.assertRaises(ValueError):
                module.check_member(name, b'{}')

    def test_credential_rejected_without_exposing_value(self):
        key = b'sk-' + b'x' * 32
        with self.assertRaisesRegex(ValueError, '^Possible credential in: lesson.md$'):
            module.check_member('lesson.md', key)

    def test_document_xml_is_scanned(self):
        buffer = io.BytesIO()
        with ZipFile(buffer, 'w') as doc:
            doc.writestr('word/document.xml', b'<w:t>sk-' + b'x' * 32 + b'</w:t>')
        with self.assertRaises(ValueError):
            module.check_member('document.docx', buffer.getvalue())

    def test_whitelist_preserves_skill_demo_and_evidence(self):
        self.assertEqual(module.remap('teach-pro/SKILL.md'), 'Skill技能包/teach-pro/SKILL.md')
        self.assertEqual(module.remap(module.DEMO + 'assets/style.css'), '课程Demo/assets/style.css')
        for name in (module.PREFIX + 'audio/teacher.mp3', '.git/config', 'example/other/index.html'):
            with self.assertRaises(ValueError):
                module.remap(name)

    def test_generated_zip_keeps_unix_mode(self):
        buffer = io.BytesIO()
        source = module.ZipInfo('start-course.command')
        source.external_attr = 0o100755 << 16
        with ZipFile(buffer, 'w') as archive:
            module.write_member(archive, 'start-course.command', b'#!/bin/sh\n', source)
        with ZipFile(buffer) as archive:
            self.assertEqual(archive.getinfo('start-course.command').create_system, 3)
            self.assertEqual(archive.getinfo('start-course.command').external_attr >> 16 & 0o777, 0o755)


if __name__ == '__main__':
    unittest.main()
