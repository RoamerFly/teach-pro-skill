"""Refresh selected shots and remove duplicate opening narration, offline only."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
from make_dialogue_video import ASS_HEADER, seconds, stamp

ROOT=Path(__file__).resolve().parents[1]
OLD_SHA='fb8119ecd89c7c65767726f64b88d32b6bfb61b9dd2010202b52b0759dfe0c25'
def sha(file):return hashlib.sha256(file.read_bytes()).hexdigest()
def run(*args,**kwargs):subprocess.run([str(a) for a in args],check=True,**kwargs)
def parse_stamp(text):
    h,m,s=text.replace(',','.').split(':');return int(h)*3600+int(m)*60+float(s)

def build(work,capture,accepted=ROOT):
    work=work.resolve();capture=capture.resolve()
    if work.exists():raise ValueError('Choose a new output folder')
    work.mkdir(parents=True)
    movie=ROOT/'学途智伴师生演示视频.mp4'
    assert sha(accepted/movie.name)==OLD_SHA
    for name in ('学途智伴师生演示视频.mp4','学途智伴师生演示字幕.srt','dialogue-video-audit.json','dialogue-video-chapters.json'):
        shutil.copy2(accepted/name,work/name)
    source=work/movie.name
    old=json.loads((work/'dialogue-video-chapters.json').read_text(encoding='utf-8'))
    srt=(work/'学途智伴师生演示字幕.srt').read_text(encoding='utf-8')
    cues=[(parse_stamp(a),parse_stamp(b),text.strip()) for a,b,text in re.findall(r'\d+\s*\n(\d\d:\d\d:\d\d,\d{3}) --> (\d\d:\d\d:\d\d,\d{3})\n(.*?)(?:\n\s*\n|\Z)',srt,re.S)]
    assert len(cues)==80
    final_cues=[];chapters=[];clips=[];cursor=0;preserved=[]
    for index,chapter in enumerate(old['chapters']):
        start=chapter['start'];length=17.44 if index==0 else 17.56 if index==5 else chapter['seconds']
        title=chapter['title'];local=[]
        for a,b,text in cues:
            if start-.001<=a<start+chapter['seconds']-.001 and (index!=0 or a<17.44):
                local.append((a-start,b-start,text))
        if index==5:
            title='06 · DeepSeek 配置与统一上下文设置'
            local.append((15.3,17.4,'整门教材共享 · 当前提问页定位'))
        if index==9:title='10 · 每题后作答，课末记录疑难'
        lines=[f'Dialogue: 0,0:00:00.00,{stamp(length,True)},Chapter,,0,0,0,,{title}']
        for a,b,text in local:
            lines.append(f'Dialogue: 1,{stamp(a,True)},{stamp(min(b,length),True)},{"Student" if text.startswith("同学") else "Teacher"},,0,0,0,,{text}')
            final_cues.append((cursor+a,cursor+min(b,length),text))
        ass=work/f'scene-{index+1:02}.ass';ass.write_text(ASS_HEADER+'\n'.join(lines)+'\n',encoding='utf-8')
        target=work/f'scene-{index+1:02}.mp4'
        args=['ffmpeg','-v','error','-y','-ss',str(start),'-i',source]
        replacement={1:'assessment',2:'lesson',3:'resources',4:'question',9:'practice'}.get(index)
        if replacement:
            raw=capture/(replacement+'.webm');duration=seconds(raw)
            args+=['-ss',str(max(0,duration-length)),'-i',raw]
            video=f'[1:v]fps=25,scale=1440:810,setsar=1,tpad=stop_mode=clone:stop_duration={length},trim=duration={length},setpts=PTS-STARTPTS,pad=1440:900:0:0:color=0x172c40,ass={ass.name}[v]'
        elif index==5:
            raw=capture/'context.webm';duration=seconds(raw)
            args+=['-ss',str(max(0,duration-8)),'-i',raw]
            video=(f'[0:v]crop=1440:810:0:0,trim=duration=9.56,setpts=PTS-STARTPTS[a];'
                   '[1:v]crop=850:360:210:350,scale=1440:610,pad=1440:810:0:100:color=0xf4f7fb,fps=25,setsar=1,tpad=stop_mode=clone:stop_duration=8,trim=duration=8,setpts=PTS-STARTPTS[b];'
                   f'[a][b]concat=n=2:v=1:a=0,pad=1440:900:0:0:color=0x172c40,ass={ass.name}[v]')
        else:
            # Reuse complete accepted shots with their approved subtitles and voices.
            video=f'[0:v]trim=duration={length},setpts=PTS-STARTPTS[v]'
            preserved.append(chapter['id'])
        audio=(f'[0:a]atrim=duration={min(length,chapter["seconds"])},asetpts=PTS-STARTPTS,apad,atrim=duration={length}[aout]')
        run(*args,'-filter_complex',video+';'+audio,'-map','[v]','-map','[aout]','-t',str(length),'-r','25',
            '-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2','-b:a','160k',target,cwd=work)
        clips.append(target)
        new=copy.deepcopy(chapter);new.update(start=round(cursor,3),seconds=length,title=title,
            picture_source='current_rc15_ui_recording' if replacement or index==5 else chapter['picture_source'])
        if index==0:new['edit_strategy']='remove duplicated continuation narration; preserve first complete dialogue'
        elif index==5:new['edit_strategy']='preserve real model-list sequence; append current context controls; reuse approved voice'
        elif replacement:new['edit_strategy']='replace picture with current UI; preserve approved voice and matching subtitles'
        chapters.append(new);cursor+=length
        print('Rendered',index+1,chapter['id'],flush=True)
    listing=work/'concat.txt';listing.write_text('\n'.join("file '"+p.as_posix()+"'" for p in clips)+'\n',encoding='utf-8')
    final=work/'rc15-final.mp4'
    run('ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',listing,'-c','copy','-movflags','+faststart',final)
    duration=seconds(final);assert 0<duration<180
    run('ffmpeg','-v','error','-xerror','-i',final,'-f','null','-')
    final_cues.sort()
    assert all(0<=a<b<=duration for a,b,_ in final_cues)
    assert all(final_cues[i][1]<=final_cues[i+1][0]+.002 for i in range(len(final_cues)-1))
    shutil.copy2(final,movie)
    (ROOT/'学途智伴师生演示字幕.srt').write_text('\n\n'.join(f'{i}\n{stamp(a)} --> {stamp(b)}\n{text}' for i,(a,b,text) in enumerate(final_cues,1))+'\n',encoding='utf-8')
    old.update(seconds=duration,version='1.1.0-rc.15',chapters=chapters,media_revision='2026-10-26',
               new_provider_requests=0,new_speech_synthesis_requests=0,
               body_edit='current UI shots replace assessment/lesson/resources/question/context/inline answers; accepted real answers retained',
               subjective_listening_review='approved voices retained at original pace; no new synthesis')
    (ROOT/'dialogue-video-chapters.json').write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    for index,chapter in enumerate(chapters):
        for fraction in (.25,.75):
            run('ffmpeg','-v','error','-y','-ss',str(chapter['start']+chapter['seconds']*fraction),'-i',final,'-frames:v','1',work/f'qa-{index+1:02}-{int(fraction*100)}.png')
    audit={'seconds':duration,'bytes':movie.stat().st_size,'sha256':sha(movie),'full_decode':'pass',
           'subtitle_cues':len(final_cues),'provider_requests':4,'new_provider_requests':0,'new_speech_synthesis_requests':0,
           'media_revision':'2026-10-26','accepted_source_sha256':OLD_SHA,
           'architecture_sha256':sha(ROOT/'assets/teach-pro-workflow-architecture-v2-connected.png'),
           'preserved_body_clips':preserved,'replaced_shots':['assessment','lesson','resources','question-origin','settings/context','save'],
           'visual_review':'pending','subjective_listening_review':'approved source voice reused without speed change',
           'runtime_capture_audit':json.loads((capture/'capture-audit.json').read_text(encoding='utf-8'))}
    volume=subprocess.run(['ffmpeg','-hide_banner','-i',str(final),'-vn','-af','volumedetect','-f','null','-'],capture_output=True,text=True,encoding='utf-8',errors='replace',check=True)
    audit['max_volume_db']=float(re.search(r'max_volume: ([\-\d.]+) dB',volume.stderr)[1]);assert audit['max_volume_db']<0
    (ROOT/'dialogue-video-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':'pass','seconds':duration,'subtitle_cues':len(final_cues),'new_provider_requests':0}))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('work',type=Path);parser.add_argument('capture',type=Path);parser.add_argument('--accepted-materials',type=Path,default=ROOT)
    args=parser.parse_args();build(args.work,args.capture,args.accepted_materials)
