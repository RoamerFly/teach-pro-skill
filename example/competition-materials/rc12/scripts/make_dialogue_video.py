"""Serial recording, mixed-provider speech and subtitle-rail rendering for rc.12."""
import argparse
import getpass
import hashlib
import json
import math
import os
import re
import subprocess
import struct
import shutil
import sys
import urllib.request
from pathlib import Path

from build_expressive_samples import ENDPOINTS, NoRedirect, audio_bytes, fingerprint, read_response
import bailian_hd_speech as hd

MATERIALS = Path(__file__).resolve().parents[1]


def run(*args, **kwargs):
    subprocess.run([str(a) for a in args], check=True, **kwargs)


def seconds(file):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1', str(file)], text=True, encoding='utf8'))


def stamp(value, ass=False):
    factor = 100 if ass else 1000
    whole, fraction = divmod(round(value * factor), factor)
    hour, rest = divmod(whole, 3600)
    minute, second = divmod(rest, 60)
    return f'{hour}:{minute:02}:{second:02}.{fraction:02}' if ass else f'{hour:02}:{minute:02}:{second:02},{fraction:03}'


def plain_answer(text):
    # Speech preserves the actual answer's words; remove only Markdown notation.
    if '```' in text:
        raise RuntimeError('Actual answer contains code; revise the speech plan before synthesis')
    return re.sub(r'(?m)^\s*#{1,6}\s+', '', text).replace('**', '').replace('`', '').strip()


def subtitle_parts(text, limit=26):
    sentences = re.findall(r'[^，。；！？、]+[，。；！？、]?', text)
    return [part[i:i+limit] for part in sentences for i in range(0, len(part), limit) if part[i:i+limit].strip()]


def canonical_pcm_wave(data):
    # Flash can return a completed PCM body with streaming RIFF length sentinels.
    # Repair only this known 44-byte PCM header; preserve every PCM sample.
    if len(data)<44 or data[:4]!=b'RIFF' or data[8:12]!=b'WAVE' or data[12:20]!=b'fmt \x10\x00\x00\x00' or data[36:40]!=b'data':
        return data
    riff_size, payload_size=struct.unpack_from('<I',data,4)[0],struct.unpack_from('<I',data,40)[0]
    if (riff_size,payload_size)!=(0x7fffffbf,0x7fffff9b):
        return data
    codec, channels, rate, byte_rate, align, bits=struct.unpack_from('<HHIIHH',data,20)
    if codec!=1 or bits!=16 or align!=channels*2 or byte_rate!=rate*align or (len(data)-44)%align:
        raise RuntimeError('Streaming WAV has incomplete or unsupported PCM samples')
    return data[:4]+struct.pack('<I',len(data)-8)+data[8:40]+struct.pack('<I',len(data)-44)+data[44:]


def record(session):
    key = getpass.getpass('DeepSeek API Key (hidden): ').strip()
    if not key:
        raise RuntimeError('Missing DeepSeek credential')
    run(os.environ.get('TEACH_PRO_NODE', 'node'), MATERIALS/'scripts/record_dialogue.cjs', session, '--live',
        input=key+'\n', text=True, encoding='utf8')


def playback_clip(source, target, tempo=1):
    """Modest pitch-preserving pacing; original provider audio stays untouched."""
    if isinstance(tempo, bool) or not isinstance(tempo, (int, float)) or not math.isfinite(tempo) or not 1 <= tempo <= 1.15:
        raise RuntimeError('Dialogue tempo must be a number between 1 and 1.15')
    if tempo == 1:
        return source
    if Path(source).resolve() == Path(target).resolve():
        raise RuntimeError('Playback target must not overwrite the source audio')
    run('ffmpeg','-v','error','-y','-i',source,'-af',f'atempo={tempo}',
        '-ar','24000','-ac','1','-c:a','pcm_s16le',target)
    return target


def speech_payload(text, role):
    """Use each model's native protocol; playback pacing is not a provider input."""
    if not isinstance(text, str) or not 0 < len(text) <= 600:
        raise RuntimeError('Speech utterance outside character budget')
    model = role['model']
    if model == hd.MODEL:
        if role.get('instructions'):
            raise RuntimeError('HD speech does not accept Qwen instructions')
        return hd.payload(text, role['voice'], role.get('speed', 1), role.get('emotion'))
    if model not in ('qwen3-tts-flash', 'qwen3-tts-instruct-flash'):
        raise RuntimeError('Unsupported dialogue speech model')
    body = {'model': model, 'input': {'text': text, 'voice': role['voice'], 'language_type': 'Chinese'}}
    if role.get('instructions'):
        if model != 'qwen3-tts-instruct-flash':
            raise RuntimeError('Speech instructions require the Qwen instruct model')
        body['input'].update(instructions=role['instructions'], optimize_instructions=True)
    return body


def voice(session, cached_only=False):
    plan = json.loads((session/'capture-plan.json').read_text(encoding='utf8'))
    current = json.loads((MATERIALS/'dialogue-plan.json').read_text(encoding='utf8'))
    if [s['id'] for s in current['scenes']] != [s['id'] for s in plan['scenes']]:
        raise RuntimeError('Recorded scenes differ from current dialogue plan')
    for scene, source in zip(plan['scenes'], current['scenes']):
        if scene.get('question') != source.get('question'):
            raise RuntimeError('Live question changed; recapture instead of relabeling the actual answer')
        scene['turns'] = source['turns']
    plan['roles'] = current['roles']
    plan['script_fingerprint'] = fingerprint(current)
    key = '' if cached_only else getpass.getpass('Bailian API Key (hidden): ').strip()
    if not key and not cached_only:
        raise RuntimeError('Missing speech credential')
    audio = session/'audio'; audio.mkdir(exist_ok=True)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    report = {'kind':'two_role_synthetic_speech', 'region':'beijing', 'roles':plan['roles'],
              'new_synthesis_requests':0, 'verification_mode':'cached_only' if cached_only else 'synthesis_or_cache',
              'subjective_listening_review':'pending', 'utterances':[]}
    timeline = 0
    for index, scene in enumerate(plan['scenes'], 1):
        scene['voice_start_seconds'] = timeline
        local = .2
        clips, cues = [], []
        for turn_index, turn in enumerate(scene['turns'], 1):
            text = plain_answer(scene['live_answer']) if turn.get('source') == 'live-answer' else turn['text']
            role = plan['roles'][turn['role']]
            body = speech_payload(text, role)
            name = f'{index:02}-{turn_index:02}'
            raw, cache = audio/(name+'.wav'), audio/(name+'.source.json')
            signature = fingerprint(body)
            old = json.loads(cache.read_text(encoding='utf8')) if cache.exists() else {}
            if not raw.exists() or old.get('fingerprint') != signature:
                if cached_only:
                    raise RuntimeError('Matching speech cache unavailable; no provider request sent')
                if role['model'] == hd.MODEL:
                    speech = hd.audio_bytes(hd.request(key, body))
                else:
                    request = urllib.request.Request(ENDPOINTS['beijing'], data=json.dumps(body).encode(),
                        headers={'Content-Type':'application/json', 'Authorization':'Bearer '+key})
                    data = json.loads(read_response(opener, request, 25*1024*1024))
                    if data.get('code'):
                        raise RuntimeError('Speech provider reported failure; no automatic retry')
                    speech = audio_bytes(data, opener)
                raw.write_bytes(speech)
                cache.write_text(json.dumps({'fingerprint':signature}), encoding='utf8')
                report['new_synthesis_requests'] += 1
            provider_bytes=raw.read_bytes()
            canonical=canonical_pcm_wave(provider_bytes)
            source=raw
            if canonical!=provider_bytes:
                source=audio/(name+'.pcm.wav');source.write_bytes(canonical)
            source_length = seconds(source)
            if not .5 < source_length < 60:
                raise RuntimeError('Unexpected utterance duration')
            run('ffmpeg','-v','error','-xerror','-i',source,'-f','null','-')
            tempo=role.get('tempo',1)
            source=playback_clip(source,audio/(name+'.playback.wav'),tempo)
            length=seconds(source)
            run('ffmpeg','-v','error','-xerror','-i',source,'-f','null','-')
            clips.append((source,local)); turn['spoken_text']=text; turn['seconds']=length
            parts = subtitle_parts(text,limit=36); weight = sum(map(len, parts)); start = local
            for part in parts:
                end = start + length*len(part)/weight
                cues.append({'start':start,'end':end,'text':part,'role':turn['role']}); start=end
            report['utterances'].append({'scene':scene['id'],'role':turn['role'],'voice':role['voice'],
                'model':role['model'],'text':text,'seconds':length,'source_seconds':source_length,
                'tempo':tempo,'provider_speed':role.get('speed'),
                'playback_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
                'source':turn.get('source','script'),
                'sha256':hashlib.sha256(provider_bytes).hexdigest(),'pcm_header_repaired':canonical!=provider_bytes,'decode':'pass'})
            local += length + .35
            print(f'SPEECH {name} {turn["role"]}: {length:.2f}s',flush=True)
        # Faster delivery must not eliminate time to watch configuration or read answers.
        reading_floor = {'settings':14,'tutor-answer':15,'followup':15}.get(scene['id'],0)
        length = math.ceil(max(local+.45, reading_floor)*25)/25
        scene['seconds']=length; scene['subtitle_cues']=cues
        inputs, streams = [], []
        for n,(file,delay) in enumerate(clips):
            inputs += ['-i',str(file)]
            streams.append(f'[{n}:a]aresample=24000,adelay={round(delay*1000)}:all=1[a{n}]')
        mix=''.join(f'[a{n}]' for n in range(len(clips)))+f'amix=inputs={len(clips)}:normalize=0,apad,atrim=duration={length}[out]'
        target=audio/f'scene-{index:02}.wav'
        run('ffmpeg','-v','error','-y',*inputs,'-filter_complex',';'.join(streams+[mix]),'-map','[out]',
            '-ar','24000','-ac','1','-c:a','pcm_s16le',target)
        timeline += length
    report['seconds']=timeline
    (session/'voice-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf8')
    (session/'dialogue-voice-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    if timeline>=180:
        raise RuntimeError(f'Speech timeline {timeline:.2f}s exceeds contest limit; shorten script instead of exceeding the modest tempo range')
    print(f'PASS: measured two-role timeline {timeline:.2f}s',flush=True)


ASS_HEADER = '''[Script Info]
ScriptType: v4.00+
PlayResX: 1440
PlayResY: 900
WrapStyle: 2
ScaledBorderAndShadow: yes
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Chapter,Microsoft YaHei,18,&H00D3E7F0,&H00FFFFFF,&H00172C40,&H00172C40,0,0,0,0,100,100,0,0,1,0,0,2,50,50,58,1
Style: Teacher,Microsoft YaHei,27,&H00FFFFFF,&H00FFFFFF,&H00172C40,&H00172C40,0,0,0,0,100,100,0,0,1,0,0,2,60,60,14,1
Style: Student,Microsoft YaHei,27,&H00BCEBD8,&H00FFFFFF,&H00172C40,&H00172C40,0,0,0,0,100,100,0,0,1,0,0,2,60,60,14,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''


def render(session):
    plan=json.loads((session/'voice-plan.json').read_text(encoding='utf8'))
    current=json.loads((MATERIALS/'dialogue-plan.json').read_text(encoding='utf8'))
    if plan.get('script_fingerprint')!=fingerprint(current) or sum(s['seconds'] for s in plan['scenes'])>=180:
        raise RuntimeError('Speech plan is stale or over the contest duration limit')
    operations=plan['live_operations']
    if [op['operation'] for op in operations]!=['models','test','chat','chat'] or any(op['local_http_status']!=200 for op in operations):
        raise RuntimeError('Missing successful real provider evidence')
    work=session/'render';work.mkdir(exist_ok=True)
    raw=session/'capture/raw.webm'
    offset=max(0,seconds(raw)-plan['capture_total_ms']/1000)
    if offset>1:
        raise RuntimeError('Video recording clock mismatch')
    chapters, srt, clips=[],[],[]
    for i,scene in enumerate(plan['scenes'],1):
        length=scene['seconds']; start=scene['capture_start_ms']/1000+offset
        captured=(scene['capture_end_ms']-scene['capture_start_ms'])/1000
        title=scene['title'];inputs=['-ss',f'{start:.4f}','-i',str(raw)];audio_index=1
        if scene['id']=='home':
            # Chromium's initial about:blank screencast can retain its old surface size.
            # This is a static overview card: use its actual full-viewport screenshot.
            inputs=['-loop','1','-framerate','25','-i',str(session/f'capture/scene-{i:02}.png')]
            vf='[0:v]setpts=PTS-STARTPTS,'
        elif captured>length+.4:
            lead=min(3,length/4);tail=length-lead
            inputs+=['-ss',f'{scene["capture_end_ms"]/1000+offset-tail:.4f}','-i',str(raw)]
            vf=f'[0:v]trim=duration={lead},setpts=PTS-STARTPTS[a];[1:v]trim=duration={tail},setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0,'
            audio_index=2
            if scene['id'] in ('settings','connection','tutor-answer','followup'): title+=' · 等待已剪短'
        else:
            vf='[0:v]setpts=PTS-STARTPTS,'
        # Clone only the last genuine frame when speech is longer than the recording.
        vf+=f'tpad=stop_mode=clone:stop_duration={max(0,length-captured)+.1},fps=25,trim=end_frame={round(length*25)},pad=1440:900:0:0:color=0x172c40,ass=scene-{i:02}.ass[v]'
        lines=[f'Dialogue: 0,0:00:00.00,{stamp(length,True)},Chapter,,0,0,0,,{title}']
        for cue in scene['subtitle_cues']:
            label=plan['roles'][cue['role']]['label'];text=f'{label}：{cue["text"]}'
            style='Student' if cue['role']=='student' else 'Teacher'
            lines.append(f'Dialogue: 1,{stamp(cue["start"],True)},{stamp(cue["end"],True)},{style},,0,0,0,,{text}')
            srt.append((scene['voice_start_seconds']+cue['start'],scene['voice_start_seconds']+cue['end'],text))
        (work/f'scene-{i:02}.ass').write_text(ASS_HEADER+'\n'.join(lines)+'\n',encoding='utf8')
        clip=work/f'scene-{i:02}.mp4'
        run('ffmpeg','-v','error','-y',*inputs,'-i',session/f'audio/scene-{i:02}.wav',
            '-filter_complex',vf,'-map','[v]','-map',f'{audio_index}:a',
            '-t',f'{length:.4f}','-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p',
            '-af','loudnorm=I=-18:TP=-2:LRA=7','-c:a','aac','-ar','48000','-ac','2','-b:a','160k',clip,cwd=work)
        clips.append(clip)
        chapters.append({'id':scene['id'],'title':title,'start':scene['voice_start_seconds'],'seconds':length,
            'removed_wait_seconds':round(max(0,captured-length),3),'added_reading_hold_seconds':round(max(0,length-captured),3),
            'picture_source':'actual_overview_screenshot' if scene['id']=='home' else 'actual_recording'})
        print(f'RENDERED {i}/{len(plan["scenes"])}: {scene["id"]}',flush=True)
    listing=work/'concat.txt';listing.write_text('\n'.join(f"file '{p.name}'" for p in clips)+'\n',encoding='utf8')
    target=work/'dialogue-final.mp4'
    run('ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',listing,'-c','copy','-movflags','+faststart',target)
    duration=seconds(target)
    if not 0<duration<180:
        raise RuntimeError('Final video exceeds duration limit')
    shutil.copy2(target,MATERIALS/'学途智伴师生演示视频.mp4')
    (MATERIALS/'学途智伴师生演示字幕.srt').write_text('\n\n'.join(f'{i}\n{stamp(a)} --> {stamp(b)}\n{text}' for i,(a,b,text) in enumerate(srt,1))+'\n',encoding='utf8')
    public={'seconds':duration,'resolution':'1440x900','fps':25,'version':plan['version'],
        'voice_strategy':'two_role_synthetic','roles':plan['roles'],'model':plan['model'],'provider_requests':4,
        'live_operations':operations,'remembered_device':plan['remembered_device'],'local_save_verified':plan['local_save_verified'],
        'chapters':chapters,'subtitle_timing':'utterance_aligned_proportional_phrase_timing','subjective_listening_review':'pending'}
    (MATERIALS/'dialogue-video-chapters.json').write_text(json.dumps(public,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    run('ffmpeg','-v','error','-y','-ss','2','-i',target,'-frames:v','1',MATERIALS/'assets/dialogue-video-poster.png')
    print(f'PASS: video created, {duration:.2f}s',flush=True)


def audit(session):
    target=MATERIALS/'学途智伴师生演示视频.mp4'
    plan=json.loads((MATERIALS/'dialogue-video-chapters.json').read_text(encoding='utf8'))
    qa=session/'qa';qa.mkdir(exist_ok=True)
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(target)],text=True,encoding='utf8'))
    streams={s['codec_type']:s for s in probe['streams']}
    assert streams['video']['codec_name']=='h264' and streams['audio']['codec_name']=='aac'
    assert (streams['video']['width'],streams['video']['height'])==(1440,900)
    assert streams['video']['r_frame_rate']=='25/1' and float(probe['format']['duration'])<180
    run('ffmpeg','-v','error','-xerror','-i',target,'-f','null','-')
    volume=subprocess.run(['ffmpeg','-hide_banner','-i',str(target),'-vn','-af','volumedetect','-f','null','-'],capture_output=True,text=True,encoding='utf8',errors='replace',check=True)
    peak=float(re.search(r'max_volume: ([\-\d.]+) dB',volume.stderr)[1]);assert peak<0
    previous=0;count=0
    for a,b in re.findall(r'(\d\d:\d\d:\d\d,\d{3}) --> (\d\d:\d\d:\d\d,\d{3})',(MATERIALS/'学途智伴师生演示字幕.srt').read_text(encoding='utf8')):
        def value(s):
            h,m,sec=s.replace(',','.').split(':');return int(h)*3600+int(m)*60+float(sec)
        start,end=value(a),value(b);assert previous-.002<=start<end<=plan['seconds'];previous=end;count+=1
    assert count>40
    for i,chapter in enumerate(plan['chapters'],1):
        for fraction in [.35,.75]:
            run('ffmpeg','-v','error','-y','-ss',f'{chapter["start"]+chapter["seconds"]*fraction:.3f}',
                '-i',target,'-frames:v','1',qa/f'frame-{i:02}-{int(fraction*100)}.png')
    result={'seconds':plan['seconds'],'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
        'full_decode':'pass','max_volume_db':peak,'subtitle_cues':count,'provider_requests':4,
        'visual_review':'pending','subjective_listening_review':'pending'}
    (qa/'audit.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
    print(json.dumps(result),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('phase',choices=['record','voice','render','audit']);parser.add_argument('session',type=Path);parser.add_argument('--cached-only',action='store_true');args=parser.parse_args()
    try:
        session=args.session.resolve();session.mkdir(exist_ok=True,parents=True)
        if args.phase=='voice': voice(session,args.cached_only)
        else: {'record':record,'render':render,'audit':audit}[args.phase](session)
    except Exception as error:
        print(str(error) if isinstance(error,RuntimeError) else 'Recording, synthesis or media validation failed; inspect local work artifacts.',file=sys.stderr)
        sys.exit(1)
