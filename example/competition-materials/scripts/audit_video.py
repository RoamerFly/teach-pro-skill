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
    parser.add_argument("--ui", action="store_true", help="Audit the silent UI edition instead of the historical voiced edition")
    args = parser.parse_args()
    materials = Path(__file__).resolve().parents[1]
    video = materials / ("学途智伴演示画面版.mp4" if args.ui else "学途智伴演示视频.mp4")
    chapters = json.loads((materials / ("video-ui-chapters.json" if args.ui else "video-chapters.json")).read_text(encoding="utf-8"))
    args.qa.mkdir(parents=True, exist_ok=True)
    probe = json.loads(subprocess.check_output([args.ffprobe, "-v", "error", "-show_streams", "-show_format", "-of", "json", str(video)], text=True, encoding="utf-8"))
    duration = float(probe["format"]["duration"])
    assert duration < 180
    streams = {stream["codec_type"]: stream for stream in probe["streams"]}
    assert streams["video"]["codec_name"] == "h264"
    assert (streams["video"]["width"], streams["video"]["height"]) == (1440, 900)
    assert streams["video"]["r_frame_rate"] == "25/1"
    if args.ui:
        assert "audio" not in streams and chapters["audio"] == "none"
    else:
        assert streams["audio"]["codec_name"] == "aac"
    script = json.loads((materials / ("video-ui-scenes.json" if args.ui else "video-scenes.json")).read_text(encoding="utf-8"))
    assert [item["id"] for item in chapters["chapters"]] == [item["id"] for item in script["scenes"]]
    if args.ui or chapters.get("voice_strategy") == "continuous":
        operations = chapters["live_operations"]
        assert len(operations) == 5
        if not args.ui:
            assert chapters["provider_requests"] == 5
        assert [item["operation"] for item in operations] == ["models", "test", "chat", "chat", "chat"]
        assert all(item["local_http_status"] == 200 for item in operations)
        assert chapters["model"] == "deepseek-flash" and chapters["model"] in operations[0]["model_ids"]
        chats = operations[2:]
        assert [item["message_count"] for item in chats] == [2, 4, 6]
        assert len({item["context_version"] for item in chats}) == 1
        assert all(item["answer_characters"] > 0 for item in chats)
        if args.ui:
            assert all(item["diagnostics"]["finish_reason"] == "stop" for item in chats)
            assert all(not item["diagnostics"]["has_reasoning"] for item in chats)
    else:
        assert chapters["provider_requests"] == 0
    last = 0
    count = 0
    subtitles = materials / ("学途智伴画面版字幕.srt" if args.ui else "学途智伴演示字幕.srt")
    for start, end in re.findall(r"(\d\d:\d\d:\d\d,\d{3}) --> (\d\d:\d\d:\d\d,\d{3})", subtitles.read_text(encoding="utf-8")):
        def seconds(text):
            h, m, s = text.replace(",", ".").split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
        a, b = seconds(start), seconds(end)
        assert last - 0.002 <= a < b <= duration
        last, count = b, count + 1
    assert count >= (24 if args.ui else 41)
    decode = subprocess.run([args.ffmpeg, "-hide_banner", "-v", "error", "-xerror", "-i", str(video), "-f", "null", "-"], text=True, capture_output=True)
    assert decode.returncode == 0, decode.stderr
    peak, mean = None, None
    if not args.ui:
        volume = subprocess.run([args.ffmpeg, "-hide_banner", "-i", str(video), "-vn", "-af", "volumedetect", "-f", "null", "-"], text=True, capture_output=True)
        assert volume.returncode == 0
        peak = float(re.search(r"max_volume: ([\-\d.]+) dB", volume.stderr)[1])
        mean = float(re.search(r"mean_volume: ([\-\d.]+) dB", volume.stderr)[1])
        assert -40 < mean < -5 and peak < 0, (mean, peak)
    for index, chapter in enumerate(chapters["chapters"], 1):
        timestamp = chapter["start"] + chapter["seconds"] * 0.65
        subprocess.run([args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{timestamp:.3f}", "-i", str(video), "-frames:v", "1", str(args.qa / f"frame-{index:02d}.png")], check=True)
    report = {"seconds": duration, "bytes": video.stat().st_size, "sha256": hashlib.sha256(video.read_bytes()).hexdigest().upper(), "chapters": len(chapters["chapters"]), "provider_requests": len(chapters.get("live_operations", [])), "subtitle_cues": count, "full_decode": "pass", "mean_volume_db": mean, "max_volume_db": peak, "visual_review": "pending"}
    (args.qa / "audit.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
