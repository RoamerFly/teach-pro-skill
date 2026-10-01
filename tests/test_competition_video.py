"""No-network timing checks for the continuous competition video pipeline."""
import json
import sys
import unittest
from pathlib import Path

MATERIALS = Path(__file__).resolve().parents[1] / 'example/competition-materials'
sys.path.insert(0, str(MATERIALS / 'scripts'))
from render_live_video import frame_schedule, loudness_measurement
from render_video import captions, clock


class CompetitionVideoTests(unittest.TestCase):
    def test_loudness_json_allows_ffmpeg_trailing_progress(self):
        measured = {'input_i': '-21.2', 'input_tp': '-5.1', 'input_lra': '1.3', 'input_thresh': '-31.2', 'target_offset': '0.1'}
        self.assertEqual(loudness_measurement('FFmpeg log\n' + json.dumps(measured) + '\nframe=final\n'), measured)

    def test_absolute_frame_schedule_has_no_cumulative_rounding_drift(self):
        scenes = [{'voice_start_seconds': index * 1.013, 'seconds': 1.013} for index in range(100)]
        schedule = frame_schedule(scenes)
        self.assertEqual(sum(frames for frames, _ in schedule), round(101.3 * 25))
        self.assertTrue(all(frames > 0 for frames, _ in schedule))
        for index, (_, start) in enumerate(schedule):
            self.assertEqual(start, sum(frames for frames, _ in schedule[:index]) / 25)

    def test_caption_chunks_preserve_text_and_sentence_interval(self):
        text = '先看懂这张图，' + '程序必须独立检查权限' * 5 + '。'
        boundaries = [{'text': text, 'offset': 10000000, 'duration': 80000000}]
        cues = list(captions(boundaries, delay=0))
        self.assertEqual(''.join(item[2] for item in cues), text)
        self.assertTrue(all(0 < len(item[2]) <= 28 for item in cues))
        self.assertEqual(cues[0][0], 1)
        self.assertAlmostEqual(cues[-1][1], 9)
        for previous, following in zip(cues, cues[1:]):
            self.assertAlmostEqual(previous[1], following[0])

    def test_subtitle_clock_carries_rounding_into_next_minute(self):
        self.assertEqual(clock(59.9999), '00:01:00,000')
        self.assertEqual(clock(59.9999, ass=True), '0:01:00.00')

    def test_public_script_is_progressive_and_continuous(self):
        plan = json.loads((MATERIALS / 'video-scenes.json').read_text(encoding='utf-8'))
        self.assertEqual(plan['voice_strategy'], 'continuous')
        self.assertEqual(plan['model'], 'deepseek-flash')
        ids = [item['id'] for item in plan['scenes']]
        self.assertEqual(ids, ['home', 'assessment', 'lesson', 'trust-gap', 'settings', 'connection', 'tutor-context', 'tutor-answer', 'followup', 'save', 'adaptive', 'closing'])
        self.assertEqual(len(ids), len(set(ids)))
        self.assertNotIn('sk-', json.dumps(plan))


if __name__ == '__main__':
    unittest.main()
