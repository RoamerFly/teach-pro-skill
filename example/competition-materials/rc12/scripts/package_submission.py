"""Package the accepted competition assets from one committed Git revision.

No live workspace, credentials, caches, learner records, or historical media
are read. ZIP Unix modes are retained even when building on Windows.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

VERSION = '1.1.0-rc.12'
TEAM = '重邮FFBond'
TITLE = '学途智伴——大学生长期自适应学习智能体'
PREFIX = 'example/competition-materials/rc12/'
DEMO = 'example/competition-demo-rc12/'
MEDIA = ('学途智伴技能说明文档.docx', '学途智伴师生演示视频.mp4',
         '学途智伴师生演示字幕.srt', '视频讲解脚本.md')
EVIDENCE = 'evals/records/2026-10-06-guided-dialogue-flow.md'
FORBIDDEN = {'learner-submissions', 'learner-chats', '__pycache__',
             '.teach-runtime', '.git', 'node_modules', '.venv'}
SECRET = re.compile(rb'sk-[A-Za-z0-9_.-]{24,}')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def check_member(name, data):
    path = PurePosixPath(name)
    if path.is_absolute() or '..' in path.parts or '\\' in name or ':' in name:
        raise ValueError('Unsafe archive path: ' + name)
    if set(path.parts) & FORBIDDEN or path.name in {'.tutor-settings.json', '.env'}:
        raise ValueError('Private runtime file: ' + name)
    if path.suffix.lower() in {'.md', '.json', '.html', '.js', '.py', '.txt',
                               '.yaml', '.yml', '.srt', '.cmd', '.sh', '.command'}:
        if SECRET.search(data):
            raise ValueError('Possible credential in: ' + name)
    if path.suffix.lower() == '.docx':
        with ZipFile(io.BytesIO(data)) as doc:
            if doc.testzip() is not None:
                raise ValueError('Invalid DOCX: ' + name)
            for member in doc.namelist():
                if member.startswith('word/comments'):
                    raise ValueError('Unresolved document comments: ' + name)
                if member.endswith('.xml') and SECRET.search(doc.read(member)):
                    raise ValueError('Possible document credential: ' + name)


def remap(name):
    if name.startswith('teach-pro/'):
        return 'Skill技能包/' + name
    if name.startswith(DEMO):
        return '课程Demo/' + name.removeprefix(DEMO)
    if name.startswith(PREFIX) and name.removeprefix(PREFIX) in MEDIA:
        return '参赛材料/' + name.removeprefix(PREFIX)
    if name == EVIDENCE:
        return '验证记录/' + PurePosixPath(name).name
    raise ValueError('Unlisted submission file: ' + name)


def write_member(archive, name, data, source=None):
    info = ZipInfo(name, source.date_time if source else (2026, 10, 6, 0, 0, 0))
    info.create_system = 3
    info.external_attr = source.external_attr if source else (0o100644 << 16)
    info.compress_type = ZIP_DEFLATED
    archive.writestr(info, data)


def build(output, ref='HEAD'):
    root = Path(__file__).resolve().parents[4]
    output = Path(output).resolve()
    if output.is_relative_to(root):
        raise ValueError('Choose an output directory outside the Git repository')
    if output.exists():
        raise FileExistsError('Choose a new output directory; deliveries are not overwritten')
    revision = subprocess.check_output(
        ['git', 'rev-parse', '--verify', ref + '^{commit}'], cwd=root, text=True).strip()
    paths = ['teach-pro', DEMO.rstrip('/'), EVIDENCE,
             PREFIX + 'dialogue-video-audit.json', *[PREFIX + name for name in MEDIA]]
    raw = subprocess.check_output(['git', 'archive', '--format=zip', revision, *paths], cwd=root)
    files = {}
    with ZipFile(io.BytesIO(raw)) as source:
        if source.testzip() is not None:
            raise ValueError('Git archive integrity failed')
        for info in source.infolist():
            if info.is_dir():
                continue
            data = source.read(info)
            check_member(info.filename, data)
            files[info.filename] = (info, data)
    version = re.search(r'^- Version: (\S+)$', files['teach-pro/VERSION.md'][1].decode(), re.M)
    if not version or version[1] != VERSION:
        raise ValueError('Review this submission manifest before changing the Skill version')
    audit = json.loads(files[PREFIX + 'dialogue-video-audit.json'][1])
    video = files[PREFIX + '学途智伴师生演示视频.mp4'][1]
    if (digest(video) != audit['sha256'] or len(video) != audit['bytes']
            or not 0 < audit['seconds'] < 180 or audit['full_decode'] != 'pass'
            or audit['provider_requests'] != 4):
        raise ValueError('Accepted video does not match its technical audit')
    document = files[PREFIX + '学途智伴技能说明文档.docx'][1]
    with ZipFile(io.BytesIO(document)) as doc:
        xml = doc.read('word/document.xml').decode()
        if '新版需重录' in xml or '2 分 48 秒' not in xml:
            raise ValueError('Document is not synchronized with the accepted film')

    note = f'''# 学途智伴参赛提交材料

队伍：{TEAM}
作品：{TITLE}
赛道：校园生活
Skill 版本：Teach Pro {VERSION}
源码快照：{revision}

## 提交材料

- `Skill技能包/teach-pro`：SKILL.md、教学参考、网页模板和运行资源。
- `参赛材料/学途智伴技能说明文档.docx`：五页技能说明，包含简介、设计思路与使用说明。
- `参赛材料/学途智伴师生演示视频.mp4`：2 分 48 秒，含配音及画面下方字幕；展示真实 DeepSeek 配置与两轮流式答疑。
- `参赛材料` 同时提供独立字幕与讲解脚本，便于核对。
- `课程Demo`：智鉴 Agent 三节正式课及一节关联补充课，可阅读和实际作答。
- `验证记录` 与 `文件清单.json`：操作来源、验证范围、源码版本和逐文件校验值。

## 使用

在支持该 Skill 文件结构的宿主中导入 `Skill技能包/teach-pro`，显式调用 `@teach-pro`，先评估基础再开课。

Demo 可直接打开 `课程Demo/index.html` 阅读；自动写文件与课内答疑需要 Python 3.11 或更新版本。Windows 双击 `start-course.cmd`；macOS 双击 `start-course.command`；Linux 在课程目录执行 `sh start-course.sh`。启动器检查运行环境并准备设备密钥依赖。可选答疑在课程设置中填写自己的 API Key，选择模型并测试连接。

继续学习时，让宿主中的教学 AI 读取该课程目录的学习记录，再生成下一课。浏览器 Tutor 负责本课答疑，不承担完整课程生成。

演示课程已经整理完成，视频中的续课结果为已有课程回放。Demo 不附学员原始作答、聊天或模型凭据；实际作答保存到体验者自己的本地副本。Windows 已实机检查，macOS/Linux 提供启动器，未声称完成原生实机验收。

项目与后续更新：https://github.com/RoamerFly/teach-pro-skill
'''.encode('utf-8')
    records = []
    selected = [(remap(name), info, data) for name, (info, data) in files.items()
                if name != PREFIX + 'dialogue-video-audit.json']
    for name, info, data in selected:
        records.append({'path': name, 'bytes': len(data), 'sha256': digest(data),
                        'unix_mode': oct((info.external_attr >> 16) & 0o777)})
    records.append({'path': 'README.md', 'bytes': len(note), 'sha256': digest(note), 'unix_mode': '0o644'})
    manifest = {'team': TEAM, 'title': TITLE, 'version': VERSION, 'revision': revision,
                'video_seconds': audit['seconds'], 'files': sorted(records, key=lambda r: r['path'])}
    output.mkdir(parents=True)
    package_path = output / f'{TEAM}+{TITLE}.zip'
    skill_path = output / f'teach-pro-{VERSION}.zip'
    with ZipFile(package_path, 'w', ZIP_DEFLATED) as package:
        for name, info, data in sorted(selected):
            write_member(package, name, data, info)
        write_member(package, 'README.md', note)
        write_member(package, '文件清单.json', json.dumps(manifest, ensure_ascii=False, indent=2).encode())
    with ZipFile(skill_path, 'w', ZIP_DEFLATED) as skill:
        for name, (info, data) in sorted(files.items()):
            if name.startswith('teach-pro/'):
                write_member(skill, name, data, info)
    for path, prefixes in ((package_path, ('Skill技能包/teach-pro/assets/', '课程Demo/')),
                           (skill_path, ('teach-pro/assets/',))):
        with ZipFile(path) as archive:
            if archive.testzip() is not None:
                raise ValueError('Output ZIP integrity failed')
            for prefix in prefixes:
                for name in ('start-course.sh', 'start-course.command'):
                    mode = (archive.getinfo(prefix + name).external_attr >> 16) & 0o777
                    if mode != 0o755:
                        raise ValueError('Executable permission not preserved: ' + prefix + name)
            if path == package_path:
                for record in records:
                    if digest(archive.read(record['path'])) != record['sha256']:
                        raise ValueError('Manifest checksum failed: ' + record['path'])
    report = {'revision': revision, 'version': VERSION, 'status': 'submission-ready',
              'integrity': 'pass', 'manifest_checksums': 'pass', 'unix_permissions': '755',
              'video_seconds': audit['seconds'], 'package_members': len(records) + 1,
              'archives': [{'file': path.name, 'bytes': path.stat().st_size,
                            'sha256': digest(path.read_bytes())} for path in (package_path, skill_path)]}
    (output / 'package-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('--ref', default='HEAD')
    args = parser.parse_args()
    build(args.output, args.ref)
