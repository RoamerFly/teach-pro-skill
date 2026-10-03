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

    def test_stream_events_and_interrupted_text_are_saved_for_retry(self):
        events = []
        def interrupted(config, messages, emit):
            emit('已到达的正文')
            error = tutor.TutorError('回答中断', 502, {'code': 'stream_interrupted'})
            error.partial_content = '已到达的正文'
            raise error
        with patch.object(tutor, 'model_request', side_effect=interrupted), self.assertRaises(tutor.TutorError):
            tutor.chat(self.root, '0001-intro', {'message': '解释一下'}, emit=lambda event, data: events.append(event))
        self.assertEqual(events, ['pending', 'delta'])
        record = tutor.history(self.root, '0001-intro')
        self.assertEqual(record['messages'][-1]['content'], '已到达的正文')
        self.assertTrue(all(m['status'] == 'incomplete' for m in record['messages']))
        with patch.object(tutor, 'model_request', return_value=tutor.parse_answer(response('补充回答'))):
            restored = tutor.chat(self.root, '0001-intro', {'message': '解释一下', 'retry_id': record['messages'][0]['id']})
        self.assertEqual(len([m for m in restored['messages'] if m['role'] == 'user']), 1)
        self.assertEqual(restored['messages'][-1]['status'], 'complete')


class StreamTests(unittest.TestCase):
    @staticmethod
    def frame(text=None, reason=None, **delta):
        if text is not None:
            delta['content'] = text
        return ('data: ' + json.dumps({'choices': [{'index': 0, 'delta': delta, 'finish_reason': reason}]}, ensure_ascii=False) + '\r\n\r\n').encode()

    def stream(self, chunks, key=''):
        output = []
        remote = Mock()
        remote.read1.side_effect = chunks + [b'']
        return tutor.read_stream(remote, key, output.append), output

    def test_fragmented_utf8_crlf_and_cross_chunk_key_redaction(self):
        wire = b': heartbeat\r\n\r\n' + self.frame(reasoning_content='PRIVATE_REASONING')
        wire += self.frame('# 中文\n凭据：demo-') + self.frame('credential。讲解。') + self.frame(reason='stop') + b'data: [DONE]\r\n\r\n'
        answer, pieces = self.stream([wire[i:i+3] for i in range(0, len(wire), 3)], CONFIG['api_key'])
        self.assertEqual(answer['status'], 'complete')
        self.assertEqual(''.join(pieces), answer['content'])
        self.assertIn('[密钥已隐藏]', answer['content'])
        self.assertNotIn(CONFIG['api_key'], ''.join(pieces))
        self.assertNotIn('PRIVATE_REASONING', answer['content'])
        self.assertTrue(answer['diagnostics']['has_reasoning'])

    def test_eof_and_length_are_incomplete_and_usage_is_preserved(self):
        for end in [b'', self.frame(reason='length') + b'data: [DONE]\n\n']:
            answer, _ = self.stream([self.frame('半段中文'), end])
            self.assertEqual(answer['status'], 'incomplete')
        usage = b'data: {"choices":[],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}\n\n'
        answer, _ = self.stream([self.frame('正文'), self.frame(reason='stop'), usage, b'data: [DONE]\n\n'])
        self.assertEqual(answer['usage']['total_tokens'], 5)

    def test_reasoning_only_and_tools_remain_errors(self):
        for wire, code in [(self.frame(reasoning_content='PRIVATE') + self.frame(reason='stop'), 'reasoning_only'),
                           (self.frame(tool_calls=[{'id': 'call'}]), 'tools_unsupported')]:
            with self.subTest(code=code), self.assertRaises(tutor.TutorError) as raised:
                self.stream([wire, b'data: [DONE]\n\n'])
            self.assertEqual(raised.exception.diagnostics['code'], code)
            self.assertNotIn('PRIVATE', str(raised.exception))

    def test_malformed_and_timeout_keep_safe_partial_text(self):
        for ending in [b'data: not-json\n\n', TimeoutError()]:
            remote = Mock()
            remote.read1.side_effect = [self.frame('已经到达'), ending, b'']
            output = []
            with self.assertRaises(tutor.TutorError) as raised:
                tutor.read_stream(remote, '', output.append)
            self.assertEqual(raised.exception.partial_content, '已经到达')
            self.assertEqual(''.join(output), '已经到达')

    def test_reply_limit_stops_stream_and_never_sends_excess_text(self):
        answer, pieces = self.stream([self.frame('文' * (tutor.MAX_REPLY + 1))])
        self.assertEqual(answer['status'], 'incomplete')
        self.assertEqual(len(''.join(pieces)), tutor.MAX_REPLY)
        self.assertTrue(answer['diagnostics']['local_truncated'])

    def test_streaming_payload_and_json_fallback_use_one_request(self):
        remote = Mock(status=200)
        remote.getheader.return_value = 'application/json'
        remote.read1.side_effect = [json.dumps(response('兼容正文')).encode(), b'']
        connection = Mock()
        connection.getresponse.return_value = remote
        pieces = []
        with patch.object(tutor, 'connection', return_value=connection):
            answer = tutor.model_request(CONFIG, [], emit=pieces.append)
        payload = json.loads(connection.request.call_args.kwargs['body'])
        self.assertTrue(payload['stream'])
        self.assertEqual(pieces, ['兼容正文'])
        self.assertFalse(answer['diagnostics']['streaming'])
        connection.request.assert_called_once()

    def test_error_frame_does_not_reflect_provider_body(self):
        with self.assertRaises(tutor.TutorError) as raised:
            self.stream([b'data: {"error":"demo-credential private body"}\n\n'])
        self.assertNotIn('private body', str(raised.exception))
        self.assertNotIn(CONFIG['api_key'], str(raised.exception))

    def test_malformed_finish_reason_and_event_size_keep_partial(self):
        for ending in [self.frame(reason={}), b'data: ' + b'x' * (128 * 1024) + b'\n\n']:
            with self.subTest(size=len(ending)), self.assertRaises(tutor.TutorError) as raised:
                self.stream([self.frame('先前正文'), ending])
            self.assertEqual(raised.exception.partial_content, '先前正文')


if __name__ == '__main__':
    unittest.main()
