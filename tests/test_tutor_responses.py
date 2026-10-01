"""Response state, paired history and retry tests. No provider calls."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

FILE = Path(__file__).resolve().parents[1] / 'teach-pro/assets/tutor_chat.py'
spec = importlib.util.spec_from_file_location('responses_tutor', FILE)
tutor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tutor)
CONFIG = {'kind': 'deepseek', 'provider': 'Demo', 'model': 'deepseek-flash', 'mode': 'cloud',
          'base_url': 'https://api.deepseek.com', 'api_key': 'demo-credential', 'max_tokens': 4096}


def response(content='回答', reason='stop', **message):
    return {'choices': [{'message': {'content': content, **message}, 'finish_reason': reason}],
            'usage': {'prompt_tokens': 10, 'completion_tokens': 2, 'total_tokens': 12}}


class ResponseTests(unittest.TestCase):
    def test_complete_markdown_preserved_and_credential_redacted(self):
        answer = tutor.parse_answer(response('# 标题\n**内容** demo-credential'), CONFIG['api_key'])
        self.assertEqual(answer['status'], 'complete')
        self.assertIn('# 标题', answer['content'])
        self.assertNotIn(CONFIG['api_key'], answer['content'])

    def test_partial_answer_is_not_complete(self):
        answer = tutor.parse_answer(response('只生成了一部分', 'length'))
        self.assertEqual(answer['status'], 'incomplete')
        self.assertEqual(answer['diagnostics']['finish_reason'], 'length')
        self.assertTrue(answer['note'])

    def test_empty_reasoning_and_budget_errors_are_distinct(self):
        for payload, code in [(response('', 'length', reasoning_content='private thought'), 'budget_exhausted'),
                              (response(None, 'stop', reasoning_content='private thought'), 'reasoning_only'),
                              (response(''), 'empty_answer')]:
            with self.subTest(code=code), self.assertRaises(tutor.TutorError) as error:
                tutor.parse_answer(payload)
            self.assertEqual(error.exception.diagnostics['code'], code)
            self.assertNotIn('private thought', json.dumps(error.exception.diagnostics))

    def test_unsupported_shapes_filters_and_tools(self):
        for payload, code in [({}, 'response_shape'), ({'choices': []}, 'response_shape'),
                              (response('hidden', 'content_filter'), 'content_filter'),
                              (response(None, 'tool_calls'), 'tools_unsupported')]:
            with self.subTest(code=code), self.assertRaises(tutor.TutorError) as error:
                tutor.parse_answer(payload)
            self.assertEqual(error.exception.diagnostics['code'], code)

    def test_local_reply_limit_is_visible(self):
        result = tutor.parse_answer(response('文' * (tutor.MAX_REPLY + 1)))
        self.assertEqual(result['status'], 'incomplete')
        self.assertTrue(result['diagnostics']['local_truncated'])

    def test_provider_specific_payload_and_test_budget(self):
        messages = [{'role': 'user', 'content': '问题'}]
        self.assertEqual(tutor.request_payload(CONFIG, messages)['thinking'], {'type': 'disabled'})
        thinking = dict(CONFIG, thinking='enabled', max_tokens=8192)
        self.assertEqual(tutor.request_payload(thinking, messages)['thinking']['type'], 'enabled')
        self.assertEqual(tutor.request_payload(thinking, messages, True)['max_tokens'], 128)
        self.assertEqual(tutor.request_payload(thinking, messages, True)['thinking']['type'], 'disabled')
        for kind in ['custom', 'openai-compatible', 'ollama', 'openai']:
            result = tutor.request_payload(dict(CONFIG, kind=kind), messages)
            self.assertNotIn('thinking', result)
            self.assertIn('max_completion_tokens' if kind == 'openai' else 'max_tokens', result)

    def test_real_request_parser_diagnostics_without_request_body_logging(self):
        remote = Mock(status=200)
        remote.read1.side_effect = [json.dumps(response()).encode(), b'']
        connection = Mock()
        connection.getresponse.return_value = remote
        with patch.object(tutor, 'connection', return_value=connection):
            result = tutor.model_request(CONFIG, [{'role': 'user', 'content': '问题'}])
        self.assertEqual(result['diagnostics']['http_status'], 200)
        connection.close.assert_called_once()
        self.assertNotIn(CONFIG['api_key'], json.dumps(result))

    def test_http_failure_never_reads_or_reflects_upstream_body(self):
        connection = Mock()
        connection.getresponse.return_value = Mock(status=429)
        with patch.object(tutor, 'connection', return_value=connection), self.assertRaises(tutor.TutorError) as error:
            tutor.model_request(CONFIG, [])
        self.assertEqual(error.exception.diagnostics['http_status'], 429)
        connection.getresponse.return_value.read1.assert_not_called()
        connection.close.assert_called_once()

    def test_invalid_json_and_timeout_have_specific_errors(self):
        for effect, code in [(ValueError('bad json'), 'response_shape'), (TimeoutError(), 'timeout')]:
            connection = Mock()
            connection.getresponse.side_effect = effect
            with patch.object(tutor, 'connection', return_value=connection), self.assertRaises(tutor.TutorError) as error:
                tutor.model_request(CONFIG, [])
            self.assertEqual(error.exception.diagnostics['code'], code)

    def test_history_budget_keeps_only_complete_pairs_and_current_version(self):
        messages = []
        for i in range(8):
            messages.extend([{'role': 'user', 'status': 'complete', 'content': f'q{i}', 'context_version': 'v'},
                             {'role': 'assistant', 'status': 'complete', 'content': f'a{i}', 'context_version': 'v'}])
        result = tutor.recent_turns(messages, 'v')
        self.assertEqual(len(result), 10)
        self.assertEqual(result[0]['content'], 'q3')
        self.assertEqual([m['role'] for m in tutor.recent_turns(messages, 'v', budget=5)], ['user', 'assistant'])
        self.assertEqual(tutor.recent_turns(messages, 'new-version'), [])
        messages[-2]['status'] = 'incomplete'
        self.assertNotIn('a7', [m['content'] for m in tutor.recent_turns(messages, 'v')])


class ChatTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        (self.root / 'lessons').mkdir()
        (self.root / 'lessons/0001-intro.html').write_text('<main><h1>课文</h1><p>内容</p></main>', encoding='utf-8')
        tutor.CONFIG = dict(CONFIG)

    def tearDown(self):
        tutor.CONFIG = None
        self.directory.cleanup()

    def test_config_has_no_checkbox_gate_and_key_never_saved(self):
        result = tutor.configure(self.root, CONFIG)
        self.assertTrue(result['configured'])
        saved = (self.root / '.tutor-settings.json').read_text(encoding='utf-8')
        self.assertNotIn(CONFIG['api_key'], saved)
        self.assertEqual(result['settings']['thinking'], 'disabled')

    def test_failed_retry_reuses_question_and_preserves_original_time(self):
        with patch.object(tutor, 'model_request', side_effect=tutor.TutorError('预算耗尽', 502, {'code': 'budget_exhausted'})):
            with self.assertRaises(tutor.TutorError):
                tutor.chat(self.root, '0001-intro', {'message': '为什么？'})
        failed = tutor.history(self.root, '0001-intro')['messages'][0]
        with patch.object(tutor, 'model_request', return_value=tutor.parse_answer(response('# 解释'))):
            record = tutor.chat(self.root, '0001-intro', {'message': failed['content'], 'retry_id': failed['id']})
        self.assertEqual(len(record['messages']), 2)
        self.assertEqual(record['messages'][0]['time'], failed['time'])
        self.assertEqual(record['messages'][0]['attempts'], 2)
        self.assertTrue(all(m['status'] == 'complete' for m in record['messages']))

    def test_key_reused_only_for_same_destination(self):
        tutor.configure(self.root, CONFIG)
        update = dict(CONFIG, api_key='', max_tokens=8192)
        self.assertTrue(tutor.configure(self.root, update)['configured'])
        self.assertEqual(tutor.current_config()['api_key'], CONFIG['api_key'])
        with self.assertRaises(tutor.TutorError):
            tutor.configure(self.root, dict(update, base_url='https://another.example/v1'))
        with self.assertRaises(tutor.TutorError):
            tutor.configure(self.root, dict(update, thinking=[]))

    def test_partial_response_roundtrip_and_retry(self):
        with patch.object(tutor, 'model_request', return_value=tutor.parse_answer(response('半段', 'length'))):
            first = tutor.chat(self.root, '0001-intro', {'message': '解释一下'})
        self.assertEqual(tutor.history(self.root, '0001-intro')['messages'][-1]['status'], 'incomplete')
        with patch.object(tutor, 'model_request', return_value=tutor.parse_answer(response('完整解释'))):
            record = tutor.chat(self.root, '0001-intro', {'message': '解释一下', 'retry_id': first['messages'][0]['id']})
        self.assertEqual(len([m for m in record['messages'] if m['role'] == 'user']), 1)
        self.assertEqual(record['messages'][-1]['status'], 'complete')
        self.assertEqual(len(tutor.recent_turns(record['messages'], record['messages'][-1]['context_version'])), 2)

    def test_old_chat_schema_and_states_still_readable(self):
        record = {'schema': 1, 'course': self.root.name, 'lesson': '0001-intro', 'messages': [
            {'role': 'user', 'content': '旧问题', 'status': 'failed', 'time': 'unknown'}]}
        tutor.save_history(self.root, record)
        original = (self.root / 'learner-chats/0001-intro.json').read_bytes()
        loaded = tutor.history(self.root, '0001-intro')
        self.assertEqual(loaded['messages'][0]['content'], '旧问题')
        self.assertEqual(original, (self.root / 'learner-chats/0001-intro.json').read_bytes())
        with patch.object(tutor, 'model_request', return_value=tutor.parse_answer(response('补答'))):
            retried = tutor.chat(self.root, '0001-intro', {'message': '旧问题', 'retry_id': loaded['messages'][0]['id']})
        self.assertEqual(len(retried['messages']), 2)

    def test_stale_retry_and_unconfigured_request_rejected(self):
        with self.assertRaises(tutor.TutorError):
            tutor.chat(self.root, '0001-intro', {'message': '问题', 'retry_id': 'missing'})
        tutor.CONFIG = None
        with self.assertRaises(tutor.TutorError) as error:
            tutor.chat(self.root, '0001-intro', {'message': '问题'})
        self.assertEqual(error.exception.status, 409)
        self.assertFalse((self.root / 'learner-chats').exists())


if __name__ == '__main__':
    unittest.main()
