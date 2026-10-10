"""Replace the opening visuals, reusing approved voices and actual body recordings.

Offline only: no synthesis, provider request, or new TeleAgent execution.
Requires the original accepted session and ffmpeg/ffprobe on PATH.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path
from make_dialogue_video import MATERIALS, ASS_HEADER, run, seconds, stamp, audit


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build(source, work):
    source, work = source.resolve(), work.resolve()
    if work.exists() and any(work.iterdir()):
        raise ValueError('Choose an empty work directory; preserve the accepted session')
    work.mkdir(parents=True, exist_ok=True)
    plan = json.loads((source / 'voice-plan.json').read_text(encoding='utf8'))
    old_video = source / 'render/dialogue-final.mp4'
    if sha(old_video) != '51fb962e98797095d9beea39f901f7893840f60ea32e54bab671bca1ce8c1d73':
        raise ValueError('Source is not the accepted 2026-10-06 film')
    public = json.loads((MATERIALS / 'dialogue-video-chapters.json').read_text(encoding='utf8'))
    if public.get('opening_revision'):
        raise ValueError('Restore the original chapter metadata before rebuilding')
    opening, continuation = plan['scenes'][0], plan['scenes'][10]
    extra = continuation['seconds']
    if seconds(old_video) + extra >= 180:
        raise ValueError('Architecture edit would exceed the contest duration')
    # Preserve complete utterances, pauses and native speech pacing.
    run('ffmpeg', '-v', 'error', '-y', '-i', source / 'audio/scene-01.wav',
        '-i', source / 'audio/scene-11.wav', '-filter_complex',
        '[0:a][1:a]concat=n=2:v=0:a=1[out]', '-map', '[out]', work / 'opening.wav')
    length = opening['seconds'] + extra
    title = '01 · Skill 架构：先评估，再按学习记录续课'
    cues = list(opening['subtitle_cues']) + [dict(c, start=c['start']+opening['seconds'],
        end=c['end']+opening['seconds']) for c in continuation['subtitle_cues']]
    lines = [f'Dialogue: 0,0:00:00.00,{stamp(length,True)},Chapter,,0,0,0,,{title}']
    for cue in cues:
        style = 'Student' if cue['role'] == 'student' else 'Teacher'
        text = plan['roles'][cue['role']]['label'] + '：' + cue['text']
        lines.append(f'Dialogue: 1,{stamp(cue["start"],True)},{stamp(cue["end"],True)},{style},,0,0,0,,{text}')
    (work / 'opening.ass').write_text(ASS_HEADER + '\n'.join(lines)+'\n', encoding='utf8')
    # Whole figure first; then focus on responsibilities and the shared file workspace.
    figure = MATERIALS / 'assets/teach-pro-workflow-architecture-v1.png'
    vf = ('[0:v]split=2[full][detail];'
          f'[full]scale=1440:810,setsar=1,trim=duration={opening["seconds"]},setpts=PTS-STARTPTS[a];'
          f'[detail]crop=1672:528:0:400,scale=1440:455,pad=1440:810:0:177:color=white,setsar=1,'
          f'trim=duration={extra},setpts=PTS-STARTPTS[b];'
          '[a][b]concat=n=2:v=1:a=0,fps=25,pad=1440:900:0:0:color=0x172c40,ass=opening.ass[v]')
    head = work / 'opening.mp4'
    run('ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', '25', '-i', figure,
        '-i', work / 'opening.wav', '-filter_complex', vf, '-map', '[v]', '-map', '1:a',
        '-t', str(length), '-c:v', 'libx264', '-preset', 'fast', '-crf', '21', '-pix_fmt', 'yuv420p',
        '-af', 'loudnorm=I=-18:TP=-2:LRA=7', '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '160k', head, cwd=work)
    clips = [head] + [source / f'render/scene-{i:02}.mp4' for i in range(2,14)]
    listing = work / 'concat.txt'
    listing.write_text('\n'.join("file '"+p.as_posix()+"'" for p in clips)+'\n', encoding='utf8')
    target = work / 'architecture-final.mp4'
    run('ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listing,
        '-c', 'copy', '-movflags', '+faststart', target)
    duration = seconds(target)
    if not 0 < duration < 180:
        raise ValueError('Final duration exceeds the contest limit')
    chapters = public['chapters']
    chapters[0].update(title=title, seconds=length, picture_source='architecture_figure_and_detail',
        edit_strategy='approved_home_and_continuation_voice; architecture_overview_then_detail')
    for chapter in chapters[1:]:
        chapter['start'] += extra
    public.update(seconds=duration, opening_revision='2026-10-10', new_provider_requests=0,
        new_speech_synthesis_requests=0, body_edit='accepted scenes 02–13 concatenated without re-encoding',
        subjective_listening_review='approved source voices reused; revised film awaits user viewing')
    shutil.copy2(target, MATERIALS / '学途智伴师生演示视频.mp4')
    (MATERIALS / 'dialogue-video-chapters.json').write_text(json.dumps(public,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    subtitles = []
    for cue in cues:
        subtitles.append((cue['start'],cue['end'],plan['roles'][cue['role']]['label']+'：'+cue['text']))
    for scene in plan['scenes'][1:]:
        for cue in scene['subtitle_cues']:
            base = scene['voice_start_seconds'] + extra
            subtitles.append((base+cue['start'],base+cue['end'],plan['roles'][cue['role']]['label']+'：'+cue['text']))
    (MATERIALS / '学途智伴师生演示字幕.srt').write_text('\n\n'.join(
        f'{i}\n{stamp(a)} --> {stamp(b)}\n{text}' for i,(a,b,text) in enumerate(subtitles,1))+'\n',encoding='utf8')
    run('ffmpeg','-v','error','-y','-ss','10','-i',target,'-frames:v','1',MATERIALS / 'assets/dialogue-video-poster.png')
    audit(work)
    result = json.loads((work / 'qa/audit.json').read_text(encoding='utf8'))
    result.update(opening_revision='2026-10-10', new_provider_requests=0, new_speech_synthesis_requests=0,
        accepted_source_sha256=sha(old_video), architecture_sha256=sha(figure),
        preserved_body_clips=[{'scene':i,'sha256':sha(source / f'render/scene-{i:02}.mp4')} for i in range(2,14)],
        subjective_listening_review=public['subjective_listening_review'])
    (MATERIALS / 'dialogue-video-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(f'PASS: architecture opening; {duration:.3f}s; no new model/speech requests', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('accepted_session', type=Path)
    parser.add_argument('work', type=Path)
    args = parser.parse_args()
    build(args.accepted_session, args.work)
