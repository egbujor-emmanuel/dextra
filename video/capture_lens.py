"""Captures a real lock on the Even simulator, frame by frame, from its automation API.

The simulator must be running with --automation-port 9898 and be paired (lens shows "listening").
It plays the eval conversation through the speakers (the simulator listens on the default mic), holds the temple
(long_press), and records the lens until the agreement card has been on screen for a while. It never presses send.
Writes video/renders/lens/<ms>.png frames and video/renders/lens/frames.txt (an ffmpeg concat list with real timing).
Usage: python video/capture_lens.py
"""
import json
import subprocess
import threading
import time
import urllib.request
from pathlib import Path

SIM = "http://localhost:9898"
ROOT = Path(__file__).resolve().parent
OUT = ROOT / "renders" / "lens"
AUDIO = ROOT.parent / "evals" / "audio" / "conversation.wav"
HOLD_AFTER_LOCK_S = 11


def press(action: str) -> None:
    req = urllib.request.Request(f"{SIM}/api/input", data=json.dumps({"action": action}).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    urllib.request.urlopen(req, timeout=5).read()


def grab_loop(stop: threading.Event, frames: list[tuple[float, Path]], t0: float) -> None:
    while not stop.is_set():
        t = time.monotonic() - t0
        path = OUT / f"{int(t * 1000):06d}.png"
        try:
            path.write_bytes(urllib.request.urlopen(f"{SIM}/api/screenshot/glasses", timeout=5).read())
            frames.append((t, path))
        except OSError:
            pass
        time.sleep(0.08)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.png"):
        old.unlink()
    frames: list[tuple[float, Path]] = []
    stop = threading.Event()
    t0 = time.monotonic()
    grabber = threading.Thread(target=grab_loop, args=(stop, frames, t0), daemon=True)
    grabber.start()
    time.sleep(1.5)
    audio_at = time.monotonic() - t0
    subprocess.run(["ffplay", "-nodisp", "-autoexit", "-loglevel", "error", str(AUDIO)], check=True)
    time.sleep(0.8)
    lock_at = time.monotonic() - t0
    press("long_press")
    time.sleep(0.6)
    press("long_press_release")
    time.sleep(HOLD_AFTER_LOCK_S)
    stop.set()
    grabber.join()
    end = time.monotonic() - t0
    lines = []
    for i, (t, path) in enumerate(frames):
        nxt = frames[i + 1][0] if i + 1 < len(frames) else end
        lines.append(f"file '{path.as_posix()}'\nduration {max(nxt - t, 0.01):.3f}\n")
    lines.append(f"file '{frames[-1][1].as_posix()}'\n")
    (OUT / "frames.txt").write_text("".join(lines), encoding="utf-8")
    (OUT / "timing.json").write_text(json.dumps({"audio_at": audio_at, "lock_at": lock_at, "end": end, "frames": len(frames)}))
    print(f"{len(frames)} frames over {end:.1f}s; audio at {audio_at:.1f}s, lock at {lock_at:.1f}s")


if __name__ == "__main__":
    main()
