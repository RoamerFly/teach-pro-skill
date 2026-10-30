"""Actual model payload and immutable evidence snapshots, with an offline provider."""
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ASSETS = Path(__file__).resolve().parents[1] / 'teach-pro/assets'
sys.path.insert(0, str(ASSETS))
spec = importlib.util.spec_from_file_location('answer_tutor', os.environ.get('TEACH_PRO_TEST_RUNTIME', str(ASSETS / 'tutor_chat.py')))
tutor = importlib.util.module_from_spec(spec); spec.loader.exec_module(tutor)
SLUG = '0001-test'
PAGE = '''<main><h1>第1课</h1><section><h2>判断消息</h2><p>写出消息的作用</p>
<label for="work">你的解释</label><textarea id="work" data-save-key="work"></textarea>
<p>选择角色</p><div data-quiz data-save-key="choice"><input type="radio" value="user"></div>
<input type="password" data-save-key="secret"><input type="hidden" data-save-key="hidden">
<div hidden><textarea data-save-key="hidden-child"></textarea></div>
<details class="answer"><summary>参考标准</summary><p>标准答案</p></details></section></main>'''


class LearnerAnswersTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root/'lessons').mkdir(); (self.root/'learner-submissions').mkdir()
        (self.root/'lessons'/f'{SLUG}.html').write_text(PAGE, encoding='utf-8')
        config = {'kind':'custom','provider':'offline','model':'mock','api_key':'', 'mode':'local',
                  'base_url':'http://127.0.0.1:11434/v1','max_tokens':None,'context_answers':False}
        self.config = config
        self.cfg = patch.object(tutor,'current_config',return_value=config); self.cfg.start(); self.addCleanup(self.cfg.stop)
        self.answer = tutor.parse_answer({'choices':[{'message':{'content':'模拟答复'},'finish_reason':'stop'}]})

    def saved(self, **fields):
        file = self.root/'learner-submissions'/f'{SLUG}.json'
        file.write_text(json.dumps({'page':SLUG,'fields':fields}), encoding='utf-8')
        return file

    def ask(self, **data):
        with patch.object(tutor,'model_request',return_value=self.answer) as model:
            record = tutor.chat(self.root,SLUG,{'message':'看看我的答案',**data})
        return record, model.call_args.args[1]

    def test_live_unsynced_answer_beats_disk_and_has_question_location(self):
        file = self.saved(work='OLD_DISK'); before = file.read_bytes()
        record,messages = self.ask(answer_snapshot={'fields':{'work':'最新解释🧑','choice':'user'}})
        latest = messages[-1]['content']
        self.assertIn('最新解释🧑',latest); self.assertNotIn('OLD_DISK',latest)
        self.assertIn('写出消息的作用',latest); self.assertIn('判断消息',latest)
        self.assertIn('user',latest); self.assertNotIn('标准答案',messages[0]['content'])
        self.assertEqual(record['messages'][0]['learner_answers']['source'],'current-page')
        self.assertEqual(file.read_bytes(),before)

    def test_clear_and_empty_snapshot_do_not_resurrect_saved_answers(self):
        self.saved(work='STALE')
        _,messages = self.ask(answer_snapshot={'fields':{'work':'','choice':''}})
        self.assertNotIn('STALE',messages[-1]['content'])
        self.assertIn('"answer": ""',messages[-1]['content'])
        _,messages = self.ask(answer_snapshot={'fields':{}})
        self.assertNotIn('STALE',messages[-1]['content'])

    def test_old_client_reads_only_saved_current_page_fields(self):
        self.saved(work='SAVED_CURRENT', secret='PRIVATE_KEY', unknown='PRIVATE_FIELD')
        (self.root/'learner-submissions/0002-other.json').write_text('{"fields":{"work":"OTHER_PAGE"}}')
        _,messages = self.ask()
        latest = messages[-1]['content']
        self.assertIn('SAVED_CURRENT',latest)
        for marker in ('PRIVATE_KEY','PRIVATE_FIELD','OTHER_PAGE'): self.assertNotIn(marker,latest)

    def test_unknown_hidden_password_fields_excluded_from_live_snapshot(self):
        _,messages = self.ask(answer_snapshot={'fields':{'work':'OK','secret':'PRIVATE','hidden':'PRIVATE',
                                                         'hidden-child':'PRIVATE','unknown':'PRIVATE'}})
        self.assertNotIn('PRIVATE',messages[-1]['content'])
        self.assertIn('OK',messages[-1]['content'])

    def test_followup_captures_changed_answer_and_replays_previous_evidence(self):
        first,_ = self.ask(answer_snapshot={'fields':{'work':'FIRST_ANSWER'}})
        _,messages = self.ask(answer_snapshot={'fields':{'work':'REVISED_ANSWER'}})
        self.assertIn('FIRST_ANSWER',messages[1]['content'])
        self.assertIn('REVISED_ANSWER',messages[-1]['content'])
        self.assertNotIn('FIRST_ANSWER',messages[-1]['content'])
        restored=tutor.history(self.root,SLUG)
        self.assertEqual(restored['messages'][0]['learner_answers'],first['messages'][0]['learner_answers'])

    def test_regenerate_reuses_original_evidence_and_edit_captures_new(self):
        first,_ = self.ask(answer_snapshot={'fields':{'work':'ORIGINAL'}})
        _,messages = self.ask(regenerate_id=first['messages'][-1]['id'],answer_snapshot={'fields':{'work':'NEW_PAGE'}})
        self.assertIn('ORIGINAL',messages[-1]['content']);self.assertNotIn('NEW_PAGE',messages[-1]['content'])
        _,messages = self.ask(edit_id=first['messages'][0]['id'],answer_snapshot={'fields':{'work':'EDITED'}})
        self.assertIn('EDITED',messages[-1]['content']);self.assertNotIn('ORIGINAL',messages[-1]['content'])

    def test_invalid_snapshot_and_key_rejected_before_provider_or_history_write(self):
        for snapshot in (None,{}, {'fields':[]},{'fields':{'work':5}}, {'fields':{'work':'API_SECRET'}}):
            with self.subTest(snapshot=snapshot),patch.object(tutor,'model_request') as model:
                if isinstance(snapshot,dict) and snapshot.get('fields')=={'work':'API_SECRET'}:
                    self.config['api_key']='API_SECRET'
                with self.assertRaises(tutor.TutorError): tutor.chat(self.root,SLUG,{'message':'请检查','answer_snapshot':snapshot})
                model.assert_not_called()
        self.assertFalse((self.root/'learner-chats'/f'{SLUG}.json').exists())

    def test_retry_keeps_original_snapshot_after_failed_attempt(self):
        with patch.object(tutor,'model_request',side_effect=tutor.TutorError('模拟连接失败',502)):
            with self.assertRaises(tutor.TutorError):
                tutor.chat(self.root,SLUG,{'message':'请检查','answer_snapshot':{'fields':{'work':'FAILED_ORIGINAL'}}})
        failed=tutor.history(self.root,SLUG)
        _,messages=self.ask(retry_id=failed['messages'][0]['id'],answer_snapshot={'fields':{'work':'CHANGED_AFTER_FAILURE'}})
        self.assertIn('FAILED_ORIGINAL',messages[-1]['content'])
        self.assertNotIn('CHANGED_AFTER_FAILURE',messages[-1]['content'])


if __name__=='__main__': unittest.main()
