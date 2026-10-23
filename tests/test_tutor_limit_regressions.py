"""Run the shipped offline response tests against source and deployed demo."""
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'teach-pro/scripts/test_response_limits.py'

class ShippedResponseRegressionTests(unittest.TestCase):
    def test_source_and_demo_runtimes(self):
        for runtime in (ROOT / 'teach-pro/assets/tutor_chat.py', ROOT / 'example/competition-demo-rc12/tutor_chat.py'):
            with self.subTest(runtime=str(runtime)):
                result = subprocess.run([sys.executable, '-B', '-X', 'utf8', str(SCRIPT), '--runtime', str(runtime)],
                                        capture_output=True, text=True, encoding='utf-8', timeout=45)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertIn('Ran 40 tests', result.stderr)

if __name__ == '__main__': unittest.main()
