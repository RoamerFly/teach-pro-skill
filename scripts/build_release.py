"""Build reproducible Skill ZIPs from a committed Git revision using the standard library."""
import argparse
import hashlib
import importlib.util
import io
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('teach_release_profiles', ROOT / 'scripts/release_profiles.py')
profiles = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profiles)
profile_files = profiles.profile_files
validate_profile = profiles.validate_profile
PROFILES = profiles.PROFILES
FORBIDDEN = {'learner-submissions', 'learner-chats', 'learner-attachments', '.teach-runtime',
             '.teach-portable', '.tutor-settings.json', '__pycache__', '.git', 'node_modules'}
SECRET = re.compile(rb'(?<![A-Za-z0-9_-])sk-[A-Za-z0-9_.-]{24,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{32,}')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def check_member(name, data):
    path = PurePosixPath(name)
    if (not name or path.is_absolute() or '..' in path.parts or '\\' in name or '\x00' in name
            or re.match(r'^[A-Za-z]:', name) or FORBIDDEN.intersection(path.parts)
            or any(part.startswith('.env') for part in path.parts)
            or path.suffix.lower() in {'.pyc', '.pyo', '.key', '.pem'}):
        raise ValueError('Excluded archive path: ' + name)
    if SECRET.search(data):
        raise ValueError('Credential-like content in: ' + name)


def write_member(archive, name, data, original=None):
    check_member(name, data)
    info = ZipInfo(name, original.date_time if original else (2026, 1, 1, 0, 0, 0))
    info.create_system = 3
    info.compress_type = ZIP_DEFLATED
    info.external_attr = (0o100755 if name.endswith(('.sh', '.command')) else 0o100644) << 16
    archive.writestr(info, data)


def extract_archive(archive_path, output):
    output = Path(output).resolve()
    with ZipFile(archive_path) as archive:
        members = [(info, archive.read(info)) for info in archive.infolist() if not info.is_dir()]
        for info, data in members:
            check_member(info.filename, data)
            target = output / info.filename
            if not target.resolve().is_relative_to(output) or target.exists():
                raise ValueError('Unsafe extraction target: ' + info.filename)
        for info, data in members:
            target = output / info.filename
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            target.chmod((info.external_attr >> 16) & 0o777)


def snapshot(ref='HEAD'):
    revision = subprocess.check_output(['git', 'rev-parse', '--verify', ref + '^{commit}'], cwd=ROOT, text=True).strip()
    raw = subprocess.check_output(['git', 'archive', '--format=zip', revision, '--', 'teach-pro'], cwd=ROOT)
    with ZipFile(io.BytesIO(raw)) as archive:
        files = {info.filename: (info, archive.read(info)) for info in archive.infolist() if not info.is_dir()}
    return revision, files


def build_files(files, output, revision, tag=None, extract=False):
    for name, (_, data) in files.items():
        if not name.startswith('teach-pro/'):
            raise ValueError('Only the Skill directory belongs in a Skill release')
        check_member(name, data)
    for required in ['SKILL.md', 'VERSION.md', 'UPSTREAM-LICENSE', 'assets/vendor/marked.LICENSE', 'assets/vendor/dompurify.LICENSE']:
        if 'teach-pro/' + required not in files:
            raise ValueError('Missing release file: ' + required)
    match = re.search(r'^- Version: (\S+)\s*$', files['teach-pro/VERSION.md'][1].decode('utf-8'), re.M)
    if not match or not re.fullmatch(r'\d+\.\d+\.\d+', match[1]):
        raise ValueError('Use a stable version such as 1.2.0 in VERSION.md')
    version = match[1]
    if tag is not None and tag != 'v' + version:
        raise ValueError('Release tag and VERSION.md do not match')
    output = Path(output)
    if output.is_symlink():
        raise ValueError('Output must not be a symlink')
    output = output.resolve()
    if output.is_relative_to((ROOT / 'teach-pro').resolve()):
        raise ValueError('Output must be outside the Skill directory')
    if output.exists() and (not output.is_dir() or any(output.iterdir())):
        raise FileExistsError('Use a new or empty output directory')
    prepared = []
    for profile, suffix in [('normal_use', ''), ('competition_submit', '-competition')]:
        adapted, mapping = profile_files(files, profile)
        for name, (_, data) in files.items():
            if name.startswith('teach-pro/assets/') or name.endswith('/check_course.py'):
                if adapted[mapping.get(name, name)][1] != data:
                    raise ValueError('Runtime differs between release profiles: ' + name)
        prepared.append((profile, f'teach-pro-{version}{suffix}.zip', adapted))
    output.mkdir(parents=True, exist_ok=True)
    manifest = {'version': version, 'source_revision': revision, 'minimum_python': '3.10', 'archives': []}
    for profile, filename, adapted in prepared:
        archive_path = output / filename
        with ZipFile(archive_path, 'w', ZIP_DEFLATED, compresslevel=9) as archive:
            for name, (info, data) in sorted(adapted.items()):
                write_member(archive, name, data, info)
        with ZipFile(archive_path) as archive:
            if archive.testzip() is not None:
                raise ValueError('ZIP integrity check failed: ' + filename)
        manifest['archives'].append({'file': filename, 'profile': profile, 'bytes': archive_path.stat().st_size,
            'sha256': digest(archive_path.read_bytes()), 'members': len(adapted), 'runtime_byte_parity': True})
        if extract:
            extract_archive(archive_path, output / profile)
    manifest_path = output / 'release-manifest.json'
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    sums = {entry['file']: entry['sha256'] for entry in manifest['archives']}
    sums[manifest_path.name] = digest(manifest_path.read_bytes())
    (output / 'SHA256SUMS').write_text(''.join(f'{sha}  {name}\n' for name, sha in sorted(sums.items())), encoding='utf-8')
    return manifest


def build(output, ref='HEAD', tag=None, extract=False):
    revision, files = snapshot(ref)
    return build_files(files, output, revision, tag, extract)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('--ref', default='HEAD')
    parser.add_argument('--tag', help='Require a matching stable version tag, for example v1.2.0')
    parser.add_argument('--extract', action='store_true')
    args = parser.parse_args()
    print(json.dumps(build(args.output, args.ref, args.tag, args.extract), ensure_ascii=False, indent=2))
