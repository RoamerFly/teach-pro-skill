"""Offline checks for the architecture-enhanced competition materials."""
import hashlib
import json
from pathlib import Path
import re
import sys
import tempfile
import unittest
from unittest.mock import patch
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1] / 'example/competition-materials/rc12'
sys.path.insert(0, str(ROOT / 'scripts'))
import update_architecture_opening as opening


class ArchitectureMaterialsTests(unittest.TestCase):
    def test_video_matches_audit_and_keeps_contest_duration(self):
        audit = json.loads((ROOT / 'dialogue-video-audit.json').read_text(encoding='utf8'))
        video = ROOT / '学途智伴师生演示视频.mp4'
        self.assertEqual(audit['sha256'], hashlib.sha256(video.read_bytes()).hexdigest())
        self.assertEqual(audit['bytes'], video.stat().st_size)
        self.assertLess(audit['seconds'], 180)
        self.assertEqual(audit['full_decode'], 'pass')
        self.assertEqual(audit['new_provider_requests'], 0)
        voices=json.loads((ROOT/'audio/dialogue-voice-audit.json').read_text(encoding='utf8'))
        self.assertEqual(audit['new_speech_synthesis_requests'], voices['new_synthesis_requests'])
        self.assertTrue(audit['all_voice_segments_fresh'])
        self.assertEqual(audit['media_revision'], '2026-10-26-fresh-emotional-voices')
        self.assertEqual(audit['runtime_capture_audit']['new_provider_requests'], 0)
        figure = ROOT / 'assets/teach-pro-workflow-architecture-v2-connected.png'
        self.assertTrue(figure.is_file())

    def test_chapters_preserve_original_real_operations(self):
        plan = json.loads((ROOT / 'dialogue-video-chapters.json').read_text(encoding='utf8'))
        self.assertEqual([op['operation'] for op in plan['live_operations']], ['models','test','chat','chat'])
        self.assertEqual(len(plan['chapters']), 13)
        self.assertAlmostEqual(plan['chapters'][0]['seconds'], 17.44)
        self.assertEqual(plan['version'], '1.1.0-rc.16')  # Actual recording version; Skill may advance separately.
        for first, second in zip(plan['chapters'],plan['chapters'][1:]):
            self.assertAlmostEqual(first['start']+first['seconds'], second['start'])
        self.assertEqual(plan['roles']['student']['voice'], 'Chinese (Mandarin)_Gentleman')
        self.assertEqual(plan['roles']['teacher']['voice'], 'Chinese (Mandarin)_Wise_Women')

    def test_subtitles_are_ordered_and_within_film(self):
        text = (ROOT / '学途智伴师生演示字幕.srt').read_text(encoding='utf8')
        duration = json.loads((ROOT / 'dialogue-video-audit.json').read_text(encoding='utf8'))['seconds']
        def value(s):
            h,m,seconds = s.replace(',','.').split(':')
            return int(h)*3600 + int(m)*60 + float(seconds)
        previous = 0
        cues = re.findall(r'(\d\d:\d\d:\d\d,\d{3}) --> (\d\d:\d\d:\d\d,\d{3})',text)
        audit=json.loads((ROOT/'dialogue-video-audit.json').read_text(encoding='utf8'))
        self.assertEqual(len(cues), audit['subtitle_cues'])
        self.assertEqual(len(cues),78)
        for start, end in cues:
            self.assertGreaterEqual(value(start),previous-.002)
            self.assertLess(value(start),value(end))
            self.assertLessEqual(value(end),duration)
            previous = value(end)

    def test_document_embeds_exact_figure_and_synchronized_duration(self):
        expected = (ROOT / 'assets/teach-pro-workflow-architecture-v2-connected.png').read_bytes()
        with ZipFile(ROOT / '学途智伴技能说明文档.docx') as doc:
            self.assertIsNone(doc.testzip())
            self.assertTrue(any(doc.read(n)==expected for n in doc.namelist() if n.startswith('word/media/')))
            xml = doc.read('word/document.xml').decode()
            duration = round(json.loads((ROOT / 'dialogue-video-audit.json').read_text(encoding='utf8'))['seconds'])
            for phrase in ('工作流程与系统架构','教学 AI','课内 Tutor',f'{duration//60} 分 {duration%60} 秒','上下文设置','题后作答'):
                self.assertIn(phrase,xml)

    def test_nonempty_work_is_preserved_before_any_encode(self):
        with tempfile.TemporaryDirectory() as temp:
            work = Path(temp)
            sentinel = work / 'keep.txt'
            sentinel.write_text('keep',encoding='utf8')
            with patch.object(opening,'run') as encoder:
                with self.assertRaises(ValueError):
                    opening.build(work/'missing-source',work)
                encoder.assert_not_called()
            self.assertEqual(sentinel.read_text(encoding='utf8'),'keep')

    def test_unaccepted_source_cannot_replace_public_film(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp)/'source'
            (source/'render').mkdir(parents=True)
            (source/'voice-plan.json').write_text('{}',encoding='utf8')
            (source/'render/dialogue-final.mp4').write_bytes(b'unaccepted')
            with patch.object(opening,'run') as encoder:
                with self.assertRaisesRegex(ValueError,'not the accepted'):
                    opening.build(source,Path(temp)/'output')
                encoder.assert_not_called()


if __name__ == '__main__':
    unittest.main()
