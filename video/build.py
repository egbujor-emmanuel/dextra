"""Builds video/renders/dextra-demo.mp4 from real captures and the Kokoro narration.

Footage: simulator lens frames (apps/site/public/lens, captured from the Even simulator running the live build) and
screenshots of the live site (video/shots). Voice: video/voice/*.wav (local Kokoro, bf_emma). Captions come from the
same lines in script.json and ship as a soft subtitle track.
Usage: python video/build.py
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LENS = ROOT.parent / "apps" / "site" / "public" / "lens"
OUT = ROOT / "renders"
TMP = OUT / "parts"
LEAD, TAIL, FPS = 0.6, 1.0, 30

# scene id -> (image, kind). "lens" frames are 576x288 green-on-transparent and are shown big on a dark field.
FOOTAGE = {
    "hook": (LENS / "02-listen.png", "lens"),
    "attack": (ROOT / "shots" / "gate.png", "page"),
    "listen-lock": (LENS / "03-card.png", "lens"),
    "send": (LENS / "04-sent.png", "lens"),
    "confirm": (ROOT / "shots" / "hero.png", "page"),
    "done": (ROOT / "shots" / "done.png", "page"),
    "proof": (ROOT / "shots" / "proof.png", "page"),
    "end": (ROOT / "shots" / "end.png", "page"),
}


def run(args):
    subprocess.run(args, check=True, capture_output=True)


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         check=True, capture_output=True, text=True).stdout
    return float(out.strip())


def video_filter(kind, frames):
    zoom = f"zoompan=z='min(1+0.00045*on,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s=1920x1080:fps={FPS}"
    if kind == "lens":
        base = ("[0:v]scale=1728:864:flags=neighbor[l];color=c=0x0b0f0c:s=1920x1080:d=1[bg];"
                "[bg][l]overlay=(W-w)/2:(H-h)/2,format=yuv420p[p];[p]")
        return base + zoom
    return "[0:v]scale=1920:1080," + zoom


def srt_time(t):
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h):02}:{int(m):02}:{s:06.3f}".replace(".", ",")


def main():
    script = json.loads((ROOT / "script.json").read_text(encoding="utf-8"))
    TMP.mkdir(parents=True, exist_ok=True)
    parts, cues, clock = [], [], 0.0
    for i, scene in enumerate(script["scenes"]):
        sid = scene["id"]
        voice = ROOT / "voice" / f"s{i}-{sid}.wav"
        image, kind = FOOTAGE[sid]
        length = LEAD + duration(voice) + TAIL
        frames = round(length * FPS)
        part = TMP / f"{i:02}-{sid}.mp4"
        vf = video_filter(kind, frames) + f",fade=t=in:st=0:d=0.3,fade=t=out:st={length - 0.35:.2f}:d=0.35[v]"
        run(["ffmpeg", "-y", "-loop", "1", "-i", str(image), "-i", str(voice),
             "-filter_complex", vf + f";[1:a]adelay={int(LEAD * 1000)}:all=1,apad,atrim=0:{length:.3f}[a]",
             "-map", "[v]", "-map", "[a]", "-t", f"{length:.3f}", "-r", str(FPS),
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "160k", "-ar", "48000", str(part)])
        parts.append(part)
        cues.append((clock + LEAD, clock + LEAD + duration(voice), scene["voice"]))
        clock += length
    (TMP / "list.txt").write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")
    srt = OUT / "dextra-demo.srt"
    srt.write_text("".join(f"{n}\n{srt_time(a)} --> {srt_time(b)}\n{text}\n\n" for n, (a, b, text) in enumerate(cues, 1)),
                   encoding="utf-8")
    final = OUT / "dextra-demo.mp4"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(TMP / "list.txt"), "-i", str(srt),
         "-map", "0", "-map", "1", "-c", "copy", "-c:s", "mov_text", "-metadata:s:s:0", "language=eng",
         "-movflags", "+faststart", str(final)])
    print(f"{final} {clock:.1f}s")


if __name__ == "__main__":
    main()
