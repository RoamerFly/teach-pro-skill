"""Branch ancestry, multimodal replay and returned reasoning, entirely offline."""
import base64
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from threading import Event
from unittest.mock import patch, Mock

ASSETS=Path(__file__).resolve().parents[1]/'teach-pro/assets'
sys.path.insert(0,str(ASSETS))
spec=importlib.util.spec_from_file_location('conversation_tutor',ASSETS/'tutor_chat.py')
tutor=importlib.util.module_from_spec(spec);spec.loader.exec_module(tutor)
SLUG='0001-test'
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=')


def frame(**delta):
    return ('data: '+json.dumps({'choices':[{'delta':delta,'index':0,'finish_reason':None}]})+'\n\n').encode()


class Response(io.BytesIO):
    def read1(self,n):return self.read(n)


class ConversationTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
        (self.root/'lessons').mkdir();(self.root/'lessons'/f'{SLUG}.html').write_text('<main><h1>第1课</h1><p>教材</p></main>',encoding='utf-8')
        self.config={'kind':'deepseek','provider':'offline','model':'deepseek-flash','api_key':'test-secret-key',
                     'mode':'local','base_url':'http://127.0.0.1:11434/v1','max_tokens':None,'thinking':'disabled'}
        self.config_patch=patch.object(tutor,'current_config',return_value=self.config);self.config_patch.start();self.addCleanup(self.config_patch.stop)

    def ask(self,text='问题',answer='回答',**data):
        result=tutor.parse_answer({'choices':[{'message':{'content':answer},'finish_reason':'stop'}]})
        with patch.object(tutor,'model_request',return_value=result) as model:
            record=tutor.chat(self.root,SLUG,{'message':text,**data})
        return record,model.call_args.args[1],model.call_args.args[0]

    def upload(self,name,raw):
        return tutor.upload_files(self.root,{'files':[{'name':name,'data':base64.b64encode(raw).decode()}]})['attachments'][0]

    def test_legacy_read_is_stable_and_does_not_rewrite(self):
        folder=self.root/'learner-chats';folder.mkdir();file=folder/(SLUG+'.json')
        old={'schema':1,'course':self.root.name,'lesson':SLUG,'messages':[{'role':'user','content':'旧问题','status':'complete'},
              {'role':'assistant','content':'旧回答','status':'complete'}]}
        file.write_text(json.dumps(old),encoding='utf-8');before=file.read_bytes()
        a=tutor.history(self.root,SLUG);b=tutor.history(self.root,SLUG)
        self.assertEqual(a,b);self.assertEqual(file.read_bytes(),before)
        self.assertEqual([m['content'] for m in tutor.active_messages(a)],['旧问题','旧回答'])

    def test_edit_preserves_old_future_and_excludes_it_from_new_context(self):
        first,_,_=self.ask('原问题','原答案');old_user=first['messages'][0]['id']
        old,_,_=self.ask('旧分支后续','旧后续答案');old_leaf=old['active_leaf']
        edited,messages,_=self.ask('修改后问题','新答案',edit_id=old_user)
        self.assertEqual(len(edited['messages']),6)
        wire=json.dumps(messages,ensure_ascii=False)
        self.assertIn('修改后问题',wire);self.assertNotIn('原答案',wire);self.assertNotIn('旧分支后续',wire)
        restored=tutor.select_branch(self.root,SLUG,{'message_id':old_user})
        self.assertEqual(restored['active_leaf'],old_leaf)
        _,messages,_=self.ask('沿旧分支继续')
        wire=json.dumps(messages,ensure_ascii=False)
        self.assertIn('旧后续答案',wire);self.assertNotIn('新答案',wire)

    def test_regenerate_creates_answer_sibling_and_reuses_question(self):
        first,_,_=self.ask('同一个问题','答案A');answer=first['messages'][-1]
        second,messages,_=self.ask('重新回答','答案B',regenerate_id=answer['id'])
        self.assertEqual(sum(m['role']=='user' for m in second['messages']),1)
        self.assertEqual([m['content'] for m in tutor.active_messages(second)],['同一个问题','答案B'])
        self.assertEqual(second['messages'][-1]['parent_id'],answer['parent_id'])
        self.assertNotIn('答案A',json.dumps(messages,ensure_ascii=False))
        old=tutor.select_branch(self.root,SLUG,{'message_id':answer['id']})
        self.assertEqual(tutor.active_messages(old)[-1]['content'],'答案A')

    def test_failed_regeneration_keeps_original_answer_and_active_failure(self):
        first,_,_=self.ask();answer=first['messages'][-1]
        with patch.object(tutor,'model_request',side_effect=tutor.TutorError('接口失败',502)):
            with self.assertRaises(tutor.TutorError):tutor.chat(self.root,SLUG,{'message':'重新回答','regenerate_id':answer['id']})
        record=tutor.history(self.root,SLUG)
        self.assertEqual(record['messages'][0]['status'],'complete')
        self.assertEqual(tutor.active_messages(record)[-1]['status'],'failed')
        restored=tutor.select_branch(self.root,SLUG,{'message_id':answer['id']})
        self.assertEqual(tutor.active_messages(restored)[-1]['content'],'回答')

    def test_image_and_text_are_replayed_on_selected_branch(self):
        image=self.upload('示意图.png',PNG);text=self.upload('笔记.md','附件唯一文字'.encode())
        first,messages,_=self.ask('看看附件',attachments=[image['id'],text['id']])
        content=messages[-1]['content']
        self.assertEqual(content[1]['image_url']['url'],'data:image/png;base64,'+base64.b64encode(PNG).decode())
        self.assertIn('附件唯一文字',content[2]['text'])
        raw=(self.root/'learner-chats'/f'{SLUG}.json').read_text(encoding='utf-8')
        self.assertNotIn('data:image',raw)
        _,messages,_=self.ask('再解释附件')
        self.assertTrue(any(isinstance(m['content'],list) for m in messages[:-1]))
        _,messages,_=self.ask('不带附件的新版本',edit_id=first['messages'][0]['id'],attachments=[])
        self.assertNotIn('data:image',json.dumps(messages));self.assertNotIn('附件唯一文字',json.dumps(messages,ensure_ascii=False))

    def test_attachment_without_text_uses_a_clear_question(self):
        image=self.upload('图.png',PNG)
        record,_,_=self.ask('',attachments=[image['id']])
        self.assertEqual(record['messages'][0]['content'],'请结合本课分析附件。')

    def test_text_only_metadata_rejects_image_before_persisting_question(self):
        image=self.upload('图.png',PNG)
        self.config['model_catalog']=[{'id':'deepseek-flash','input_modalities':['text']}]
        with self.assertRaises(tutor.TutorError):self.ask('分析',attachments=[image['id']])
        self.assertFalse((self.root/'learner-chats'/f'{SLUG}.json').exists())

    def test_text_only_model_cannot_silently_discard_previous_images(self):
        image=self.upload('图.png',PNG)
        self.ask(attachments=[image['id']])
        self.config['model_catalog']=[{'id':'deepseek-flash','input_modalities':['text']}]
        with self.assertRaises(tutor.TutorError):self.ask('沿着带图历史继续')

    def test_stale_visible_branch_is_rejected_without_modifying_history(self):
        self.ask();file=self.root/'learner-chats'/f'{SLUG}.json';before=file.read_bytes()
        with self.assertRaises(tutor.TutorError):self.ask(expected_leaf='stale-leaf')
        self.assertEqual(file.read_bytes(),before)

    def test_upload_checks_encoding_content_and_confines_path(self):
        meta=self.upload('../../notes.md','可读'.encode())
        self.assertEqual(meta['name'],'notes.md');self.assertEqual(tutor.attachment(self.root,meta['id'])[1],'可读'.encode())
        for files in ([],[{'name':'x.png','data':'%%%'}],[{'name':'x.png','data':base64.b64encode(b'not image').decode()}]):
            with self.subTest(files=files),self.assertRaises(tutor.TutorError):tutor.upload_files(self.root,{'files':files})
        with self.assertRaises(tutor.TutorError):tutor.attachment(self.root,'../private')

    def test_text_attachment_cannot_send_the_current_key(self):
        meta=self.upload('secret.txt',b'test-secret-key')
        with self.assertRaises(tutor.TutorError):self.ask(attachments=[meta['id']])

    def test_request_model_effort_overrides_do_not_change_course_defaults(self):
        record,_,config=self.ask(model='deepseek-v4-pro',reasoning_effort='max')
        payload=tutor.request_payload(config,[])
        self.assertEqual(payload['thinking'],{'type':'enabled'});self.assertEqual(payload['reasoning_effort'],'max')
        self.assertEqual(record['messages'][-1]['model'],'deepseek-v4-pro')
        self.assertEqual(self.config['model'],'deepseek-flash');self.assertEqual(self.config['thinking'],'disabled')
        off=tutor.request_payload(tutor.request_config(self.config,{'reasoning_effort':'none'}),[])
        self.assertEqual(off['thinking'],{'type':'disabled'});self.assertNotIn('reasoning_effort',off)
        with self.assertRaises(tutor.TutorError):tutor.request_config(self.config,{'reasoning_effort':'invalid'})

    def test_provider_effort_metadata_takes_priority(self):
        self.config.update(kind='custom',model='custom-thinker',model_catalog=[{'id':'custom-thinker','effort':{'supported_levels':['low','max']}}])
        self.assertEqual(tutor.model_capabilities(self.config,'custom-thinker')['efforts'],['auto','low','max'])
        with self.assertRaises(tutor.TutorError):tutor.request_config(self.config,{'reasoning_effort':'high'})

    def test_streamed_reasoning_is_separate_redacted_and_persisted(self):
        body=[];thought=[]
        def emit(text):body.append(text)
        emit.reasoning=thought.append
        stop=b'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
        wire=frame(reasoning_content='先检查 test-sec')+frame(reasoning_content='ret-key，然后解释。')+frame(content='最终回答')+stop
        answer=tutor.read_stream(Response(wire),'test-secret-key',emit)
        self.assertEqual(''.join(body),'最终回答');self.assertEqual(''.join(thought),'先检查 [密钥已隐藏]，然后解释。')
        self.assertEqual(answer['reasoning'],''.join(thought));self.assertIn('reasoning_ms',answer['diagnostics'])
        with patch.object(tutor,'model_request',return_value=answer):record=tutor.chat(self.root,SLUG,{'message':'问题'})
        self.assertEqual(record['messages'][-1]['reasoning'],answer['reasoning'])
        self.assertEqual(tutor.history(self.root,SLUG)['messages'][-1]['reasoning'],answer['reasoning'])

    def test_reasoning_only_failure_preserves_reasoning_without_faking_answer(self):
        with self.assertRaises(tutor.TutorError) as raised:
            tutor.read_stream(Response(frame(reasoning_content='可展示的思考')+b'data: [DONE]\n\n'),'',lambda s:None)
        self.assertEqual(raised.exception.partial_reasoning,'可展示的思考')
        self.assertEqual(raised.exception.partial_content,'')

    def test_stop_is_scoped_to_course_lesson_and_request(self):
        event=Event();connection=Mock();sock=Mock()
        job={'root':self.root.resolve(),'slug':SLUG,'id':'request-one','cancel':event,'connection':connection,'socket':sock}
        with patch.object(tutor,'ACTIVE_REQUEST',job):
            with self.assertRaises(tutor.TutorError):tutor.stop_request(self.root,SLUG,{'request_id':'stale-id'})
            self.assertFalse(event.is_set())
            tutor.stop_request(self.root,SLUG,{'request_id':'request-one'})
        self.assertTrue(event.is_set());sock.shutdown.assert_called_once();connection.close.assert_called_once()

    def test_stopped_thinking_is_saved_and_other_versions_remain(self):
        error=tutor.TutorError('已停止生成。',499,{'code':'cancelled'});error.partial_content='半段正文';error.partial_reasoning='半段思考'
        with patch.object(tutor,'model_request',side_effect=error):
            with self.assertRaises(tutor.TutorError):tutor.chat(self.root,SLUG,{'message':'停止测试'})
        record=tutor.history(self.root,SLUG);self.assertEqual(record['messages'][-1]['status'],'stopped')
        self.assertEqual(record['messages'][-1]['content'],'半段正文');self.assertEqual(record['messages'][-1]['reasoning'],'半段思考')


if __name__=='__main__':unittest.main()
