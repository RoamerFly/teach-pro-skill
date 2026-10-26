"""Align freshly generated dialogue with the current course's recorded actions."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
from make_dialogue_video import ASS_HEADER, seconds, stamp, subtitle_parts

ROOT=Path(__file__).resolve().parents[1]


def run(*args,**kwargs):subprocess.run([str(a) for a in args],check=True,**kwargs)


def layout(work):
    plan=json.loads((work/'performance-plan.json').read_text(encoding='utf-8'))
    previous=json.loads((ROOT/'dialogue-video-chapters.json').read_text(encoding='utf-8'))
    timeline=0
    audit={'kind':'fresh_two_role_bailian_emotional_speech','region':'beijing','roles':plan['roles'],
           'voice_revision':plan['revision'],'utterances':[],'subjective_listening_review':'pending-user-listening',
           'postprocessing':'loudness normalization only; native speed; no pitch or tempo manipulation'}
    for i,scene in enumerate(plan['scenes'],1):
        cursor=2 if scene['id']=='connection' else .2
        cues=[];clips=[]
        for j,turn in enumerate(scene['turns'],1):
            if scene['id'] in ['tutor-answer','followup'] and turn['role']=='teacher':
                cursor=max(cursor,5.67 if scene['id']=='tutor-answer' else 7.63)
            turn['start_seconds']=round(cursor,5)
            for k,seg in enumerate(turn['segments'],1):
                file=Path(seg['file']);assert file.exists()
                length=seconds(file);seg['start_seconds']=round(cursor,5);clips.append((file,cursor))
                chunks=subtitle_parts(seg['text'],36);weight=sum(map(len,chunks));start=cursor
                for text in chunks:
                    end=start+length*len(text)/weight;cues.append({'start':start,'end':end,'role':turn['role'],'text':text});start=end
                audit['utterances'].append({'scene':scene['id'],'role':turn['role'],
                    'voice':plan['roles'][turn['role']]['voice'],'model':plan['roles'][turn['role']]['model'],
                    'text':seg['text'],'seconds':length,'start_seconds':cursor,'native_speed':seg['speed'],
                    'emotion':seg.get('emotion','automatic'),'direction':seg.get('direction',turn.get('delivery')),
                    'direction_sent_to_provider':False,'sha256':seg['sha256'],'decode':'pass'})
                cursor+=length
                if k<len(turn['segments']):cursor+=.12
            turn['end_seconds']=round(cursor,5)
            if j<len(scene['turns']):cursor+=.25
        length=scene['old_seconds'];assert cursor+.2<=length, f'{scene["id"]} voice exceeds footage: {cursor}/{length}'
        scene.update(seconds=length,start=timeline,subtitle_cues=cues)
        args=[];filters=[]
        for n,(file,offset) in enumerate(clips):
            args+=['-i',file];filters.append(f'[{n}:a]aresample=32000,adelay={round(offset*1000)}:all=1[a{n}]')
        filters.append(''.join(f'[a{n}]' for n in range(len(clips)))+f'amix=inputs={len(clips)}:normalize=0,apad,atrim=duration={length}[out]')
        run('ffmpeg','-v','error','-y',*args,'-filter_complex',';'.join(filters),'-map','[out]',
            '-ar','32000','-ac','1','-c:a','pcm_s16le',work/'audio'/f'scene-{i:02}.wav')
        timeline+=length
    assert timeline<180
    audit['seconds']=round(timeline,5);audit['segments']=len(audit['utterances'])
    (work/'aligned-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (work/'voice-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':'aligned','seconds':timeline,'segments':audit['segments']}))


def render(work,capture):
    plan=json.loads((work/'aligned-plan.json').read_text(encoding='utf-8'))
    previous=json.loads((ROOT/'dialogue-video-chapters.json').read_text(encoding='utf-8'))
    recording=json.loads((capture/'capture-audit.json').read_text(encoding='utf-8'));assert recording['status']=='pass'
    raw=capture/'current-ui.webm'
    pixels=subprocess.check_output(['ffmpeg','-v','error','-i',str(raw),'-vf',
        'fps=25,crop=4:4:700:802,scale=1:1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'])
    marked=[i for i in range(len(pixels)//3) if min(pixels[i*3],pixels[i*3+2])>pixels[i*3+1]*1.5+25]
    groups=[]
    for frame in marked:
        if not groups or frame>groups[-1][-1]+1:groups.append([])
        groups[-1].append(frame)
    assert len(groups)==len(recording['scenes'])
    starts={s['id']:(g[-1]+1)/25 for s,g in zip(recording['scenes'],groups)}
    folder=work/'render';folder.mkdir(exist_ok=False)
    chapters=[];subtitles=[];clips=[]
    for i,scene in enumerate(plan['scenes'],1):
        length=scene['seconds'];ass=folder/f'scene-{i:02}.ass'
        lines=[f'Dialogue: 0,0:00:00.00,{stamp(length,True)},Chapter,,0,0,0,,{scene["title"]}']
        for c in scene['subtitle_cues']:
            text=plan['roles'][c['role']]['label']+'：'+c['text']
            lines.append(f'Dialogue: 1,{stamp(c["start"],True)},{stamp(c["end"],True)},{"Student" if c["role"]=="student" else "Teacher"},,0,0,0,,{text}')
            subtitles.append((scene['start']+c['start'],scene['start']+c['end'],text))
        ass.write_text(ASS_HEADER+'\n'.join(lines)+'\n',encoding='utf-8')
        if scene['id']=='home':
            inputs=['-loop','1','-framerate','25','-i',ROOT/'assets/teach-pro-workflow-architecture-v2-connected.png']
            picture=f'[0:v]scale=1440:810,setsar=1,trim=duration={length},setpts=PTS-STARTPTS'
        else:
            inputs=['-ss',str(starts[scene['id']]),'-i',raw]
            picture=f'[0:v]fps=25,scale=1440:810,setsar=1,trim=duration={length-.16},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=1,trim=duration={length}'
        target=folder/f'scene-{i:02}.mp4'
        run('ffmpeg','-v','error','-y',*inputs,'-i',work/'audio'/f'scene-{i:02}.wav',
            '-filter_complex',picture+f',pad=1440:900:0:0:color=0x172c40,ass={ass.name}[v]',
            '-map','[v]','-map','1:a','-t',str(length),'-r','25','-c:v','libx264','-preset','fast',
            '-crf','20','-pix_fmt','yuv420p','-af','loudnorm=I=-18:TP=-2:LRA=7','-c:a','aac',
            '-ar','48000','-ac','2','-b:a','160k',target,cwd=folder)
        chapters.append({**previous['chapters'][i-1], 'start':scene['start'],'seconds':length,
            'picture_source':'architecture_figure' if scene['id']=='home' else 'current_rc16_ui_recording',
            'edit_strategy':'fresh role performance; per-scene synchronized current UI'})
        clips.append(target);print('Rendered '+scene['id'],flush=True)
    listing=folder/'concat.txt';listing.write_text('\n'.join("file '"+p.as_posix()+"'" for p in clips)+'\n',encoding='utf-8')
    final=work/'expressive-final.mp4';run('ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',listing,'-c','copy','-movflags','+faststart',final)
    run('ffmpeg','-v','error','-xerror','-i',final,'-f','null','-')
    duration=seconds(final);assert duration<180
    assert all(0<=a<b<=duration for a,b,_ in subtitles)
    assert all(subtitles[n][1]<=subtitles[n+1][0]+.002 for n in range(len(subtitles)-1))
    srt=work/'学途智伴师生演示字幕.srt';srt.write_text('\n\n'.join(f'{n}\n{stamp(a)} --> {stamp(b)}\n{text}' for n,(a,b,text) in enumerate(subtitles,1))+'\n',encoding='utf-8')
    metadata={**previous,'seconds':duration,'roles':plan['roles'],'chapters':chapters,
              'media_revision':'2026-10-26-fresh-emotional-voices','new_speech_synthesis_requests':len([g for s in plan['scenes'] for t in s['turns'] for g in t['segments']]),
              'voice_strategy':'native_bailian_hd_emotion_per_segment','body_edit':'latest UI recorded to revised performance cues',
              'subjective_listening_review':'pending-user-listening','subtitle_timing':'fresh utterance audio measured; proportional short phrase timing'}
    (work/'dialogue-video-chapters.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    volume=subprocess.run(['ffmpeg','-hide_banner','-i',str(final),'-vn','-af','volumedetect','-f','null','-'],capture_output=True,text=True,encoding='utf-8',errors='replace',check=True)
    peak=float(re.search(r'max_volume: ([\-\d.]+) dB',volume.stderr)[1]);assert peak<0
    audit={'seconds':duration,'bytes':final.stat().st_size,'sha256':hashlib.sha256(final.read_bytes()).hexdigest(),
           'version':'1.1.0-rc.16','media_revision':metadata['media_revision'],'full_decode':'pass','visual_review':'pending',
           'subjective_listening_review':'pending-user-listening','max_volume_db':peak,'subtitle_cues':len(subtitles),
           'provider_requests':4,'new_provider_requests':0,'new_speech_synthesis_requests':metadata['new_speech_synthesis_requests'],
           'audio_stream_identical':False,'all_voice_segments_fresh':True,'roles':plan['roles'],'runtime_capture_audit':recording}
    (work/'dialogue-video-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    for i,c in enumerate(chapters,1):
        for f in [.25,.75]:run('ffmpeg','-v','error','-y','-ss',str(c['start']+c['seconds']*f),'-i',final,'-frames:v','1',work/f'qa-{i:02}-{int(f*100)}.png')
    print(json.dumps({'status':'rendered','seconds':duration,'subtitle_cues':len(subtitles),'peak_db':peak}))


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('phase',choices=['layout','render']);p.add_argument('work',type=Path);p.add_argument('--capture',type=Path);a=p.parse_args()
    if a.phase=='layout':layout(a.work.resolve())
    else:render(a.work.resolve(),a.capture.resolve())
