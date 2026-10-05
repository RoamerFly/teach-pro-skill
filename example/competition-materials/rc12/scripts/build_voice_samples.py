"""Two voice auditions from the same public script; no credentials or learner data."""
import argparse
import asyncio
import importlib
import json
import subprocess
import sys
from pathlib import Path


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('output', type=Path)
    parser.add_argument('--tts-packages', type=Path, required=True)
    parser.add_argument('--ffprobe', default='ffprobe')
    args = parser.parse_args()
    sys.path.insert(0, str(args.tts_packages.resolve()))
    edge_tts = importlib.import_module('edge_tts')
    source = Path(__file__).resolve().parents[1] / 'video-scenes.json'
    plan = json.loads(source.read_text(encoding='utf8'))
    text = plan['scenes'][0]['narration'] + '\n' + plan['scenes'][7]['narration']
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    report = {'kind':'synthetic_voice_audition', 'listened_by_human':False, 'samples':[]}
    for name, voice in [('女声试样', 'zh-CN-XiaoxiaoNeural'), ('男声试样', 'zh-CN-YunxiNeural')]:
        target = output / (name + '.mp3')
        await edge_tts.Communicate(text, voice, rate='+0%', pitch='+0Hz').save(str(target))
        duration = float(subprocess.check_output([args.ffprobe,'-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(target)],text=True).strip())
        if not 10 < duration < 60:
            raise RuntimeError('Unexpected audition duration')
        report['samples'].append({'file':target.name,'voice':voice,'seconds':duration,'rate':'+0%','pitch':'+0Hz','text':text})
        print(f'{name}: {duration:.2f}s', flush=True)
    (output / 'voice-samples.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')


if __name__ == '__main__':
    asyncio.run(main())
