"""Offline profile adaptation: real source paths, unchanged runtime, usable examples."""
import importlib.util
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
from zipfile import ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'example/competition-materials/rc12/scripts/package_submission.py'
spec = importlib.util.spec_from_file_location('release_profiles', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ReleaseProfileTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        names = subprocess.check_output(['git', 'ls-files', '-z', 'teach-pro'], cwd=ROOT).decode().split('\0')
        cls.files = {name: (ZipInfo(name), (ROOT / name).read_bytes()) for name in names if name}

    def test_normal_profile_is_byte_identical(self):
        actual, mapping = module.profile_files(self.files, 'normal_use')
        self.assertEqual(mapping, {})
        self.assertEqual(actual, self.files)
        module.validate_profile(actual, 'normal_use')

    def test_competition_metadata_structure_and_runtime_parity(self):
        actual, mapping = module.profile_files(self.files, 'competition_submit')
        header = actual['teach-pro/SKILL.md'][1].decode().split('\n---\n', 1)[0]
        fields = set(re.findall(r'^(\w+):', header, re.M))
        self.assertEqual(fields, {'name', 'description', 'name_cn', 'description_cn'})
        self.assertIn('面向大学生课程学习', header)
        self.assertEqual({name for name in actual if '/' not in name.removeprefix('teach-pro/')},
                         {'teach-pro/SKILL.md', 'teach-pro/README.md', 'teach-pro/CHANGELOG.md'})
        self.assertIn('teach-pro/references/specs/VERSION.md', actual)
        self.assertIn('teach-pro/assets/templates/quiz.html', actual)
        self.assertEqual(actual['teach-pro/agents/openai.yaml'], self.files['teach-pro/agents/openai.yaml'])
        for name, (_, source) in self.files.items():
            if name.startswith(('teach-pro/assets/', 'teach-pro/templates/')) or name.endswith('/check_course.py'):
                with self.subTest(name=name):
                    self.assertEqual(actual[mapping.get(name, name)][1], source)
        # Teaching body differs only in relocated references and template paths.
        body = actual['teach-pro/SKILL.md'][1].decode().split('\n---\n', 1)[1]
        reverted = body.replace('assets/templates/', 'templates/').replace('references/specs/', './')
        reverted = reverted.replace('(README.md)', '(./README.md)').replace('(CHANGELOG.md)', '(./CHANGELOG.md)')
        reverted = reverted.replace('(references/examples/', '(./references/examples/').replace('(assets/vendor/', '(./assets/vendor/')
        self.assertEqual(reverted, self.files['teach-pro/SKILL.md'][1].decode().split('\n---\n', 1)[1])
        module.validate_profile(actual, 'competition_submit')

    def test_relations_across_moved_spec_templates_and_examples(self):
        actual, _ = module.profile_files(self.files, 'competition_submit')
        html_spec = actual['teach-pro/references/specs/HTML-OUTPUT-SPEC.md'][1].decode()
        self.assertIn('(../../assets/templates/quiz.html)', html_spec)
        self.assertIn('(LOCAL-SYNC-SPEC.md)', html_spec)
        example = actual['teach-pro/references/examples/statistics/README.md'][1].decode()
        self.assertIn('(../../specs/LESSON-DELIVERY-POLICY.md)', example)
        self.assertIn('(../../../SKILL.md)', example)
        self.assertNotIn('`templates/', actual['teach-pro/SKILL.md'][1].decode())

    def test_missing_links_and_unknown_profiles_are_rejected(self):
        broken = dict(self.files)
        info, data = broken['teach-pro/SKILL.md']
        broken['teach-pro/SKILL.md'] = info, data + b'\n[Missing](./missing-file.md)\n'
        for profile in module.PROFILES:
            with self.subTest(profile=profile), self.assertRaisesRegex(ValueError, 'Broken'):
                module.profile_files(broken, profile)
        with self.assertRaisesRegex(ValueError, 'Unknown release profile'):
            module.profile_files(self.files, 'incorrect')

    def test_build_never_overwrites_existing_delivery(self):
        with tempfile.TemporaryDirectory(prefix='teach-profile-guard-') as temporary:
            root = Path(temporary)
            marker = root / 'keep.txt'
            marker.write_bytes(b'user-owned-delivery')
            with self.assertRaises(FileExistsError):
                module.build(root, profile='normal_use')
            self.assertEqual(marker.read_bytes(), b'user-owned-delivery')
        with self.assertRaisesRegex(ValueError, 'outside the Git repository'):
            module.build(ROOT / 'never-create-profile', profile='competition_submit')
        self.assertFalse((ROOT / 'never-create-profile').exists())

    def test_competition_example_builds_both_stages_after_relocation(self):
        actual, _ = module.profile_files(self.files, 'competition_submit')
        with tempfile.TemporaryDirectory(prefix='teach-profile-test-') as temporary:
            root = Path(temporary)
            zip_path = root / 'skill.zip'
            with ZipFile(zip_path, 'w') as archive:
                for name, (info, data) in actual.items():
                    module.write_member(archive, name, data, info)
            module.extract_archive(zip_path, root)
            for stage, pages in (('assessment', 3), ('lesson', 4)):
                course = root / stage
                result = subprocess.run([sys.executable, '-X', 'utf8', '-B',
                                         str(root / 'teach-pro/scripts/build_example.py'), str(course), '--stage', stage],
                                        capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                check = subprocess.run([sys.executable, '-X', 'utf8', '-B',
                                        str(root / 'teach-pro/scripts/check_course.py'), str(course), '--json'],
                                       capture_output=True, text=True)
                self.assertEqual(check.returncode, 0, check.stdout + check.stderr)
                self.assertEqual(len(list(course.rglob('*.html'))), pages)
                self.assertEqual((course / 'assets/style.css').read_bytes(), self.files['teach-pro/assets/style.css'][1])
                self.assertFalse((course / 'learner-submissions').exists())

    def test_complete_adaptive_example_builds_after_relocation(self):
        actual, _ = module.profile_files(self.files, 'competition_submit')
        with tempfile.TemporaryDirectory(prefix='teach-adaptive-profile-') as temporary:
            root = Path(temporary)
            archive_path = root / 'skill.zip'
            with ZipFile(archive_path, 'w') as archive:
                for name, (info, data) in actual.items():
                    module.write_member(archive, name, data, info)
            module.extract_archive(archive_path, root)
            output = root / 'showcase'
            result = subprocess.run([sys.executable, '-X', 'utf8', '-B',
                                     str(root / 'teach-pro/scripts/build_adaptive_example.py'), str(output)],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            for name, pages in (('start', 5), ('case-a', 6), ('case-b', 7)):
                course = output / name
                check = subprocess.run([sys.executable, '-X', 'utf8', '-B',
                                        str(root / 'teach-pro/scripts/check_course.py'), str(course), '--json'],
                                       capture_output=True, text=True)
                self.assertEqual(check.returncode, 0, check.stdout + check.stderr)
                self.assertEqual(len(list(course.rglob('*.html'))), pages)
                self.assertEqual((course / 'assets/style.css').read_bytes(), self.files['teach-pro/assets/style.css'][1])

    def test_packaged_showcase_is_ready_to_open_and_has_no_runtime_data(self):
        actual, _ = module.profile_files(self.files, 'competition_submit')
        members = module.build_showcase_members(actual)
        self.assertEqual(sum(name.endswith('.html') for name, _, _ in members), 19)
        self.assertIn('自适应教学案例/index.html', {name for name, _, _ in members})
        self.assertIn('自适应教学案例/case-b/synthetic-inputs/0001-answer.json', {name for name, _, _ in members})
        for name, info, data in members:
            module.check_member(name, data)
            if name.endswith(('.sh', '.command')):
                self.assertEqual(info.external_attr >> 16 & 0o777, 0o755)


if __name__ == '__main__':
    unittest.main()
