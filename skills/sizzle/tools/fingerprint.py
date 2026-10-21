#!/usr/bin/env python
"""Keep every reel different: compare a reel's direction and its rendered look with every reel made before.

  python fingerprint.py axes                     # the axes a direction is described on, with common values
  python fingerprint.py fresh [--last 10]        # per axis: what recent reels used, what is still fresh
  python fingerprint.py check promo/reel.json    # the planned direction vs history: PASS / WARN / FAIL
  python fingerprint.py look  promo/reel.json    # rendered stills vs past reels' stills (after reel.py stills)
  python fingerprint.py record promo/reel.json   # add this reel (direction + look) to the history

History lives in ~/.sizzle/history.jsonl (or $SIZZLE_HOME/history.jsonl), shared by every project, so
reels for different products stay apart too. The direction is the "direction" object in reel.json:

  "direction": {
    "concept": "chat-thread",            "aspect": "4:5",              "length": 18,
    "tone": "light",                     "palette": ["#f6f1e7", "#1b1b1b", "#ff5a36"],   # bg, ink, accents...
    "display_font": "Fraunces",          "type": "editorial-serif",
    "motion": "fluid",                   "camera": "push-pan",         "composition": "flush-left",
    "demo": "ui-fragments",              "opening": "mid-action",      "ending": "loop-back",
    "texture": "paper",                  "signature": "messages fold into paper planes",
    "music": "lofi",                     "bpm": 84,                    "sfx": "organic"
  }

Values are free words, but use the common values from `axes` where one fits, so reels compare well.
check fails when the direction is too close to any recent reel overall, or repeats a "never twice in a
row" axis (concept, display font, opening, signature, music genre) of the last three. Fix the direction,
not the threshold.
Needs: numpy, pillow (look only).
"""
import argparse
import datetime
import glob
import json
import os
import re
import sys

AXES = {
    # axis: (weight, common values)
    "concept": (3.0, "problem-solution cold-open-demo manifesto ui-pov mock-ad day-in-life data-story speedrun "
                     "before-after chat-thread quiz countdown metaphor letter kinetic-poem behind-the-scenes "
                     "user-story map-journey unboxing split-compare loop challenge recipe trailer"),
    "aspect": (0.7, "9:16 4:5 1:1 16:9"),
    "length": (0.5, "short(<12s) mid(12-20s) long(20-30s) extended(>30s)"),
    "tone": (1.5, "dark light saturated duotone monochrome gradient"),
    "palette": (2.0, "[bg, ink, accent, ...] as hex"),
    "display_font": (2.0, "the headline typeface family"),
    "type": (1.5, "giant-condensed editorial-serif mono hand grotesk rounded collage outline pixel tiny-caption"),
    "motion": (1.5, "snappy fluid stepped elastic cinematic glitch handmade physics typewriter"),
    "camera": (1.0, "static push-pan one-take hard-cuts split-screen scroll 3d-orbit zoom-through"),
    "composition": (1.0, "centered flush-left grid full-bleed collage asymmetric frame-in-frame letterbox"),
    "demo": (1.5, "device-frame full-bleed-ui exploded-ui cursor-desktop ui-fragments abstract no-ui"),
    "opening": (2.0, "question-text cold-open-ui black-sound big-number object quote mid-action logo-first"),
    "ending": (1.0, "url-type logo-sting button-press loop-back question end-card stamp"),
    "texture": (1.0, "none grain halftone paper scanlines glass noise-gradient grid dots"),
    "signature": (1.0, "one sentence: the move people remember"),
    "music": (1.5, "genre: house lofi synthwave techno ambient chiptune trap pluckpop cinematic indie acoustic "
                   "orchestral jazz funk rock hiphop none"),
    "sfx": (1.0, "palette: digital organic cinematic retro soft glitch none"),
}
NEVER_TWICE = ["concept", "display_font", "opening", "signature", "music"]   # vs the last 3 reels
FAIL_AT, WARN_AT = 0.5, 0.36
LOOK_FAIL, LOOK_WARN = 0.86, 0.79


def home():
    return os.environ.get("SIZZLE_HOME") or os.path.join(os.path.expanduser("~"), ".sizzle")


def read_history():
    p = os.path.join(home(), "history.jsonl")
    out = []
    if os.path.isfile(p):
        with open(p, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        out.append(json.loads(line))
                    except ValueError:
                        pass
    return out


def load_cfg(path):
    with open(path, encoding="utf-8") as f:
        c = json.load(f)
    c["_base"] = os.path.dirname(os.path.abspath(path))
    return c


def norm(v):
    return re.sub(r"[^a-z0-9:]+", "-", str(v).lower()).strip("-")


def bucket(sec):
    sec = float(sec)
    return "short" if sec < 12 else "mid" if sec < 20 else "long" if sec <= 30 else "extended"


def hex_lab(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    x = (0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2]) / 0.95047
    y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
    z = (0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2]) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    return (116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z)))


def de(a, b):
    return sum((p - q) ** 2 for p, q in zip(hex_lab(a), hex_lab(b))) ** 0.5


def words(s):
    stop = {"the", "a", "an", "and", "of", "into", "in", "on", "to", "with", "its", "it", "as", "at", "for", "from"}
    return {w for w in re.findall(r"[a-z]+", str(s).lower()) if w not in stop and len(w) > 2}


def same(axis, a, b):
    """Does value a match value b on this axis? Returns a 0..1 score."""
    if a in (None, "", [], 0) or b in (None, "", [], 0):
        return None
    if axis == "length":
        return 1.0 if bucket(a) == bucket(b) else 0.0
    if axis == "palette":
        try:
            bg = de(a[0], b[0]) < 12
            acc_a, acc_b = a[2:] or a[1:2], b[2:] or b[1:2]
            acc = min(de(x, y) for x in acc_a for y in acc_b) < 18
        except (ValueError, IndexError, TypeError):
            return None
        return 1.0 if (bg and acc) else 0.5 if (bg or acc) else 0.0
    if axis == "signature":
        wa, wb = words(a), words(b)
        if not wa or not wb:
            return None
        j = len(wa & wb) / len(wa | wb)
        return 1.0 if j >= 0.5 else 0.5 if j >= 0.25 else 0.0
    return 1.0 if norm(a) == norm(b) else 0.0


def compare(d, past):
    total = hit = 0.0
    matches = []
    for axis, (w, _) in AXES.items():
        s = same(axis, d.get(axis), past.get(axis))
        if s is None:
            continue
        total += w
        hit += w * s
        if s >= 0.5:
            matches.append(axis if s == 1 else axis + "(partly)")
    return (hit / total if total else 0.0), matches


# Reels made with the old block recipes (v2) have a recipe, not a direction: translate it so they count.
LEGACY_STYLE = {  # style: (tone, type, motion, texture)
    "midnight-electric": ("dark", "grotesk", "snappy", "dots"), "paper-ink": ("light", "hand", "handmade", "paper"),
    "swiss-grid": ("light", "grotesk", "snappy", "grid"), "brutalist": ("saturated", "giant-condensed", "snappy", "none"),
    "editorial-serif": ("light", "editorial-serif", "fluid", "none"), "terminal-mono": ("dark", "mono", "typewriter", "scanlines"),
    "pastel-soft": ("light", "rounded", "elastic", "none"), "riso-print": ("duotone", "grotesk", "stepped", "halftone"),
    "glass-gradient": ("gradient", "grotesk", "fluid", "glass"), "colorblock-pop": ("saturated", "giant-condensed", "snappy", "none"),
    "noir-film": ("monochrome", "editorial-serif", "cinematic", "grain"), "arcade-crt": ("dark", "pixel", "stepped", "scanlines"),
}
LEGACY_CONCEPT = {"problem-solution": "problem-solution", "three-reasons": "countdown", "before-after": "before-after",
                  "one-take": "ui-pov", "manifesto": "manifesto", "speedrun": "speedrun", "q-and-a": "quiz",
                  "mini-story": "day-in-life"}
LEGACY_TEXTURE = {"dots-glow": "dots", "grid-lines": "grid", "film-grain": "grain", "gradient-mesh": "noise-gradient",
                  "halftone": "halftone", "scanlines": "scanlines", "paper-grain": "paper", "starfield": "dots"}
LEGACY_DEMO = {"app-fullbleed": "full-bleed-ui", "exploded-cards": "exploded-ui"}
LEGACY_END = {"url-pill": "url-type", "search-type": "url-type", "terminal-cmd": "url-type", "button-press": "button-press",
              "stamp-badge": "stamp", "sticker-pile": "stamp", "end-card": "end-card", "big-type": "end-card"}


def legacy_direction(r):
    tone, typ, motion, texture = LEGACY_STYLE.get(r.get("style"), ("", "", "", ""))
    return {"concept": LEGACY_CONCEPT.get(r.get("structure"), r.get("structure", "")), "aspect": "9:16", "length": 24,
            "tone": tone, "type": typ, "motion": motion, "texture": LEGACY_TEXTURE.get(r.get("background"), texture),
            "camera": "one-take" if r.get("structure") == "one-take" else "hard-cuts",
            "composition": {"left-editorial": "flush-left", "center-stack": "centered", "giant-behind": "centered",
                            "bottom-caption": "centered", "top-tight": "centered"}.get(r.get("layout"), ""),
            "demo": LEGACY_DEMO.get(r.get("frame"), "device-frame"), "opening": "question-text",
            "ending": LEGACY_END.get(r.get("cta"), ""), "signature": "%s reveal" % r.get("transition", ""),
            "_legacy": True}


def directions(hist):
    out = []
    for h in hist:
        if h.get("direction"):
            out.append(h)
        elif h.get("recipe"):
            out.append(dict(h, direction=legacy_direction(h["recipe"])))
    return out


def label(h):
    return "%s (%s)" % (h.get("name", "?"), str(h.get("time", ""))[:10])


# --------------------------------------------------------------------------- commands
def cmd_axes(_):
    for axis, (w, vals) in AXES.items():
        flag = "  never twice in a row" if axis in NEVER_TWICE else ""
        print("%-13s w=%.1f  %s%s" % (axis, w, vals, flag))


def cmd_fresh(a):
    past = directions(read_history())[-a.last:]
    if not past:
        print("no reels with a direction in the history yet: everything is fresh")
        return
    print("last %d reels, newest last: %s\n" % (len(past), ", ".join(label(h) for h in past)))
    for axis, (w, vals) in AXES.items():
        used = [h["direction"].get(axis) for h in past if h["direction"].get(axis) not in (None, "")]
        if axis == "length":
            used = [bucket(u) for u in used]
        if axis in ("palette", "signature", "display_font"):
            shown = ["/".join(u) if isinstance(u, list) else str(u) for u in used[-3:]]
            print("%-13s recent: %s" % (axis, "; ".join(shown) or "-"))
            continue
        un = {norm(u) for u in used}
        common = [v for v in vals.split() if not v.startswith("[")]
        common = [re.sub(r"\(.*\)", "", v) for v in common if ":" not in v or axis == "aspect"]
        fresh = [v for v in common if norm(v) not in un]
        print("%-13s recent: %-40s fresh: %s" % (axis, ", ".join(str(u) for u in used[-4:]) or "-", ", ".join(fresh) or "-"))


def cmd_check(a):
    c = load_cfg(a.config)
    d = c.get("direction")
    if not d:
        sys.exit("reel.json has no \"direction\" object (see SKILL.md, step 4)")
    missing = [k for k in AXES if d.get(k) in (None, "", [], 0)]
    hist = [h for h in directions(read_history()) if h.get("name") != c.get("name")]
    verdict, notes = "PASS", []
    if missing:
        notes.append("WARN  direction is missing: %s (missing axes can't be compared)" % ", ".join(missing))
        verdict = "WARN"
    for h in hist[-3:]:
        for axis in NEVER_TWICE:
            s = same(axis, d.get(axis), h["direction"].get(axis))
            if s is not None and s >= (1.0 if axis != "signature" else 0.5):
                notes.append("FAIL  %s repeats %s's %s: %r" % (axis, label(h), axis, h["direction"].get(axis)))
                verdict = "FAIL"
    worst = None
    for h in hist[-a.last:]:
        sim, matches = compare(d, h["direction"])
        if worst is None or sim > worst[0]:
            worst = (sim, h, matches)
        if sim >= FAIL_AT:
            notes.append("FAIL  %.0f%% like %s, same: %s" % (sim * 100, label(h), ", ".join(matches)))
            verdict = "FAIL"
        elif sim >= WARN_AT:
            notes.append("WARN  %.0f%% like %s, same: %s" % (sim * 100, label(h), ", ".join(matches)))
            if verdict == "PASS":
                verdict = "WARN"
    for n in notes:
        print(n)
    if worst:
        print("closest: %.0f%% %s (fail at %.0f%%, warn at %.0f%%)" % (worst[0] * 100, label(worst[1]), FAIL_AT * 100, WARN_AT * 100))
    else:
        print("no earlier reels with a direction to compare with")
    print(verdict)
    sys.exit(1 if verdict == "FAIL" else 0)


def stills_dir(c):
    work = c.get("work", ".reel-work")
    root = os.path.normpath(os.path.join(c["_base"], c.get("root", ".")))
    work = work if os.path.isabs(work) else os.path.join(root, work)
    return os.path.join(work, c["name"], "stills")


def features(path):
    import numpy as np
    from PIL import Image
    im = Image.open(path).convert("RGB")
    g = np.asarray(im.convert("L").resize((17, 16), Image.BILINEAR), dtype=float)
    bits = (g[:, 1:] > g[:, :-1]).flatten()
    dh = "".join("1" if b else "0" for b in bits)
    hsv = np.asarray(im.resize((96, 160)).convert("HSV"), dtype=float)
    h = (hsv[..., 0] / 256 * 12).astype(int)
    s = (hsv[..., 1] / 256 * 3).astype(int)
    v = (hsv[..., 2] / 256 * 4).astype(int)
    idx = np.where(s == 0, 144 + v, (h * 3 + s) * 4 + v)   # greys get their own bins
    hist = np.bincount(idx.flatten(), minlength=148).astype(float)
    hist /= hist.sum()
    return {"dhash": "%064x" % int(dh, 2), "hist": [round(x, 4) for x in hist.tolist()]}


def look_sim(f1, f2):
    import numpy as np
    ham = bin(int(f1["dhash"], 16) ^ int(f2["dhash"], 16)).count("1")
    hist = float(np.minimum(np.array(f1["hist"]), np.array(f2["hist"])).sum())
    return 0.4 * (1 - ham / 256) + 0.6 * hist


def reel_look(c):
    d = stills_dir(c)
    files = sorted(f for f in glob.glob(os.path.join(d, "t*.png")))
    if not files:
        return None
    return [features(f) for f in files]


def cmd_look(a):
    c = load_cfg(a.config)
    mine = reel_look(c)
    if not mine:
        sys.exit("no stills in %s: run reel.py stills first" % stills_dir(c))
    hist = [h for h in read_history() if h.get("look") and h.get("name") != c.get("name")]
    if not hist:
        print("no earlier reels with a stored look: nothing to compare (PASS)")
        return
    verdict = "PASS"
    rows = []
    for h in hist[-a.last:]:
        theirs = h["look"]
        sim = sum(max(look_sim(m, t) for t in theirs) for m in mine) / len(mine)
        rows.append((sim, h))
    rows.sort(key=lambda r: -r[0])
    for sim, h in rows[:5]:
        tag = "FAIL" if sim >= LOOK_FAIL else "WARN" if sim >= LOOK_WARN else "ok  "
        print("%s  %.0f%% like %s" % (tag, sim * 100, label(h)))
        if tag == "FAIL":
            verdict = "FAIL"
        elif tag == "WARN" and verdict == "PASS":
            verdict = "WARN"
    print("(per still: best match in that reel; layout hash 40%%, colour histogram 60%%; fail at %.0f%%)" % (LOOK_FAIL * 100))
    print(verdict)
    sys.exit(1 if verdict == "FAIL" else 0)


def cmd_record(a):
    c = load_cfg(a.config)
    d = c.get("direction") or (legacy_direction(c["recipe"]) if c.get("recipe") else None)
    if not d:
        sys.exit("reel.json has no \"direction\" object")
    entry = {"v": 3, "time": datetime.datetime.now().isoformat(timespec="seconds"), "name": c.get("name"),
             "page": os.path.normpath(os.path.join(c["_base"], c.get("root", "."), c.get("page", ""))),
             "direction": d}
    look = reel_look(c)
    if look:
        entry["look"] = look
    os.makedirs(home(), exist_ok=True)
    hist = read_history()
    same_reel = lambda h: os.path.normcase(os.path.normpath(
        h.get("page") or h.get("out") or "")) == os.path.normcase(entry["page"])
    kept = [h for h in hist if not same_reel(h)]
    with open(os.path.join(home(), "history.jsonl"), "w", encoding="utf-8") as f:
        for h in kept + [entry]:
            f.write(json.dumps(h) + "\n")
    print("recorded %s (%s stills) in %s" % (entry["name"], len(look) if look else "no", os.path.join(home(), "history.jsonl")))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("axes")
    p = sub.add_parser("fresh")
    p.add_argument("--last", type=int, default=10)
    for name in ("check", "look"):
        p = sub.add_parser(name)
        p.add_argument("config")
        p.add_argument("--last", type=int, default=12)
    p = sub.add_parser("record")
    p.add_argument("config")
    a = ap.parse_args()
    {"axes": cmd_axes, "fresh": cmd_fresh, "check": cmd_check, "look": cmd_look, "record": cmd_record}[a.cmd](a)


if __name__ == "__main__":
    main()
