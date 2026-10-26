"""Native speech parameters and the committed measured performance contract."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import unittest

BASE=Path(__file__).resolve().parents[1]/'example/competition-materials/rc12'
sys.path.insert(0,str(BASE/'scripts'))
spec=importlib.util.spec_from_file_location('fresh_voice',BASE/'scripts/regenerate_expressive_voice.py')
voice=importlib.util.module_from_spec(spec);spec.loader.exec_module(voice)


class EmotionalVideoTests(unittest.TestCase):
    def setUp(self):
        self.plan=json.loads((BASE/'emotional-performance-plan.json').read_text(encoding='utf-8'))

    def test_both_roles_receive_real_native_controls(self):
        for role in ('student','teacher'):
            body=voice.request_payload({'text':'问得好！','speed':1.2,'emotion':'happy'},role)
            self.assertEqual(body['model'],'MiniMax/speech-2.8-hd')
            self.assertEqual(body['input']['voice_setting']['emotion'],'happy')
            self.assertEqual(body['input']['voice_setting']['speed'],1.2)
            self.assertNotIn('instructions',body['input'])
        self.assertNotEqual(voice.request_payload({'text':'你好','speed':1.2},'student')['input']['voice_setting']['voice_id'],
                            voice.request_payload({'text':'你好','speed':1.2},'teacher')['input']['voice_setting']['voice_id'])

    def test_measured_dialogue_fits_each_chapter_and_captions_do_not_overlap(self):
        total=0;count=0
        for scene in self.plan['scenes']:
            self.assertAlmostEqual(scene['start'],total)
            previous=0
            for cue in scene['subtitle_cues']:
                self.assertLessEqual(previous,cue['start']+.002)
                self.assertLess(cue['start'],cue['end'])
                self.assertLessEqual(cue['end']+.19,scene['seconds'])
                previous=cue['end']
            for turn in scene['turns']:
                self.assertEqual(turn['spoken_text'],''.join(g['text'] for g in turn['segments']))
                count+=len(turn['segments'])
            total+=scene['seconds']
        self.assertEqual(count,32)
        self.assertLess(total,180)

    def test_actual_model_answers_are_preserved_verbatim(self):
        recorded=json.loads((BASE/'dialogue-video-chapters.json').read_text(encoding='utf-8'))
        hashes=[op['answer_sha256'] for op in recorded['live_operations'] if op['operation']=='chat']
        actual=[t['spoken_text'] for s in self.plan['scenes'] for t in s['turns'] if t['source']=='live-answer']
        self.assertEqual([hashlib.sha256(t.encode()).hexdigest() for t in actual],hashes)

    def test_public_plan_contains_no_private_file_paths(self):
        for scene in self.plan['scenes']:
            for turn in scene['turns']:
                for segment in turn['segments']:
                    self.assertEqual(Path(segment['file']).name,segment['file'])
                    self.assertRegex(segment['sha256'],r'^[a-f0-9]{64}$')
                    self.assertGreater(segment['seconds'],.2)


if __name__=='__main__':unittest.main()
