"""Generate two public-script Qwen auditions; credentials stay in process memory."""
import argparse
import base64
import getpass
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

ENDPOINTS = {
    'beijing': 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    'singapore': 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def payload(plan, variant):
    if not 0 < len(plan['text']) <= 600:
        raise ValueError('Audition text must contain 1–600 characters')
    return {'model': plan['model'], 'input': {
        'text': plan['text'], 'voice': plan['voice'], 'language_type': plan['language_type'],
        'instructions': variant['instructions'], 'optimize_instructions': plan['optimize_instructions'],
    }}


def read_response(opener, request, limit):
    try:
        with opener.open(request, timeout=90) as response:
            data = response.read(limit + 1)
            if len(data) > limit:
                raise RuntimeError('Provider output exceeded size limit')
            return data
    except urllib.error.HTTPError as error:
        # Never print upstream body, signed URLs, headers or credentials.
        code = ''
        try:
            value = json.loads(error.read(65536)).get('code', '')
            if re.fullmatch(r'[A-Za-z0-9_.-]{1,80}', value):
                code = value
        except (ValueError, AttributeError, TypeError):
            pass
        raise RuntimeError(f'Provider HTTP {error.code}; code={code or "unavailable"}; no automatic retry') from None
    except urllib.error.URLError:
        raise RuntimeError('Provider network/TLS failure; no automatic retry') from None


def audio_bytes(result, opener):
    audio = (result.get('output') or {}).get('audio') or {}
    if audio.get('data'):
        return base64.b64decode(audio['data'], validate=True)
    url = audio.get('url', '')
    parsed = urlsplit(url)
    # Generated audio is served by the provider's OSS; never forward the API key.
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or not parsed.hostname.endswith('.aliyuncs.com') or parsed.username or parsed.password:
        raise RuntimeError('Missing or unexpected generated-audio location')
    if parsed.scheme == 'http':
        url = 'https:' + url[len('http:'):]
    return read_response(opener, urllib.request.Request(url), 20 * 1024 * 1024)


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def check_audio(path, ffmpeg, ffprobe):
    seconds = float(subprocess.check_output([ffprobe, '-v', 'error', '-show_entries', 'format=duration',
                                            '-of', 'default=noprint_wrappers=1:nokey=1', str(path)], text=True, encoding='utf-8', errors='replace'))
    if not 10 < seconds < 60:
        raise RuntimeError('Unexpected audition length; inspect source audio')
    subprocess.run([ffmpeg, '-v', 'error', '-xerror', '-i', str(path), '-f', 'null', '-'], check=True)
    volume = subprocess.run([ffmpeg, '-hide_banner', '-i', str(path), '-af', 'volumedetect',
                             '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace', check=True)
    match = re.search(r'max_volume: ([\-\d.]+) dB', volume.stderr)
    if not match:
        raise RuntimeError('Audio peak measurement unavailable')
    peak = float(match[1])
    if peak >= 0:
        raise RuntimeError('Candidate has clipped peaks')
    return seconds, peak


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('output', type=Path)
    parser.add_argument('--region', choices=ENDPOINTS, default='beijing')
    parser.add_argument('--key-stdin', action='store_true', help='Read key without command-line arguments or files')
    parser.add_argument('--cached-only', action='store_true', help='Recheck matching cached sources offline; never request synthesis')
    parser.add_argument('--ffmpeg', default='ffmpeg')
    parser.add_argument('--ffprobe', default='ffprobe')
    args = parser.parse_args()
    key = ''
    if not args.cached_only:
        key = (getpass.getpass('API Key (hidden): ') if sys.stdin.isatty() else sys.stdin.readline()).strip() if args.key_stdin else os.environ.get('DASHSCOPE_API_KEY', '').strip()
    if not key and not args.cached_only:
        raise RuntimeError('Set DASHSCOPE_API_KEY or use --key-stdin')
    plan = json.loads((Path(__file__).resolve().parents[1] / 'expressive-voice-plan.json').read_text(encoding='utf8'))
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    report = {'kind': 'synthetic_expressive_auditions', 'model': plan['model'], 'voice': plan['voice'],
              'region': args.region, 'subjective_listening_review': 'pending', 'new_synthesis_requests': 0,
              'verification_mode': 'cached_only' if args.cached_only else 'synthesis_or_cache',
              'text': plan['text'], 'samples': []}
    for variant in plan['variants']:
        body = payload(plan, variant)
        stamp = output / (variant['id'] + '.source.json')
        raw = output / (variant['id'] + '.wav')
        target = output / variant['file']
        signature = fingerprint({'request': body, 'region': args.region})
        cached = json.loads(stamp.read_text(encoding='utf8')) if stamp.exists() else {}
        if not raw.exists() or cached.get('fingerprint') != signature:
            if args.cached_only:
                raise RuntimeError('Matching cached source unavailable; no provider request sent')
            request = urllib.request.Request(ENDPOINTS[args.region], data=json.dumps(body).encode(),
                       headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key})
            result = json.loads(read_response(opener, request, 25 * 1024 * 1024))
            if result.get('code') or result.get('status_code', 200) != 200:
                raise RuntimeError('Provider reported synthesis failure; no automatic retry')
            raw.write_bytes(audio_bytes(result, opener))
            stamp.write_text(json.dumps({'fingerprint': signature}, indent=2), encoding='utf8')
            report['new_synthesis_requests'] += 1
        check_audio(raw, args.ffmpeg, args.ffprobe)
        # Match audition loudness, without changing pitch, speech speed or pauses.
        subprocess.run([args.ffmpeg, '-v', 'error', '-y', '-i', str(raw), '-af', 'loudnorm=I=-18:TP=-2:LRA=7',
                        '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k', str(target)], check=True)
        seconds, peak = check_audio(target, args.ffmpeg, args.ffprobe)
        report['samples'].append({'id': variant['id'], 'file': target.name, 'seconds': seconds,
             'instructions': variant['instructions'], 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
             'raw_sha256': hashlib.sha256(raw.read_bytes()).hexdigest(), 'peak_db': peak, 'decode': 'pass'})
        print(f'{variant["id"]}: {seconds:.2f}s; decoded; peak {peak}dB', flush=True)
    (output / 'expressive-voice-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print('PASS: cached audio rechecked offline; listening review pending' if args.cached_only
          else 'PASS: emotional instructions submitted; listening review pending', flush=True)


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, ValueError, OSError, subprocess.SubprocessError):
        # Exception strings can contain provider URLs; expose only our safe RuntimeErrors.
        error = sys.exc_info()[1]
        print(str(error) if isinstance(error, RuntimeError) else 'Synthesis or audio validation failed; no automatic retry', file=sys.stderr)
        sys.exit(1)
