"""Continuous narration with real recorded requests; only waiting time is cut."""
import json
import subprocess
from pathlib import Path
from render_video import captions, clock, duration, run


def frame_schedule(scenes, fps=25):
    ends = [round((scene["voice_start_seconds"] + scene["seconds"]) * fps) for scene in scenes]
    starts = [0] + ends[:-1]
    return [(end - start, start / fps) for start, end in zip(starts, ends)]


def loudness_measurement(log):
    # FFmpeg can append its final progress line after the loudnorm JSON.
    result, _ = json.JSONDecoder().raw_decode(log[log.rfind('{'):])
    for name in ('input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset'):
        float(result[name])
    return result


def render(args, session, materials, plan):
    raw = session / "capture/raw.webm"
    voice = session / "audio/narration.mp3"
    offset = max(0, duration(raw, args.ffprobe) - plan["scenes"][-1]["capture_end_ms"] / 1000)
    if offset > 1:
        raise RuntimeError("Recording clock mismatch")
    operations = plan["live_operations"]
    assert [item["operation"] for item in operations] == ["models", "test", "chat", "chat", "chat"]
    assert all(item["local_http_status"] == 200 for item in operations)
    assert plan["model"] in operations[0]["model_ids"]
    assert operations[-1]["message_count"] == 6 and not plan["blocked_requests"]
    boundaries = json.loads((session / "audio/narration.json").read_text(encoding="utf-8"))
    cues = list(captions(boundaries, delay=0))
    cues = [(a, min(b, cues[index + 1][0]) if index + 1 < len(cues) else b, text) for index, (a, b, text) in enumerate(cues)]
    render_dir = session / "render-live"
    render_dir.mkdir(exist_ok=True)
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
    public = {"resolution": "1440x900", "fps": 25, "voice": plan["voice"], "speech_rate": plan["rate"], "voice_strategy": "continuous", "model": plan["model"], "max_tokens": plan["max_tokens"], "provider_requests": len(operations), "live_operations": operations, "chapters": []}
    schedule = frame_schedule(plan["scenes"])
    clips = []
    for index, (scene, (frames, final_start)) in enumerate(zip(plan["scenes"], schedule), 1):
        length = frames / 25
        initial = scene["capture_start_ms"] / 1000 + offset
        captured = (scene["capture_end_ms"] - scene["capture_start_ms"]) / 1000
        short = captured > length + 0.35
        title = scene["title"]
        if short and scene["id"] in {"settings", "connection", "tutor-answer", "followup"} and '等待' not in title:
            title += ' · 等待已剪短'
        lines = [f'Dialogue: 0,0:00:00.00,{clock(length, True)},Chapter,,0,0,0,,{title}']
        for a, b, text in cues:
            start, end = max(a, final_start), min(b, final_start + length)
            if start < end:
                lines.append(f"Dialogue: 1,{clock(start - final_start, True)},{clock(end - final_start, True)},Caption,,0,0,0,,{text}")
        ass = f"live-{index:02d}.ass"
        (render_dir / ass).write_text(header + "\n".join(lines) + "\n", encoding="utf-8")
        inputs = ["-ss", f"{initial:.4f}", "-i", str(raw)]
        filters = "[0:v]"
        screenshot_hold = scene['id'] == 'lesson'
        if screenshot_hold:
            # The end screenshot is the actual code page from this capture, not a mock.
            # Keep the diagram and navigation in motion; repair only the static reading hold.
            lead = min(length - 0.5, (scene['action_end_ms'] - scene['capture_start_ms']) / 1000 + 0.15)
            tail = length - lead
            inputs += ['-loop', '1', '-framerate', '25', '-i', str(session / f'capture/scene-{index:02d}.png')]
            filters = f'[0:v]trim=duration={lead:.4f},setpts=PTS-STARTPTS[a];[1:v]trim=duration={tail:.4f},setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0,'
        elif short:
            lead = min(2.4, length / 3)
            tail = length - lead
            last = scene["capture_end_ms"] / 1000 + offset - tail
            inputs += ["-ss", f"{last:.4f}", "-i", str(raw)]
            filters = f"[0:v]trim=duration={lead:.4f},setpts=PTS-STARTPTS[a];[1:v]trim=duration={tail:.4f},setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0,"
        filters += f"fps=25,trim=end_frame={frames},setpts=PTS-STARTPTS,pad=1440:900:0:0:color=0x172c40,ass={ass}[v]"
        clip = render_dir / f"live-{index:02d}.mp4"
        subprocess.run([args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", *inputs, "-filter_complex", filters, "-map", "[v]", "-an", "-frames:v", str(frames), "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", str(clip)], cwd=render_dir, check=True)
        clips.append(clip)
        public["chapters"].append({"id": scene["id"], "title": title, "start": final_start, "seconds": length, "wait_cut_seconds": round(max(0, captured - length), 3), "reading_hold": "actual_capture_screenshot" if screenshot_hold else "recording"})
        print(f"Rendered {index}/{len(schedule)}: {scene['id']}", flush=True)
    listing = render_dir / "concat.txt"
    listing.write_text("\n".join(f"file '{clip.name}'" for clip in clips) + "\n", encoding="utf-8")
    silent = render_dir / "continuous-picture.mp4"
    run(args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", listing, "-c", "copy", silent)
    measure = subprocess.run([args.ffmpeg, "-hide_banner", "-i", str(voice), "-af", "highpass=f=65,loudnorm=I=-18:TP=-2:LRA=11:print_format=json", "-f", "null", "-"], text=True, capture_output=True, check=True)
    loud = loudness_measurement(measure.stderr)
    (render_dir / "loudness.json").write_text(json.dumps(loud, indent=2), encoding="utf-8")
    normalization = 'highpass=f=65,loudnorm=I=-18:TP=-2:LRA=11:' + ':'.join(f'{key}={loud[value]}' for key, value in {'measured_I': 'input_i', 'measured_TP': 'input_tp', 'measured_LRA': 'input_lra', 'measured_thresh': 'input_thresh', 'offset': 'target_offset'}.items()) + ':linear=true,apad'
    output = materials / "学途智伴演示视频.mp4"
    final_length = sum(frames for frames, _ in schedule) / 25
    run(args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", silent, "-i", voice, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-af", normalization, "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "160k", "-t", f"{final_length:.4f}", "-movflags", "+faststart", output)
    public["seconds"] = duration(output, args.ffprobe)
    assert public["seconds"] < 180
    (materials / "video-chapters.json").write_text(json.dumps(public, ensure_ascii=False, indent=2), encoding="utf-8")
    srt = "\n\n".join(f"{index}\n{clock(a)} --> {clock(min(b, final_length))}\n{text}" for index, (a, b, text) in enumerate(cues, 1) if a < final_length)
    (materials / "学途智伴演示字幕.srt").write_text(srt + "\n", encoding="utf-8")
    run(args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-ss", "2", "-i", output, "-frames:v", "1", materials / "assets/video-poster.png")
    print(f"PASS: {public['seconds']:.2f}s; continuous voice, real Flash answers, subtitles outside lesson")
