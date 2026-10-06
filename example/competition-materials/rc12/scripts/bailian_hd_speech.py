"""MiniMax HD auditions through Bailian; original audio and credentials stay local."""
import argparse
import getpass
import hashlib
import json
import math
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

from build_expressive_samples import ENDPOINTS, NoRedirect, fingerprint

MODEL = 'MiniMax/speech-2.8-hd'
VOICE_MODEL = 'MiniMax/speech-2.8-turbo'
def payload(text, voice, speed=1.25, emotion=None):
    if not isinstance(text, str) or not 0 < len(text) <= 600:
        raise RuntimeError('Audition text must contain 1–600 characters')
    if not isinstance(voice, str) or not voice or len(voice)>160:
        raise RuntimeError('Missing or invalid system voice ID')
    if isinstance(speed, bool) or not isinstance(speed, (int,float)) or not math.isfinite(speed) or not .5 <= speed <= 2:
        raise RuntimeError('Provider speed must be between 0.5 and 2')
    settings={'voice_id':voice,'speed':speed,'vol':1,'pitch':0}
    if emotion is not None:
        if emotion not in ('happy','sad','angry','fearful','disgusted','surprised','calm'):
            raise RuntimeError('Unsupported HD emotion')
        settings['emotion']=emotion
    return {'model':MODEL,'input':{'text':text,'voice_setting':settings,
        'audio_setting':{'sample_rate':32000,'format':'wav','channel':1},
        'output_format':'hex','language_boost':'auto','subtitle_enable':False}}


def output(result):
    if not isinstance(result,dict) or result.get('code'):
        raise RuntimeError('HD provider reported failure; no automatic retry')
    value=result.get('output')
    status=value.get('base_resp') if isinstance(value,dict) else None
    if not isinstance(status,dict) or status.get('status_code')!=0:
        raise RuntimeError('HD provider did not return a successful result; no automatic retry')
    return value


def audio_bytes(result):
    data=output(result).get('data')
    if not isinstance(data,dict) or data.get('status')!=2:
        raise RuntimeError('HD audio is missing or incomplete')
    encoded=data.get('audio')
    if not isinstance(encoded,str) or not encoded or len(encoded)>40*1024*1024 or not re.fullmatch(r'(?:[0-9a-fA-F]{2})+',encoded):
        raise RuntimeError('HD provider returned invalid hex audio')
    return bytes.fromhex(encoded)


def request(key, body):
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
    req=urllib.request.Request(ENDPOINTS['beijing'],data=json.dumps(body).encode(),
        headers={'Content-Type':'application/json','Authorization':'Bearer '+key})
    try:
        with opener.open(req,timeout=90) as response:
            data=response.read(50*1024*1024+1)
            if len(data)>50*1024*1024:
                raise RuntimeError('HD provider output exceeded size limit')
            result=json.loads(data)
    except urllib.error.HTTPError as error:
        try:
            failure=json.loads(error.read(65536))
            detail=str(failure.get('message','')).replace(key,'[redacted]')
            detail=re.sub(r'https?://\S+|sk-[A-Za-z0-9._-]+','[redacted]',detail)
            detail=re.sub(r'[\r\n\x00-\x1f]',' ',detail)[:400]
            code=str(failure.get('code','unavailable'))
            if not re.fullmatch(r'[A-Za-z0-9_.-]{1,80}',code): code='unavailable'
        except (ValueError,AttributeError,TypeError):
            detail='';code='unavailable'
        raise RuntimeError(f'HD provider HTTP {error.code}; code={code}; {detail}; no automatic retry') from None
    except urllib.error.URLError:
        raise RuntimeError('HD provider network/TLS failure; no automatic retry') from None
    output(result)
    return result


def voices(work, key):
    result=request(key,{'model':VOICE_MODEL,'input':{'action':'get_voice','voice_type':'system'}})
    system=output(result).get('system_voice')
    if not isinstance(system,list) or not system:
        raise RuntimeError('No system voice list returned')
    cleaned=[{field:v.get(field) for field in ('voice_id','voice_name','description')} for v in system if isinstance(v,dict)]
    (work/'system-voices.json').write_text(json.dumps(cleaned,ensure_ascii=False,indent=2),encoding='utf8')
    for item in cleaned:
        label=json.dumps(item,ensure_ascii=False)
        if re.search(r'Chinese|中文|普通话|female-qn|male-qn',label,re.I):
            print(label,flush=True)
    print(f'PASS: {len(cleaned)} system voices queried; no custom voices requested',flush=True)


def audition(work, key, plan_file, cached_only=False):
    plan=json.loads(plan_file.read_text(encoding='utf8'))
    report={'kind':'bailian_minimax_hd_auditions','model':MODEL,'region':'beijing',
        'new_synthesis_requests':0,'postprocessing':'loudness_only; no tempo or pitch modification',
        'subjective_listening_review':'pending','samples':[]}
    for variant in plan['variants']:
        if not re.fullmatch(r'[a-z0-9-]{1,60}',variant['id']):
            raise RuntimeError('Invalid audition file ID')
        body=payload(variant.get('text',plan['text']),variant['voice'],variant['speed'],variant.get('emotion'))
        raw=work/(variant['id']+'.wav');cache=work/(variant['id']+'.source.json')
        old=json.loads(cache.read_text(encoding='utf8')) if cache.exists() else {}
        signature=fingerprint(body)
        if not raw.exists() or old.get('fingerprint')!=signature:
            if cached_only:
                raise RuntimeError('Matching HD audition cache unavailable; no provider request sent')
            result=request(key,body)
            raw.write_bytes(audio_bytes(result))
            cache.write_text(json.dumps({'fingerprint':signature}),encoding='utf8')
            report['new_synthesis_requests']+=1
        duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration',
            '-of','default=noprint_wrappers=1:nokey=1',str(raw)],text=True))
        if not .5<duration<60:
            raise RuntimeError('Unexpected HD audition duration')
        subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(raw),'-f','null','-'],check=True)
        target=work/(variant['id']+'.mp3')
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(raw),'-af','loudnorm=I=-18:TP=-2:LRA=7',
            '-ar','32000','-ac','1','-b:a','128k',str(target)],check=True)
        report['samples'].append({**variant,'text':body['input']['text'],'seconds':duration,
            'file':target.name,'raw_sha256':hashlib.sha256(raw.read_bytes()).hexdigest(),
            'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'decode':'pass'})
        print(f'HD SPEECH {variant["id"]}: {duration:.2f}s; provider speed {variant["speed"]}',flush=True)
    (work/'hd-audition-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print('PASS: HD auditions ready; listening review pending',flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('phase',choices=['voices','audition'])
    parser.add_argument('work',type=Path);parser.add_argument('--plan',type=Path)
    parser.add_argument('--cached-only',action='store_true');args=parser.parse_args()
    try:
        work=args.work.resolve();work.mkdir(exist_ok=True,parents=True)
        if args.phase=='voices' and args.cached_only:
            raise RuntimeError('Voice-list query is a provider request')
        if args.phase=='audition' and args.plan is None:
            raise RuntimeError('Provide an audition plan')
        key='' if args.cached_only else getpass.getpass('Bailian API Key (hidden): ').strip()
        if not key and not args.cached_only:
            raise RuntimeError('Missing speech credential')
        if args.phase=='voices': voices(work,key)
        else: audition(work,key,args.plan,args.cached_only)
    except Exception as error:
        print(str(error) if isinstance(error,RuntimeError) else 'HD speech request or media check failed; inspect local artifacts.',file=sys.stderr)
        sys.exit(1)
