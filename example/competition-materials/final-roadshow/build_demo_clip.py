"""Assemble a muted 60-second excerpt from the accepted course-operation film."""
import hashlib
import json
from pathlib import Path
import subprocess
import argparse

ROOT=Path(__file__).resolve().parent
SOURCE=ROOT.parent/'rc12/学途智伴师生演示视频.mp4'
PARTS=[('assessment',17.44,8),('lesson',27.8,8),('resources',36.92,6),
       ('tutor-answer',88.6,12),('save',122.48,12),('continuation',138.36,6),('adaptive',147.76,8)]


def main(output):
    output.mkdir(parents=True,exist_ok=True)
    target=output/'学途智伴课程演示_60秒.mp4'
    if target.exists():raise RuntimeError('Choose a fresh output directory')
    sha=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    assert sha=='8cb33013bf1c2f286259860ba3805f44e9d26ac89599de8f28396fb51fa88a85'
    filters=[];labels=[]
    for i,(_,start,length) in enumerate(PARTS):
        label=f'v{i}'
        # Keep the original course frame; remove the dialogue subtitle strip for live narration.
        filters.append(f'[0:v]trim=start={start}:duration={length},setpts=PTS-STARTPTS,crop=1440:814:0:0,scale=1280:724[{label}]')
        labels.append(f'[{label}]')
    filters.append(''.join(labels)+f'concat=n={len(labels)}:v=1:a=0,scale=1280:720[out]')
    subprocess.run(['ffmpeg','-v','error','-i',str(SOURCE),'-filter_complex',';'.join(filters),'-map','[out]',
                    '-an','-r','25','-c:v','libx264','-crf','20','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',str(target)],check=True)
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(target)]))
    assert len(probe['streams'])==1 and probe['streams'][0]['codec_type']=='video'
    assert abs(float(probe['format']['duration'])-60)<.1
    subprocess.run(['ffmpeg','-v','error','-i',str(target),'-f','null','-'],check=True)
    result={'status':'pass','seconds':float(probe['format']['duration']),'sound':'muted for presenter narration',
            'source':'accepted rc.16 operation recording and archived answers','source_sha256':sha,
            'segments':[{'id':n,'start':s,'seconds':t} for n,s,t in PARTS],
            'output_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'new_model_requests':0}
    (output/'演示片段制作记录.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('output',type=Path);main(parser.parse_args().output)
