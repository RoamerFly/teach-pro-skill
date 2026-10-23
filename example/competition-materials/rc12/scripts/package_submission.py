"""Package the accepted competition assets from one committed Git revision.

No live workspace, credentials, caches, learner records, or historical media
are read. ZIP Unix modes are retained even when building on Windows.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import posixpath
import re
import subprocess
import sys
import tempfile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

VERSION = '1.1.0-rc.13'
TEAM = '重邮FFBond'
TITLE = '学途智伴——大学生长期自适应学习智能体'
PREFIX = 'example/competition-materials/rc12/'
DEMO = 'example/competition-demo-rc12/'
MEDIA = ('学途智伴技能说明文档.docx', '学途智伴师生演示视频.mp4',
         '学途智伴师生演示字幕.srt', '视频讲解脚本.md')
FIGURES = {'assets/teach-pro-workflow-architecture-v2-connected.png': '学途智伴工作流程架构图.png'}
EVIDENCE = 'evals/records/2026-10-06-guided-dialogue-flow.md'
ARCHITECTURE_EVIDENCE = 'evals/records/2026-10-10-architecture-media.md'
CONNECTED_FIGURE_EVIDENCE = 'evals/records/2026-10-10-connected-architecture-media.md'
VALUE_EVIDENCE = 'evals/records/2026-10-10-value-positioning.md'
TUTOR_LIMIT_EVIDENCE = 'evals/records/2026-10-23-tutor-response-limits.md'
FORBIDDEN = {'learner-submissions', 'learner-chats', '__pycache__',
             '.teach-runtime', '.git', 'node_modules', '.venv'}
SECRET = re.compile(rb'(?<![A-Za-z0-9_-])sk-[A-Za-z0-9_.-]{24,}')
PROFILES = ('normal_use', 'competition_submit')
MD_LINK = re.compile(r'(\[[^\]\n]*\]\()([^\s)]+)(\))')


def profile_files(files, profile):
    """Adapt a committed snapshot, never the normal-use source or runtime."""
    if profile not in PROFILES:
        raise ValueError('Unknown release profile')
    if profile == 'normal_use':
        validate_profile(files, profile)
        return dict(files), {}
    mapping = {}
    for name in files:
        path = PurePosixPath(name)
        if (path.parent == PurePosixPath('teach-pro') and path.suffix == '.md'
                and path.name not in {'SKILL.md', 'README.md', 'CHANGELOG.md'}):
            mapping[name] = 'teach-pro/references/specs/' + path.name
        elif name.startswith('teach-pro/templates/'):
            mapping[name] = name.replace('teach-pro/templates/', 'teach-pro/assets/templates/', 1)
    adapted = {}
    for name, (info, data) in files.items():
        destination = mapping.get(name, name)
        if name.startswith('teach-pro/') and name.endswith('.md'):
            text = data.decode('utf-8')

            def relink(match):
                target, separator, anchor = match[2].partition('#')
                if not target or ':' in target or target.startswith('/') or '*' in target:
                    return match[0]
                original = posixpath.normpath(posixpath.join(posixpath.dirname(name), target))
                if original not in files:
                    raise ValueError('Broken source Markdown link: ' + name + ' -> ' + target)
                updated = posixpath.relpath(mapping.get(original, original), posixpath.dirname(destination))
                return match[1] + updated + (separator + anchor if separator else '') + match[3]

            # Protect Markdown links while adapting literal Skill-root template paths.
            links = []

            def protect(match):
                links.append(relink(match))
                return f'\x00LINK{len(links) - 1}\x00'

            text = MD_LINK.sub(protect, text)
            text = re.sub(r'(?<![\w/-])templates/', 'assets/templates/', text)
            for index, link in enumerate(links):
                text = text.replace(f'\x00LINK{index}\x00', link)
            if name == 'teach-pro/SKILL.md':
                header, body = text.split('\n---\n', 1)
                cn_name = re.search(r'^  name_cn: (.+)$', header, re.M)
                cn_description = re.search(r'^  description_cn: (.+)$', header, re.M)
                if not cn_name or not cn_description:
                    raise ValueError('Chinese metadata missing from committed source')
                header = re.sub(r'\nmetadata:\n  name_cn: .+\n  description_cn: .+', '', header)
                header += '\nname_cn: ' + cn_name[1] + '\ndescription_cn: ' + cn_description[1].replace(
                    '面向系统学习、备考和技能提升', '面向大学生课程学习、备考和项目能力提升', 1)
                header = header.replace('description: 当用户', 'description: 面向大学生课程学习、考试备考与项目能力提升。当用户', 1)
                text = header + '\n---\n' + body
            if name == 'teach-pro/README.md':
                text = text.replace('中文名称与简介保存在 `SKILL.md` 的 `metadata.name_cn` / `metadata.description_cn`，教学入口仍为 `name` / `description`；',
                                    '此包为校园生活赛道赛事版。中文名称与简介保存在 `SKILL.md` 的顶层 `name_cn` / `description_cn`，教学入口仍为 `name` / `description`；')
                for original, moved in mapping.items():
                    if original.startswith('teach-pro/') and original.endswith('.md'):
                        text = text.replace('`' + PurePosixPath(original).name + '`', '`' + moved.removeprefix('teach-pro/') + '`')
                text = text.replace('`*-FORMAT.md`', '`references/specs/*-FORMAT.md`')
                text += ('\n## 校园生活赛道\n\n面向课程理解、考试备考、论文阅读与项目技能学习。'
                         '先确认目标和基础，再逐课教学；用真实作答调整路线，而不是一次生成整门课程。'
                         '统计学示例展示通用性，配套智鉴 Agent Demo 展示正式课、补充课与课内答疑。\n\n'
                         '版本见 [VERSION.md](references/specs/VERSION.md)。赛事字段适配参考评审 v2.1；'
                         '日常 Codex 使用选择 normal_use 包。两个包来自同一提交，教学规则与运行组件一致。\n')
            data = text.encode('utf-8')
        elif name == 'teach-pro/scripts/build_example.py':
            text = data.decode('utf-8')
            expected = ("SKILL / 'templates' / template", "SKILL / 'templates/course.gitignore'")
            if not all(item in text for item in expected):
                raise ValueError('Review example template paths before packaging')
            text = text.replace(expected[0], "SKILL / 'assets/templates' / template")
            text = text.replace(expected[1], "SKILL / 'assets/templates/course.gitignore'")
            data = text.encode('utf-8')
        if destination in adapted:
            raise ValueError('Release path collision: ' + destination)
        check_member(destination, data)
        adapted[destination] = (info, data)
    validate_profile(adapted, profile)
    return adapted, mapping


def validate_profile(files, profile):
    """Check actual references and required fields, not a predicted review score."""
    text = files['teach-pro/SKILL.md'][1].decode('utf-8')
    header = text.split('\n---\n', 1)[0]
    if profile == 'competition_submit':
        for field in ('name', 'description', 'name_cn', 'description_cn'):
            if not re.search(r'^' + field + r': \S', header, re.M):
                raise ValueError('Missing top-level competition field: ' + field)
        if any(name.startswith('teach-pro/templates/') for name in files):
            raise ValueError('Competition templates were not relocated')
    for name, (_, data) in files.items():
        if not name.startswith('teach-pro/') or not name.endswith('.md'):
            continue
        for match in MD_LINK.finditer(data.decode('utf-8')):
            target = match[2].split('#', 1)[0]
            if not target or ':' in target or target.startswith('/') or '*' in target:
                continue
            resolved = posixpath.normpath(posixpath.join(posixpath.dirname(name), target))
            if resolved not in files:
                raise ValueError('Broken release Markdown link: ' + name + ' -> ' + target)


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
    if name.startswith(PREFIX) and name.removeprefix(PREFIX) in FIGURES:
        return '参赛材料/' + FIGURES[name.removeprefix(PREFIX)]
    if name in (EVIDENCE, ARCHITECTURE_EVIDENCE, CONNECTED_FIGURE_EVIDENCE, VALUE_EVIDENCE, TUTOR_LIMIT_EVIDENCE):
        return '验证记录/' + PurePosixPath(name).name
    raise ValueError('Unlisted submission file: ' + name)


def write_member(archive, name, data, source=None):
    info = ZipInfo(name, source.date_time if source else (2026, 10, 6, 0, 0, 0))
    info.create_system = 3
    info.external_attr = source.external_attr if source else (0o100644 << 16)
    info.compress_type = ZIP_DEFLATED
    archive.writestr(info, data)


def extract_archive(path, output):
    with ZipFile(path) as archive:
        archive.extractall(output)
        for info in archive.infolist():
            if info.filename.endswith(('.sh', '.command')):
                (output / info.filename).chmod((info.external_attr >> 16) & 0o777)


def build_showcase_members(files):
    """Render only the archived Skill's synthetic sources, without learner data."""
    if 'teach-pro/scripts/build_adaptive_example.py' not in files:
        return []
    with tempfile.TemporaryDirectory(prefix='teach-release-showcase-') as temporary:
        root = Path(temporary)
        for name, (_, data) in files.items():
            if name.startswith('teach-pro/'):
                check_member(name, data)
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
        output = root / 'showcase'
        subprocess.run([sys.executable, '-X', 'utf8', '-B',
                        str(root / 'teach-pro/scripts/build_adaptive_example.py'), str(output)],
                       check=True, capture_output=True, text=True)
        members = []
        for path in sorted(output.rglob('*')):
            if not path.is_file():
                continue
            name = '自适应教学案例/' + path.relative_to(output).as_posix()
            data = path.read_bytes()
            check_member(name, data)
            info = ZipInfo(name)
            info.external_attr = (0o100755 if path.suffix in {'.sh', '.command'} else 0o100644) << 16
            members.append((name, info, data))
        if sum(name.endswith('.html') for name, _, _ in members) != 19:
            raise ValueError('Unexpected adaptive showcase page count')
        return members


def build(output, ref='HEAD', profile=None, skill_only=False, extract=False):
    if profile is not None and profile not in PROFILES:
        raise ValueError('Unknown release profile')
    root = Path(__file__).resolve().parents[4]
    output = Path(output)
    if output.is_symlink():
        raise ValueError('Output must not be a symlink')
    output = output.resolve()
    if output.is_relative_to(root):
        raise ValueError('Choose an output directory outside the Git repository')
    if output.exists() and (not output.is_dir() or any(output.iterdir())):
        raise FileExistsError('Choose a new output directory; deliveries are not overwritten')
    revision = subprocess.check_output(
        ['git', 'rev-parse', '--verify', ref + '^{commit}'], cwd=root, text=True).strip()
    paths = ['teach-pro', DEMO.rstrip('/'), EVIDENCE,
             PREFIX + 'dialogue-video-audit.json', *[PREFIX + name for name in MEDIA]]
    # Historical revisions remain buildable when the later optional figure is absent.
    if not skill_only:
        figure_paths = [PREFIX + name for name in FIGURES] + [ARCHITECTURE_EVIDENCE, CONNECTED_FIGURE_EVIDENCE, VALUE_EVIDENCE, TUTOR_LIMIT_EVIDENCE]
        available = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', revision, '--', *figure_paths],
                                            cwd=root, text=True).splitlines()
        paths.extend(name for name in figure_paths if name in available)
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
        duration_label = f"{round(audit['seconds']) // 60} 分 {round(audit['seconds']) % 60} 秒"
        if '新版需重录' in xml or duration_label not in xml:
            raise ValueError('Document is not synchronized with the accepted film')

    path_mapping = {}
    source_hashes = {name: digest(data) for name, (_, data) in files.items() if name.startswith('teach-pro/')}
    if profile is not None:
        files, path_mapping = profile_files(files, profile)

    note = f'''# 学途智伴参赛提交材料

队伍：{TEAM}
作品：{TITLE}
赛道：校园生活
Skill 版本：Teach Pro {VERSION}
源码快照：{revision}

当前技能包与课程运行组件为 rc.13，含答疑分层限额与 Unicode 修复。Word、视频和实录图片沿用 rc.12 的功能演示；当前课页采用题后原位作答。升级既有课程答疑运行组件后重启服务并刷新网页，原学习记录和模型配置保留。

## 用途与价值

大学生系统学习需要持续整理目标、作答表现与未解决问题，并据此安排下一步。学途智伴把学习目标、课程与本地学习记录连接起来：先评估基础，再逐课教学；请求继续时读取作答与疑难，调整下一节正式课，并按需提供独立补充课。学习者主要负责学习、作答和提问，减少反复说明背景、整理进度与自行编排课程的负担。

## 提交材料

- `Skill技能包/teach-pro`：SKILL.md、教学参考、网页模板和运行资源。
- `参赛材料/学途智伴技能说明文档.docx`：技能说明，包含简介、工作流程与系统架构、设计思路及使用说明。
- `参赛材料/学途智伴师生演示视频.mp4`：{duration_label}，含配音及画面下方字幕；展示架构讲解、真实 DeepSeek 配置与两轮流式答疑。
- `参赛材料` 同时提供独立字幕与讲解脚本，便于核对。
- `课程Demo`：智鉴 Agent 三节正式课及一节关联补充课，可阅读和实际作答。
- `验证记录` 与 `文件清单.json`：操作来源、验证范围、源码版本和逐文件校验值。

## 使用

在支持该 Skill 文件结构的宿主中导入 `Skill技能包/teach-pro`，显式调用 `@teach-pro`，先评估基础再开课。

Demo 可直接打开 `课程Demo/index.html` 阅读；自动写文件与课内答疑需要 Python 3.11 或更新版本。Windows 双击 `start-course.cmd`；macOS 双击 `start-course.command`；Linux 在课程目录执行 `sh start-course.sh`。启动器检查运行环境并准备设备密钥依赖。可选答疑在课程设置中填写自己的 API Key，选择模型并测试连接。

继续学习时，让宿主中的教学 AI 读取该课程目录的学习记录，再生成下一课。浏览器 Tutor 专注本课答疑，帮助学员理解内容、讨论问题。

演示课程呈现从评估、理解、练习到答疑和续课的学习闭环。实际作答保存到体验者自己的本地副本，教学 AI 读取记录后接续教学。提供 Windows、macOS 与 Linux 启动器；运行检查与验证记录见配套文件。

项目与后续更新：https://github.com/RoamerFly/teach-pro-skill
'''.encode('utf-8')
    figures = [(name, destination) for name, destination in FIGURES.items() if PREFIX + name in files]
    if figures:
        note += '\n## 工作流程与系统架构\n\n'.encode('utf-8')
        for _, destination in figures:
            note += f'![学途智伴工作流程与系统架构](参赛材料/{destination})\n\n'.encode('utf-8')
        note += ('上半部分展示访谈、评估、逐课教学、作答、证据审阅与自适应续课；'
                 '下半部分区分宿主教学 AI、浏览器、本地服务、可选课内 Tutor 与课程工作区。\n').encode('utf-8')
    if profile == 'competition_submit':
        note += ('\n## 赛事适配\n\n此包使用顶层中文字段；教学规范位于 `references/specs/`，'
                 '页面模板位于 `assets/templates/`。`agents/openai.yaml` 保留显式调用策略。'
                         '教学与运行能力保持一致。字段适配依据参考评审 v2.1。\n').encode('utf-8')
    if 'teach-pro/references/examples/statistics/README.md' in files:
        note += ('\n独立 Skill 包也附带[统计学最小输入输出示例](Skill技能包/teach-pro/references/examples/statistics/README.md)。'
                 '在 Skill 根目录运行 `python scripts/build_example.py <新目录> --stage assessment` 或 `--stage lesson`，'
                 '可离线组装评估与首课页面，再用 `scripts/check_course.py` 检查；不调用模型，不预填学员记录。'
                 '它是可复现页面夹具，教学 AI 的新生成行为需在宿主中另行验证。\n').encode('utf-8')
    if 'teach-pro/references/examples/statistics-adaptive/README.md' in files:
        note += ('\n专家可对照[校园统计完整自适应案例](Skill技能包/teach-pro/references/examples/statistics-adaptive/README.md)。'
                 '在 Skill 根目录运行 `python scripts/build_adaptive_example.py <新目录>`，'
                 '打开输出的 `index.html` 查看共同起点、两组模拟作答和对应的正式／补充交付；'
                 '复用原运行组件，可实际体验保存。离线案例用于展示教学结果对照，新课程由宿主中的教学 AI 生成。\n').encode('utf-8')
    records = []
    selected = [(remap(name), info, data) for name, (info, data) in files.items()
                if name != PREFIX + 'dialogue-video-audit.json']
    showcase = [] if skill_only else build_showcase_members(files)
    if showcase:
        selected.extend(showcase)
        note += ('\n## 完整案例直接体验\n\n打开[自适应教学案例/index.html](自适应教学案例/index.html)，'
                 '按“共同起点 → 案例 A／B”查看。两条分支进入同一新目标，分别采用迁移练习和分步支架；'
                 'B 还交付独立补充课。页面与输入来自可复现的合成学习场景，支持实际体验文件保存。\n').encode('utf-8')
    for name, info, data in selected:
        records.append({'path': name, 'bytes': len(data), 'sha256': digest(data),
                        'unix_mode': oct((info.external_attr >> 16) & 0o777)})
    records.append({'path': 'README.md', 'bytes': len(note), 'sha256': digest(note), 'unix_mode': '0o644'})
    manifest = {'team': TEAM, 'title': TITLE, 'version': VERSION, 'revision': revision,
                'video_seconds': audit['seconds'], 'files': sorted(records, key=lambda r: r['path'])}
    if profile is not None:
        manifest['profile'] = profile
    output.mkdir(parents=True, exist_ok=True)
    package_path = output / f'{TEAM}+{TITLE}.zip'
    skill_path = output / f'teach-pro-{VERSION}.zip'
    if not skill_only:
        with ZipFile(package_path, 'w', ZIP_DEFLATED) as package:
            for name, info, data in sorted(selected):
                write_member(package, name, data, info)
            write_member(package, 'README.md', note)
            write_member(package, '文件清单.json', json.dumps(manifest, ensure_ascii=False, indent=2).encode())
    with ZipFile(skill_path, 'w', ZIP_DEFLATED) as skill:
        for name, (info, data) in sorted(files.items()):
            if name.startswith('teach-pro/'):
                write_member(skill, name, data, info)
    archive_checks = [(skill_path, ('teach-pro/assets/',))]
    if not skill_only:
        archive_checks.insert(0, (package_path, ('Skill技能包/teach-pro/assets/', '课程Demo/')))
    for path, prefixes in archive_checks:
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
    report = {'revision': revision, 'version': VERSION, 'status': 'release-built' if profile else 'submission-ready',
              'integrity': 'pass', 'manifest_checksums': 'not-applicable' if skill_only else 'pass', 'unix_permissions': '755',
              'video_seconds': audit['seconds'], 'package_members': 0 if skill_only else len(records) + 1,
              'archives': [{'file': path.name, 'bytes': path.stat().st_size,
                            'sha256': digest(path.read_bytes())} for path, _ in archive_checks]}
    if showcase:
        report['adaptive_showcase'] = {'pages': 19, 'source': 'committed-synthetic-fixture', 'model_calls': 0}
    if figures:
        report['architecture_figures'] = [{'file': '参赛材料/' + destination,
                                          'sha256': digest(files[PREFIX + name][1])}
                                         for name, destination in figures]
    if profile is not None:
        parity = [{'source': name, 'release': path_mapping.get(name, name),
                   'source_sha256': source_sha, 'release_sha256': digest(files[path_mapping.get(name, name)][1])}
                  for name, source_sha in sorted(source_hashes.items())]
        runtime_parity = all(item['source_sha256'] == item['release_sha256'] for item in parity
                             if item['source'].startswith(('teach-pro/assets/', 'teach-pro/templates/', 'teach-pro/agents/'))
                             or item['source'].endswith('/check_course.py'))
        if not runtime_parity:
            raise ValueError('Profile adaptation changed the frozen runtime, templates or invocation policy')
        report.update(profile=profile, reference_links='pass', runtime_byte_parity='pass', source_parity=parity,
                      moved_paths=path_mapping, official_score=None)
        (output / 'README.md').write_text(
            ('# 学途智伴 · ' + ('赛事提交版' if profile == 'competition_submit' else '日常使用版') +
             '\n\n版本：' + VERSION + '\n源码提交：' + revision +
             '\n\n把学习目标、课程与本地学习记录连接起来，先评估基础，再逐课教学，依据作答与疑难安排下一步。'
             '用途和操作见 [Skill 使用说明](teach-pro/README.md)。' +
             '\n\n导入 `teach-pro/` 或独立 Skill ZIP；课程生成和启动方式见包内 README。\n' +
             ('\n参赛提交使用以队伍名和作品名命名的完整 ZIP，已包含 Word、视频和干净 Demo。'
              '赛事版中文字段在顶层；日常 Codex 使用请选择 normal_use 版。\n'
              if profile == 'competition_submit' else '\n保留日常兼容格式与原有目录；中文字段位于 metadata。\n') +
             '\n日常版与赛事版共享教学源码，按不同发布配置组织。该包来源提交、逐文件差异与 ZIP 校验值见 package-audit.json。\n'), encoding='utf-8')
    if extract:
        extract_archive(skill_path, output)
        if not skill_only:
            extract_archive(package_path, output / package_path.stem)
    (output / 'package-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({key: value for key, value in report.items() if key not in {'source_parity', 'moved_paths'}}, ensure_ascii=False, indent=2))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('--ref', default='HEAD')
    parser.add_argument('--profile', choices=PROFILES)
    parser.add_argument('--skill-only', action='store_true')
    parser.add_argument('--extract', action='store_true', help='Also create clean, importable extracted folders')
    args = parser.parse_args()
    build(args.output, args.ref, args.profile, args.skill_only, args.extract)
