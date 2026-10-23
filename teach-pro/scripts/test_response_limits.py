"""Offline response regressions. No real credentials, providers or learner files.

python scripts/test_response_limits.py [--runtime /path/to/tutor_chat.py]
"""
from pathlib import Path
import argparse
import http.client
import importlib.util
import io
import json
import sys
import tempfile
import unittest
from unittest.mock import patch

parser = argparse.ArgumentParser(add_help=False)
parser.add_argument('--runtime', type=Path, default=Path(__file__).resolve().parents[1]/'assets/tutor_chat.py')
args, rest = parser.parse_known_args()
sys.path.insert(0, str(args.runtime.parent))
spec = importlib.util.spec_from_file_location('tutor_response_under_test', args.runtime)
tutor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tutor)


def answer(content='正确正文', reason='stop', **message):
    return {'choices': [{'message': {'content': content, **message}, 'finish_reason': reason}]}


def event(text=None, reason=None, **delta):
    if text is not None:
        delta['content'] = text
    return {'choices': [{'index': 0, 'delta': delta, 'finish_reason': reason}]}


def frame(data, newline=b'\n'):
    raw = data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)
    return b'data: ' + raw.encode('utf-8') + newline + newline


def large_normal_stream():
    # Realistic per-token provider metadata: tiny answer, >512 KiB wire.
    rows = []
    for _ in range(3153):
        item = event('答'); item.update(id='chatcmpl-'+'x'*180, model='offline-test', created=1)
        rows.append(frame(item))
    return b''.join(rows) + frame(event(reason='stop')) + frame('[DONE]')


class Response:
    status = 200
    def __init__(self, raw, step=8192, content_type='text/event-stream', failure=None):
        self.raw = io.BytesIO(raw); self.step = step; self.kind = content_type; self.failure = failure
    def read1(self, size):
        data = self.raw.read(min(size, self.step))
        if not data and self.failure:
            raise self.failure
        return data
    def getheader(self, name, default=''):
        return self.kind if name.lower() == 'content-type' else default


class ResponseTests(unittest.TestCase):
    def stream(self, raw, **options):
        emitted = []; result = tutor.read_stream(Response(raw, **options), 'test-secret-key', emitted.append)
        self.assertEqual(''.join(emitted), result['content'])
        return result

    def test_original_failure_3153_characters_over_512k(self):
        raw = large_normal_stream(); self.assertGreater(len(raw), 512*1024)
        result = self.stream(raw)
        self.assertEqual(result['content'], '答'*3153); self.assertEqual(result['status'], 'complete')
        self.assertEqual(result['diagnostics']['response_bytes'], len(raw))

    def test_large_reasoning_then_small_answer(self):
        result = self.stream(frame(event(reasoning_content='思'*190000))+frame(event('最终解释'))+frame(event(reason='stop')))
        self.assertEqual(result['content'], '最终解释'); self.assertTrue(result['diagnostics']['has_reasoning'])

    def test_large_single_event_below_bound(self):
        self.assertEqual(self.stream(frame({**event('短答'), 'metadata': 'm'*600000})+frame(event(reason='stop')))['status'], 'complete')

    def test_heartbeats_not_answer(self):
        result = self.stream((b': ping\n\n'*70000)+frame(event('有效'))+frame(event(reason='stop')))
        self.assertEqual(result['content'], '有效')

    def test_utf8_split_every_byte(self):
        self.assertEqual(self.stream(frame(event('中文🙂𠮷'))+frame(event(reason='stop')), step=1)['content'], '中文🙂𠮷')

    def test_crlf(self):
        self.assertEqual(self.stream(frame(event('甲'),b'\r\n')+frame(event(reason='stop'),b'\r\n'))['status'], 'complete')

    def test_multiline_data_and_comments(self):
        raw = b': comment\nevent: message\ndata: {"choices":\ndata: [{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\n'
        self.assertEqual(self.stream(raw)['content'], 'ok')

    def test_usage_only(self):
        result = self.stream(frame(event('答'))+frame(event(reason='stop'))+frame({'choices': [], 'usage': {'completion_tokens': 10, 'private': 'never'}})+frame('[DONE]'))
        self.assertEqual(result['usage'], {'completion_tokens': 10})

    def test_secret_split_across_frames(self):
        result = self.stream(frame(event('先test-sec'))+frame(event('ret-key后'))+frame(event(reason='stop')))
        self.assertEqual(result['content'], '先[密钥已隐藏]后')

    def test_secret_prefix_flush_at_end(self):
        self.assertEqual(self.stream(frame(event('test-sec'))+frame(event(reason='stop')))['content'], 'test-sec')

    def test_long_body_not_locally_truncated(self):
        text = '字'*100000
        result = self.stream(frame(event(text))+frame(event(reason='stop')))
        self.assertEqual(result['content'], text)
        self.assertEqual(result['status'], 'complete')
        self.assertNotIn('local_truncated', result['diagnostics'])

    def test_unicode_above_old_character_limit_complete(self):
        self.assertEqual(self.stream(frame(event('🙂𠮷'*20000))+frame(event(reason='stop')))['content'], '🙂𠮷'*20000)

    def test_model_token_limit(self):
        result = self.stream(frame(event('部分'))+frame(event(reason='length')))
        self.assertEqual(result['status'], 'incomplete'); self.assertEqual(result['diagnostics']['code'], 'budget_exhausted')

    def test_eof_without_finish(self):
        result = self.stream(frame(event('还没完')))
        self.assertEqual(result['status'], 'incomplete'); self.assertEqual(result['diagnostics']['code'], 'stream_interrupted')

    def test_done_without_finish(self):
        self.assertEqual(self.stream(frame(event('不确定'))+frame('[DONE]'))['status'], 'incomplete')

    def test_partial_frame_after_finish(self):
        self.assertEqual(self.stream(frame(event('正文',reason='stop'))+b'data: {')['status'], 'incomplete')

    def check_error(self, raw, code, partial='', **options):
        emitted=[]
        with self.assertRaises(tutor.TutorError) as raised:
            tutor.read_stream(Response(raw, **options), 'test-secret-key', emitted.append)
        self.assertEqual(raised.exception.diagnostics['code'], code)
        self.assertEqual(raised.exception.partial_content, partial)
        self.assertNotIn('test-secret-key', ''.join(emitted)+str(raised.exception)+json.dumps(raised.exception.diagnostics))
        return raised.exception

    def test_wire_above_old_16m_limit_completes(self):
        raw=frame(event('开头'))+(b': '+b'p'*4000+b'\n\n')*4200+frame(event('结尾', reason='stop'))
        result=self.stream(raw)
        self.assertGreater(result['diagnostics']['response_bytes'],16*1024*1024)
        self.assertEqual(result['content'],'开头结尾');self.assertEqual(result['status'],'complete')

    def test_unterminated_event_bound(self):
        result=self.stream(frame(event('保留'))+b'data: '+b' '* (1024*1024+1))
        self.assertEqual(result['content'],'保留');self.assertEqual(result['diagnostics']['code'],'stream_interrupted')

    def test_terminated_event_bound(self):
        self.assertEqual(self.stream(frame(event('保留'))+frame({**event('字'), 'large':'x'*(2*1024*1024)})+frame(event(reason='stop')))['content'],'保留字')

    def test_invalid_json_partial(self):
        self.check_error(frame(event('保留'))+frame('{broken'), 'stream_interrupted', '保留')

    def test_invalid_utf8(self):
        self.check_error(b'data: \xff\n\n', 'stream_interrupted')

    def test_provider_error_frame_is_not_reflected(self):
        exc=self.check_error(frame({'error': {'message': 'test-secret-key'}}), 'response_shape')
        self.assertNotIn('message', str(exc))

    def test_tools_rejected(self):
        self.check_error(frame(event(tool_calls=[{'id':'x'}])), 'tools_unsupported')

    def test_content_filter_partial(self):
        self.check_error(frame(event('已有'))+frame(event(reason='content_filter')), 'content_filter', '已有')

    def test_reasoning_only(self):
        self.check_error(frame(event(reasoning_content='不可见'))+frame(event(reason='stop')), 'reasoning_only')

    def test_reasoning_budget_empty(self):
        self.check_error(frame(event(reasoning_content='不可见'))+frame(event(reason='length')), 'budget_exhausted')

    def test_empty_answer(self):
        self.check_error(frame(event(reason='stop')), 'empty_answer')

    def test_socket_timeout_preserves_partial(self):
        self.check_error(frame(event('已收')), 'timeout', '已收', failure=TimeoutError())

    def test_active_response_has_no_wall_clock_deadline(self):
        with patch.object(tutor.time,'monotonic',side_effect=AssertionError('No total-time deadline')):
            result=self.stream(frame(event('持续生成'))+frame(event(reason='stop')))
        self.assertEqual(result['status'],'complete')

    def test_non_string_delta(self):
        self.check_error(frame(event(content=['bad'])), 'response_shape')

    def test_unknown_nonstream_finish_is_incomplete(self):
        result=tutor.parse_answer(answer(reason=None));self.assertEqual(result['status'],'incomplete')

    def test_json_over_old_limit(self):
        raw=json.dumps(answer('有效',reasoning_content='思'*190000),ensure_ascii=False).encode()
        self.assertGreater(len(raw),512*1024)
        self.assertEqual(tutor.parse_answer(tutor.read_response(Response(raw)))['content'],'有效')

    def test_model_list_still_validates_its_own_response(self):
        with self.assertRaises(tutor.TutorError) as raised:
            tutor.read_response(Response(b' '* (512*1024+1)),512*1024)
        self.assertEqual(raised.exception.diagnostics['code'],'response_size')

    def test_large_json_fallback_full_body(self):
        text='甲'*100000
        raw=json.dumps(answer(text,reasoning_content='r'*(5*1024*1024)),ensure_ascii=False).encode()
        result=tutor.parse_answer(tutor.read_response(Response(raw)))
        self.assertEqual(result['content'],text);self.assertEqual(result['status'],'complete')

    def test_json_redaction(self):
        self.assertEqual(tutor.parse_answer(answer('test-secret-key'),'test-secret-key')['content'],'[密钥已隐藏]')

    def test_payload_budget_preserved(self):
        config={'model':'offline','kind':'custom','max_tokens':16384}
        self.assertEqual(tutor.request_payload(config,[],streaming=True),{'model':'offline','messages':[],'stream':True,'max_tokens':16384})

    def test_model_request_json_fallback_once_and_close(self):
        class Connection:
            calls=0;closed=False
            def request(self,*args,**kwargs):self.calls+=1
            def getresponse(self):return Response(json.dumps(answer('同一次请求')).encode(),content_type='application/json')
            def close(self):self.closed=True
        conn=Connection();seen=[]
        config={'base_url':'http://127.0.0.1:11434/v1','mode':'local','api_key':'','kind':'custom','model':'mock','max_tokens':4096}
        with patch.object(tutor,'connection',return_value=conn):result=tutor.model_request(config,[],emit=seen.append)
        self.assertEqual(conn.calls,1);self.assertTrue(conn.closed);self.assertEqual(seen,['同一次请求']);self.assertFalse(result['diagnostics']['streaming'])

    def test_model_request_http_error_no_body_or_retry(self):
        class Connection:
            calls=0;closed=False
            def request(self,*args,**kwargs):self.calls+=1
            def getresponse(self):r=Response(b'secret');r.status=429;return r
            def close(self):self.closed=True
        conn=Connection();config={'base_url':'http://127.0.0.1:11434/v1','mode':'local','api_key':'','kind':'custom','model':'mock','max_tokens':4096}
        with patch.object(tutor,'connection',return_value=conn),self.assertRaises(tutor.TutorError) as raised:tutor.model_request(config,[])
        self.assertTrue(conn.closed);self.assertEqual(conn.calls,1);self.assertNotIn('secret',str(raised.exception))

    def test_chat_partial_saved_and_retry_no_duplicate_user(self):
        with tempfile.TemporaryDirectory(prefix='teach-response-') as temp:
            root=Path(temp)/'isolated-course';(root/'lessons').mkdir(parents=True)
            (root/'lessons/0001-test.html').write_text('<main><h1>测试课</h1><p>正文</p></main>',encoding='utf-8')
            config={'provider':'mock','kind':'custom','model':'mock','api_key':''}
            def failure(*a,**kw):
                exc=tutor.TutorError('连接中断，已保留回答。',502,{'code':'stream_interrupted'});exc.partial_content='已收到的回答';raise exc
            with patch.object(tutor,'current_config',return_value=config),patch.object(tutor,'model_request',side_effect=failure),self.assertRaises(tutor.TutorError):
                tutor.chat(root,'0001-test',{'message':'问题'},emit=lambda *a:None)
            saved=tutor.history(root,'0001-test');self.assertEqual([m['status'] for m in saved['messages']],['incomplete','incomplete'])
            retry=saved['messages'][0]['id']
            with patch.object(tutor,'current_config',return_value=config),patch.object(tutor,'model_request',return_value=tutor.parse_answer(answer('重试完成'))):
                result=tutor.chat(root,'0001-test',{'message':'问题','retry_id':retry},emit=lambda *a:None)
            self.assertEqual(sum(m['role']=='user' for m in result['messages']),1)
            self.assertEqual(result['messages'][0]['attempts'],2);self.assertEqual(result['messages'][-1]['status'],'complete')

    def test_endpoint_guards_unchanged(self):
        for base,mode in [('http://example.com','cloud'),('http://192.168.1.1','local'),('https://user:pass@example.com','cloud')]:
            with self.subTest(base=base),self.assertRaises(tutor.TutorError):tutor.validate_endpoint(base,mode)


if __name__=='__main__':
    unittest.main(argv=[sys.argv[0],*rest])
