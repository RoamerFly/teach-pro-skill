"""Replace the old UI shots; copy the accepted audio packets without re-synthesis."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
from make_dialogue_video import ASS_HEADER, seconds, stamp

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(*args, **kwargs):
    subprocess.run([str(a) for a in args], check=True, **kwargs)


def parse_stamp(text):
    h, m, s = text.replace(',', '.').split(':')
    return int(h) * 3600 + int(m) * 60 + float(s)


def build(work, capture):
    work, capture = work.resolve(), capture.resolve()
    if work.exists():
        raise ValueError('Choose a new edit folder')
    recorded = json.loads((capture / 'capture-audit.json').read_text(encoding='utf-8'))
    assert recorded['status'] == 'pass' and recorded['version'] == '1.1.0-rc.16'
    assert not recorded['new_provider_requests'] and not recorded['external_browser_requests']
    work.mkdir(parents=True)
    names = ('学途智伴师生演示视频.mp4', '学途智伴师生演示字幕.srt',
             'dialogue-video-audit.json', 'dialogue-video-chapters.json')
    before = work / 'before'; before.mkdir()
    for name in names:
        shutil.copy2(ROOT / name, before / name)
    old_audit = json.loads((before / names[2]).read_text(encoding='utf-8'))
    source = before / names[0]
    assert sha(source) == old_audit['sha256']
    metadata = json.loads((before / names[3]).read_text(encoding='utf-8'))
    srt = (before / names[1]).read_text(encoding='utf-8')
    cues = [(parse_stamp(a), parse_stamp(b), text.strip()) for a, b, text in
            re.findall(r'\d+\s*\n(\d\d:\d\d:\d\d,\d{3}) --> (\d\d:\d\d:\d\d,\d{3})\n(.*?)(?:\n\s*\n|\Z)', srt, re.S)]
    raw = capture / 'current-ui.webm'
    pixels = subprocess.check_output(['ffmpeg','-v','error','-i',str(raw),'-vf',
        'fps=25,crop=4:4:700:802,scale=1:1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'])
    # The dialog backdrop can dim the marker; detect magenta chroma rather than
    # assuming full brightness while a native dialog occupies the top layer.
    marked = [i for i in range(len(pixels)//3) if min(pixels[i*3],pixels[i*3+2]) > pixels[i*3+1]*1.5+25]
    groups = []
    for frame in marked:
        if not groups or frame > groups[-1][-1]+1:
            groups.append([])
        groups[-1].append(frame)
    assert len(groups) == len(recorded['scenes']), 'Missing recording synchronization marker'
    starts = {s['id']:(group[-1]+1)/25 for s,group in zip(recorded['scenes'],groups)}
    drift = [starts[s['id']]-s['start_ms']/1000 for s in recorded['scenes']]
    assert max(drift)-min(drift) < .15, 'Scene synchronization drift exceeds one visual tolerance'
    scenes = {s['id']: s for s in recorded['scenes']}
    clips, chapters = [], copy.deepcopy(metadata['chapters'])
    for i, chapter in enumerate(chapters, 1):
        length, start = chapter['seconds'], chapter['start']
        target = work / f'scene-{i:02}.mp4'
        if chapter['id'] in scenes:
            scene = scenes[chapter['id']]
            local = [(a-start, b-start, text) for a, b, text in cues if start-.001 <= a < start+length-.001]
            ass = work / f'scene-{i:02}.ass'
            lines = [f'Dialogue: 0,0:00:00.00,{stamp(length,True)},Chapter,,0,0,0,,{chapter["title"]}']
            lines += [f'Dialogue: 1,{stamp(a,True)},{stamp(min(b,length),True)},{"Student" if text.startswith("同学") else "Teacher"},,0,0,0,,{text}' for a,b,text in local]
            ass.write_text(ASS_HEADER + '\n'.join(lines)+'\n', encoding='utf-8')
            picture = f'fps=25,scale=1440:810,setsar=1,trim=duration={length-.16},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=1,trim=duration={length},pad=1440:900:0:0:color=0x172c40,ass={ass.name}'
            run('ffmpeg','-v','error','-y','-ss',str(starts[chapter['id']]), '-i',raw,
                '-vf',picture,'-an','-t',str(length),'-r','25','-c:v','libx264','-preset','fast',
                '-crf','20','-pix_fmt','yuv420p',target,cwd=work)
            chapter['picture_source'] = 'current_rc16_ui_recording'
            chapter['edit_strategy'] = 'current UI, accepted answer replay where applicable, unchanged narration and subtitles'
        else:
            run('ffmpeg','-v','error','-y','-ss',str(start),'-i',source,'-an','-t',str(length),
                '-r','25','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p',target)
        clips.append(target)
        print(f'Rendered {i}: {chapter["id"]}', flush=True)
    listing = work / 'concat.txt'
    listing.write_text('\n'.join("file '"+p.as_posix()+"'" for p in clips)+'\n',encoding='utf-8')
    silent = work / 'picture.mp4'
    run('ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',listing,'-an','-c:v','copy',silent)
    final = work / 'rc16-final.mp4'
    run('ffmpeg','-v','error','-y','-i',silent,'-i',source,'-map','0:v:0','-map','1:a:0',
        '-c','copy','-movflags','+faststart',final)
    duration = seconds(final)
    assert duration < 180 and abs(duration-seconds(source)) < .05
    # The exact AAC stream is retained, rather than comparing subjective voice quality.
    audio_hashes = []
    for name, file in [('old', source), ('new', final)]:
        aac = work / (name+'.aac')
        run('ffmpeg','-v','error','-y','-i',file,'-vn','-c:a','copy',aac)
        audio_hashes.append(sha(aac))
    assert audio_hashes[0] == audio_hashes[1]
    run('ffmpeg','-v','error','-xerror','-i',final,'-f','null','-')
    for i, chapter in enumerate(chapters, 1):
        for fraction in (.25,.75):
            run('ffmpeg','-v','error','-y','-ss',str(chapter['start']+chapter['seconds']*fraction),
                '-i',final,'-frames:v','1',work/f'qa-{i:02}-{int(fraction*100)}.png')
    metadata.update(seconds=duration,version='1.1.0-rc.16',chapters=chapters,
                    media_revision='2026-10-26-rc16-ui',new_provider_requests=0,new_speech_synthesis_requests=0,
                    body_edit='all course UI and tutor shots recaptured; accepted audio retained byte-for-byte',
                    answer_mode=recorded['answer_mode'])
    audit = {**old_audit,'seconds':duration,'bytes':final.stat().st_size,'sha256':sha(final),
             'version':'1.1.0-rc.16','media_revision':'2026-10-26-rc16-ui','full_decode':'pass',
             'visual_review':'pending','accepted_source_sha256':sha(source),'audio_stream_identical':True,
             'audio_stream_sha256':audio_hashes[0],'subtitle_file_identical':True,
             'new_provider_requests':0,'new_speech_synthesis_requests':0,
             'replaced_shots':list(scenes),'preserved_body_clips':[c['id'] for c in chapters if c['id'] not in scenes],
             'frame_sync_starts':starts,'synchronization':'per-scene in-frame markers, excluded from final footage',
             'runtime_capture_audit':recorded,
             'subjective_listening_review':'previously approved native-pace teacher and student; exact accepted AAC retained'}
    (work/'dialogue-video-chapters.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (work/'dialogue-video-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':'ready-for-visual-review','seconds':duration,'audio_identical':True}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('work',type=Path);parser.add_argument('capture',type=Path)
    args = parser.parse_args();build(args.work,args.capture)
