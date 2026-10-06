"""Offline contract checks: no provider calls, credentials or audio generation."""
import base64
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch

MATERIALS = Path(__file__).resolve().parents[1] / 'example/competition-materials/rc12'
spec = importlib.util.spec_from_file_location('expressive_voice', MATERIALS / 'scripts/build_expressive_samples.py')
voice = importlib.util.module_from_spec(spec)
spec.loader.exec_module(voice)


class ExpressiveVoiceTests(unittest.TestCase):
    def setUp(self):
        self.plan = json.loads((MATERIALS / 'expressive-voice-plan.json').read_text(encoding='utf8'))

    def test_variants_compare_expression_not_speaker_or_text(self):
        bodies = [voice.payload(self.plan, variant) for variant in self.plan['variants']]
        self.assertEqual(len(bodies), 2)
        self.assertNotEqual(bodies[0]['input']['instructions'], bodies[1]['input']['instructions'])
        for body in bodies:
            self.assertEqual(body['model'], 'qwen3-tts-instruct-flash')
            self.assertEqual(body['input']['voice'], 'Serena')
            self.assertEqual(body['input']['text'], self.plan['text'])
            self.assertTrue(body['input']['optimize_instructions'])
            self.assertNotIn('Authorization', body)

    def test_character_budget_checked_before_request(self):
        for text in ['', '字' * 601]:
            self.plan['text'] = text
            with self.assertRaises(ValueError):
                voice.payload(self.plan, self.plan['variants'][0])

    def test_cached_only_missing_source_never_contacts_provider_or_reads_key(self):
        with tempfile.TemporaryDirectory() as output, \
             patch.object(voice.sys, 'argv', ['voice', output, '--cached-only', '--key-stdin']), \
             patch.object(voice.getpass, 'getpass') as read_key, \
             patch.object(voice.urllib.request, 'build_opener') as build:
            with self.assertRaisesRegex(RuntimeError, 'Matching cached source unavailable'):
                voice.main()
            read_key.assert_not_called()
            build.return_value.open.assert_not_called()

    def test_missing_peak_has_controlled_diagnostic(self):
        with patch.object(voice.subprocess, 'check_output', return_value='30.0'), \
             patch.object(voice.subprocess, 'run', return_value=Mock(stderr='不可解析的测量结果')):
            with self.assertRaisesRegex(RuntimeError, 'Audio peak measurement unavailable'):
                voice.check_audio(Path('中文试样.mp3'), 'ffmpeg', 'ffprobe')

    def test_inline_audio_is_decoded_without_download(self):
        opener = Mock()
        result = {'output': {'audio': {'data': base64.b64encode(b'RIFF-test').decode()}}}
        self.assertEqual(voice.audio_bytes(result, opener), b'RIFF-test')
        opener.open.assert_not_called()

    def test_audio_download_never_forwards_credentials(self):
        opener = MagicMock()
        opener.open.return_value.__enter__.return_value.read.return_value = b'RIFF-test'
        result = {'output': {'audio': {'url': 'http://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/audio.wav?Signature=test'}}}
        self.assertEqual(voice.audio_bytes(result, opener), b'RIFF-test')
        request = opener.open.call_args.args[0]
        self.assertTrue(request.full_url.startswith('https:'))
        self.assertFalse(request.has_header('Authorization'))

    def test_audio_locations_reject_foreign_and_non_http_destinations(self):
        opener = Mock()
        for url in ['file:///private.wav', 'https://example.com/audio.wav', 'https://user:pass@oss-cn-beijing.aliyuncs.com/audio.wav']:
            with self.assertRaises(RuntimeError):
                voice.audio_bytes({'output': {'audio': {'url': url}}}, opener)
        opener.open.assert_not_called()


if __name__ == '__main__':
    unittest.main()
