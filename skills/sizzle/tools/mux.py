#!/usr/bin/env python
"""Mux a JPEG frame sequence + voiceover + background music + sound effects into a reel MP4.

Everything runs through PyAV (no ffmpeg CLI needed):
  * video: libx264 (High profile, yuv420p, BT.709 tags, CRF, preset slow), +faststart
  * audio: 48 kHz stereo AAC @ 192 kb/s

Audio pipeline
  VO   -> resampled to 48 kHz, mono duplicated to L/R, placed at --vo-offset seconds.
  BGM  -> resampled to 48 kHz stereo, head trimmed by --bgm-offset, looped (equal-power
          crossfade) if shorter than the video, trimmed to the video, 0.4 s fade-in and
          --fade-out s fade-out, base gain --bgm-gain-db, sidechain-ducked by --duck-db
          whenever the VO envelope (50 ms RMS, 80 ms attack / 350 ms release) is over a
          speech threshold.
  SFX  -> a JSON list of events [{"file", "t", "gain_db"=-6, "pan"=0, "from"=0, "len"=null, "fade"=0.01}]:
          each file is placed at t seconds (negative t trims its head), panned equal-power (-1 left .. 1 right),
          optionally cut to [from, from+len] with a short fade-out. The music dips by --sfx-duck-db under
          the SFX bus (same envelope follower as the VO duck), so hits read without a loud mix.
  Mix  -> normalised to ~-14 LUFS integrated (ITU-R BS.1770-4 K-weighting with the
          -70 LUFS absolute / -10 LU relative gates) with a look-ahead true-peak limiter
          (4x oversampled peak detection) keeping the result <= -1 dBTP.

Usage
  python -I mux.py --frames DIR --fps 30 --out out.mp4 [--vo vo.mp3] [--vo-offset 0.0] [--vo-mute 6.2-7.4,21.6-]
                   [--bgm bgm.mp3] [--bgm-offset 0.0] [--bgm-gain-db -16] [--duck-db -9]
                   [--fade-out 1.5] [--sfx events.json] [--sfx-duck-db -4] [--crf 16]
"""
import argparse
import glob
import os
import sys
import time
from fractions import Fraction

import av
import cv2
import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 48000
TARGET_LUFS = -14.0
CEILING_DBTP = -1.0
LIMITER_CEILING_DBTP = -1.5   # internal margin: AAC encoding can add a few tenths of a dB


# --------------------------------------------------------------------------- audio io
def decode_audio(path, stereo):
    """Decode any audio file to float32 (n, ch) at 48 kHz. ch = 2 if stereo else 1."""
    layout = "stereo" if stereo else "mono"
    rs = av.AudioResampler(format="flt", layout=layout, rate=SR)
    chunks = []
    with av.open(path) as c:
        stream = c.streams.audio[0]
        for frame in c.decode(stream):
            frame.pts = None  # let the resampler ignore odd timestamps (e.g. mp3 gaps)
            for f in rs.resample(frame):
                chunks.append(f.to_ndarray().reshape(-1))
        for f in rs.resample(None):
            chunks.append(f.to_ndarray().reshape(-1))
    if not chunks:
        return np.zeros((0, 2 if stereo else 1), np.float32)
    data = np.concatenate(chunks).astype(np.float32)
    ch = 2 if stereo else 1
    return data.reshape(-1, ch)


def source_channels(path):
    with av.open(path) as c:
        return c.streams.audio[0].codec_context.channels


# --------------------------------------------------------------------------- dsp helpers
def db2lin(db):
    return 10.0 ** (db / 20.0)


def lin2db(x):
    return 20.0 * np.log10(max(float(x), 1e-12))


def k_weight(x):
    """ITU-R BS.1770 K-weighting filter (48 kHz coefficients) applied per channel."""
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    y = signal.lfilter(b1, a1, x, axis=0)
    return signal.lfilter(b2, a2, y, axis=0)


def integrated_lufs(x):
    """BS.1770-4 gated integrated loudness of a (n, ch) float array at 48 kHz."""
    if x.shape[0] < int(0.4 * SR):
        return -np.inf
    y = k_weight(x.astype(np.float64))
    block, hop = int(0.4 * SR), int(0.1 * SR)
    p = np.sum(y * y, axis=1)                       # channel weights are 1.0 for L/R
    cs = np.concatenate([[0.0], np.cumsum(p)])
    starts = np.arange(0, len(p) - block + 1, hop)
    z = (cs[starts + block] - cs[starts]) / block   # mean square per 400 ms block
    with np.errstate(divide="ignore"):
        lk = -0.691 + 10 * np.log10(z)
    z = z[lk > -70.0]
    if z.size == 0:
        return -np.inf
    rel = -0.691 + 10 * np.log10(z.mean()) - 10.0
    lk = -0.691 + 10 * np.log10(z)
    z = z[lk > rel]
    if z.size == 0:
        return -np.inf
    return -0.691 + 10 * np.log10(z.mean())


def true_peak_env(x, os_factor=4):
    """Per-sample true-peak estimate (max over channels of 4x oversampled |x|)."""
    up = signal.resample_poly(x, os_factor, 1, axis=0)
    a = np.abs(up).max(axis=1)
    n = x.shape[0]
    a = a[: n * os_factor]
    if a.size < n * os_factor:
        a = np.pad(a, (0, n * os_factor - a.size))
    return a.reshape(n, os_factor).max(axis=1)


def true_peak_db(x):
    if x.size == 0:
        return -np.inf
    return lin2db(true_peak_env(x).max())


def follower(x, attack_s, release_s, rate):
    """One-pole attack/release envelope follower on a control-rate signal."""
    a_at = np.exp(-1.0 / (attack_s * rate))
    a_re = np.exp(-1.0 / (release_s * rate))
    out = np.empty_like(x)
    s = 0.0
    for i, v in enumerate(x):
        c = a_at if v > s else a_re
        s = c * s + (1.0 - c) * v
        out[i] = s
    return out


def limiter(x, ceiling_db, window_s=0.02):
    """Look-ahead brickwall limiter on true-peak estimate.

    gain_req = min(1, ceiling/peak); a centred min-filter of width 2W followed by a box
    filter of width W gives a smooth gain that is guaranteed <= gain_req everywhere
    (attack/release ~W, look-ahead W).
    """
    ceil = db2lin(ceiling_db)
    pk = true_peak_env(x)
    req = np.minimum(1.0, ceil / np.maximum(pk, 1e-12))
    if req.min() >= 1.0:
        return x
    w = max(3, int(window_s * SR))
    g = minimum_filter1d(req, size=2 * w + 1, mode="nearest")
    g = uniform_filter1d(g, size=w | 1, mode="nearest")
    return x * g[:, None]


# --------------------------------------------------------------------------- audio build
def parse_mutes(spec):
    """'6.2-7.4,21.6-' -> [(6.2, 7.4), (21.6, inf)] (seconds in the VO file's own time)."""
    out = []
    for part in filter(None, (spec or "").replace(" ", "").split(",")):
        a, _, b = part.partition("-")
        out.append((float(a), float(b) if b else np.inf))
    return out


def mute_ranges(vo, mutes, fade_s):
    """Silence [a, b) of the VO with fade_s linear fades just outside each range."""
    if not mutes:
        return vo
    vo = vo.copy()
    g = np.ones(len(vo), np.float32)
    f = max(1, int(fade_s * SR))
    for a, b in mutes:
        i0 = max(0, int(round(a * SR)))
        i1 = len(vo) if not np.isfinite(b) else min(len(vo), int(round(b * SR)))
        g[i0:i1] = 0.0
        lo = max(0, i0 - f)                       # fade out before the cut
        g[lo:i0] = np.minimum(g[lo:i0], np.linspace(1.0, 0.0, i0 - lo, dtype=np.float32))
        hi = min(len(vo), i1 + f)                 # fade back in after it
        g[i1:hi] = np.minimum(g[i1:hi], np.linspace(0.0, 1.0, hi - i1, dtype=np.float32))
    return vo * g[:, None]


def build_vo(path, offset_s, n, mutes=None, mute_fade=0.012):
    out = np.zeros((n, 2), np.float32)
    if not path:
        return out
    stereo = source_channels(path) >= 2
    vo = mute_ranges(decode_audio(path, stereo), mutes, mute_fade)
    if not stereo:
        vo = np.repeat(vo, 2, axis=1)               # mono VO -> both channels
    start = int(round(offset_s * SR))
    if start < 0:                                    # negative offset trims the VO head
        vo, start = vo[-start:], 0
    if start >= n:
        return out
    m = min(len(vo), n - start)
    out[start:start + m] = vo[:m]
    return out


def build_bgm(path, offset_s, n, fade_in_s, fade_out_s, xfade_s=0.5):
    out = np.zeros((n, 2), np.float32)
    if not path:
        return out, False
    seg = decode_audio(path, stereo=True)[int(round(offset_s * SR)):]
    if len(seg) == 0:
        return out, False
    looped = False
    if len(seg) >= n:
        out[:] = seg[:n]
    else:
        looped = True
        xf = int(min(xfade_s, len(seg) / SR / 4) * SR)
        t = np.linspace(0.0, np.pi / 2, xf, dtype=np.float32)[:, None] if xf else None
        fade_o, fade_i = (np.cos(t), np.sin(t)) if xf else (None, None)  # equal-power
        pos = len(seg)
        out[:pos] = seg
        while pos < n:
            # overlap the next copy's head with the last xf samples already written
            start = pos - xf
            if xf:
                out[start:pos] = out[start:pos] * fade_o + seg[:xf] * fade_i
            body = seg[xf:]
            m = min(len(body), n - pos)
            out[pos:pos + m] = body[:m]
            pos += m
    # fades
    fi = min(int(fade_in_s * SR), n)
    if fi > 0:
        out[:fi] *= np.linspace(0.0, 1.0, fi, dtype=np.float32)[:, None]
    fo = min(int(fade_out_s * SR), n)
    if fo > 0:
        out[n - fo:] *= np.linspace(1.0, 0.0, fo, dtype=np.float32)[:, None]
    return out, looped


def build_sfx(events, n):
    """Place every SFX event on a stereo bus. Returns (bus, placed_count)."""
    bus = np.zeros((n, 2), np.float32)
    cache, placed = {}, 0
    for ev in events:
        path = ev["file"]
        if path not in cache:
            cache[path] = decode_audio(path, stereo=True)
        x = cache[path]
        a = int(round(float(ev.get("from", 0)) * SR))
        x = x[a:]
        if ev.get("len"):
            x = x[:int(round(float(ev["len"]) * SR))].copy()
            f = min(int(float(ev.get("fade", 0.01)) * SR), len(x))
            if f > 0:
                x[-f:] *= np.linspace(1.0, 0.0, f, dtype=np.float32)[:, None]
        x = x * db2lin(float(ev.get("gain_db", -6)))
        pan = max(-1.0, min(1.0, float(ev.get("pan", 0))))
        th = (pan + 1) * np.pi / 4                   # equal-power pan
        x = x * np.array([np.cos(th), np.sin(th)], np.float32) * np.sqrt(2)
        start = int(round(float(ev["t"]) * SR))
        if start < 0:
            x, start = x[-start:], 0
        if start >= n or len(x) == 0:
            continue
        m = min(len(x), n - start)
        bus[start:start + m] += x[:m]
        placed += 1
    return bus, placed


def duck_gain(vo, duck_db, n):
    """Per-sample linear gain for the BGM driven by the VO envelope."""
    if duck_db == 0 or not np.any(vo):
        return np.ones(n, np.float32), 0.0
    hop = SR // 1000                                 # 1 kHz control rate
    mono = vo.mean(axis=1).astype(np.float64)
    ms = uniform_filter1d(mono * mono, size=int(0.05 * SR), mode="constant")  # 50 ms RMS
    ms_c = ms[::hop]
    rms_db = 10 * np.log10(np.maximum(ms_c, 1e-12))
    rate = SR / hop
    env_db = 10 * np.log10(np.maximum(follower(ms_c, 0.08, 0.35, rate), 1e-12))
    # speech threshold: relative to the loud part of the VO, never below -50 dBFS
    voiced = rms_db[rms_db > -70]
    ref = np.percentile(voiced, 95) if voiced.size else -20.0
    thr = max(ref - 24.0, -50.0)
    knee = 6.0                                        # soft knee: full duck 6 dB over thr
    amt = np.clip((env_db - thr) / knee, 0.0, 1.0)
    amt = follower(amt, 0.08, 0.35, rate)             # smooth the gain change itself
    g_db = -abs(duck_db) * amt
    g = db2lin(g_db)
    t_c = np.arange(len(g)) * hop
    gain = np.interp(np.arange(n), t_c, g).astype(np.float32)
    return gain, float((amt > 0.5).mean())


def normalize(mix):
    """Hit ~-14 LUFS with a true-peak limiter at the ceiling. Returns (mix, lufs, tp, gain_db)."""
    l0 = integrated_lufs(mix)
    if not np.isfinite(l0):
        return mix, l0, true_peak_db(mix), 0.0
    total = 0.0
    y = mix
    for _ in range(4):
        l = integrated_lufs(y)
        g = TARGET_LUFS - l
        if abs(g) < 0.1 and true_peak_db(y) <= CEILING_DBTP:
            break
        total += g
        y = limiter(mix * db2lin(total), LIMITER_CEILING_DBTP)
    # final safety: plain gain if anything still pokes over the ceiling
    tp = true_peak_db(y)
    if tp > LIMITER_CEILING_DBTP:
        y = y * db2lin(LIMITER_CEILING_DBTP - tp)
    y = y.astype(np.float32)
    return y, integrated_lufs(y), true_peak_db(y), total


# --------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--frames", required=True, help="directory of 00000.jpg, 00001.jpg, ...")
    ap.add_argument("--fps", default="30", help="frame rate (e.g. 30, 29.97, 30000/1001)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--vo")
    ap.add_argument("--vo-offset", type=float, default=0.0, help="VO start time in the video (s)")
    ap.add_argument("--vo-mute", default="", help="silence VO ranges, VO-file seconds: '6.2-7.4,21.6-' (open end = to the end)")
    ap.add_argument("--mute-fade", type=float, default=0.012, help="fade length around each muted range (s)")
    ap.add_argument("--bgm")
    ap.add_argument("--bgm-offset", type=float, default=0.0, help="seconds trimmed from the BGM head")
    ap.add_argument("--bgm-gain-db", type=float, default=-16.0)
    ap.add_argument("--duck-db", type=float, default=-9.0)
    ap.add_argument("--fade-out", type=float, default=1.5)
    ap.add_argument("--sfx", help="JSON file: list of {file, t, gain_db, pan, from, len, fade}")
    ap.add_argument("--sfx-duck-db", type=float, default=-4.0, help="music dip under the SFX bus (0 = off)")
    ap.add_argument("--crf", type=float, default=16)
    args = ap.parse_args()

    t0 = time.time()
    files = sorted(glob.glob(os.path.join(args.frames, "*.jpg")) + glob.glob(os.path.join(args.frames, "*.jpeg")))
    if not files:
        sys.exit(f"no .jpg frames in {args.frames}")
    fps = Fraction(args.fps).limit_denominator(1001)
    nframes = len(files)
    first = cv2.imread(files[0], cv2.IMREAD_COLOR)
    if first is None:
        sys.exit(f"cannot read {files[0]}")
    h, w = first.shape[:2]
    del first
    if w % 2 or h % 2:
        sys.exit(f"frame size {w}x{h} must be even for yuv420p")
    duration = float(nframes / fps)
    n = int(round(duration * SR))

    # ---------------- audio (fully rendered in memory: ~30 s stereo float is tiny)
    vo = build_vo(args.vo, args.vo_offset, n, parse_mutes(args.vo_mute), args.mute_fade)
    bgm, looped = build_bgm(args.bgm, args.bgm_offset, n, 0.4, args.fade_out)
    bgm *= db2lin(args.bgm_gain_db)
    sfx, nsfx = np.zeros((n, 2), np.float32), 0
    if args.sfx:
        import json
        with open(args.sfx, encoding="utf-8") as f:
            sfx, nsfx = build_sfx(json.load(f), n)
    gain, duck_frac = duck_gain(vo, args.duck_db, n) if args.bgm else (np.ones(n, np.float32), 0.0)
    if args.bgm and nsfx:
        gain = gain * duck_gain(sfx, args.sfx_duck_db, n)[0]
    mix = vo + bgm * gain[:, None] + sfx
    pre_lufs = integrated_lufs(mix)
    mix, lufs, tp, norm_gain = normalize(mix)
    # 5 ms de-click ramps on the whole mix
    r = min(int(0.005 * SR), n // 2)
    if r:
        ramp = np.linspace(0, 1, r, dtype=np.float32)[:, None]
        mix[:r] *= ramp
        mix[n - r:] *= ramp[::-1]
    sample_peak = lin2db(np.abs(mix).max()) if n else -np.inf
    audio = np.ascontiguousarray(mix.T)              # (2, n) planar for fltp

    # ---------------- container + streams
    out = av.open(args.out, mode="w", format="mp4", container_options={"movflags": "+faststart"})
    vs = out.add_stream("libx264", rate=fps, options={
        "crf": str(args.crf), "preset": "slow", "profile": "high",
        "x264-params": "colorprim=bt709:transfer=bt709:colormatrix=bt709",
    })
    vs.width, vs.height, vs.pix_fmt = w, h, "yuv420p"
    vs.codec_context.time_base = Fraction(1) / fps
    vs.codec_context.colorspace = 1          # AVCOL_SPC_BT709
    vs.codec_context.color_primaries = 1
    vs.codec_context.color_trc = 1
    vs.codec_context.color_range = 1         # MPEG / limited
    vs.thread_type = "AUTO"
    as_ = out.add_stream("aac", rate=SR, layout="stereo")
    as_.bit_rate = 192000
    as_.codec_context.time_base = Fraction(1, SR)

    reformatter = av.video.reformatter.VideoReformatter()
    AFR = 1024
    apos = 0

    def push_audio(until):
        nonlocal apos
        until = min(until, n)
        while apos < until:
            m = min(AFR, n - apos)
            fr = av.AudioFrame.from_ndarray(audio[:, apos:apos + m].copy(), format="fltp", layout="stereo")
            fr.sample_rate = SR
            fr.pts = apos
            fr.time_base = Fraction(1, SR)
            for pkt in as_.encode(fr):
                out.mux(pkt)
            apos += m

    for i, path in enumerate(files):
        img = cv2.imread(path, cv2.IMREAD_COLOR)
        if img is None:
            sys.exit(f"cannot read {path}")
        if img.shape[0] != h or img.shape[1] != w:
            sys.exit(f"{path}: size {img.shape[1]}x{img.shape[0]} != {w}x{h}")
        vf = av.VideoFrame.from_ndarray(img, format="bgr24")
        vf = reformatter.reformat(vf, format="yuv420p", dst_colorspace="ITU709",
                                  interpolation="BICUBIC", dst_color_range="MPEG")
        vf.pts = i
        vf.time_base = vs.codec_context.time_base
        for pkt in vs.encode(vf):
            out.mux(pkt)
        # keep audio slightly ahead of video for good interleaving
        push_audio(int(round(float((i + 1) / fps) * SR)) + AFR)
        if (i + 1) % 60 == 0 or i + 1 == nframes:
            el = time.time() - t0
            print(f"  encoded {i + 1}/{nframes} frames ({el:.0f}s)", file=sys.stderr, flush=True)
    push_audio(n)
    for pkt in vs.encode(None):
        out.mux(pkt)
    for pkt in as_.encode(None):
        out.mux(pkt)
    out.close()

    size_mb = os.path.getsize(args.out) / 1e6
    print("---- mux summary ----")
    print(f"output      : {args.out} ({size_mb:.1f} MB)")
    print(f"video       : {w}x{h}, {nframes} frames @ {float(fps):g} fps, H.264 High crf {args.crf:g} preset slow")
    print(f"duration    : {duration:.3f} s")
    print(f"audio       : AAC 48 kHz stereo 192k | VO={'yes' if args.vo else 'no'}"
          f" BGM={'yes' + (' (looped)' if looped else '') if args.bgm else 'no'}"
          + (f" ducked {duck_frac * 100:.0f}% of time" if args.bgm and args.vo else "")
          + f" SFX={nsfx} events")
    if args.vo_mute:
        print(f"VO muted    : {args.vo_mute} (VO-file seconds; +{args.vo_offset:g} s in the video)")
    if np.isfinite(lufs):
        print(f"loudness    : {lufs:.1f} LUFS integrated (BS.1770-4 K-weighted, gated); "
              f"pre-normalisation {pre_lufs:.1f} LUFS, gain {norm_gain:+.1f} dB")
        print(f"peak        : {tp:.2f} dBTP (4x oversampled), {sample_peak:.2f} dBFS sample peak")
    else:
        print("loudness    : silent track")
    print(f"elapsed     : {time.time() - t0:.1f} s")


if __name__ == "__main__":
    main()
