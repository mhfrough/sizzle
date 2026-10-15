#!/usr/bin/env python
"""Find where to start a music track so its drop lands on the reel's big moment.

  python -I music_sync.py track.mp3 --cue 2.95 --length 25

Prints the track's tempo, a per-second loudness strip, and the strongest "hits" (a beat where the music
gets clearly louder, e.g. the drop after a build). For each hit it suggests an offset = hit - cue, so the
hit lands exactly on --cue seconds into the reel, and scores the 25 s window that offset gives you:
  pre    mean loudness before the cue (a quieter build under the hook is good)
  body   mean loudness after the cue (should stay high)
  dips   seconds after the cue that sit 6+ dB under the body (breakdowns; better on scene changes)
  fits   whether the window ends before the track does
Put the chosen offset in reel.json ("music": {"offset": ...}) and re-mux.
Needs: av, numpy, scipy.
"""
import argparse

import av
import numpy as np
from scipy.ndimage import uniform_filter1d

SR = 48000


def decode(path):
    rs = av.AudioResampler(format="flt", layout="mono", rate=SR)
    out = []
    with av.open(path) as c:
        for f in c.decode(c.streams.audio[0]):
            f.pts = None
            for g in rs.resample(f):
                out.append(g.to_ndarray().reshape(-1))
        for g in rs.resample(None):
            out.append(g.to_ndarray().reshape(-1))
    return np.concatenate(out)


def frames(x, size, hop):
    return np.lib.stride_tricks.sliding_window_view(x, size)[::hop]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("track")
    ap.add_argument("--cue", type=float, default=3.0, help="reel time (s) where the hit should land")
    ap.add_argument("--length", type=float, default=25.0, help="reel length (s)")
    ap.add_argument("--top", type=int, default=6)
    a = ap.parse_args()

    x = decode(a.track)
    dur = len(x) / SR
    # 50 ms loudness and spectral flux
    hop = SR // 20
    fr = frames(x, 2048, hop)
    db = 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1e-9)
    spec = np.abs(np.fft.rfft(fr * np.hanning(2048), axis=1))
    flux = np.r_[0, np.maximum(0, np.diff(np.log1p(spec), axis=0)).sum(1)]
    f0 = flux - flux.mean()
    ac = np.correlate(f0, f0, "full")[len(f0) - 1:]
    lags = np.arange(len(ac)) * 0.05
    m = (lags > 0.3) & (lags < 1.0)
    beat = lags[m][np.argmax(ac[m])]
    print(f"track {dur:.1f}s, beat ~{beat:.2f}s (~{60 / beat:.0f} bpm, or double that)")
    per_s = [db[i * 20:i * 20 + 20].mean() for i in range(int(dur))]
    print("loudness per second (dBFS):")
    for i in range(0, len(per_s), 20):
        print(f"  {i:4d}s  " + " ".join(f"{int(v):4d}" for v in per_s[i:i + 20]))

    # candidate rises: 2 s after vs 2 s before
    sm = uniform_filter1d(db, 40)
    jump = np.zeros_like(sm)
    jump[40:-40] = sm[80:] - sm[:-80]
    picks = []
    for i in np.argsort(-jump):
        t = i * 0.05
        if jump[i] < 1.5:
            break
        if all(abs(t - p) > 4 for p in picks):
            picks.append(t)
        if len(picks) == a.top:
            break

    # refine each rise to the onset (5 ms grid) where loudness steps up the most
    fine = SR // 200
    rows = []
    for r in picks:
        s0 = max(0.0, r - 2.0)
        seg = x[int(s0 * SR):int(min(dur, r + 1.0) * SR)]
        if len(seg) < 4096:
            continue
        ff = frames(seg, 1024, fine)
        sp = np.abs(np.fft.rfft(ff * np.hanning(1024), axis=1))
        fl = np.r_[0, np.maximum(0, np.diff(np.log1p(sp), axis=0)).sum(1)]
        best, hit = -1e9, r
        for i in np.argsort(-fl)[:12]:
            t = s0 + i * fine / SR + 512 / SR
            b = x[int(max(0, t - .5) * SR):int(t * SR)]
            c = x[int(t * SR):int(min(dur, t + .5) * SR)]
            if len(b) < 100 or len(c) < 100:
                continue
            step = 20 * np.log10(np.sqrt((c ** 2).mean()) + 1e-9) - 20 * np.log10(np.sqrt((b ** 2).mean()) + 1e-9)
            score = step + 0.002 * fl[i]
            if score > best:
                best, hit = score, t
        off = hit - a.cue
        if off < 0:
            continue
        w = np.array(per_s[int(off):int(off + a.length)]) if off + a.length <= dur else np.array(per_s[int(off):])
        k = int(round(a.cue))
        pre = w[:k].mean() if k and len(w) > k else float("nan")
        body = w[k:].mean() if len(w) > k else float("nan")
        dips = [int(i) for i in np.where(w[k:] < body - 6)[0] + k]
        rows.append((hit, off, pre, body, dips, off + a.length <= dur - 0.5))

    print(f"\nhits, and the offset that lands each on the cue at {a.cue:g}s:")
    if not rows:
        print("  none found (no clear rise in loudness late enough in the track); try another track or an earlier --cue")
    for hit, off, pre, body, dips, fits in sorted(rows, key=lambda r: (not r[5], -(r[3] - r[2]))):
        print(f"  hit {hit:7.2f}s  offset {off:7.2f}  pre {pre:6.1f} dB  body {body:6.1f} dB  "
              f"dips at {dips or '-'}  fits {'yes' if fits else 'NO'}")
    print("\nPrefer: fits=yes, pre quieter than body, dips falling on your scene changes.")


if __name__ == "__main__":
    main()
