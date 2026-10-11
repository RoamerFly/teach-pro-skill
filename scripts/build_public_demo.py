"""Build a selected, committed public showcase, never a live course workspace."""
import argparse
import importlib.util
import io
import json
import posixpath
import re
import subprocess
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'example/competition-pages'
DEMO = 'example/competition-demo-rc12/'
MATERIALS = 'example/competition-materials/rc12/'
FORBIDDEN = {'learner-submissions', 'learner-chats', '.teach-runtime', '.git', '__pycache__', '.tutor-settings.json', '.env'}
SECRET = re.compile(rb'(?<![A-Za-z0-9_-])sk-[A-Za-z0-9_.-]{24,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{32,}')

def snapshot(ref):
    revision = subprocess.check_output(['git', 'rev-parse', ref], cwd=ROOT, text=True).strip()
    raw = subprocess.check_output(['git', 'archive', '--format=zip', revision, '--', 'teach-pro', DEMO, MATERIALS], cwd=ROOT)
    with ZipFile(io.BytesIO(raw)) as archive:
        files = {i.filename: (i, archive.read(i)) for i in archive.infolist() if not i.is_dir()}
    return revision, files

def check_public(name, data):
    if FORBIDDEN.intersection(PurePosixPath(name).parts) or SECRET.search(data):
        raise ValueError('Non-public content: ' + name)

class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.paths = []
    def handle_starttag(self, tag, attrs):
        self.paths.extend(value for name, value in attrs if name in {'href', 'src', 'poster'} and value)

def validate(files):
    for name, data in files.items():
        check_public(name, data)
        if not name.endswith('.html'):
            continue
        links = Links(); links.feed(data.decode('utf-8'))
        for target in links.paths:
            parsed = urlsplit(target)
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            if parsed.path.startswith('/'):
                raise ValueError('Project Pages absolute path: ' + name + ' -> ' + target)
            resolved = posixpath.normpath(posixpath.join(posixpath.dirname(name), unquote(parsed.path)))
            if resolved not in files:
                raise ValueError('Missing public link: ' + name + ' -> ' + target)

def load_package_module():
    spec = importlib.util.spec_from_file_location('submission', ROOT / MATERIALS / 'scripts/package_submission.py')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module

def build(output, ref='HEAD'):
    output = Path(output).resolve()
    if output.exists() or output.is_relative_to(SOURCE.resolve()):
        raise ValueError('Use a new output directory outside the source folder')
    revision, source = snapshot(ref)
    package = load_package_module()
    public = {}
    for path in SOURCE.rglob('*'):
        if path.is_file() and path.suffix in {'.html', '.css', '.js', '.png'}:
            public[path.relative_to(SOURCE).as_posix()] = path.read_bytes()
    course_files = {n: (i, d) for n, (i, d) in source.items() if n.startswith(DEMO)}
    for name, (info, data) in course_files.items():
        check_public(name, data)
        rel = name.removeprefix(DEMO)
        if Path(rel).suffix not in {'.html', '.css', '.js'}:
            continue
        if rel.endswith('.html'):
            prefix = posixpath.relpath('assets', posixpath.dirname(rel) or '.')
            data = data.decode('utf-8').replace('</head>', f'  <link rel="stylesheet" href="{prefix}/preview.css">\n</head>').replace('</body>', f'  <script src="{prefix}/preview.js"></script>\n</body>').encode('utf-8')
        public['course/' + rel] = data
    public['course/assets/preview.css'] = public['assets/preview.css']
    public['course/assets/preview.js'] = public['assets/preview.js']
    with io.BytesIO() as raw:
        with ZipFile(raw, 'w', ZIP_DEFLATED) as archive:
            for name, (info, data) in course_files.items():
                package.write_member(archive, name.removeprefix(DEMO), data, info)
        public['downloads/zhijian-agent-course.zip'] = raw.getvalue()
    skill = {n: pair for n, pair in source.items() if n.startswith('teach-pro/')}
    adapted, _ = package.profile_files(skill, 'normal_use')
    for name, (_, data) in adapted.items():
        check_public(name, data)
    with io.BytesIO() as raw:
        with ZipFile(raw, 'w', ZIP_DEFLATED) as archive:
            for name, (info, data) in adapted.items():
                package.write_member(archive, name, data, info)
        public['downloads/teach-pro.zip'] = raw.getvalue()
    # The existing reproducible synthetic fixture is built with frozen Skill resources.
    from tempfile import TemporaryDirectory
    with TemporaryDirectory(prefix='teach-pages-') as temp:
        temp = Path(temp)
        with ZipFile(io.BytesIO(public['downloads/teach-pro.zip'])) as archive:
            archive.extractall(temp)
        subprocess.run([__import__('sys').executable, '-B', str(temp / 'teach-pro/scripts/build_adaptive_example.py'), str(temp / 'adaptive')], check=True, capture_output=True)
        for path in (temp / 'adaptive').rglob('*'):
            if path.is_file() and path.suffix in {'.html', '.css', '.js'}:
                public['adaptive/' + path.relative_to(temp / 'adaptive').as_posix()] = path.read_bytes()
    public['assets/workflow.png'] = source[MATERIALS + 'assets/teach-pro-workflow-architecture-v2-connected.png'][1]
    public['assets/demo.mp4'] = source[MATERIALS + '学途智伴师生演示视频.mp4'][1]
    public['.nojekyll'] = b''
    validate(public)
    report = {'source_revision': revision, 'status': 'pass', 'local_links': 'pass',
              'credential_scan': 'pass', 'new_model_calls': 0, 'files': [
                  {'path': n, 'bytes': len(d), 'sha256': sha256(d).hexdigest()} for n, d in sorted(public.items())]}
    public['build-audit.json'] = json.dumps(report, ensure_ascii=False, indent=2).encode('utf-8')
    for name, data in public.items():
        target = output / name; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(data)
    print(json.dumps({'status': 'pass', 'source_revision': revision, 'public_files': len(public), 'output': str(output)}, ensure_ascii=False))
    return report

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('output'); parser.add_argument('--ref', default='HEAD')
    args = parser.parse_args(); build(args.output, args.ref)
