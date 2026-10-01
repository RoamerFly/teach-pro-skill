"""No-network execution checks for the manually reviewed competition lesson."""
import contextlib
import html
import io
import json
import re
import unittest
from pathlib import Path
from types import SimpleNamespace

LESSON = Path(__file__).resolve().parents[1] / 'example/competition-demo-zhi-jian-agent/lessons/0003-tool-calling-dataflow.html'


def blocks(section_id):
    section = LESSON.read_text(encoding='utf-8').split(f'<section id="{section_id}"', 1)[1].split('</section>', 1)[0]
    return [html.unescape(block) for block in re.findall(r'<pre><code[^>]*>(.*?)</code></pre>', section, re.S)]


class DemoCodeTests(unittest.TestCase):
    def test_message_pairing(self):
        scope = {}
        with contextlib.redirect_stdout(io.StringIO()):
            exec(blocks('mock-run')[0], scope)
        messages = scope['messages']
        self.assertEqual([message['role'] for message in messages], ['system', 'user', 'assistant', 'tool'])
        self.assertEqual(messages[2]['tool_calls'][0]['id'], messages[3]['tool_call_id'])
        self.assertEqual(json.loads(messages[3]['content'])['affected'], '>=1.4.0, <1.6.0')

    def test_sender_simulation(self):
        scope = {}
        code = next(block for block in blocks('step-by-step') if 'ALLOWED_RECIPIENTS' in block)
        with contextlib.redirect_stdout(io.StringIO()):
            exec(code, scope)
            self.assertTrue(scope['send_report']('attacker@example.com', 'mock').startswith('REFUSED'))
            self.assertTrue(scope['send_report']('analyst@yourcompany.example', 'mock').startswith('MOCK_ACCEPTED'))

    def test_loop_exit_conditions(self):
        code = next(block for block in blocks('step-by-step') if 'MAX_ROUNDS = ' in block)
        for reason, expected_requests, expected_results in [('stop', 1, 0), ('length', 1, 0), ('content_filter', 1, 0), ('tool_calls', 8, 16)]:
            with self.subTest(reason=reason):
                requests, results = [], []
                msg = SimpleNamespace(content='mock output', tool_calls=[SimpleNamespace(id='a'), SimpleNamespace(id='b')])

                def call_api(messages, tools):
                    requests.append(True)
                    return SimpleNamespace(choices=[SimpleNamespace(message=msg, finish_reason=reason)])

                def execute_with_check(call):
                    results.append(call.id)
                    return 'mock result'

                def tool_message(call, result):
                    return {'role': 'tool', 'tool_call_id': call.id, 'content': result}

                scope = {'messages': [], 'tools': [], 'call_api': call_api, 'execute_with_check': execute_with_check, 'tool_message': tool_message}
                output = io.StringIO()
                with contextlib.redirect_stdout(output):
                    exec(code, scope)
                self.assertEqual(len(requests), expected_requests)
                self.assertEqual(len(results), expected_results)
                if reason in ('length', 'content_filter'):
                    self.assertIn('异常或不完整', output.getvalue())
                if reason == 'tool_calls':
                    self.assertIn('已达最大轮数', output.getvalue())


if __name__ == '__main__':
    unittest.main()
