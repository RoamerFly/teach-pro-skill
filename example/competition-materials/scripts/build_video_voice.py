"""Generate public-script narration only. No learner or model configuration is read."""
import argparse
import asyncio
import importlib
import json
import subprocess
import sys
from pathlib import Path


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("session", type=Path)
    parser.add_argument("--tts-packages", type=Path)
    parser.add_argument("--ffprobe", default="ffprobe")
    args = parser.parse_args()
    if args.tts_packages:
        sys.path.insert(0, str(args.tts_packages.resolve()))
    edge_tts = importlib.import_module("edge_tts")
    source = Path(__file__).resolve().parents[1] / "video-scenes.json"
    plan = json.loads(source.read_text(encoding="utf-8"))
    audio = args.session.resolve() / "audio"
    audio.mkdir(parents=True, exist_ok=True)
    for index, scene in enumerate(plan["scenes"], 1):
        target = audio / f"voice-{index:02d}.mp3"
        timing = audio / f"voice-{index:02d}.json"
        stamp = audio / f"voice-{index:02d}.source.json"
        identity = {"text": scene["narration"], "voice": plan["voice"], "rate": plan["rate"]}
        cached = json.loads(stamp.read_text(encoding="utf-8")) if stamp.exists() else None
        if not target.exists() or not timing.exists() or cached != identity:
            boundaries = []
            speaker = edge_tts.Communicate(scene["narration"], plan["voice"], rate=plan["rate"])
            with target.open("wb") as output:
                async for item in speaker.stream():
                    if item["type"] == "audio":
                        output.write(item["data"])
                    elif item["type"] in ("WordBoundary", "SentenceBoundary"):
                        boundaries.append({key: item[key] for key in ("type", "offset", "duration", "text")})
            timing.write_text(json.dumps(boundaries, ensure_ascii=False, indent=2), encoding="utf-8")
            stamp.write_text(json.dumps(identity, ensure_ascii=False), encoding="utf-8")
        duration = float(subprocess.check_output([
            args.ffprobe, "-v", "error", "-show_entries", "format=duration", "-of",
            "default=noprint_wrappers=1:nokey=1", str(target)
        ], text=True).strip())
        scene.update(audio_seconds=duration, seconds=max(scene["minimum"], duration + 0.8))
        print(f'{index:02d} {scene["id"]}: narration {duration:.2f}s, scene {scene["seconds"]:.2f}s', flush=True)
    total = sum(scene["seconds"] for scene in plan["scenes"])
    if total >= 178:
        raise RuntimeError(f"Narration exceeds budget ({total:.2f}s); revise script rather than accelerating speech")
    plan["seconds"] = total
    (args.session.resolve() / "voice-plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"PASS: natural-rate narration; total {total:.2f}s")


if __name__ == "__main__":
    asyncio.run(main())
