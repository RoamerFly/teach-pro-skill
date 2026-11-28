"""Adapt one Skill source into normal and competition package layouts."""
from pathlib import PurePosixPath
import posixpath
import re

PROFILES = ("normal_use", "competition_submit")
MD_LINK = re.compile(r"(\[[^\]\n]*\]\()([^\s)]+)(\))")

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
                         '日常使用选择 normal_use 包。两个包来自同一提交，教学规则与运行组件一致。\n')
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
