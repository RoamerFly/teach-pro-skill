"""Offline MiniMax HD parameter and complete-audio checks; no provider requests."""
import importlib.util
import io
import json
import sys
import unittest
from unittest.mock import patch,Mock
from urllib.error import HTTPError
from pathlib import Path

SCRIPTS=Path(__file__).resolve().parents[1]/'example/competition-materials/rc12/scripts'
sys.path.insert(0,str(SCRIPTS))
spec=importlib.util.spec_from_file_location('hd_speech',SCRIPTS/'bailian_hd_speech.py')
hd=importlib.util.module_from_spec(spec);spec.loader.exec_module(hd)


class HDSpeechTests(unittest.TestCase):
    def test_native_speed_and_emotion_are_not_qwen_instructions(self):
        body=hd.payload('今天先看图。','female-system',1.25,'happy')
        self.assertEqual(body['model'],'MiniMax/speech-2.8-hd')
        self.assertEqual(body['input']['voice_setting'],{'voice_id':'female-system','speed':1.25,'vol':1,'pitch':0,'emotion':'happy'})
        self.assertNotIn('instructions',body['input'])
        self.assertNotIn('tempo',body['input'])
        self.assertEqual(body['input']['output_format'],'hex')

    def test_automatic_emotion_omits_explicit_setting(self):
        self.assertNotIn('emotion',hd.payload('原文','voice')['input']['voice_setting'])

    def test_invalid_speed_or_unsupported_emotion_rejected(self):
        for value in (0.49,2.01,True,float('inf'),float('nan'),'1.25'):
            with self.subTest(value=value),self.assertRaises(RuntimeError): hd.payload('原文','voice',value)
        with self.assertRaises(RuntimeError): hd.payload('原文','voice',1,'whisper')

    def test_text_budget_and_voice_validation(self):
        for text in ('','文'*601,None):
            with self.subTest(text=type(text)),self.assertRaises(RuntimeError): hd.payload(text,'voice')
        with self.assertRaises(RuntimeError): hd.payload('原文','')

    def test_completed_hex_audio_preserves_bytes(self):
        result={'output':{'base_resp':{'status_code':0},'data':{'status':2,'audio':'52494646'}}}
        self.assertEqual(hd.audio_bytes(result),b'RIFF')

    def test_failed_missing_partial_or_invalid_audio_is_rejected(self):
        for value in (None,{'output':None},{'output':{'base_resp':None}},
            {'output':{'base_resp':{'status_code':1004}}},
            {'code':'failure','output':{'base_resp':{'status_code':0}}}):
            with self.subTest(value=value),self.assertRaises(RuntimeError): hd.output(value)
        for data in (None,{'status':1,'audio':'12'},{'status':2,'audio':''},
            {'status':2,'audio':'123'},{'status':2,'audio':'https://host/audio'}, {'status':2,'audio':'zz'}):
            with self.subTest(data=data),self.assertRaises(RuntimeError):
                hd.audio_bytes({'output':{'base_resp':{'status_code':0},'data':data}})

    def test_http_diagnostic_preserves_cause_without_credential_or_url(self):
        key='test-credential-placeholder'
        body={'code':'InvalidParameter','message':'The product is not activated. '+key+' https://provider/path?signature=test'}
        error=HTTPError('https://provider/',400,'Bad request',{},io.BytesIO(json.dumps(body).encode()))
        opener=Mock();opener.open.side_effect=error
        with patch.object(hd.urllib.request,'build_opener',return_value=opener):
            with self.assertRaises(RuntimeError) as caught: hd.request(key,{'model':hd.MODEL})
        message=str(caught.exception)
        self.assertIn('The product is not activated',message)
        self.assertNotIn(key,message)
        self.assertNotIn('https://provider',message)
        self.assertEqual(opener.open.call_count,1)


if __name__=='__main__': unittest.main()
