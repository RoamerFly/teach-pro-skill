"""Uncapped answer persistence, automatic budgets and explicit continuation."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

ASSETS = Path(__file__).resolve().parents[1] / 'teach-pro/assets'
sys.path.insert(0, str(ASSETS))
spec = importlib.util.spec_from_file_location('continuation_tutor', ASSETS / 'tutor_chat.py')
tutor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tutor)


def answer(text, reason='stop'):
    return tutor.parse_answer({'choices': [{'message': {'content': text}, 'finish_reason': reason}]})


class ContinuationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='teach-continue-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'lessons').mkdir()
        self.lesson = self.root / 'lessons/0001-intro.html'
        self.lesson.write_text('<main><h1>测试课</h1><p>当前正文</p></main>', encoding='utf-8')
        self.config = {'kind': 'custom', 'provider': 'offline', 'model': 'mock', 'api_key': '',
                       'mode': 'local', 'base_url': 'http://127.0.0.1:11434/v1', 'max_tokens': None}
        self.current = patch.object(tutor, 'current_config', return_value=self.config)
        self.current.start(); self.addCleanup(self.current.stop)

    def partial(self, text='已讲的部分'):
        with patch.object(tutor, 'model_request', return_value=answer(text, 'length')):
            return tutor.chat(self.root, '0001-intro', {'message': '原来的问题', 'selection': '选中的概念'})

    def test_default_budget_omits_parameter_for_every_kind(self):
        for kind in tutor.KINDS:
            payload = tutor.request_payload(dict(self.config, kind=kind), [])
            self.assertNotIn('max_tokens', payload)
            self.assertNotIn('max_completion_tokens', payload)

    def test_explicit_budget_and_test_budget_are_kept(self):
        for kind in tutor.KINDS:
            config = dict(self.config, kind=kind, max_tokens=131072)
            parameter = tutor.KINDS[kind]['token_parameter']
            self.assertEqual(tutor.request_payload(config, [])[parameter], 131072)
            self.assertEqual(tutor.request_payload(config, [], testing=True)[parameter], 128)

    def test_budget_validation(self):
        for value in (None, 1, 4096, 131072): self.assertTrue(tutor.valid_budget(value))
        for value in (0, -1, True, False, '4096', 1.5): self.assertFalse(tutor.valid_budget(value))

    def test_no_request_until_explicit_continuation(self):
        with patch.object(tutor, 'model_request', return_value=answer('一半', 'length')) as call:
            record = tutor.chat(self.root, '0001-intro', {'message': '问题'})
            tutor.history(self.root, '0001-intro')
        self.assertEqual(call.call_count, 1)
        self.assertEqual(record['messages'][-1]['status'], 'incomplete')

    def test_continuation_receives_original_selection_and_all_partial_text(self):
        partial = '前文🙂𠮷' * 10000
        record = self.partial(partial)
        before = record['messages'][-1].copy()
        with patch.object(tutor, 'model_request', return_value=answer('接着讲完')) as model:
            result = tutor.chat(self.root, '0001-intro', {'message': '请继续回答', 'continue_id': before['reply_to']})
        sent = model.call_args.args[1]
        self.assertIn('原来的问题', sent[-3]['content'])
        self.assertIn('选中的概念', sent[-3]['content'])
        self.assertEqual(sent[-2], {'role': 'assistant', 'content': partial})
        self.assertIn('不要重复', sent[-1]['content'])
        self.assertEqual(result['messages'][1], before)
        self.assertEqual(result['messages'][-2]['continues'], before['reply_to'])
        self.assertEqual(result['messages'][-1]['status'], 'complete')
        self.assertEqual(tutor.history(self.root, '0001-intro')['messages'], result['messages'])

    def test_stale_continuation_is_rejected_without_call_or_write(self):
        self.partial()
        file = self.root / 'learner-chats/0001-intro.json'
        before = file.read_bytes()
        with patch.object(tutor, 'model_request') as model, self.assertRaises(tutor.TutorError):
            tutor.chat(self.root, '0001-intro', {'message': '继续', 'continue_id': 'stale'})
        model.assert_not_called(); self.assertEqual(file.read_bytes(), before)

    def test_changed_lesson_cannot_continue_old_context(self):
        record = self.partial()
        self.lesson.write_text('<main>新版本课文</main>', encoding='utf-8')
        with patch.object(tutor, 'model_request') as model, self.assertRaises(tutor.TutorError):
            tutor.chat(self.root, '0001-intro', {'message': '继续', 'continue_id': record['messages'][-1]['reply_to']})
        model.assert_not_called()

    def test_retry_failed_continuation_retains_its_context(self):
        record = self.partial()
        with patch.object(tutor, 'model_request', side_effect=tutor.TutorError('离线', 502)), self.assertRaises(tutor.TutorError):
            tutor.chat(self.root, '0001-intro', {'message': '继续', 'continue_id': record['messages'][-1]['reply_to']})
        failed = tutor.history(self.root, '0001-intro')['messages'][-1]
        with patch.object(tutor, 'model_request', return_value=answer('恢复后讲完')) as model:
            result = tutor.chat(self.root, '0001-intro', {'message': '重试', 'retry_id': failed['id']})
        self.assertEqual(model.call_args.args[1][-2]['content'], '已讲的部分')
        self.assertEqual(sum(m['role'] == 'user' for m in result['messages']), 2)
        self.assertEqual(result['messages'][-2]['attempts'], 2)

    def test_long_history_above_old_8m_is_readable(self):
        text = '文' * (3 * 1024 * 1024)
        record = {'course': self.root.name, 'lesson': '0001-intro', 'schema': 1,
                  'messages': [{'role': 'assistant', 'content': text, 'status': 'complete'}]}
        tutor.save_history(self.root, record)
        self.assertGreater((self.root / 'learner-chats/0001-intro.json').stat().st_size, 8*1024*1024)
        self.assertEqual(tutor.history(self.root, '0001-intro')['messages'][0]['content'], text)

    def test_active_json_read_has_no_total_deadline(self):
        response = Mock()
        response.read1.side_effect = [b'{"ok":', b'true}', b'']
        with patch.object(tutor.time, 'monotonic', side_effect=AssertionError('No wall-clock deadline')):
            self.assertEqual(tutor.read_response(response), {'ok': True})

    def test_socket_inactivity_timeout_not_a_turn_deadline(self):
        remote = Mock(status=200)
        remote.getheader.return_value = 'application/json'
        remote.read1.side_effect = [json.dumps({'choices': [{'message': {'content': '完成'}, 'finish_reason': 'stop'}]}).encode(), b'']
        conn = Mock(); conn.getresponse.return_value = remote
        with patch.object(tutor, 'connection', return_value=conn): tutor.model_request(self.config, [])
        conn.sock.settimeout.assert_called_once_with(tutor.READ_IDLE_SECONDS)
        conn.request.assert_called_once()

    def test_settings_automatic_budget_survives_restart(self):
        with patch.object(tutor, 'CONFIG', None), patch.object(tutor, 'RESTORED_ROOT', None), patch.object(tutor, 'RESTORE_ERROR', ''):
            data = dict(self.config, remember_key=False)
            first = tutor.configure(self.root, data)
            self.assertTrue(first['configured']); self.assertIsNone(first['settings']['max_tokens'])
            tutor.CONFIG = None; tutor.RESTORED_ROOT = None
            restored = tutor.config_status(self.root)
            self.assertTrue(restored['configured']); self.assertIsNone(restored['settings']['max_tokens'])


if __name__ == '__main__': unittest.main()
