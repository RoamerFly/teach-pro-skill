"""Assemble recorded scenes with natural-speed narration and a separate subtitle rail."""
import argparse
import json
import re
import subprocess
from pathlib import Path


def run(*args):
    subprocess.run([str(arg) for arg in args], check=True)


def duration(file, ffprobe):
    return float(subprocess.check_output([ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(file)], text=True).strip())


def clock(seconds, ass=False):
    factor = 100 if ass else 1000
    total = round(seconds * factor)
    whole, fraction = divmod(total, factor)
    hour, rest = divmod(whole, 3600)
    minute, second = divmod(rest, 60)
    return f"{hour}:{minute:02}:{second:02}.{fraction:02}" if ass else f"{hour:02}:{minute:02}:{second:02},{fraction:03}"


def captions(boundaries):
    for boundary in boundaries:
        parts = re.findall(r"[^，。；！？、]+[，。；！？、]?", boundary["text"])
        parts = [chunk for part in parts for chunk in [part[i:i + 28] for i in range(0, len(part), 28)] if chunk.strip()]
        offset = boundary["offset"] / 1e7 + 0.2
        length = boundary["duration"] / 1e7
        weight = sum(len(part) for part in parts)
        for part in parts:
            step = length * len(part) / weight
            yield offset, offset + step, part
            offset += step


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("session", type=Path)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--ffprobe", default="ffprobe")
    args = parser.parse_args()
    session = args.session.resolve()
    materials = Path(__file__).resolve().parents[1]
    render = session / "render"
    render.mkdir(exist_ok=True)
    plan = json.loads((session / "capture-plan.json").read_text(encoding="utf-8"))
    script = json.loads((materials / "video-scenes.json").read_text(encoding="utf-8"))
    assert len(plan["scenes"]) == len(script["scenes"])
    for captured, source in zip(plan["scenes"], script["scenes"]):
        assert (captured["id"], captured["narration"]) == (source["id"], source["narration"]), "Voice script changed; regenerate narration and capture"
        captured["title"] = source["title"]
    raw = session / "capture/raw.webm"
    raw_seconds = duration(raw, args.ffprobe)
    # The video writer starts just before newPage returns; align its tail to the last hold.
    offset = max(0, raw_seconds - plan["scenes"][-1]["capture_end_ms"] / 1000)
    if offset > 1:
        raise RuntimeError(f"Unexpected recording clock offset: {offset:.3f}s")
    header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1440
PlayResY: 900
WrapStyle: 2
ScaledBorderAndShadow: yes
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Chapter,Microsoft YaHei,19,&H00D3E7F0,&H00FFFFFF,&H00172C40,&H00172C40,0,0,0,0,100,100,0,0,1,0,0,2,60,60,55,1
Style: Caption,Microsoft YaHei,28,&H00FFFFFF,&H00FFFFFF,&H00172C40,&H00172C40,0,0,0,0,100,100,0,0,1,0,0,2,70,70,13,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    clips, subtitles = [], []
    elapsed = 0
    for index, scene in enumerate(plan["scenes"], 1):
        number = f"{index:02d}"
        length = scene["seconds"]
        boundaries = json.loads((session / f"audio/voice-{number}.json").read_text(encoding="utf-8"))
        lines = [f'Dialogue: 0,0:00:00.00,{clock(length, True)},Chapter,,0,0,0,,{scene["title"]}']
        cues = list(captions(boundaries))
        for cue_index, (start, end, text) in enumerate(cues):
            if cue_index + 1 < len(cues):
                end = min(end, cues[cue_index + 1][0])
            end = min(end, length)
            if start >= end:
                continue
            lines.append(f"Dialogue: 1,{clock(start, True)},{clock(end, True)},Caption,,0,0,0,,{text}")
            subtitles.append((elapsed + start, elapsed + end, text))
        (render / f"scene-{number}.ass").write_text(header + "\n".join(lines) + "\n", encoding="utf-8")
        clip = render / f"scene-{number}.mp4"
        command = [args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-ss", f'{scene["capture_start_ms"] / 1000 + offset:.4f}', "-i", str(raw), "-i", str(session / f"audio/voice-{number}.mp3"), "-filter_complex", f"[0:v]fps=25,pad=1440:900:0:0:color=0x172c40,ass=scene-{number}.ass[v];[1:a]volume=3dB,adelay=200|200,apad[a]", "-map", "[v]", "-map", "[a]", "-t", f"{length:.4f}", "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "128k", str(clip)]
        subprocess.run(command, cwd=render, check=True)
        clips.append(clip)
        scene["clip_seconds"] = duration(clip, args.ffprobe)
        elapsed += scene["clip_seconds"]
        print(f"Rendered {index}/{len(plan['scenes'])}: {scene['id']}", flush=True)
    listing = render / "concat.txt"
    listing.write_text("\n".join(f"file '{clip.name}'" for clip in clips) + "\n", encoding="utf-8")
    output = materials / "学途智伴演示视频.mp4"
    run(args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", listing, "-c", "copy", "-movflags", "+faststart", output)
    final_seconds = duration(output, args.ffprobe)
    if not 0 < final_seconds < 180:
        raise RuntimeError(f"Invalid final duration {final_seconds}")
    srt = "\n\n".join(f"{index}\n{clock(start)} --> {clock(end)}\n{text}" for index, (start, end, text) in enumerate(subtitles, 1))
    (materials / "学途智伴演示字幕.srt").write_text(srt + "\n", encoding="utf-8")
    # Public chapter timing contains no temporary paths, answers, chats or configuration.
    public = {"seconds": final_seconds, "resolution": "1440x900", "fps": 25, "voice": plan["voice"], "speech_rate": plan["rate"], "provider_requests": len(plan["blocked_requests"]), "chapters": []}
    start = 0
    for scene in plan["scenes"]:
        public["chapters"].append({"start": round(start, 3), "seconds": round(scene["clip_seconds"], 3), "id": scene["id"], "title": scene["title"]})
        start += scene["clip_seconds"]
    (materials / "video-chapters.json").write_text(json.dumps(public, ensure_ascii=False, indent=2), encoding="utf-8")
    run(args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-ss", "2", "-i", output, "-frames:v", "1", materials / "assets/video-poster.png")
    print(f"PASS: {final_seconds:.2f}s, natural speech, subtitles outside page; {output}")


if __name__ == "__main__":
    main()
