"""Check repository README presentation without changing teaching resources."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
README = (ROOT / 'README.md').read_text(encoding='utf-8')

class ReadmeVisualTests(unittest.TestCase):
    def test_all_local_links_and_images_exist(self):
        for target in re.findall(r'!?\[[^\]\n]*\]\(([^\s)]+)\)', README):
            if ':' not in target and not target.startswith('#'):
                self.assertTrue((ROOT / target.split('#', 1)[0]).exists(), target)

    def test_five_existing_images_have_descriptive_alt_text(self):
        images = re.findall(r'!\[([^\]]*)\]\(([^)]+)\)', README)
        self.assertEqual(len(images), 5)
        for alt, path in images:
            self.assertGreater(len(alt), 12)
            self.assertTrue((ROOT / path).is_file())

    def test_online_course_and_video_links_are_present(self):
        for suffix in ('/', '/#video', '/#experience'):
            self.assertIn('https://roamerfly.github.io/teach-pro-skill' + suffix, README)

    def test_model_settings_preview_is_collapsed(self):
        self.assertIn('<summary>查看统一模型与上下文设置界面</summary>', README)
        details = README.split('<details>', 1)[1].split('</details>', 1)[0]
        self.assertIn('settings-preview.png', details)

    def test_showcase_keeps_skill_identity_and_actual_capture_label(self):
        self.assertIn('自适应教学 Skill', README)
        self.assertIn('实际两轮回答', README)

if __name__ == '__main__': unittest.main()
