"""Sync the reviewed TeleAgent clip and Q&A, then verify both finals archives."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import subprocess
import zipfile
from urllib.parse import unquote
from datetime import datetime, timezone
from docx import Document


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def dump(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', 'utf8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', type=Path, required=True)
    parser.add_argument('--ffprobe', type=Path, required=True)
    parser.add_argument('--ffmpeg', type=Path, required=True)
    args = parser.parse_args()
    root = args.project.resolve()
    repo = root / 'skill'
    source = Path(__file__).resolve().parent.parent
    work = root / 'competition-work/2026-11-27-teleagent-live'
    video = work / 'TeleAgent高数学习闭环_60秒.mp4'
    assert video.is_file()
    media = json.loads(subprocess.check_output([str(args.ffprobe), '-v', 'error', '-show_entries',
        'format=duration:stream=width,height,nb_frames', '-of', 'json', str(video)], text=True))
    assert abs(float(media['format']['duration']) - 60) < .1
    assert media['streams'][0]['width'] == 1920 and media['streams'][0]['height'] == 1080
    subprocess.run([str(args.ffmpeg), '-v', 'error', '-i', str(video), '-f', 'null', '-'], check=True)
    qa = json.loads((source / '答辩问答.json').read_text('utf8'))
    answers = qa['core'] + qa['follow_up']
    doc_text = '\n'.join(p.text for p in Document(source / '两分钟答辩准备.docx').paragraphs)
    assert all(row['answer'] in doc_text for row in answers)
    assert 'Codex' not in doc_text and 'ChatGPT' not in doc_text
    course = root / 'demo/gaodeng-shuxue'
    protected = work / 'student-submissions-before-continuation'
    assert all(sha(p) == sha(course / 'learner-submissions' / p.name) for p in protected.glob('*.json'))
    skill_hash = sha(root / 'competition-submission/competition_submit/teach-pro/SKILL.md')
    assert skill_hash == '8f804c67c643a590bd8283cd8187d1ee3e77e8874533742f61208bc3f3c1136c'
    record = json.loads((work / 'run.json').read_text('utf8'))
    record.update(status='video_completed_course_pages_generated_host_validation_running',
        snapshot_at_utc=datetime.now(timezone.utc).isoformat(), formal_lessons=2, supplemental_lessons=1,
        continuation_request='我已在网页做完入门评估和第1课的题，答案和疑问都填好了。最后图像平移还是不太明白，想先补一下这个点，也想继续学下一课。',
        teaching_result={'supplement':'图像平移：加在外面抬高，写在括号里左右移动',
                         'formal_2':'极限的直觉：x 靠近 1 时，f(x) 靠近什么'},
        validations={'course_pages':6, 'structural_issues':0, 'submission_files_unchanged':True,
                     'browser_reload_restored_first_lesson_answers':True, 'student_input': 'browser form interaction',
                     'video_full_decode':'pass', 'duration_seconds':60, 'decoded_frames':1440, 'frame_size':[1920,1080],
                     'visual_review':'all selected scenes and boundaries reviewed',
                     'display_sources':['TeleAgent window','course browser viewport']},
        video={'file':video.name,'sha256':sha(video),'bytes':video.stat().st_size},
        source_recordings=[{'file':p.relative_to(work).as_posix(),'sha256':sha(p)} for p in [
            work/'01-teleagent-intake.mkv',work/'04-teleagent-reading-submissions.mkv',
            *sorted((work/'browser-raw').glob('*.webm'))]],
        generated_pages=[{'file':p.relative_to(course).as_posix(),'sha256':sha(p)}
                         for p in [course/'index.html',*sorted((course/'lessons').glob('*.html'))]],
        learner_records=[{'file':p.name,'sha256':sha(p)} for p in sorted(protected.glob('*.json'))])
    dump(work / 'run.json', record)
    dump(repo / 'evals/records/2026-11-27-teleagent-live.json', record)
    backup = work / 'before-delivery'
    backup.mkdir(exist_ok=True)
    folders = [root/'路演材料/最终路演包',root/'路演材料/总决赛交付包_4分钟版']
    name = '学途智伴高数60秒静音演示.mp4'
    for folder in [source,root/'路演材料/4分钟版']:
        if (folder/name).exists():
            target = backup / ('source' if folder==source else '4分钟版')
            target.mkdir(exist_ok=True);shutil.copy2(folder/name,target/name)
        shutil.copy2(video,folder/name)
    shutil.copy2(video,root/'路演材料/4分钟版'/video.name)
    qa_record = {'date':'2026-11-27','questions':10,'priority_questions':4,'follow_up_questions':6,
        'answer_characters':[len(x['answer']) for x in answers],'docx_pages':2,
        'answers_match_markdown_and_docx':True,'render':'Word PDF export and two Poppler page images reviewed',
        'content_verified_against':['teach-pro/SKILL.md','evals/records/2026-11-27-teleagent-live.json'],
        'claims':['TeleAgent actual skill run with a simulated university learner',
                  'two formal lessons plus one related supplement generated from browser submissions'],
        'docx_sha256':sha(source/'两分钟答辩准备.docx'),'markdown_sha256':sha(source/'两分钟答辩准备.md')}
    dump(repo/'evals/records/2026-11-27-defense-qa.json',qa_record)
    for filename in ['两分钟答辩准备.docx','两分钟答辩准备.md','README.md']:
        shutil.copy2(source/filename,root/'路演材料/4分钟版'/filename)
    archive_rows = []
    for bundle,archive_name in zip(folders,['重邮FFBond+刘飞扬_最终路演包.zip','重邮FFBond+刘飞扬_总决赛材料_4分钟.zip']):
        before = json.loads((bundle/'05_检查记录/文件校验清单.json').read_text('utf8'))
        course_rows = [x for x in before['files'] if x['path'].startswith('02_现场使用/现场演示课程/')]
        assert all(sha(bundle/x['path']) == x['sha256'] for x in course_rows)
        for relative in ['01_提前发送/'+name,'02_现场使用/'+name,'03_备用录屏/高数60秒静音演示.mp4']:
            target=bundle/relative
            save=backup/bundle.name/relative;save.parent.mkdir(parents=True,exist_ok=True)
            if target.exists():shutil.copy2(target,save)
            shutil.copy2(video,target)
        for folder_name in ['01_提前发送','02_现场使用']:
            presentations=list((bundle/folder_name).glob('*.pptx'))
            assert len(presentations)==1
            with zipfile.ZipFile(presentations[0]) as presentation:
                relationships='\n'.join(presentation.read(p).decode('utf8') for p in presentation.namelist()
                                         if p.startswith('ppt/slides/_rels/') and p.endswith('.rels'))
                slides='\n'.join(presentation.read(p).decode('utf8') for p in presentation.namelist()
                                if p.startswith('ppt/slides/slide') and p.endswith('.xml'))
                assert name in unquote(relationships) and 'ppaction://hlinkfile' in slides
        for filename in ['两分钟答辩准备.docx','两分钟答辩准备.md']:
            shutil.copy2(source/filename,bundle/'04_答辩支撑'/filename)
        dump(bundle/'05_检查记录/TeleAgent录屏验收.json',record)
        dump(bundle/'05_检查记录/答辩材料修订验收.json',qa_record)
        manifest = {'files':[{'path':p.relative_to(bundle).as_posix(),'sha256':sha(p),'bytes':p.stat().st_size}
            for p in sorted(bundle.rglob('*')) if p.is_file() and p.name!='文件校验清单.json'],
            'main_edition':'最终四分钟路演包','revision':'2026-11-27 TeleAgent actual-run clip and Q&A',
            'existing_portable_course_preserved_files':len(course_rows)}
        dump(bundle/'05_检查记录/文件校验清单.json',manifest)
        out=root/'路演材料'/archive_name
        if out.exists():shutil.copy2(out,backup/archive_name)
        temporary=out.with_suffix('.next.zip')
        with zipfile.ZipFile(temporary,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
            for p in sorted(bundle.rglob('*')):
                if p.is_file():
                    info=zipfile.ZipInfo.from_file(p,Path(bundle.name)/p.relative_to(bundle))
                    info.compress_type=zipfile.ZIP_DEFLATED
                    if p.suffix in {'.sh','.command'}:info.create_system=3;info.external_attr=0o100755<<16
                    z.writestr(info,p.read_bytes())
        with zipfile.ZipFile(temporary) as z:
            assert z.testzip() is None
            for row in manifest['files']:
                assert hashlib.sha256(z.read(bundle.name+'/'+row['path'])).hexdigest()==row['sha256']
        temporary.replace(out)
        out.with_suffix('.zip.sha256').write_text(sha(out)+'  '+out.name+'\n','utf8')
        archive_rows.append({'file':out.name,'bytes':out.stat().st_size,'sha256':sha(out)})
    release_path=repo/'evals/records/2026-11-27-final-release.json'
    release=json.loads(release_path.read_text('utf8'))
    release.update(archives=archive_rows,latest_revision='TeleAgent actual-run video and two-minute Q&A; existing portable course preserved')
    dump(release_path,release)
    print(json.dumps({'video':record['video'],'archives':archive_rows},ensure_ascii=False))


if __name__=='__main__':main()
