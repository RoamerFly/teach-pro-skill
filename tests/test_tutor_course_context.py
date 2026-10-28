"""Course-wide textbook context and current-page grounding, no provider calls."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ASSETS = Path(__file__).resolve().parents[1] / 'teach-pro/assets'
sys.path.insert(0, str(ASSETS))
spec = importlib.util.spec_from_file_location('course_context_tutor', ASSETS / 'tutor_chat.py')
tutor = importlib.util.module_from_spec(spec); spec.loader.exec_module(tutor)
SLUG = '0004-s01-signals-and-evaluation'
CURRENT = '''<main data-lesson-kind="supplement" data-related-lesson="0004">
<h1>第4课补充 · 历史信号与新旧评价</h1><section id="exercises"><h2>两道短检查</h2>
<h3>A. 用自己的话说DER++</h3><p>它们必须来自同一批吗？</p>
<textarea>PRIVATE_ANSWER</textarea><input value="PRIVATE_FIELD"><select><option>PRIVATE_SELECT</option></select>
<details class="answer"><summary>参考标准</summary><p>不必同批，按具体合同抽样。历史分数来自过去模型。</p></details>
<details><summary>补充解释</summary><p>这里是折叠扩展说明。</p></details></section>
<aside><p>教师提示也属于教材。</p></aside><figure><img alt="信号来源图"><figcaption>图注信息</figcaption></figure>
<section id="resources"><h2>一手阅读</h2><p>阅读任务<a href="https://example.test/paper">论文</a></p></section>
<script>PRIVATE_SCRIPT</script><style>PRIVATE_STYLE</style><nav>PRIVATE_NAV</nav></main>'''


class CourseContextTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='teach-course-context-'); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for folder in ('lessons', 'practice', 'reference', 'learner-chats', 'learner-submissions'):
            (self.root / folder).mkdir()
        self.write('lessons/' + SLUG + '.html', CURRENT)
        self.write('lessons/0001-intro.html', '<main><h1>第1课 · 基础</h1><p>第一课唯一教材信号</p></main>')
        self.write('index.html', '<main><h1>课程首页</h1><p>完整路线</p></main>')
        self.write('practice/entry-assessment.html', '<main><h1>入门评估</h1><p>题干与标准</p></main>')
        self.write('reference/reading.html', '<main><h1>阅读中心</h1><p>资源中心唯一标记</p></main>')
        self.write('settings.html', '<main>PRIVATE_SETTINGS</main>')
        self.write('LEARNER-PROFILE.md', 'PRIVATE_PROFILE')
        self.write('learner-submissions/private.html', '<main>PRIVATE_SUBMISSION</main>')
        self.write('learner-chats/other.json', 'PRIVATE_OTHER_CHAT')
        self.config = {'kind': 'custom', 'provider': 'offline', 'model': 'mock', 'api_key': '',
                       'mode': 'local', 'base_url': 'http://127.0.0.1:11434/v1', 'max_tokens': None}
        self.current = patch.object(tutor, 'current_config', return_value=self.config)
        self.current.start(); self.addCleanup(self.current.stop)

    def write(self, path, text): (self.root / path).write_text(text, encoding='utf-8')

    def ask(self, **data):
        answer = tutor.parse_answer({'choices': [{'message': {'content': '模拟回答'}, 'finish_reason': 'stop'}]})
        with patch.object(tutor, 'model_request', return_value=answer) as model:
            record = tutor.chat(self.root, SLUG, {'message': '解释这里，也联系第一课。', **data})
        return record, model.call_args.args[1]

    def test_folded_answers_explanations_asides_and_figures_are_included(self):
        ctx = tutor.lesson_context(self.root, SLUG)
        for phrase in ('按具体合同抽样', '折叠扩展说明', '教师提示也属于教材', '信号来源图', '图注信息'):
            self.assertIn(phrase, ctx['text'])

    def test_unsafe_and_user_input_nodes_are_not_textbook(self):
        text = tutor.course_context(self.root, SLUG)['course_text']
        for marker in ('PRIVATE_ANSWER','PRIVATE_FIELD','PRIVATE_SELECT','PRIVATE_SCRIPT','PRIVATE_STYLE','PRIVATE_NAV',
                       'PRIVATE_SETTINGS','PRIVATE_PROFILE','PRIVATE_SUBMISSION','PRIVATE_OTHER_CHAT'):
            self.assertNotIn(marker, text)

    def test_resource_text_and_hrefs_are_included_without_fetching(self):
        ctx = tutor.course_context(self.root, SLUG)
        self.assertIn('https://example.test/paper', ctx['course_text'])
        self.assertIn('资源中心唯一标记', ctx['course_text'])

    def test_default_course_scope_has_current_page_once_and_other_lessons(self):
        ctx = tutor.course_context(self.root, SLUG)
        self.assertEqual(len(ctx['pages']), 5)
        self.assertEqual(ctx['pages'][0]['path'], 'lessons/' + SLUG + '.html')
        self.assertEqual(ctx['course_text'].count('按具体合同抽样'), 1)
        self.assertIn('第一课唯一教材信号', ctx['course_text'])

    def test_current_scope_excludes_other_pages(self):
        ctx = tutor.course_context(self.root, SLUG, {'context_scope':'current'})
        self.assertEqual(len(ctx['pages']), 1)
        self.assertNotIn('第一课唯一教材信号', ctx['course_text'])
        self.assertIn('按具体合同抽样', ctx['course_text'])

    def test_answers_off_keeps_folded_explanations(self):
        ctx = tutor.course_context(self.root, SLUG, {'context_answers':False})
        self.assertNotIn('按具体合同抽样', ctx['course_text'])
        self.assertIn('折叠扩展说明', ctx['course_text'])

    def test_resources_off_excludes_section_and_reference_pages(self):
        ctx = tutor.course_context(self.root, SLUG, {'context_resources':False})
        self.assertNotIn('https://example.test/paper', ctx['course_text'])
        self.assertNotIn('资源中心唯一标记', ctx['course_text'])

    def test_no_local_24000_character_truncation(self):
        self.write('lessons/0001-intro.html','<main><h1>长课</h1><p>'+'文'*30000+'末尾关键点</p></main>')
        ctx = tutor.course_context(self.root, SLUG)
        self.assertIn('末尾关键点', ctx['course_text']); self.assertFalse(ctx['truncated'])

    def test_selected_answer_has_title_section_heading_and_complete_paragraph(self):
        origin = tutor.selection_context(tutor.lesson_context(self.root, SLUG),'按具体合同抽样','exercises')
        self.assertTrue(origin['matched']); self.assertEqual(origin['section'],'exercises')
        self.assertIn('A. 用自己的话说DER++',origin['heading']); self.assertIn('参考标准',origin['heading'])
        self.assertIn('历史分数来自过去模型',origin['paragraph'])

    def test_whitespace_normalization_and_missing_quote_do_not_fabricate_origin(self):
        current=tutor.lesson_context(self.root,SLUG)
        self.assertTrue(tutor.selection_context(current,'按具体 合同抽样')['matched'])
        missing=tutor.selection_context(current,'并不存在的话')
        self.assertFalse(missing['matched']); self.assertEqual(missing['paragraph'],'')

    def test_duplicate_quote_uses_dom_section_hint(self):
        self.write('lessons/'+SLUG+'.html','<main><h1>重复句</h1><section id="first"><p>相同短语</p></section><section id="second"><h2>第二处</h2><p>相同短语，带完整解释。</p></section></main>')
        origin=tutor.selection_context(tutor.lesson_context(self.root,SLUG),'相同短语','second')
        self.assertEqual(origin['section'],'second');self.assertIn('完整解释',origin['paragraph'])

    def test_actual_payload_has_current_fourth_supplement_and_past_lesson(self):
        record,messages=self.ask(selection='按具体合同抽样',selection_section='exercises')
        prompt=messages[0]['content']
        self.assertIn('第一课唯一教材信号',prompt)
        self.assertIn('先直接回答学员的问题', prompt)
        self.assertIn('具体例子', prompt)
        self.assertIn('不执行工具、代码、改文件或生成下一课', prompt)
        location=json.loads(prompt.split('[当前提问位置]\n')[1].split('\n')[0])
        self.assertEqual(location['number'],'4');self.assertEqual(location['kind'],'supplement')
        self.assertEqual(location['lesson'],SLUG)
        self.assertIn('参考标准',messages[-1]['content']);self.assertIn('历史分数来自过去模型',messages[-1]['content'])
        self.assertEqual(record['context_manifest']['current_page']['lesson'],SLUG)
        self.assertEqual(record['messages'][0]['selection_context']['page'],'lessons/'+SLUG+'.html')

    def test_explicit_selection_still_discussable_when_bulk_answers_off(self):
        self.config['context_answers']=False
        _,messages=self.ask(selection='按具体合同抽样')
        self.assertNotIn('按具体合同抽样',messages[0]['content'])
        self.assertIn('历史分数来自过去模型',messages[-1]['content'])

    def test_context_manifest_changes_when_prior_page_changes_not_current_hash(self):
        old=tutor.course_context(self.root,SLUG)
        self.write('lessons/0001-intro.html','<main><h1>第1课新版</h1>更新教材</main>')
        new=tutor.course_context(self.root,SLUG)
        self.assertEqual(old['version'],new['version'])
        self.assertNotEqual(old['course_version'],new['course_version'])

    def test_memory_settings_allow_all_complete_current_page_pairs(self):
        items=[]
        for i in range(12):
            items.extend([{'role':'user','status':'complete','content':f'问题{i}','context_version':'v'},
                          {'role':'assistant','status':'complete','content':'解释'*10000,'context_version':'v'}])
        self.assertEqual(len(tutor.recent_turns(items,'v',budget=None,turns=None)),24)
        self.assertEqual(len(tutor.recent_turns(items,'v',budget=None,turns=10)),20)
        self.assertEqual(tutor.recent_turns(items,'old',budget=None,turns=None),[])

    def test_options_are_validated_and_defaults_upgrade_old_config(self):
        self.assertEqual(tutor.context_options({}), tutor.CONTEXT_DEFAULTS)
        for changes in ({'context_scope':'all-files'},{'context_scope':[]},{'context_answers':1},
                        {'context_resources':'true'},{'history_turns':0},{'history_turns':True}):
            with self.subTest(changes=changes),self.assertRaises(tutor.TutorError): tutor.context_options(changes)

    def test_context_settings_persist_restore_and_old_client_preserves_values(self):
        data=dict(self.config,remember_key=False,thinking='disabled',context_scope='current',context_answers=False,context_resources=False,history_turns=None)
        with patch.object(tutor,'CONFIG',None),patch.object(tutor,'RESTORED_ROOT',None),patch.object(tutor,'RESTORE_ERROR',''):
            tutor.configure(self.root,data)
            tutor.CONFIG=None;tutor.RESTORED_ROOT=None
            result=tutor.config_status(self.root)
            for key in tutor.CONTEXT_DEFAULTS:self.assertEqual(result['settings'][key],data[key])
            result=tutor.configure(self.root,dict(self.config,remember_key=False))
            for key in tutor.CONTEXT_DEFAULTS:self.assertEqual(result['settings'][key],data[key])

    def test_unknown_lesson_rejected_and_no_history_created(self):
        with self.assertRaises(tutor.TutorError):tutor.course_context(self.root,'9999-not-generated')
        self.assertEqual(list((self.root/'learner-chats').glob(SLUG+'.json')),[])

    def test_formal_lesson_slug_starting_with_s_is_not_a_supplement(self):
        self.write('lessons/0003-safe-tools.html','<main><h1>第3课 · 安全工具</h1></main>')
        answer=tutor.parse_answer({'choices':[{'message':{'content':'模拟'},'finish_reason':'stop'}]})
        with patch.object(tutor,'model_request',return_value=answer):
            record=tutor.chat(self.root,'0003-safe-tools',{'message':'当前在哪节课？'})
        self.assertEqual(record['context_manifest']['current_page']['kind'],'formal')


if __name__=='__main__':unittest.main()
