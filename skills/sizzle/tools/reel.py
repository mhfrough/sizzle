#!/usr/bin/env python
"""One command for a reel: stills to check, 4K frames, mux with music, poster.

  python reel.py stills  reel.json 1.5,4,8,12.3   # 1080x1920 PNGs + contact sheet (<work>/<name>/stills/sheet.jpg)
  python reel.py frames  reel.json                # every frame as JPEG (2160x3840 at scale 2)
  python reel.py mux     reel.json                # frames + music (+ optional voiceover) -> MP4 + WebP poster
  python reel.py all     reel.json                # frames then mux
  python reel.py poster  reel.json                # only the WebP poster, from the frame at poster_t

reel.json (paths are relative to the JSON file unless absolute):
  {
    "name": "your-app-reel",
    "root": "..",                        # folder served over HTTP (the page's ../ links must resolve inside it)
    "page": "promo/your-app-reel.html",  # page path inside root
    "port": 8123,
    "fps": 30, "scale": 2, "crf": 16,
    "work": "promo/.reel-work",          # frames and stills go in <work>/<name>/ (gitignore it)
    "out": "videos/your-app-reel.mp4",
    "poster_t": 12,
    "music": {"file": "promo/your-app-bgm.mp3", "offset": 54.07, "gain_db": -14, "fade_out": 1.2},
    "voiceover": {"file": null, "offset": 0.0, "mute": "", "duck_db": -9}
  }

It starts `python -m http.server <port>` in root unless something already answers on that port, then runs
render.js (Playwright, fake clock) and mux.py (PyAV: H.264 High, AAC 192k, -14 LUFS, -1 dBTP).
Needs: node + playwright (npm i -D playwright && npx playwright install chromium),
python: av, numpy, scipy, opencv-python, pillow.
"""
import argparse
import json
import os
import socket
import subprocess
import sys
import time

TOOLS = os.path.dirname(os.path.abspath(__file__))


def load(cfg_path):
    with open(cfg_path, encoding="utf-8") as f:
        c = json.load(f)
    base = os.path.dirname(os.path.abspath(cfg_path))
    rel = lambda p: p if (p is None or os.path.isabs(p)) else os.path.normpath(os.path.join(base, p))
    c["root"] = rel(c.get("root", "."))
    inroot = lambda p: p if (p is None or os.path.isabs(p)) else os.path.normpath(os.path.join(c["root"], p))
    c["page_url"] = "http://localhost:%d/%s" % (c.get("port", 8123), c["page"].replace("\\", "/").lstrip("/"))
    c["out"] = inroot(c.get("out", "videos/%s.mp4" % c["name"]))
    c["work"] = os.path.join(inroot(c.get("work", ".reel-work")), c["name"])
    c.setdefault("fps", 30)
    c.setdefault("scale", 2)
    c.setdefault("crf", 16)
    c.setdefault("poster_t", 3)
    m = c.get("music") or {}
    if m.get("file"):
        m["file"] = inroot(m["file"])
    c["music"] = m
    v = c.get("voiceover") or {}
    if v.get("file"):
        v["file"] = inroot(v["file"])
    c["voiceover"] = v
    return c


def port_open(port):
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


class Server:
    def __init__(self, c):
        self.c = c

    def __enter__(self):
        self.proc = None
        port = self.c.get("port", 8123)
        if not port_open(port):
            self.proc = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
                                         cwd=self.c["root"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            for _ in range(50):
                if port_open(port):
                    break
                time.sleep(0.1)
        return self

    def __exit__(self, *a):
        if self.proc:
            self.proc.terminate()
            self.proc.wait()


def run(cmd, **kw):
    print("$", " ".join(str(x) for x in cmd), flush=True)
    subprocess.run([str(x) for x in cmd], check=True, **kw)


def render(c, mode, out_dir, arg):
    cmd = ["node", os.path.join(TOOLS, "render.js"), mode, c["page_url"], out_dir, arg]
    if mode == "frames":
        cmd.append(str(c["scale"]))
    with Server(c):
        run(cmd, cwd=c["root"])


def sheet(out_dir, times):
    from PIL import Image
    # render.js names stills t<sec>.png with JS toFixed(2); match by value, not by Python's own formatting
    found = {}
    for f in os.listdir(out_dir) if os.path.isdir(out_dir) else []:
        if f.startswith("t") and f.endswith(".png"):
            try:
                found[float(f[1:-4])] = os.path.join(out_dir, f)
            except ValueError:
                pass
    files = []
    for t in sorted(set(times)):
        near = [v for v in found if abs(v - t) < 0.006]
        if near:
            files.append(found[min(near, key=lambda v: abs(v - t))])
    if not files:
        return
    w, h, gap, per_row = 432, 768, 10, 5
    rows = (len(files) + per_row - 1) // per_row
    cols = min(per_row, len(files))
    im = Image.new("RGB", (cols * (w + gap) + gap, rows * (h + gap) + gap), "#2e2e2a")
    for i, f in enumerate(files):
        im.paste(Image.open(f).convert("RGB").resize((w, h)), (gap + (i % per_row) * (w + gap), gap + (i // per_row) * (h + gap)))
    dst = os.path.join(out_dir, "sheet.jpg")
    im.save(dst, quality=90)
    print("contact sheet", dst)


def mux(c, frames):
    os.makedirs(os.path.dirname(c["out"]), exist_ok=True)
    cmd = [sys.executable, os.path.join(TOOLS, "mux.py"), "--frames", frames, "--fps", str(c["fps"]),
           "--out", c["out"], "--crf", str(c["crf"])]
    m, v = c["music"], c["voiceover"]
    if m.get("file"):
        cmd += ["--bgm", m["file"], "--bgm-offset", str(m.get("offset", 0)), "--bgm-gain-db", str(m.get("gain_db", -14)),
                "--fade-out", str(m.get("fade_out", 1.2))]
    if v.get("file"):
        cmd += ["--vo", v["file"], "--vo-offset", str(v.get("offset", 0)), "--duck-db", str(v.get("duck_db", -9))]
        if v.get("mute"):
            cmd += ["--vo-mute", v["mute"]]
    run(cmd)
    poster(c, frames)


def poster(c, frames):
    from PIL import Image
    src = os.path.join(frames, "%05d.jpg" % round(c["poster_t"] * c["fps"]))
    dst = os.path.splitext(c["out"])[0] + ".webp"
    Image.open(src).convert("RGB").resize((720, 1280), Image.LANCZOS).save(dst, "WEBP", quality=80, method=6)
    print("poster", dst, "from", os.path.basename(src))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["stills", "frames", "mux", "all", "poster"])
    ap.add_argument("config", help="reel.json")
    ap.add_argument("times", nargs="?", default="1,3,6,10,15,20", help="stills: comma-separated seconds")
    a = ap.parse_args()
    c = load(a.config)
    frames = os.path.join(c["work"], "frames")
    if a.cmd == "stills":
        out = os.path.join(c["work"], "stills")
        render(c, "stills", out, a.times)
        sheet(out, [float(t) for t in a.times.split(",")])
        return
    if a.cmd in ("frames", "all"):
        if os.path.isdir(frames):
            for f in os.listdir(frames):
                if f.endswith(".jpg"):
                    os.remove(os.path.join(frames, f))
        render(c, "frames", frames, str(c["fps"]))
    if a.cmd in ("mux", "all"):
        mux(c, frames)
    if a.cmd == "poster":
        poster(c, frames)


if __name__ == "__main__":
    main()
