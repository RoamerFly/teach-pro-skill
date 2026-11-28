"""Release ZIPs, stable version checks, extraction boundaries and checksums."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from zipfile import ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('build_release', ROOT / 'scripts/build_release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class BuildReleaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        names = subprocess.check_output(['git','ls-files','-z','teach-pro'], cwd=ROOT).decode().split('\0')
        cls.files = {name: (ZipInfo(name), (ROOT/name).read_bytes()) for name in names if name}
        cls.version = next(line.split(':', 1)[1].strip() for line in
                           cls.files['teach-pro/VERSION.md'][1].decode().splitlines() if line.startswith('- Version:'))

    def test_packages_have_same_runtime_licenses_modes_and_verifiable_checksums(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / 'release'
            manifest = release.build_files(self.files, output, 'test-source', 'v'+self.version, extract=True)
            self.assertEqual(manifest['version'], self.version)
            for entry in manifest['archives']:
                archive_path = output / entry['file']
                self.assertEqual(entry['sha256'], hashlib.sha256(archive_path.read_bytes()).hexdigest())
                with ZipFile(archive_path) as archive:
                    self.assertIsNone(archive.testzip())
                    self.assertEqual(archive.read('teach-pro/UPSTREAM-LICENSE'), self.files['teach-pro/UPSTREAM-LICENSE'][1])
                    for name in ['serve_course.py','tutor_chat.py','credential_store.py','start-course.cmd','start-course.sh','start-course.command']:
                        member = 'teach-pro/assets/' + name
                        self.assertEqual(archive.read(member), self.files[member][1])
                        if name.endswith(('.sh','.command')):
                            self.assertEqual((archive.getinfo(member).external_attr >> 16) & 0o777, 0o755)
                self.assertTrue((output / entry['profile'] / 'teach-pro/SKILL.md').is_file())
            for line in (output/'SHA256SUMS').read_text().splitlines():
                sha, name = line.split('  ',1)
                self.assertEqual(sha, hashlib.sha256((output/name).read_bytes()).hexdigest())

    def test_same_source_builds_identical_archives(self):
        with tempfile.TemporaryDirectory() as temporary:
            first = release.build_files(self.files, Path(temporary)/'a', 'source')
            second = release.build_files(self.files, Path(temporary)/'b', 'source')
            self.assertEqual(first,second)

    def test_tag_mismatch_is_rejected_before_writing(self):
        with tempfile.TemporaryDirectory() as temporary:
            target=Path(temporary)/'release'
            with self.assertRaises(ValueError): release.build_files(self.files,target,'source','v9999.0.0')
            self.assertFalse(target.exists())

    def test_prerelease_version_is_rejected(self):
        files=dict(self.files)
        info,data=files['teach-pro/VERSION.md']
        files['teach-pro/VERSION.md']=(info,data.replace(self.version.encode(),(self.version+'-preview.1').encode()))
        with tempfile.TemporaryDirectory() as temporary, self.assertRaises(ValueError):
            release.build_files(files,Path(temporary)/'release','source')

    def test_private_data_and_traversal_paths_are_excluded(self):
        for name in ['../escape','/absolute','C:/drive','teach-pro/learner-chats/a.json','teach-pro/.env','teach-pro/__pycache__/a.pyc']:
            with self.subTest(name=name), self.assertRaises(ValueError):release.check_member(name,b'{}')
        with self.assertRaises(ValueError):release.check_member('teach-pro/config.txt',b'sk-'+b'x'*32)

    def test_extraction_rejects_traversal_without_writing(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            with ZipFile(root/'bad.zip','w') as archive:archive.writestr('../escape','x')
            with self.assertRaises(ValueError):release.extract_archive(root/'bad.zip',root/'out')
            self.assertFalse((root/'escape').exists())


if __name__=='__main__':unittest.main()
