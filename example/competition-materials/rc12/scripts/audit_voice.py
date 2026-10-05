"""Offline checks and voice-relative subtitles for public narration candidates."""
import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('session', type=Path)
    parser.add_argument('--ffmpeg', default='ffmpeg')
    parser.add_argument('--ffprobe', default='ffprobe')
    args = parser.parse_args()
    materials = Path(__file__).resolve().parents[1]
    session = args.session.resolve()
    script = json.loads((materials / 'video-scenes.json').read_text(encoding='utf8'))
    plan = json.loads((session / 'voice-plan.json').read_text(encoding='utf8'))
    identity = json.loads((session / 'audio/narration.source.json').read_text(encoding='utf8'))
    expected_text = '\n'.join(scene['narration'] for scene in script['scenes'])
    expected_identity = dict(text=expected_text, voice=script['voice'], rate=script['rate'], pitch=script['pitch'])
    if identity != expected_identity:
        raise RuntimeError('Regenerate narration: public script or voice changed')
    if any(plan[key] != script[key] for key in ('version', 'voice', 'rate', 'pitch')):
        raise RuntimeError('Stale voice plan')
    if [(s['id'], s['narration']) for s in plan['scenes']] != [(s['id'], s['narration']) for s in script['scenes']]:
        raise RuntimeError('Stale scene timing')
    auditions = json.loads((session / 'samples/voice-samples.json').read_text(encoding='utf8'))
    sample_text = script['scenes'][0]['narration'] + '\n' + script['scenes'][7]['narration']
    samples = auditions['samples']
    if len(samples) != 2 or any(s['text'] != sample_text for s in samples):
        raise RuntimeError('Regenerate auditions: public sample text changed')
    candidates = [
        ('连续旁白候选.mp3', session / 'audio/narration.mp3', script['voice']),
        ('女声试样.mp3', session / 'samples' / samples[0]['file'], samples[0]['voice']),
        ('男声试样.mp3', session / 'samples' / samples[1]['file'], samples[1]['voice']),
    ]
    report = dict(version=script['version'], kind='synthetic_voice_candidates',
                  subjective_listening_review='pending', final_video_recorded=False,
                  script_sha256=sha256(materials / 'video-scenes.json'), rate=script['rate'],
                  pitch=script['pitch'], files=[])
    audio = materials / 'audio'
    for name, source, voice in candidates:
        path = audio / name
        if sha256(path) != sha256(source):
            raise RuntimeError('Public candidate differs from generated audio')
        duration = float(subprocess.check_output([args.ffprobe, '-v', 'error', '-show_entries',
                         'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(path)], text=True))
        subprocess.run([args.ffmpeg, '-v', 'error', '-xerror', '-i', str(path), '-f', 'null', '-'], check=True)
        result = subprocess.run([args.ffmpeg, '-hide_banner', '-i', str(path), '-af', 'volumedetect',
                                 '-f', 'null', '-'], capture_output=True, text=True, check=True)
        peak = float(re.search(r'max_volume: ([\-\d.]+) dB', result.stderr)[1])
        mean = float(re.search(r'mean_volume: ([\-\d.]+) dB', result.stderr)[1])
        if peak >= 0 or not 0 < duration < 178:
            raise RuntimeError('Audio clipping or duration outside budget')
        report['files'].append(dict(file=name, sha256=sha256(path), seconds=duration, voice=voice,
                                    mean_db=mean, peak_db=peak, full_decode='pass'))
    narration_seconds = report['files'][0]['seconds']
    if abs(plan['seconds'] - narration_seconds - 0.35) > 0.01:
        raise RuntimeError('Narration timeline does not match audio duration')
    report['timeline_seconds_with_tail'] = round(plan['seconds'], 3)
    report['chapters'] = [dict(id=s['id'], start=round(s['voice_start_seconds'], 3),
                              seconds=round(s['seconds'], 3)) for s in plan['scenes']]
    sys.path.insert(0, str(materials.parent / 'scripts'))
    from render_video import captions, clock
    boundaries = json.loads((session / 'audio/narration.json').read_text(encoding='utf8'))
    cues = list(captions(boundaries, delay=0))
    lines = []
    previous_end = 0
    for index, (start, end, text) in enumerate(cues):
        if index + 1 < len(cues):
            end = min(end, cues[index + 1][0])
        end = min(end, narration_seconds)
        if not previous_end <= start < end or len(text) > 28:
            raise RuntimeError('Invalid, overlapping or overlong voice subtitle')
        previous_end = end
        lines.append(f'{index + 1}\n{clock(start)} --> {clock(end)}\n{text}')
    if not lines:
        raise RuntimeError('No speech boundaries available')
    (audio / '旁白字幕候选.srt').write_text('\n\n'.join(lines) + '\n', encoding='utf8')
    report['subtitles'] = dict(file='旁白字幕候选.srt', cues=len(lines),
                              sha256=sha256(audio / '旁白字幕候选.srt'), max_line_characters=28,
                              timebase='narration_audio_only', final_video_alignment='pending')
    (audio / 'voice-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(f'PASS: 3 audio files decoded; {narration_seconds:.3f}s narration; {len(lines)} short subtitles; listening pending')


if __name__ == '__main__':
    main()
