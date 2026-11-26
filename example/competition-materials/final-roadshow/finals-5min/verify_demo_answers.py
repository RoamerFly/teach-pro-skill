"""Check that the final showcase archive includes the approved simulated answers."""
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile

parser = argparse.ArgumentParser()
parser.add_argument('archive', type=Path)
args = parser.parse_args()
policy = json.loads((Path(__file__).parent / '演示作答打包规则.json').read_text(encoding='utf8'))
with ZipFile(args.archive) as archive:
    assert archive.testzip() is None
    for item in policy['pages']:
        matches = [n for n in archive.namelist() if n.endswith('/现场演示课程/' + item['file'])]
        assert len(matches) == 1, 'Missing or duplicate simulated answer record'
        raw = archive.read(matches[0])
        assert hashlib.sha256(raw).hexdigest() == item['sha256'], 'Unapproved answer data'
        record = json.loads(raw)
        assert len(record['fields']) == item['fields']
        assert all(isinstance(v, str) and v.strip() for v in record['fields'].values())
print('PASS: two approved simulated records and ten nonempty input values are included')
