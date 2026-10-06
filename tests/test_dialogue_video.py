"""Offline subtitle and actual-answer preservation checks for the demo video."""
import importlib.util
import sys
import struct
import unittest
from unittest.mock import patch
from pathlib import Path

SCRIPTS=Path(__file__).resolve().parents[1]/'example/competition-materials/rc12/scripts'
sys.path.insert(0,str(SCRIPTS))
spec=importlib.util.spec_from_file_location('dialogue_video',SCRIPTS/'make_dialogue_video.py')
video=importlib.util.module_from_spec(spec)
spec.loader.exec_module(video)


class DialogueVideoTests(unittest.TestCase):
    def test_unmodified_playback_reuses_source(self):
        with patch.object(video,'run') as command:
            self.assertEqual(video.playback_clip(Path('source.wav'),Path('playback.wav')),Path('source.wav'))
            command.assert_not_called()

    def test_playback_uses_pitch_preserving_tempo_and_separate_target(self):
        with patch.object(video,'run') as command:
            target=Path('playback.wav')
            self.assertEqual(video.playback_clip(Path('source.wav'),target,1.08),target)
            args=command.call_args.args
            self.assertEqual(args[args.index('-af')+1],'atempo=1.08')
            self.assertEqual(args[-1],target)

    def test_excessive_or_invalid_tempo_is_rejected(self):
        for tempo in (0.9,1.16,float('nan'),float('inf'),True,'1.08'):
            with self.subTest(tempo=tempo),patch.object(video,'run') as command:
                with self.assertRaises(RuntimeError): video.playback_clip(Path('a'),Path('b'),tempo)
                command.assert_not_called()

    def test_playback_never_overwrites_provider_source(self):
        with patch.object(video,'run') as command:
            with self.assertRaises(RuntimeError): video.playback_clip(Path('a.wav'),Path('a.wav'),1.08)
            command.assert_not_called()

    def test_spoken_live_answer_only_removes_markdown(self):
        text='### 原因\n模型仅看 **本次请求** 的 `messages`。\n带回历史才能延续上下文。'
        self.assertEqual(video.plain_answer(text),'原因\n模型仅看 本次请求 的 messages。\n带回历史才能延续上下文。')

    def test_code_answer_is_not_silently_rewritten(self):
        with self.assertRaises(RuntimeError):
            video.plain_answer('```python\nmessages = []\n```')

    def test_caption_chunks_preserve_text_and_stay_short(self):
        text='学途智伴，是一个 Skill 技能包。'+ '解释要保留完整原文'*8+'！'
        chunks=video.subtitle_parts(text)
        self.assertEqual(''.join(chunks),text)
        self.assertTrue(all(len(c)<=26 for c in chunks))

    def test_subtitle_rounding_carries(self):
        self.assertEqual(video.stamp(59.9999),'00:01:00,000')
        self.assertEqual(video.stamp(59.9999,True),'0:01:00.00')

    def test_streaming_wave_repair_preserves_all_pcm_samples(self):
        pcm=bytes(range(20))
        header=b'RIFF'+struct.pack('<I',0x7fffffbf)+b'WAVEfmt '+struct.pack('<IHHIIHH',16,1,1,24000,48000,2,16)+b'data'+struct.pack('<I',0x7fffff9b)
        fixed=video.canonical_pcm_wave(header+pcm)
        self.assertEqual(fixed[44:],pcm)
        self.assertEqual(struct.unpack_from('<I',fixed,4)[0],len(fixed)-8)
        self.assertEqual(struct.unpack_from('<I',fixed,40)[0],len(pcm))
        self.assertEqual(video.canonical_pcm_wave(fixed),fixed)
        with self.assertRaises(RuntimeError): video.canonical_pcm_wave(header+pcm+b'\x00')


if __name__=='__main__':
    unittest.main()
