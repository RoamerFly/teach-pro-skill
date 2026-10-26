"""Fresh Bailian role performances; credentials remain in process memory."""
import argparse
import getpass
import hashlib
import json
import re
from pathlib import Path
import subprocess

import bailian_hd_speech as hd
from build_expressive_samples import fingerprint
from make_dialogue_video import canonical_pcm_wave, seconds

ROOT = Path(__file__).resolve().parents[1]


def request_payload(segment, role):
    voice='Chinese (Mandarin)_Wise_Women' if role=='teacher' else 'Chinese (Mandarin)_Gentleman'
    return hd.payload(segment['text'],voice,segment['speed'],segment.get('emotion'))


def build_plan(accepted):
    script=json.loads((ROOT/'dialogue-plan.json').read_text(encoding='utf-8'))
    archived=json.loads((accepted/'capture-plan.json').read_text(encoding='utf-8'))
    actual={s['id']:s.get('live_answer') for s in archived['scenes']}
    chapters=json.loads((ROOT/'dialogue-video-chapters.json').read_text(encoding='utf-8'))
    teacher_splits={
        'home':['那就从你的基础开始！','学途智伴是一个 Skill 技能包。导入 TeleAgent，告诉它你想学什么，先评估，再开课。'],
        'assessment':['先做几道入门题，再写下目标和每周能学多久。','答案会自动保存，教学 AI 据此安排课程。接下来，看看第一课！'],
        'lesson':['先看图：程序把消息发给模型，再拿回回答。','对照代码找一找：这次请求，到底带了哪些消息？'],
        'resources':['往下看，就是本课论文和视频。','带着这里的小任务去读，回来试着用自己的话解释。'],
        'question-origin':['问得好！','点顶部的“问 AI”，就能结合教材讨论。第一次用，先连接一个答疑模型。'],
        'connection':['连接成功！','点“返回第一课”，答疑窗口就回来了。现在，把刚才代码里的疑问发给它。'],
        'save':['对，这就说清楚了！','把解释写进练习，再记下疑难。答案和对话都会保存，教学 AI 就能据此安排续课。'],
        'continuation':['回到 TeleAgent，请它读取学习记录，再生成下一课。','这样，下一课就知道你学会了什么，还卡在哪里。'],
        'adaptive':['来看已有的续课结果。','正式课继续学工具契约；旧课的误解，放进关联补充页。补上薄弱处，也接着学新内容。'],
        'closing':['没错！','学途智伴，用一个 Skill，把评估、理解、提问和续课，串成持续的学习。']}
    student_intents={
        'home':'向熟悉的老师坦诚求教。第一句陈述已有基础，后半句说出困惑，句尾轻轻上扬，有真实求助感。',
        'resources':'听懂老师讲解后，自然产生兴趣，真诚好奇地问一个简短问题，重点是“去哪儿看”，疑问句尾上扬。',
        'question-origin':'刚在代码中发现一个疑点，“欸”带轻微惊讶，随后认真求证，重读“上一轮”，最后是真实的疑问语气。',
        'tutor-answer':'承接刚才的讨论，把问题问完整，重读“只发新问题”和“上一轮”，语气认真，句尾有清楚的疑问起伏。',
        'followup':'先恍然大悟，“哦”自然舒展，语气有明白后的轻松；接着提出新的求证，重读“就算智能体了吗”，结尾上扬。',
        'save':'刚想通问题，带克制的高兴和确定感说“明白了”，然后流畅说出自己的理解，语气明显比开场更有把握。',
        'closing':'轻松、安心地表达对下一次学习的期待，有浅浅笑意，句子自然收束。'}
    out=[]
    for scene,chapter in zip(script['scenes'],chapters['chapters']):
        item={'id':scene['id'],'title':chapter['title'],'old_seconds':chapter['seconds'],'turns':[]}
        for index,turn in enumerate(scene['turns']):
            role=turn['role']
            text=actual[scene['id']] if turn.get('source')=='live-answer' else turn['text']
            if role=='student':
                instructions=('温润磁性、沉稳成年男声，用清楚自然的普通话，与坐在对面的老师交谈。'
                    '正常偏利落的日常交流语速，短停顿，句子连贯，有明确的重音和语调起伏。'+student_intents[scene['id']]+
                    '只朗读给定台词；情绪自然克制，不作新闻播报，不拖长字，不附加其他声音。')
                # Intent is production metadata; only the model's actual native
                # parameters below are sent. Never claim an unused prompt took effect.
                emotion={'question-origin':'surprised','followup':'surprised','save':'happy','closing':'happy'}.get(scene['id'])
                segments=[{'text':text,'direction':instructions,'speed':1.19,
                           **({'emotion':emotion} if emotion else {})}]
            else:
                if scene['id'] in teacher_splits:
                    if index != len(scene['turns'])-1: raise ValueError('Unexpected teacher turn count')
                    texts=teacher_splits[scene['id']]
                else:texts=[text]
                segments=[]
                for n,part in enumerate(texts):
                    # Native emotion on responses; automatic contextual prosody for
                    # longer mechanisms rather than forcing all explanations neutral.
                    emotion='happy' if scene['id'] not in ['lesson','tutor-answer','followup'] else None
                    if scene['id']=='lesson' and n==1:emotion='surprised'
                    speed=1.27 if len(part)<14 else 1.30
                    segments.append({'text':part,'speed':speed,**({'emotion':emotion} if emotion else {})})
                text=''.join(texts)
            item['turns'].append({'role':role,'spoken_text':text,'source':turn.get('source','script'),
                                  'delivery':turn.get('delivery'),'segments':segments})
        out.append(item)
    return {'version':'1.1.0-rc.16','revision':'2026-10-26-expressive-v2','scenes':out,
            'roles':{'teacher':{'voice':'Chinese (Mandarin)_Wise_Women','model':hd.MODEL,'label':'老师'},
                     'student':{'voice':'Chinese (Mandarin)_Gentleman','model':hd.MODEL,'label':'同学'}},
            'sources':['https://help.aliyun.com/zh/model-studio/minimax-synchronous-speech-synthesis-api',
                       'https://help.aliyun.com/zh/model-studio/qwen3-tts-instruct-flash']}


def synthesize(work,plan,key,samples=False):
    audio=work/'audio';audio.mkdir(exist_ok=True)
    audit={'new_synthesis_requests':0,'requests':[],'region':'beijing','status':'in-progress'}
    chosen={'question-origin','followup'} if samples else None
    order=list(enumerate(plan['scenes'],1))
    if samples:order.sort(key=lambda pair: pair[1]['id']!='question-origin')
    for i,scene in order:
        if chosen and scene['id'] not in chosen:continue
        turns=list(enumerate(scene['turns'],1))
        if samples:turns.sort(key=lambda pair:pair[1]['role']!='teacher')
        for j,turn in turns:
            for k,segment in enumerate(turn['segments'],1):
                name=f'{i:02}-{j:02}-{k:02}';body=request_payload(segment,turn['role']);sig=fingerprint(body)
                file=audio/(name+'.wav');meta=audio/(name+'.json')
                cache=json.loads(meta.read_text(encoding='utf-8')) if meta.exists() else {}
                if not file.exists() or cache.get('fingerprint')!=sig:
                    if not key:raise RuntimeError('Bailian credential is required for fresh synthesis')
                    raw=hd.audio_bytes(hd.request(key,body))
                    file.write_bytes(canonical_pcm_wave(raw));audit['new_synthesis_requests']+=1
                    meta.write_text(json.dumps({'fingerprint':sig,'payload':body},ensure_ascii=False,indent=2),encoding='utf-8')
                duration=seconds(file)
                if not .2<duration<60:raise RuntimeError('Unexpected speech duration')
                subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(file),'-f','null','-'],check=True)
                segment.update(file=str(file),seconds=duration,sha256=hashlib.sha256(file.read_bytes()).hexdigest())
                audit['requests'].append({'id':name,'role':turn['role'],'model':body['model'],'seconds':duration,'sha256':segment['sha256']})
                (work/'synthesis-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')
                (work/'performance-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
                print(f'Synthesized {name} {turn["role"]}: {duration:.2f}s',flush=True)
    audit['status']='samples-ready' if samples else 'synthesis-complete'
    (work/'synthesis-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('work',type=Path);p.add_argument('--accepted',type=Path,required=True)
    p.add_argument('--samples',action='store_true');p.add_argument('--key-stdin',action='store_true');p.add_argument('--key-file',type=Path);a=p.parse_args()
    a.work.mkdir(parents=True,exist_ok=True)
    if a.key_file:
        matches=re.findall(r'(?<![A-Za-z0-9_-])sk-[A-Za-z0-9_.-]+',a.key_file.read_text(encoding='utf-8-sig'))
        if len(matches)!=1:raise SystemExit('Credential file must contain exactly one API key')
        key=matches[0]
    else:key=(input().strip() if a.key_stdin else getpass.getpass('Bailian API Key (hidden): ')).strip()
    try:synthesize(a.work,build_plan(a.accepted),key,a.samples)
    except Exception as e:
        print(str(e) if isinstance(e,RuntimeError) else 'Synthesis failed; original media remains unchanged.',flush=True)
        raise SystemExit(1) from None
