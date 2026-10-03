"""Default deployment is inert until the learner explicitly configures AI."""
import importlib.util
import json
import tempfile
import threading
import time
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ASSETS = Path(__file__).resolve().parents[1] / 'teach-pro' / 'assets'


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


tutor = load('defaults_tutor', ASSETS / 'tutor_chat.py')
server = load('defaults_server', ASSETS / 'serve_course.py')
server.tutor_chat = tutor


class DefaultTutorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / 'lessons').mkdir()
        (self.root / 'practice').mkdir()
        (self.root / 'lessons/0001-intro.html').write_text(
            '<main><h1>Lesson</h1><p>Teaching content</p></main>', encoding='utf-8')
        (self.root / 'practice/entry-assessment.html').write_text('<main>Assessment</main>', encoding='utf-8')
        (self.root / 'settings.html').write_text(
            (ASSETS / 'course-settings.html').read_text(encoding='utf-8'), encoding='utf-8')
        server.ROOT = self.root
        server.SUBMISSIONS = self.root / 'learner-submissions'
        tutor.CONFIG = None
        self.service = ThreadingHTTPServer(('127.0.0.1', 0), server.CourseHandler)
        self.thread = threading.Thread(target=self.service.serve_forever, daemon=True)
        self.thread.start()
        self.base = f'http://127.0.0.1:{self.service.server_port}'

    def tearDown(self):
        self.service.shutdown()
        self.service.server_close()
        self.thread.join(2)
        tutor.CONFIG = None
        self.temp.cleanup()

    def request(self, route, data=None, token=''):
        headers = {'Origin': self.base, 'Sec-Fetch-Site': 'same-origin', 'X-Teach-Token': token}
        body = None
        if data is not None:
            headers['Content-Type'] = 'application/json'
            body = json.dumps(data).encode()
        with urlopen(Request(self.base + route, data=body, headers=headers), timeout=5) as response:
            return json.load(response)

    def test_default_browsing_has_no_provider_calls_or_empty_chat_files(self):
        with patch.object(tutor, 'connection', side_effect=AssertionError('Unexpected provider request')) as connection:
            with urlopen(self.base + '/settings.html', timeout=5) as response:
                self.assertEqual(response.status, 200)
            boot = self.request('/api/tutor/bootstrap')
            self.assertFalse(boot['configured'])
            self.assertEqual(boot['settings'], {})
            token = boot['token']
            self.assertIn('Teaching content', self.request('/api/tutor/context/0001-intro', token=token)['text'])
            self.assertEqual(self.request('/api/tutor/history/0001-intro', token=token)['messages'], [])
            connection.assert_not_called()
        self.assertFalse((self.root / 'learner-chats').exists())
        self.assertFalse((self.root / '.tutor-settings.json').exists())

    def test_answer_sync_works_without_model_configuration(self):
        fields = {'entry-q1': 'My own answer'}
        result = self.request('/api/submissions/entry-assessment', {'fields': fields})
        self.assertTrue(result['ok'])
        saved = json.loads((self.root / 'learner-submissions/entry-assessment.json').read_text(encoding='utf-8'))
        self.assertEqual(saved['fields'], fields)
        self.assertFalse(self.request('/api/tutor/bootstrap')['configured'])

    def test_unconfigured_chat_is_rejected_without_writing_or_calling_provider(self):
        token = self.request('/api/tutor/bootstrap')['token']
        with patch.object(tutor, 'connection', side_effect=AssertionError('Unexpected provider request')) as connection:
            with self.assertRaises(HTTPError) as raised:
                self.request('/api/tutor/chat/0001-intro', {'message': 'Help?', 'consent': True}, token)
            self.assertEqual(raised.exception.code, 409)
            raised.exception.close()
            connection.assert_not_called()
        self.assertFalse((self.root / 'learner-chats').exists())

    def test_stream_flushes_before_completion_and_survives_reader_disconnect(self):
        tutor.CONFIG = {'kind': 'custom', 'provider': 'Synthetic', 'model': 'demo', 'mode': 'local',
                        'base_url': 'http://127.0.0.1:11434/v1', 'api_key': '', 'max_tokens': 4096}
        token = self.request('/api/tutor/bootstrap')['token']
        release = threading.Event()
        def model(config, messages, emit):
            emit('分段中文')
            if not release.wait(3):
                raise AssertionError('reader did not release synthetic model')
            return tutor.parse_answer({'choices': [{'message': {'content': '分段中文完整回答'}, 'finish_reason': 'stop'}]})
        headers = {'Origin': self.base, 'Sec-Fetch-Site': 'same-origin', 'X-Teach-Token': token, 'Content-Type': 'application/json'}
        request = Request(self.base + '/api/tutor/chat-stream/0001-intro', data=b'{"message":"Help?"}', headers=headers)
        with patch.object(tutor, 'model_request', side_effect=model):
            try:
                reader = urlopen(request, timeout=5)
                self.assertIn('application/x-ndjson', reader.headers['Content-Type'])
                self.assertEqual(json.loads(reader.readline())['event'], 'pending')
                self.assertEqual(json.loads(reader.readline()), {'event': 'delta', 'data': {'text': '分段中文'}})
                self.assertEqual(tutor.history(self.root, '0001-intro')['messages'][0]['status'], 'pending')
                with self.assertRaises(HTTPError) as raised:
                    self.request('/api/tutor/forget', {}, token)
                self.assertEqual(raised.exception.code, 409)
                raised.exception.close()
                reader.close()
            finally:
                release.set()
            for _ in range(100):
                saved = tutor.history(self.root, '0001-intro')
                if saved['messages'][-1]['role'] == 'assistant':
                    break
                time.sleep(.02)
            self.assertEqual(saved['messages'][-1]['content'], '分段中文完整回答')
            self.assertEqual(saved['messages'][-1]['status'], 'complete')

    def test_stream_validation_errors_remain_json_and_do_not_create_records(self):
        token = self.request('/api/tutor/bootstrap')['token']
        for credential, code in [('', 403), (token, 409)]:
            with self.subTest(code=code), self.assertRaises(HTTPError) as raised:
                self.request('/api/tutor/chat-stream/0001-intro', {'message': 'Help?'}, credential)
            self.assertEqual(raised.exception.code, code)
            raised.exception.close()
        self.assertFalse((self.root / 'learner-chats').exists())

    def test_stream_never_reports_done_when_final_save_fails(self):
        tutor.CONFIG = {'kind': 'custom', 'provider': 'Synthetic', 'model': 'demo', 'mode': 'local',
                        'base_url': 'http://127.0.0.1:11434/v1', 'api_key': '', 'max_tokens': 4096}
        token = self.request('/api/tutor/bootstrap')['token']
        save = tutor.save_history
        def write(root, record):
            if any(m['role'] == 'assistant' for m in record['messages']):
                raise OSError('synthetic save failure')
            save(root, record)
        def model(config, messages, emit):
            emit('回答正文')
            return tutor.parse_answer({'choices': [{'message': {'content': '回答正文'}, 'finish_reason': 'stop'}]})
        headers = {'Origin': self.base, 'Sec-Fetch-Site': 'same-origin', 'X-Teach-Token': token, 'Content-Type': 'application/json'}
        request = Request(self.base + '/api/tutor/chat-stream/0001-intro', data=b'{"message":"Help?"}', headers=headers)
        with patch.object(tutor, 'model_request', side_effect=model), patch.object(tutor, 'save_history', side_effect=write):
            with urlopen(request, timeout=5) as reader:
                events = [json.loads(line) for line in reader]
        self.assertEqual([item['event'] for item in events], ['pending', 'delta', 'error'])
        self.assertEqual(tutor.history(self.root, '0001-intro')['messages'][0]['status'], 'pending')


if __name__ == '__main__':
    unittest.main()
