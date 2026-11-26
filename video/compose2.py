"""Final cut: problem -> solution -> five steps, each shown as it is done -> why you can trust it -> closing.

Motion graphics come from motion.html (record-motion.mjs). Footage is all real: the live site (record-site.mjs), the
simulator lock and send (capture_lens.py --send), and the live Telegram chat (tg-live.ps1).
Writes video/renders/dextra-walkthrough.mp4. Usage: python video/compose2.py
"""
import json
import subprocess
from pathlib import Path

import compose
from compose import ENC, ORDER, R, V, label, render

LENS_STILLS = Path(__file__).resolve().parent.parent / "apps" / "site" / "public" / "lens"


def tail(name: str, src: Path, start: float, length: float, voices: list[tuple[Path, float]]) -> Path:
    """A motion-graphic scene from its animation start, frozen on its last frame if the voice runs longer."""
    vf = (f"[0:v]trim={start:.3f},setpts=PTS-STARTPTS,fps=30,tpad=stop_mode=clone:stop_duration=6,"
          f"scale=1920:1080:flags=lanczos,fade=t=in:st=0:d=0.2,fade=t=out:st={length - 0.25:.3f}:d=0.25[vout]")
    if voices:
        return render(name, ["-i", str(src)], vf, voices, 1, length)
    out = R / f"seg-{name}.mp4"
    script = R / f"seg-{name}.filter"
    script.write_text(vf, encoding="utf-8")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
                    "-filter_complex_script", str(script), "-map", "[vout]", "-map", "1:a", "-t", f"{length:.3f}", *ENC,
                    str(out)], check=True)
    return out


def lens_still(name: str, image: Path, caption: str, length: float) -> Path:
    vf = ("[0:v]format=rgba,geq=r='if(gt(alpha(X,Y),0),70,0)':g='if(gt(alpha(X,Y),0),255,0)':"
          "b='if(gt(alpha(X,Y),0),140,0)':a=255,scale=1728:864:flags=neighbor,"
          "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b0f0c,format=yuv420p,fps=30,"
          f"{label(caption)},fade=t=in:st=0:d=0.25,fade=t=out:st={length - 0.3}:d=0.3[vout]")
    out = R / f"seg-{name}.mp4"
    script = R / f"seg-{name}.filter"
    script.write_text(vf, encoding="utf-8")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-i", str(image), "-f", "lavfi", "-i",
                    "anullsrc=r=48000:cl=stereo", "-filter_complex_script", str(script), "-map", "[vout]", "-map", "1:a",
                    "-t", f"{length}", *ENC, str(out)], check=True)
    return out


def telegram_clip(name: str, start: float, end: float, speed: float, caption: str, voice: Path, at: float) -> Path:
    length = (end - start) / speed
    vf = (f"[0:v]trim={start}:{end},setpts=(PTS-STARTPTS)/{speed},fps=30,scale=-2:1000:flags=lanczos,"
          f"pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xe8efff,{label(caption)},"
          f"fade=t=in:st=0:d=0.25,fade=t=out:st={length - 0.3:.3f}:d=0.3[vout]")
    return render(name, ["-i", str(R / "telegram-live.mp4")], vf, [(voice, at)], 1, length)


def site_clip(name: str, start: float, end: float, voices: list[tuple[str, float]]) -> Path:
    """Live-site footage between two times, with narration lines at absolute recording times."""
    length = end - start
    vf = (f"[0:v]trim={start:.3f}:{end:.3f},setpts=PTS-STARTPTS,fps=30,delogo=x=1574:y=1:w=22:h=17,"
          f"scale=1920:1080:flags=lanczos,fade=t=in:st=0:d=0.25,fade=t=out:st={length - 0.3:.3f}:d=0.3[vout]")
    return render(name, ["-i", str(R / "site.webm")], vf, [(V / f"{v}.wav", t - start) for v, t in voices], 1, length)


def main() -> None:
    raw = json.loads((R / "marks.json").read_text())
    m = {ORDER[int(k) - 1]: v for k, v in raw.items() if 1 <= int(k) <= len(ORDER)}
    cue = json.loads((R / "motion-cues.json").read_text())
    mv = lambda scene: R / f"motion-{scene}.webm"  # noqa: E731
    d = compose.dur
    card = lambda n, voice=None: tail(f"card{n}", mv(f"step-{n}"), cue[f"step-{n}"],  # noqa: E731
                                      max(2.3, d(voice) + 0.6) if voice else 2.3, [(voice, 0.3)] if voice else [])
    segments = [
        tail("problem", mv("problem"), cue["problem"], d(V / "problem.wav") + 1.4, [(V / "problem.wav", 0.4)]),
        tail("solution", mv("solution"), cue["solution"], d(V / "solution.wav") + 1.2, [(V / "solution.wav", 0.3)]),
        card(1),
        site_clip("s1", m["step1"], m["step2"], [("step1", m["step1"] + 0.15)]),
        lens_still("pair", LENS_STILLS / "01-pair.png", "On the lens · the pairing code", 3.0),
        card(2),
        telegram_clip("s2", 4, 12, 1.0, "In Telegram · /pair, then Linked ✓", V / "step2.wav", 0.4),
        card(3),
        site_clip("s3", m["step3"], m["step4"], [("step3", m["step3"] + 0.15)]),
        card(4, V / "step4.wav"),
        compose.lens_segment(),
        card(5),
        telegram_clip("s5", 58, 100, 2.0, "In Telegram · live · Attrito confirms and ticks", V / "step5.wav", 1.0),
        compose.confirmed_segment(),
        site_clip("trust", m["gate"] - 2.0, m["proof"], [("trust", m["gate"] - 1.8), ("gate", m["gate"] + 0.15),
                                                         ("records", m["records"] + 0.15)]),
        tail("outro", mv("outro"), cue["outro"], d(V / "closing.wav") + 2.2, [(V / "closing.wav", 0.7)]),
    ]
    lst = R / "segments.txt"
    lst.write_text("".join(f"file '{s.as_posix()}'\n" for s in segments), encoding="utf-8")
    final = R / "dextra-walkthrough.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy",
                    "-movflags", "+faststart", str(final)], check=True)
    print(final, f"{d(final):.1f}s")


if __name__ == "__main__":
    main()
