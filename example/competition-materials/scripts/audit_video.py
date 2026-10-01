"""Decode all streams, validate subtitle timing, and extract every chapter for visual QA."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("qa", type=Path, help="Directory outside the repository")
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--ffprobe", default="ffprobe")
    args = parser.parse_args()
    materials = Path(__file__).resolve().parents[1]
    video = materials / "学途智伴演示视频.mp4"
    chapters = json.loads((materials / "video-chapters.json").read_text(encoding="utf-8"))
    args.qa.mkdir(parents=True, exist_ok=True)
    probe = json.loads(subprocess.check_output([args.ffprobe, "-v", "error", "-show_streams", "-show_format", "-of", "json", str(video)], text=True, encoding="utf-8"))
    duration = float(probe["format"]["duration"])
    assert duration < 180
    streams = {stream["codec_type"]: stream for stream in probe["streams"]}
    assert streams["video"]["codec_name"] == "h264"
    assert (streams["video"]["width"], streams["video"]["height"]) == (1440, 900)
    assert streams["video"]["r_frame_rate"] == "25/1"
    assert streams["audio"]["codec_name"] == "aac"
    assert len(chapters["chapters"]) == 16 and chapters["provider_requests"] == 0
    last = 0
    count = 0
    for start, end in re.findall(r"(\d\d:\d\d:\d\d,\d{3}) --> (\d\d:\d\d:\d\d,\d{3})", (materials / "学途智伴演示字幕.srt").read_text(encoding="utf-8")):
        def seconds(text):
            h, m, s = text.replace(",", ".").split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
        a, b = seconds(start), seconds(end)
        assert last - 0.002 <= a < b <= duration
        last, count = b, count + 1
    assert count > 40
    decode = subprocess.run([args.ffmpeg, "-hide_banner", "-v", "error", "-xerror", "-i", str(video), "-f", "null", "-"], text=True, capture_output=True)
    assert decode.returncode == 0, decode.stderr
    volume = subprocess.run([args.ffmpeg, "-hide_banner", "-i", str(video), "-vn", "-af", "volumedetect", "-f", "null", "-"], text=True, capture_output=True)
    assert volume.returncode == 0
    peak = float(re.search(r"max_volume: ([\-\d.]+) dB", volume.stderr)[1])
    mean = float(re.search(r"mean_volume: ([\-\d.]+) dB", volume.stderr)[1])
    assert -40 < mean < -5 and peak < 0, (mean, peak)
    for index, chapter in enumerate(chapters["chapters"], 1):
        timestamp = chapter["start"] + chapter["seconds"] * 0.65
        subprocess.run([args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{timestamp:.3f}", "-i", str(video), "-frames:v", "1", str(args.qa / f"frame-{index:02d}.png")], check=True)
    report = {"seconds": duration, "bytes": video.stat().st_size, "sha256": hashlib.sha256(video.read_bytes()).hexdigest().upper(), "chapters": 16, "subtitle_cues": count, "full_decode": "pass", "mean_volume_db": mean, "max_volume_db": peak, "visual_review": "pending"}
    (args.qa / "audit.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
