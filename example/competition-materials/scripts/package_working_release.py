"""Build the review package from a committed Git tree, never from learner files."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('output', type=Path)
    parser.add_argument('--ref', default='HEAD', help='Committed Git revision')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    output = args.output.resolve()
    if output.is_relative_to(root):
        raise ValueError('Output must be outside the repository')
    revision = subprocess.check_output(['git', 'rev-parse', '--verify', args.ref + '^{commit}'], cwd=root, text=True).strip()
    paths = ['teach-pro', 'example/competition-demo-zhi-jian-agent',
             'example/competition-materials/学途智伴技能说明文档.docx',
             'example/competition-materials/学途智伴演示画面版.mp4',
             'example/competition-materials/学途智伴画面版字幕.srt',
             'example/competition-materials/video-ui-chapters.json']
    archive = subprocess.check_output(['git', 'archive', '--format=zip', revision, *paths], cwd=root)
    files = []
    with ZipFile(io.BytesIO(archive)) as source:
        assert source.testzip() is None
        for info in source.infolist():
            if info.is_dir():
                continue
            assert not set(Path(info.filename).parts) & {'learner-submissions', 'learner-chats', '__pycache__'}
            assert Path(info.filename).name != '.tutor-settings.json'
            data = source.read(info)
            if Path(info.filename).suffix in {'.md', '.json', '.html', '.js', '.py', '.txt', '.yaml', '.srt'}:
                assert not re.search(rb'sk-[0-9a-f]{32}\b', data), info.filename
            files.append((info, data))
    version_file = next(data for info, data in files if info.filename == 'teach-pro/VERSION.md')
    version = re.search(r'^- Version: (\S+)$', version_file.decode(), re.MULTILINE)[1]
    assert version == '1.1.0-rc.4', 'Review the package manifest before packaging a different version'
    output.mkdir(parents=True, exist_ok=True)
    skill_path = output / f'teach-pro-{version}.zip'
    package_path = output / '重邮FFBond+学途智伴——大学生长期自适应学习智能体.zip'
    if skill_path.exists() or package_path.exists():
        raise FileExistsError('Choose a fresh output directory; existing deliveries are not overwritten')
    with ZipFile(skill_path, 'w', ZIP_DEFLATED) as skill:
        for info, data in files:
            if info.filename.startswith('teach-pro/'):
                skill.writestr(info, data)
    with ZipFile(skill_path) as skill:
        assert skill.testzip() is None
        for name in ('start-course.sh', 'start-course.command'):
            assert (skill.getinfo('teach-pro/assets/' + name).external_attr >> 16) & 0o777 == 0o755
    note = f'''# 学途智伴参赛工作包

队伍：重邮FFBond
作品：学途智伴——大学生长期自适应学习智能体
Skill：Teach Pro {version}
Git：{revision}

包含 Skill 技能包、七页 Word、无配音画面版及字幕、公开课程 Demo。
画面版为 2 分 50.64 秒，真实 DeepSeek Flash 配置与三轮问答；教学调整采用已有合成测试回放。
本包用于审阅，不是最终比赛提交包。完成配音试听和音画合成后，须替换视频并再次验收。

使用：解压 Skill技能包 中的 ZIP 并导入 teach-pro 目录；课程Demo 可独立打开 index.html 阅读。
自动写文件与课内答疑需 Python 3.11+，运行课程Demo 内的启动器；密钥请自行输入。
包内没有学员原始作答、聊天、模型配置或密钥，也没有旧版配音视频。
'''
    with ZipFile(package_path, 'w', ZIP_DEFLATED) as package:
        package.writestr('Skill技能包/' + skill_path.name, skill_path.read_bytes())
        for info, data in files:
            if info.filename.startswith('teach-pro/'):
                continue
            clone = ZipInfo(info.filename, info.date_time)
            clone.create_system, clone.external_attr = info.create_system, info.external_attr
            clone.compress_type = ZIP_DEFLATED
            if info.filename.startswith('example/competition-demo-zhi-jian-agent/'):
                clone.filename = '课程Demo/' + info.filename.removeprefix('example/competition-demo-zhi-jian-agent/')
            else:
                clone.filename = '参赛材料/' + Path(info.filename).name
            package.writestr(clone, data)
        package.writestr('提交前说明.md', note)
    with ZipFile(package_path) as package:
        assert package.testzip() is None
        assert not any('演示视频.mp4' in name for name in package.namelist())
        for name in ('start-course.sh', 'start-course.command'):
            assert (package.getinfo('课程Demo/' + name).external_attr >> 16) & 0o777 == 0o755
    report = {'revision': revision, 'version': version, 'status': 'review-only; voice pending',
              'archives': [{'file': path.name, 'bytes': path.stat().st_size,
                            'sha256': hashlib.sha256(path.read_bytes()).hexdigest().upper()}
                           for path in (skill_path, package_path)], 'integrity': 'pass', 'unix_permissions': '755'}
    (output / 'package-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
