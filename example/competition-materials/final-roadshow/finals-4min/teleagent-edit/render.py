"""Edit genuine TeleAgent/browser recordings using a checked, relative-path timeline."""
from pathlib import Path
import argparse
import json
import subprocess
from PIL import Image, ImageDraw, ImageFont


def run(args):
    subprocess.run([str(x) for x in args], check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--raw-dir', type=Path, required=True)
    parser.add_argument('--timeline', type=Path, default=Path(__file__).with_name('timeline.json'))
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--ffmpeg', type=Path, required=True)
    parser.add_argument('--font', type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.timeline.read_text('utf8'))
    work = args.output.parent / (args.output.stem + '-edit')
    work.mkdir(parents=True, exist_ok=True)
    duration = 0
    for i, clip in enumerate(data['clips'], 1):
        source = (args.raw_dir / clip['file']).resolve()
        assert source.is_relative_to(args.raw_dir.resolve()) and source.is_file(), source
        header = Image.new('RGBA', (1920, 84), '#FAF7EF')
        draw = ImageDraw.Draw(header)
        draw.rounded_rectangle((28, 18, 83, 65), radius=12, fill='#087F70')
        draw.text((41, 22), f'{i:02}', font=ImageFont.truetype(str(args.font), 29), fill='white')
        draw.text((105, 21), clip['caption'], font=ImageFont.truetype(str(args.font), 30), fill='#102A43')
        tag = '高等数学 · 模拟学员'
        draw.text((1642, 28), tag, font=ImageFont.truetype(str(args.font), 22), fill='#53716B')
        draw.rectangle((0, 81, 1920, 83), fill='#C6DBD0')
        png = work / f'{i:02}-header.png'
        header.save(png)
        filters = []
        if 'crop' in clip:
            filters.append('crop=' + ':'.join(map(str, clip['crop'])))
        speed = float(clip.get('speed', 1))
        assert .5 <= speed <= 2
        filters += [f'setpts=(PTS-STARTPTS)/{speed}', 'fps=24', 'scale=1920:996:force_original_aspect_ratio=decrease:force_divisible_by=2',
                    'pad=1920:996:(ow-iw)/2:(oh-ih)/2:color=0xFAF7EF',
                    'pad=1920:1080:0:84:color=0xFAF7EF', 'setsar=1']
        chain = '[0:v]' + ','.join(filters) + '[screen];[screen][1:v]overlay=0:0:eof_action=repeat[v]'
        out = work / f'{i:02}.mp4'
        run([args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-ss', clip['start'],
             '-i', source, '-i', png, '-filter_complex', chain, '-map', '[v]',
             '-t', clip['duration'], '-an', '-c:v', 'libx264', '-crf', '18', '-preset', 'fast',
             '-pix_fmt', 'yuv420p', '-r', '24', '-color_range', 'tv', '-colorspace', 'bt709',
             '-color_trc', 'bt709', '-color_primaries', 'bt709', '-video_track_timescale', '24000', out])
        duration += clip['duration']
    concat = work / 'concat.txt'
    concat.write_text(''.join(f"file '{i:02}.mp4'\n" for i in range(1, len(data['clips']) + 1)), 'utf8')
    run([args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0',
         '-i', concat, '-c:v', 'libx264', '-crf', '18', '-preset', 'fast', '-pix_fmt', 'yuv420p',
         '-color_range', 'tv', '-colorspace', 'bt709', '-color_trc', 'bt709', '-color_primaries', 'bt709',
         '-video_track_timescale', '24000', '-movflags', '+faststart',
         '-metadata', 'title=学途智伴 TeleAgent 高数学习闭环', args.output])
    print(json.dumps({'output': str(args.output), 'seconds': duration,
                      'clips': len(data['clips']), 'source': 'actual TeleAgent and local course browser'}, ensure_ascii=False))


if __name__ == '__main__':
    main()
