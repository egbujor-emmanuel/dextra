"""Cuts the final walkthrough: video/renders/dextra-walkthrough.mp4.

Segments, all real footage:
  A. the live site, steps 1-4 (renders/site.webm, Playwright recording with cursor and step labels)
  B. the Even simulator locking the eval conversation (renders/lens/frames.txt from capture_lens.py)
  C. the real Telegram chat (renders/telegram.mp4, chat pane only)
  D. the live site: the refusal panel, the records deck with Demo Shield, the measured numbers
Narration lines (voice2/*.wav) start where record-site.mjs put its sync marker (renders/marks.json).
Usage: python video/compose.py
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
R = ROOT / "renders"
V = ROOT / "voice2"
FONT = "C\\:/Windows/Fonts/segoeuib.ttf"
ORDER = ["intro", "step1", "step2", "step3", "step4", "cut", "gate", "records", "proof"]
ENC = ["-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
       "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2"]


def dur(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         check=True, capture_output=True, text=True).stdout
    return float(out.strip())


def label(text: str) -> str:
    return (f"drawtext=fontfile='{FONT}':text='{text}':fontsize=24:fontcolor=white:box=1:boxcolor=0x0f172a:"
            f"boxborderw=10:x=26:y=h-58")


def audio_mix(voices: list[tuple[Path, float]], first_input: int, length: float) -> tuple[list[str], str]:
    """Inputs and a filter that place each clip at its offset and pad to the segment length."""
    args, parts = [], []
    for i, (clip, at) in enumerate(voices):
        args += ["-i", str(clip)]
        parts.append(f"[{first_input + i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={int(at * 1000)}:all=1[a{i}]")
    mix = "".join(f"[a{i}]" for i in range(len(voices)))
    parts.append(f"{mix}amix=inputs={len(voices)}:normalize=0,apad,atrim=0:{length:.3f}[aout]")
    return args, ";".join(parts)


def render(name: str, inputs: list[str], vf: str, voices: list[tuple[Path, float]], first_audio: int, length: float) -> Path:
    out = R / f"seg-{name}.mp4"
    a_args, af = audio_mix(voices, first_audio, length)
    script = R / f"seg-{name}.filter"
    script.write_text(vf + ";" + af, encoding="utf-8")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, *a_args, "-filter_complex_script", str(script),
                    "-map", "[vout]", "-map", "[aout]", "-t", f"{length:.3f}", *ENC, str(out)], check=True)
    return out


def site_segment(name: str, start: float, end: float, lines: list[str], marks: dict[str, float]) -> Path:
    length = end - start
    vf = (f"[0:v]trim={start:.3f}:{end:.3f},setpts=PTS-STARTPTS,fps=30,delogo=x=1574:y=1:w=22:h=17,"
          f"scale=1920:1080:flags=lanczos,fade=t=in:st=0:d=0.25,fade=t=out:st={length - 0.3:.3f}:d=0.3[vout]")
    voices = [(V / f"{l}.wav", marks[l] - start + 0.15) for l in lines]
    return render(name, ["-i", str(R / "site.webm")], vf, voices, 1, length)


def first_card_frame(lock_at: float) -> float:
    """Time of the first frame after "Locking what was said…" (the card), by lit-pixel count jumping up."""
    frames = sorted((R / "lens").glob("*.png"))
    sizes = [(int(f.stem) / 1000, f.stat().st_size) for f in frames]
    locking = [sz for t, sz in sizes if lock_at < t < lock_at + 3]
    base = min(locking) if locking else 0
    return next((t for t, sz in sizes if t > lock_at + 2 and sz > base * 1.3), lock_at + 8)


def lens_segment() -> Path:
    timing = json.loads((R / "lens" / "timing.json").read_text())
    start = 1.0
    length = timing["end"] - start - 0.2
    card_at = first_card_frame(timing["lock_at"]) - start
    vf = ("[0:v]fps=30,format=rgba,geq=r='if(gt(alpha(X,Y),0),70,0)':g='if(gt(alpha(X,Y),0),255,0)':"
          "b='if(gt(alpha(X,Y),0),140,0)':a=255,"
          f"trim={start}:{start + length},setpts=PTS-STARTPTS,scale=1728:864:flags=neighbor,"
          "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b0f0c,format=yuv420p,"
          f"{label('In the Even simulator · DEXTRA live build')},"
          f"fade=t=in:st=0:d=0.25,fade=t=out:st={length - 0.3}:d=0.3[vout]")
    conversation = ROOT.parent / "evals" / "audio" / "conversation.wav"
    voices = [(conversation, timing["audio_at"] - start), (V / "sim.wav", card_at + 0.3)]
    return render("lens", ["-f", "concat", "-safe", "0", "-i", str(R / "lens" / "frames.txt")], vf, voices, 1, length)


def telegram_segment() -> Path:
    length = 12.5
    vf = ("[0:v]trim=1.5:26.5,setpts=(PTS-STARTPTS)/2,fps=30,scale=-2:1000:flags=lanczos,"
          "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xe8efff,"
          f"{label('In Telegram · the real chat with Attrito')},"
          f"fade=t=in:st=0:d=0.25,fade=t=out:st={length - 0.3}:d=0.3[vout]")
    return render("telegram", ["-i", str(R / "telegram.mp4")], vf, [(V / "telegram.wav", 0.5)], 1, length)


def main() -> None:
    raw = json.loads((R / "marks.json").read_text())
    marks = {ORDER[int(k) - 1]: v for k, v in raw.items() if 1 <= int(k) <= len(ORDER)}
    end = dur(R / "site.webm")
    a_start = marks["intro"] - 0.8
    d_start = marks["gate"] - 0.7
    segments = [
        site_segment("a", a_start, marks["cut"], ORDER[:5], marks),
        lens_segment(),
        telegram_segment(),
        site_segment("d", d_start, min(end, marks["proof"] + dur(V / "proof.wav") + 1.5), ORDER[6:], marks),
    ]
    lst = R / "segments.txt"
    lst.write_text("".join(f"file '{s.as_posix()}'\n" for s in segments), encoding="utf-8")
    final = R / "dextra-walkthrough.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy",
                    "-movflags", "+faststart", str(final)], check=True)
    print(final, f"{dur(final):.1f}s")


if __name__ == "__main__":
    main()
