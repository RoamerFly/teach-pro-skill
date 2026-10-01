"""Render genuine UI capture with separate subtitles; do not create or modify voice."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess


def stamp(seconds, ass=False):
    scale = 100 if ass else 1000
    ticks = round(seconds * scale)
    hours, ticks = divmod(ticks, 3600 * scale)
    minutes, ticks = divmod(ticks, 60 * scale)
    seconds, fraction = divmod(ticks, scale)
    return f'{hours}:{minutes:02}:{seconds:02}.{fraction:02}' if ass else f'{hours:02}:{minutes:02}:{seconds:02},{fraction:03}'


def render():
    parser = argparse.ArgumentParser()
    parser.add_argument('session', type=Path)
    args = parser.parse_args()
    session = args.session.resolve()
    materials = Path(__file__).resolve().parents[1]
    plan = json.loads((session / 'capture-plan.json').read_text(encoding='utf-8'))
    content = json.loads((materials / 'video-ui-scenes.json').read_text(encoding='utf-8'))
    edits = {scene['id']: scene for scene in content['scenes']}
    assert len(plan['live_operations']) == 5
    assert all(item['local_http_status'] == 200 for item in plan['live_operations'])
    directory = session / 'ui-render'; directory.mkdir(exist_ok=True)
    raw = session / 'capture/raw.webm'
    offset = plan.get('raw_video_offset_seconds', 0)
    public = {'skill_version': content['version'], 'audio': 'none', 'resolution': '1440x900', 'fps': 25, 'model': plan['model'], 'max_tokens': plan['max_tokens'], 'live_operations': plan['live_operations'], 'chapters': []}
    clips, cues, cursor = [], [], 0
    header = '''[Script Info]
ScriptType: v4.00+
PlayResX: 1440
PlayResY: 900
WrapStyle: 0
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Chapter,Microsoft YaHei,18,&H00CAD8E5,&H00FFFFFF,&H00172C40,&H00172C40,0,0,0,0,100,100,0,0,1,0,0,8,32,32,817,1
Style: Caption,Microsoft YaHei,23,&H00FFFFFF,&H00FFFFFF,&H00172C40,&H00172C40,0,0,0,0,100,100,0,0,1,0,0,2,40,40,12,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
    for index, scene in enumerate(plan['scenes'], 1):
        frames = round(scene['seconds'] * 25)
        length = frames / 25
        edit = edits[scene['id']]
        captured = (scene['capture_end_ms'] - scene['capture_start_ms']) / 1000
        short = captured > length + .35
        title = edit['title'] + (' · 等待已剪短' if short else '')
        events = [f'Dialogue: 0,0:00:00.00,{stamp(length, True)},Chapter,,0,0,0,,{title}']
        for part, text in enumerate(edit['captions']):
            begin = part * length / len(edit['captions'])
            end = (part + 1) * length / len(edit['captions'])
            events.append(f'Dialogue: 1,{stamp(begin, True)},{stamp(end, True)},Caption,,0,0,0,,{text}')
            cues.append((cursor + begin, cursor + end, text))
        subtitle = directory / f'ui-{index:02}.ass'; subtitle.write_text(header + '\n'.join(events) + '\n', encoding='utf-8')
        initial = scene['capture_start_ms'] / 1000 + offset
        inputs = ['-ss', f'{initial:.4f}', '-i', str(raw)]
        # True screenshot reading holds avoid headless recording compositor artifacts.
        # All screenshots are from this same live capture; provider answers are unchanged.
        lead = min(length - .5, max(1.5, min(2.4, length / 3))) if short else min(length - .5, (scene['action_end_ms'] - scene['capture_start_ms']) / 1000 + .15)
        if scene['id'] == 'closing':
            # A separately captured architecture card is not a provider-response frame.
            initial = 0
            inputs = ['-loop', '1', '-framerate', '25', '-i', str(materials / 'assets/ui-closing.png')]
        tail = length - lead
        screenshot = materials / 'assets/ui-closing.png' if scene['id'] == 'closing' else session / f'capture/scene-{index:02}.png'
        inputs += ['-loop', '1', '-framerate', '25', '-i', str(screenshot)]
        filters = f'[0:v]trim=duration={lead:.4f},setpts=PTS-STARTPTS[a];[1:v]trim=duration={tail:.4f},setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0,fps=25,trim=end_frame={frames},setpts=PTS-STARTPTS,pad=1440:900:0:0:color=0x172c40,ass={subtitle.name}[v]'
        output = directory / f'ui-{index:02}.mp4'
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *inputs, '-filter_complex', filters, '-map', '[v]', '-an', '-frames:v', str(frames), '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', str(output)], cwd=directory, check=True)
        clips.append(output)
        public['chapters'].append({'id': scene['id'], 'title': title, 'start': cursor, 'seconds': length, 'wait_cut_seconds': round(max(0, captured - length), 3), 'reading_hold': 'current_architecture_card' if scene['id'] == 'closing' else 'same_capture_screenshot'})
        cursor += length
        print(f'Rendered UI {index}/12', flush=True)
    listing = directory / 'concat.txt'; listing.write_text('\n'.join(f"file '{clip.name}'" for clip in clips), encoding='utf-8')
    final = materials / '学途智伴演示画面版.mp4'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(listing), '-c', 'copy', '-movflags', '+faststart', str(final)], check=True)
    public['seconds'] = cursor; public['sha256'] = hashlib.sha256(final.read_bytes()).hexdigest().upper()
    assert cursor < 180
    (materials / 'video-ui-chapters.json').write_text(json.dumps(public, ensure_ascii=False, indent=2), encoding='utf-8')
    (materials / '学途智伴画面版字幕.srt').write_text('\n\n'.join(f'{index}\n{stamp(a)} --> {stamp(b)}\n{text}' for index, (a, b, text) in enumerate(cues, 1)) + '\n', encoding='utf-8')
    print(f'PASS: {cursor:.2f}s picture and subtitles; no voice edited')


if __name__ == '__main__':
    render()
