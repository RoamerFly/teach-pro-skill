"""Exercise the shipped launcher with the interpreter running this test suite."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import venv


ASSETS = Path(__file__).resolve().parents[1] / 'teach-pro/assets'


class RuntimeLauncherTests(unittest.TestCase):
    def test_current_python_starts_course_and_preserves_arguments(self):
        launchers = ('start-course.cmd',) if os.name == 'nt' else ('start-course.sh', 'start-course.command')
        for name in launchers:
            with self.subTest(launcher=name), tempfile.TemporaryDirectory(prefix='teach-launcher-') as temporary:
                course = Path(temporary)
                shutil.copyfile(ASSETS / name, course / name)
                (course / 'serve_course.py').write_text(
                    'import json, sys\nfrom pathlib import Path\n'
                    'Path("launch.json").write_text(json.dumps({"version": list(sys.version_info[:2]), '
                    '"args": sys.argv[1:]}), encoding="utf-8")\n', encoding='utf-8')
                args = ['--no-browser', '--session-only', '--port', '0']
                command = ([os.environ.get('COMSPEC', 'cmd.exe'), '/d', '/c', name] if os.name == 'nt'
                           else ['sh', name])
                environment = dict(os.environ, PATH=str(Path(sys.executable).parent) + os.pathsep + os.environ.get('PATH', ''))
                result = subprocess.run(command + args, cwd=course, env=environment,
                                        stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=15)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                launched = json.loads((course / 'launch.json').read_text(encoding='utf-8'))
                self.assertEqual(launched['version'], list(sys.version_info[:2]))
                self.assertEqual(launched['args'], args)

    def test_existing_course_environment_with_spaces_starts_from_system_python(self):
        with tempfile.TemporaryDirectory(prefix='teach-runtime-') as temporary:
            course = Path(temporary) / 'course with spaces'
            course.mkdir()
            shutil.copyfile(ASSETS / 'serve_course.py', course / 'serve_course.py')
            venv.EnvBuilder(with_pip=False).create(course / '.teach-runtime')
            result = subprocess.run([sys.executable, '-X', 'utf8', '-B', str(course / 'serve_course.py'), '--help'],
                                    cwd=course, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=20)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn('Open the course with automatic local answer sync', result.stdout)
            self.assertFalse(result.stderr)


if __name__ == '__main__':
    unittest.main()
