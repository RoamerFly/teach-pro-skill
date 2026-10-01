"""Use the packaged render_docx.py with Word PDF export on Windows without bundled LO.

The managed skill package is never edited. Python/Poppler are from the selected bundle.
"""
import argparse
import importlib.util
import os
from pathlib import Path
import subprocess
import sys

parser = argparse.ArgumentParser()
parser.add_argument('document')
parser.add_argument('output_dir')
parser.add_argument('--renderer', required=True)
parser.add_argument('--poppler', required=True)
args = parser.parse_args()
spec = importlib.util.spec_from_file_location('packaged_docx_renderer', args.renderer)
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)


def word_pdf(doc_path, user_profile, convert_tmp_dir, stem, verbose):
    output = str(Path(convert_tmp_dir) / f'{stem}.pdf')
    command = ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', str(Path(__file__).with_name('export_word_pdf.ps1')), '-InputPath', doc_path, '-OutputPath', output]
    result = subprocess.run(command, capture_output=True, text=True, timeout=60)
    if result.returncode or not Path(output).is_file():
        raise RuntimeError('Word PDF export failed: ' + result.stdout + result.stderr)
    return output, 'Word.Application ExportAsFixedFormat; no LibreOffice invoked'


if sys.platform != 'win32':
    raise SystemExit('This adapter is for Windows Word export only; use the packaged renderer directly elsewhere.')
os.environ['PATH'] = str(Path(args.poppler).resolve()) + os.pathsep + os.environ.get('PATH', '')
renderer.convert_to_pdf = word_pdf
sys.argv = [args.renderer, args.document, '--output_dir', args.output_dir, '--emit_pdf', '--dpi', '160']
renderer.main()
