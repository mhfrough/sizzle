#!/usr/bin/env python
"""Royalty-free sound, made from scratch: sound effects, SFX kits and music beds.

Everything here is synthesised with numpy (no samples, no downloads), so it is yours to use anywhere.
Each call takes a --seed, so every reel gets its own variation.

  python synth.py list                                          # kinds, palettes and genres
  python synth.py sfx whoosh promo/sfx/whoosh.wav [--len .7] [--pitch 0] [--bright .5] [--seed 7]
  python synth.py sfx type promo/sfx/type.wav --chars 18 --cps 24   # a typing run to match R.type
  python synth.py kit promo/sfx --palette organic --seed 7      # a whole matched set for one reel
  python synth.py bed promo/bed.wav --genre lofi --length 24 --drop 3.0 [--bpm 84] [--key D] [--scale minor]
                                    [--outro 19.5] [--seed 7]

bed: a backing track built on a bar grid whose downbeat lands exactly on --drop (the reel's big moment),
with a quieter intro and a riser into it, the full arrangement after it, and (with --outro) drums out for
the ending. It also writes <out>.grid.json (bpm, beat length, downbeat times) so you can put cues on the
beat. The result is a sketch-quality bed: fine under a promo, not a produced track. When the person wants
a real track, source one (references/sound.md); use beds and synth SFX when they don't want downloads, or
when nothing found fits.
Needs: numpy, scipy.
"""
import argparse
import json
import os
import sys
import wave

import numpy as np
from scipy import signal

SR = 48000
NOTE = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7,
        "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
SCALES = {"major": [0, 2, 4, 5, 7, 9, 11], "minor": [0, 2, 3, 5, 7, 8, 10], "dorian": [0, 2, 3, 5, 7, 9, 10],
          "mixolydian": [0, 2, 4, 5, 7, 9, 10], "pentatonic": [0, 2, 4, 7, 9]}


# --------------------------------------------------------------------------- primitives
def t_axis(n):
    return np.arange(n) / SR


def ns(sec):
    return max(1, int(round(sec * SR)))


def mtof(m):
    return 440.0 * 2 ** ((np.asarray(m, float) - 69) / 12)


def exp_env(n, decay, attack=0.002):
    t = t_axis(n)
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-t / max(decay, 1e-4))


def adsr(n, a, d, s, r):
    t = t_axis(n)
    dur = n / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = np.clip((dur - t) / max(r, 1e-4), 0, 1)
    return e * rel


def osc(freq, n, shape="sine", phase=0.0):
    f = np.broadcast_to(np.asarray(freq, float), (n,))
    ph = phase + np.cumsum(f) / SR
    ph -= np.floor(ph)
    if shape == "sine":
        return np.sin(2 * np.pi * ph)
    if shape == "saw":
        return 2 * ph - 1
    if shape == "square":
        return np.where(ph < 0.5, 1.0, -1.0)
    if shape == "tri":
        return 4 * np.abs(ph - 0.5) - 1
    raise ValueError(shape)


def filt(x, kind, fc, order=2):
    nyq = SR / 2
    if kind == "bp":
        lo, hi = max(20, fc[0]), min(fc[1], nyq * 0.95)
        sos = signal.butter(order, [lo / nyq, hi / nyq], btype="band", output="sos")
    else:
        sos = signal.butter(order, min(max(fc, 20), nyq * 0.95) / nyq, btype="low" if kind == "lp" else "high", output="sos")
    return signal.sosfilt(sos, x, axis=0)


def sweep_filter(x, f0, f1, q=2.0, curve=None):
    """State-variable band-pass whose centre moves from f0 to f1 (or along curve, an array of Hz)."""
    n = len(x)
    fc = curve if curve is not None else np.geomspace(max(f0, 20), max(f1, 20), n)
    g = np.tan(np.pi * np.clip(fc, 20, SR * 0.45) / SR)
    k = 1.0 / q
    ic1 = ic2 = 0.0
    y = np.empty(n)
    for i in range(n):  # plain loop: fine for SFX lengths
        gi = g[i]
        v3 = x[i] - ic2
        v1 = (gi * v3 + ic1) / (1 + gi * (gi + k))
        v2 = ic2 + gi * v1
        ic1, ic2 = 2 * v1 - ic1, 2 * v2 - ic2
        y[i] = v1
    return y


def reverb(x, size=1.2, mix=0.2, rng=None, bright=0.5):
    if mix <= 0:
        return x
    rng = rng or np.random.default_rng(0)
    n = ns(size)
    ir = rng.standard_normal((n, 2)) * np.exp(-t_axis(n) * 6.9 / size)[:, None]
    ir = filt(ir, "lp", 2500 + 9000 * bright)
    ir /= np.sqrt((ir ** 2).sum(axis=0))
    st = x if x.ndim == 2 else np.repeat(x[:, None], 2, axis=1)
    wet = np.stack([signal.fftconvolve(st[:, c], ir[:, c])[:len(st) + n - 1] for c in (0, 1)], axis=1)
    out = np.zeros_like(wet)
    out[:len(st)] = st * (1 - mix)
    return out + wet * mix


def crush(x, bits=6, down=4):
    q = 2 ** (bits - 1)
    y = np.round(x * q) / q
    return np.repeat(y[::down], down, axis=0)[:len(x)] if down > 1 else y


def soft(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive)


def stereo(x, pan=0.0, width=0.0, rng=None):
    if x.ndim == 2:
        return x
    th = (pan + 1) * np.pi / 4
    st = np.stack([x * np.cos(th), x * np.sin(th)], axis=1) * np.sqrt(2)
    if width > 0:
        d = ns(0.011)
        st[d:, 1] = st[d:, 1] * (1 - width) + x[:-d] * width * np.sin(th) * np.sqrt(2)
    return st


def finish(x, peak_db=-1.0, fade=0.004):
    x = stereo(x) if x.ndim == 1 else x
    x = x - x.mean(axis=0)
    p = np.abs(x).max()
    if p > 0:
        x = x / p * 10 ** (peak_db / 20)
    f = min(ns(fade), len(x) // 2)
    x[:f] *= np.linspace(0, 1, f)[:, None]
    x[-f:] *= np.linspace(1, 0, f)[:, None]
    return x


def write_wav(path, x):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    x = finish(x) if x.ndim == 1 else x
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print("wrote %s (%.2f s)" % (path, len(x) / SR))


# --------------------------------------------------------------------------- sound effects
# Every SFX function: (rng, length, pitch semitones, bright 0..1, **extra) -> mono or stereo float array.
def sfx_whoosh(rng, L=0.7, pitch=0, bright=0.5, **_):
    n = ns(L)
    x = rng.standard_normal(n)
    p = 2 ** (pitch / 12)
    t = np.linspace(0, 1, n)
    curve = (300 + (2500 + 5000 * bright) * np.sin(np.pi * t) ** 1.5) * p
    y = sweep_filter(x, 0, 0, q=1.4, curve=curve)
    y *= np.sin(np.pi * t) ** 2
    pan = np.linspace(-0.6, 0.6, n) if rng.random() < 0.5 else np.linspace(0.6, -0.6, n)
    th = (pan + 1) * np.pi / 4
    return np.stack([y * np.cos(th), y * np.sin(th)], axis=1)


def sfx_swipe(rng, L=0.22, pitch=0, bright=0.6, **_):
    return sfx_whoosh(rng, L, pitch + 5, bright)


def sfx_riser(rng, L=1.8, pitch=0, bright=0.5, **_):
    n = ns(L)
    t = np.linspace(0, 1, n)
    p = 2 ** (pitch / 12)
    nz = sweep_filter(rng.standard_normal(n), 0, 0, q=2.5, curve=(400 + 7000 * bright * t ** 2) * p)
    tone = osc(np.geomspace(110 * p, 880 * p, n), n, "saw") + 0.6 * osc(np.geomspace(111 * p, 884 * p, n), n, "saw")
    tone = filt(tone, "lp", 900 + 5000 * bright)
    y = (nz * 0.8 + tone * 0.25) * t ** 2.2
    y[-ns(0.01):] *= np.linspace(1, 0, ns(0.01))
    return reverb(y, 0.8, 0.15, rng, bright)[:n]


def sfx_reverse(rng, L=1.2, pitch=0, bright=0.6, **_):
    """reverse cymbal: swells up and stops dead (place it to end on the cue)"""
    n = ns(L)
    x = filt(rng.standard_normal(n), "hp", 3000 + 3000 * bright) * 0.7 + filt(rng.standard_normal(n), "bp", (1200, 5000)) * 0.3
    return x * np.linspace(0, 1, n) ** 3


def sfx_impact(rng, L=1.4, pitch=0, bright=0.5, **_):
    n = ns(L)
    p = 2 ** (pitch / 12)
    t = t_axis(n)
    body = osc(45 * p + 110 * p * np.exp(-t / 0.05), n) * exp_env(n, 0.35)
    crack = filt(rng.standard_normal(n), "bp", (300, 3000 + 6000 * bright)) * exp_env(n, 0.05)
    y = soft(body * 1.2 + crack * 0.6, 1.5)
    return reverb(y, L, 0.25, rng, bright)[:n]


def sfx_boom(rng, L=2.5, pitch=0, bright=0.3, **_):
    n = ns(L)
    y = sfx_impact(rng, L, pitch - 3, bright)
    sub = osc(38 * 2 ** (pitch / 12), n) * exp_env(n, 0.9)
    return y + stereo(sub * 0.8)


def sfx_subdrop(rng, L=1.2, pitch=0, **_):
    n = ns(L)
    p = 2 ** (pitch / 12)
    return soft(osc(np.geomspace(90 * p, 28 * p, n), n) * exp_env(n, L / 2.5, 0.01), 1.3)


def sfx_click(rng, L=0.05, pitch=0, bright=0.6, **_):
    n = ns(L)
    p = 2 ** (pitch / 12)
    x = filt(rng.standard_normal(n), "bp", (1500 * p, 6000 + 6000 * bright)) * exp_env(n, 0.006)
    return x + osc(1800 * p, n) * exp_env(n, 0.004) * 0.4


def sfx_tick(rng, L=0.04, pitch=0, **_):
    n = ns(L)
    return osc(3200 * 2 ** (pitch / 12), n, "sine") * exp_env(n, 0.006)


def sfx_pop(rng, L=0.14, pitch=0, **_):
    n = ns(L)
    p = 2 ** (pitch / 12)
    f = 260 * p * np.geomspace(1, 3.2, n)
    return osc(f, n) * exp_env(n, 0.045, 0.003)


def sfx_snap(rng, L=0.12, pitch=0, bright=0.6, **_):
    n = ns(L)
    x = filt(rng.standard_normal(n), "bp", (1800, 7000 + 4000 * bright)) * exp_env(n, 0.018, 0.0005)
    return reverb(x, 0.25, 0.15, rng, bright)[:n]


def sfx_thud(rng, L=0.35, pitch=0, **_):
    n = ns(L)
    p = 2 ** (pitch / 12)
    t = t_axis(n)
    body = osc(70 * p + 60 * p * np.exp(-t / 0.02), n) * exp_env(n, 0.09)
    paper = filt(rng.standard_normal(n), "lp", 1800) * exp_env(n, 0.03)
    return body + paper * 0.5


def sfx_chime(rng, L=1.6, pitch=0, bright=0.5, **_):
    n = ns(L)
    t = t_axis(n)
    f = mtof(84 + pitch)
    idx = (2 + 3 * bright) * np.exp(-t / 0.25)
    mod = np.sin(2 * np.pi * f * 3.5 * t) * idx
    y = np.sin(2 * np.pi * f * t + mod) * exp_env(n, 0.6)
    y += 0.4 * np.sin(2 * np.pi * f * 2.01 * t) * exp_env(n, 0.3)
    return reverb(y, 1.2, 0.25, rng, bright)[:n]


def sfx_notif(rng, L=0.45, pitch=0, **_):
    n = ns(L)
    a, b = mtof(79 + pitch), mtof(86 + pitch)
    h = n // 3
    y = np.zeros(n)
    y[:h] = osc(a, h) * exp_env(h, 0.08)
    y[h:] = osc(b, n - h) * exp_env(n - h, 0.12)
    return reverb(y, 0.6, 0.18, rng)[:n]


def sfx_error(rng, L=0.35, pitch=0, **_):
    n = ns(L)
    y = filt(osc(mtof(45 + pitch), n, "square") + osc(mtof(45.3 + pitch), n, "square"), "lp", 1800)
    gate = (np.floor(t_axis(n) / 0.09) % 2 == 0)
    return y * gate * adsr(n, 0.005, 0.2, 0.7, 0.05) * 0.5


def sfx_shimmer(rng, L=1.5, pitch=0, bright=0.6, **_):
    n = ns(L)
    t = t_axis(n)
    y = np.zeros(n)
    base = mtof(84 + pitch)
    for k in range(9):
        f = base * rng.choice([1, 1.5, 2, 2.5, 3, 4]) * (1 + rng.uniform(-0.01, 0.01))
        on = rng.uniform(0, L * 0.6)
        e = np.clip((t - on) / 0.02, 0, 1) * np.exp(-np.clip(t - on, 0, None) / 0.35)
        y += np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * e
    return reverb(y / 3, 1.4, 0.4, rng, bright)[:n]


def sfx_glitch(rng, L=0.5, pitch=0, **_):
    n = ns(L)
    y = np.zeros(n)
    pos = 0
    while pos < n:
        m = min(n - pos, ns(rng.uniform(0.015, 0.07)))
        kind = rng.integers(3)
        if kind == 0:
            seg = osc(mtof(rng.integers(60, 100) + pitch), m, "square")
        elif kind == 1:
            seg = rng.standard_normal(m)
        else:
            seg = np.zeros(m)
        y[pos:pos + m] = seg * rng.uniform(0.3, 1)
        pos += m
    return crush(y, 4, 6) * 0.6


def sfx_tape(rng, L=0.8, pitch=0, **_):
    """tape stop: a falling tone (end of a scene, a 'wait, what?')"""
    n = ns(L)
    f = mtof(72 + pitch) * np.linspace(1, 0.05, n) ** 1.5
    return filt(osc(f, n, "saw") * 0.5 + osc(f * 0.5, n, "tri"), "lp", 3000) * np.linspace(1, 0, n) ** 0.5


def sfx_key(rng, L=0.06, pitch=0, bright=0.5, **_):
    n = ns(L)
    x = filt(rng.standard_normal(n), "bp", (900 * 2 ** (pitch / 12), 4000 + 5000 * bright)) * exp_env(n, 0.008, 0.0008)
    thock = osc(rng.uniform(180, 260), n) * exp_env(n, 0.012) * 0.6
    return x + thock


def sfx_type(rng, L=None, pitch=0, bright=0.5, chars=16, cps=24, **_):
    """a typing run: one key per character at cps, slightly humanised; L is set from chars / cps"""
    total = chars / cps + 0.15
    n = ns(total)
    y = np.zeros(n)
    for i in range(chars):
        at = ns(i / cps + rng.uniform(-0.25, 0.25) / cps) if i else 0
        k = sfx_key(rng, 0.06, pitch + rng.uniform(-2, 2), bright) * rng.uniform(0.55, 1)
        m = min(len(k), n - at)
        y[at:at + m] += k[:m]
    return y


SFX = {
    "whoosh": (sfx_whoosh, "air past the camera; scene moves, big slides"),
    "swipe": (sfx_swipe, "short whoosh for UI swipes, card moves"),
    "riser": (sfx_riser, "builds into a moment; place it to END on the cue (at: cue - len)"),
    "reverse": (sfx_reverse, "reverse cymbal swell that stops dead on the cue (at: cue - len)"),
    "impact": (sfx_impact, "a hit with body and crack; reveals, slams, title cards"),
    "boom": (sfx_boom, "a cinematic boom with a long tail; the biggest moment only"),
    "subdrop": (sfx_subdrop, "felt more than heard; under a reveal or a cut to black"),
    "click": (sfx_click, "a UI click or tap"),
    "tick": (sfx_tick, "a clock tick, counter steps, timers"),
    "pop": (sfx_pop, "bubbly pop for chips, stickers, arrivals"),
    "snap": (sfx_snap, "a finger snap; cuts, a word landing"),
    "thud": (sfx_thud, "a soft thump; paper, a card landing, a stamp"),
    "chime": (sfx_chime, "a bell; success, a tick drawn, the URL appearing"),
    "notif": (sfx_notif, "a two-note notification blip"),
    "error": (sfx_error, "a buzz; the old way failing"),
    "shimmer": (sfx_shimmer, "sparkle; something new or polished appears"),
    "glitch": (sfx_glitch, "digital stutter; glitch cuts, errors, scramble text"),
    "tape": (sfx_tape, "a tape stop; record scratch-style pause"),
    "key": (sfx_key, "one key press"),
    "type": (sfx_type, "a typing run; use --chars and --cps to match R.type"),
}

PALETTES = {
    # how a kit sounds: pitch offset, brightness, reverb mix, crush (bits, down) or None, impact kind, members
    "digital": dict(pitch=2, bright=0.8, rev=0.08, crush=None, members=["swipe", "whoosh", "click", "tick", "pop", "notif", "glitch", "impact", "riser", "type", "chime"]),
    "organic": dict(pitch=-2, bright=0.35, rev=0.18, crush=None, members=["whoosh", "snap", "thud", "pop", "key", "type", "chime", "shimmer", "reverse", "subdrop"]),
    "cinematic": dict(pitch=-5, bright=0.4, rev=0.3, crush=None, members=["whoosh", "riser", "reverse", "boom", "impact", "subdrop", "tick", "shimmer", "tape"]),
    "retro": dict(pitch=5, bright=0.7, rev=0.05, crush=(5, 5), members=["pop", "click", "tick", "notif", "error", "glitch", "chime", "riser", "type", "impact"]),
    "soft": dict(pitch=0, bright=0.25, rev=0.25, crush=None, members=["swipe", "pop", "key", "type", "chime", "shimmer", "thud", "notif"]),
    "glitch": dict(pitch=0, bright=0.9, rev=0.04, crush=(6, 3), members=["glitch", "click", "tick", "swipe", "impact", "subdrop", "error", "type", "tape"]),
}


def make_sfx(kind, rng, length=None, pitch=0.0, bright=0.5, **extra):
    fn = SFX[kind][0]
    kw = dict(pitch=pitch, bright=bright, **extra)
    if length is not None:
        kw["L"] = length
    return fn(rng, **kw)


# --------------------------------------------------------------------------- instruments (music bed)
def i_kick(rng, L=0.45, punch=1.0, pitch=0):
    n = ns(L)
    t = t_axis(n)
    p = 2 ** (pitch / 12)
    y = osc(48 * p + 120 * p * punch * np.exp(-t / 0.035), n) * exp_env(n, 0.22)
    y += filt(rng.standard_normal(n), "hp", 2500) * exp_env(n, 0.004) * 0.25 * punch
    return soft(y, 1.6)


def i_snare(rng, L=0.3, bright=0.5):
    n = ns(L)
    nz = filt(rng.standard_normal(n), "bp", (1200, 5000 + 5000 * bright)) * exp_env(n, 0.12)
    return nz * 0.8 + osc(190, n) * exp_env(n, 0.06) * 0.5


def i_clap(rng, L=0.35):
    n = ns(L)
    y = np.zeros(n)
    for k, o in enumerate([0, 0.011, 0.022]):
        m = ns(0.02 if k < 2 else 0.25)
        a = ns(o)
        y[a:a + m] += rng.standard_normal(min(m, n - a)) * exp_env(min(m, n - a), 0.01 if k < 2 else 0.09)
    return filt(y, "bp", (900, 4000))


def i_hat(rng, L=0.06, bright=0.6):
    n = ns(L)
    return filt(rng.standard_normal(n), "hp", 6000 + 3000 * bright) * exp_env(n, L / 2.2, 0.0005)


def i_crash(rng, L=2.0):
    n = ns(L)
    return filt(rng.standard_normal(n), "hp", 4000) * exp_env(n, 0.7, 0.001) * 0.6


def i_bass(midi, L, shape="saw", cutoff=500, glide_from=None):
    n = ns(L)
    f = mtof(midi) * np.ones(n)
    if glide_from is not None:
        g = min(n, ns(0.06))
        f[:g] = np.geomspace(mtof(glide_from), mtof(midi), g)
    y = osc(f, n, shape) + (0.5 * osc(f / 2, n, "sine") if shape != "sine" else 0)
    if shape != "sine":
        y = filt(y, "lp", cutoff)
    return y * adsr(n, 0.004, 0.25, 0.6, 0.04)


def i_808(midi, L, glide_from=None):
    n = ns(L)
    f = mtof(midi) * np.ones(n)
    if glide_from is not None:
        g = min(n, ns(0.08))
        f[:g] = np.geomspace(mtof(glide_from), mtof(midi), g)
    return soft(osc(f, n) * exp_env(n, max(L / 2, 0.3), 0.003), 2.0)


def i_pad(notes, L, bright=0.4, rng=None):
    n = ns(L)
    y = np.zeros((n, 2))
    for m in notes:
        for d, side in ((-0.09, 0), (0.0, None), (0.09, 1)):
            v = osc(mtof(m + d), n, "saw", rng.random() if rng is not None else 0)
            if side is None:
                y += v[:, None] * 0.5
            else:
                y[:, side] += v * 0.7
    y = filt(y, "lp", 700 + 2500 * bright)
    return y * adsr(n, min(0.35, L / 3), 0.5, 0.8, min(0.4, L / 3))[:, None] / max(1, len(notes))


def i_keys(notes, L, bright=0.5):
    """electric-piano-ish: sine with a little bell and tremolo"""
    n = ns(L)
    t = t_axis(n)
    y = np.zeros(n)
    for m in notes:
        f = mtof(m)
        y += np.sin(2 * np.pi * f * t + 0.8 * bright * np.sin(2 * np.pi * f * 7 * t) * np.exp(-t / 0.08))
    y *= (1 + 0.15 * np.sin(2 * np.pi * 4.5 * t)) * exp_env(n, 1.2, 0.006)
    return y / max(1, len(notes))


def i_pluck(midi, L=0.5, bright=0.5):
    n = ns(L)
    t = t_axis(n)
    f = mtof(midi)
    y = np.sin(2 * np.pi * f * t) * exp_env(n, 0.25) + 0.35 * np.sin(2 * np.pi * f * 4 * t) * exp_env(n, 0.03 + 0.05 * bright)
    return y


def i_lead(midi, L, shape="square", cutoff=3000):
    n = ns(L)
    y = osc(mtof(midi), n, shape)
    if shape != "sine":
        y = filt(y, "lp", cutoff)
    return y * adsr(n, 0.004, 0.1, 0.6, 0.03)


# --------------------------------------------------------------------------- the bed
class Bus:
    def __init__(self, n):
        self.n = n
        self.x = np.zeros((n, 2))

    def add(self, t, sig, gain=1.0, pan=0.0):
        a = int(round(t * SR))
        s = stereo(sig, pan) if sig.ndim == 1 else sig
        if a < 0:
            s, a = s[-a:], 0
        if a >= self.n or len(s) == 0:
            return
        m = min(len(s), self.n - a)
        self.x[a:a + m] += s[:m] * gain


GENRES = {
    "house": dict(bpm=(118, 126), scale="minor", desc="four-on-the-floor, offbeat hats, stabs; bright, upbeat"),
    "lofi": dict(bpm=(72, 90), scale="dorian", desc="swung boom-bap, warm keys, vinyl crackle; calm, friendly"),
    "synthwave": dict(bpm=(96, 112), scale="minor", desc="gated drums, saw arpeggio, wide pads; retro night drive"),
    "techno": dict(bpm=(122, 130), scale="minor", desc="minimal: kick, clicks, sub pulse; precise, cool"),
    "ambient": dict(bpm=(70, 90), scale="major", desc="pads and sparkle, soft pulse; airy, premium"),
    "chiptune": dict(bpm=(132, 156), scale="major", desc="square lead, triangle bass, noise hats; playful, 8-bit"),
    "trap": dict(bpm=(136, 150), scale="minor", desc="808 slides, hat rolls, half-time snare; heavy, confident"),
    "pluckpop": dict(bpm=(100, 118), scale="major", desc="marimba plucks, claps, bouncy bass; bright, cute"),
    "cinematic": dict(bpm=(80, 100), scale="minor", desc="drone, low strings, big booms; dramatic, trailer"),
}

PROGRESSIONS = {
    "major": [[0, 4, 5, 3], [0, 5, 3, 4], [3, 0, 4, 5], [0, 2, 3, 4], [0, 3, 0, 4]],
    "minor": [[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 6], [0, 4, 3, 0], [0, 5, 3, 4]],
}


def chord(root, scale, degree, size=3, octave=0):
    steps = SCALES[scale]
    notes = []
    for k in range(size):
        d = degree + 2 * k
        notes.append(root + 12 * octave + steps[d % len(steps)] + 12 * (d // len(steps)))
    return notes


def make_bed(genre, length, drop, bpm, key, scale, outro, seed):
    rng = np.random.default_rng(seed)
    g = GENRES[genre]
    bpm = bpm or int(rng.integers(g["bpm"][0], g["bpm"][1] + 1))
    scale = scale or g["scale"]
    root = NOTE[key] if key else int(rng.integers(12))
    root += 48  # C3-based
    pscale = "major" if scale in ("major", "mixolydian", "pentatonic") else "minor"
    prog = PROGRESSIONS[pscale][rng.integers(len(PROGRESSIONS[pscale]))]
    sc = scale if scale != "pentatonic" else "major"
    beat = 60.0 / bpm
    bar = 4 * beat
    tail = 2.5
    n = ns(length + tail)
    drums, bass, harm, lead, fx = Bus(n), Bus(n), Bus(n), Bus(n), Bus(n)
    outro = outro if outro is not None else length + 99
    # grid: a downbeat exactly on drop
    k0 = int(np.ceil(drop / bar)) if drop > 0 else 0
    first = drop - k0 * bar
    nbars = int(np.ceil((length + tail - first) / bar))
    swing = 0.16 if genre == "lofi" else 0.0
    arp_shape = rng.choice(["up", "updown", "random"])
    downbeats = []

    for b in range(nbars):
        t0 = first + b * bar
        if t0 > length + 0.5:
            break
        downbeats.append(round(t0, 4))
        sec = "intro" if t0 < drop - 1e-6 else ("outro" if t0 >= outro - 1e-6 else "main")
        deg = prog[b % len(prog)] if b >= k0 else prog[(b - k0) % len(prog)]
        ch = chord(root, sc, deg, 3, 1)
        ch4 = chord(root, sc, deg, 4, 1)
        bn = root - 12 + SCALES[sc][deg % len(SCALES[sc])]
        main = sec == "main"

        def st(i, sub=4):  # time of the i-th subdivision (sub per beat) with swing on offbeats
            tt = t0 + i * beat / sub
            if swing and i % 2 == 1:
                tt += swing * beat / sub * 2
            return tt

        if genre == "house":
            harm.add(t0, i_pad(ch, bar, 0.25 if sec == "intro" else 0.45, rng), 0.35)
            if main:
                for q in range(4):
                    drums.add(t0 + q * beat, i_kick(rng), 0.9)
                    drums.add(t0 + q * beat + beat / 2, i_hat(rng, 0.09), 0.35, 0.2)
                    bass.add(t0 + q * beat + beat / 2, i_bass(bn, beat / 2.2, cutoff=700), 0.45)
                for q in (1, 3):
                    drums.add(t0 + q * beat, i_clap(rng), 0.5)
                for s16 in rng.choice(16, 3, replace=False):
                    harm.add(st(int(s16)), i_keys(ch, beat * 0.6, 0.7), 0.25, -0.2)
            else:
                for q in range(4):
                    drums.add(t0 + q * beat + beat / 2, i_hat(rng, 0.05), 0.15)
        elif genre == "lofi":
            harm.add(t0, i_keys(ch4, bar * 1.05, 0.4), 0.55)
            if main or sec == "intro":
                for i in range(8):
                    drums.add(st(i, 2), i_hat(rng, 0.05, 0.3), 0.18 if main else 0.1, 0.25)
            if main:
                for q in (0, 2.5):
                    drums.add(t0 + q * beat, i_kick(rng, 0.4, 0.7), 0.8)
                for q in (1, 3):
                    drums.add(t0 + q * beat, i_snare(rng, 0.25, 0.2), 0.45)
                bass.add(t0, i_bass(bn, beat * 1.8, "sine"), 0.6)
                bass.add(t0 + 2.5 * beat, i_bass(bn + SCALES[sc][4 % 7] - SCALES[sc][0], beat * 1.2, "sine"), 0.5)
        elif genre == "synthwave":
            harm.add(t0, i_pad(ch, bar, 0.5, rng), 0.4)
            arp = ch + [ch[0] + 12]
            for i in range(16 if sec != "intro" else 8):
                j = i if arp_shape == "up" else (i % 6 if i % 6 < 4 else 6 - i % 6) if arp_shape == "updown" else rng.integers(4)
                lead.add(t0 + i * beat / (4 if sec != "intro" else 2), i_lead(arp[j % 4] + 12, beat / 4.4, "saw", 2400), 0.22, 0.3 * (1 if i % 2 else -1))
            if main:
                for q in range(4):
                    drums.add(t0 + q * beat, i_kick(rng, 0.4), 0.8 if q % 2 == 0 else 0.6)
                for q in (1, 3):
                    drums.add(t0 + q * beat, reverb(i_snare(rng, 0.3, 0.6), 0.6, 0.35, rng), 0.5)
                for i in range(8):
                    bass.add(t0 + i * beat / 2, i_bass(bn, beat / 2.3, cutoff=600), 0.45)
        elif genre == "techno":
            if sec != "outro":
                for q in range(4):
                    if main or q % 2 == 0:
                        drums.add(t0 + q * beat, i_kick(rng, 0.35, 1.2), 0.95 if main else 0.4)
            if main:
                for i in range(16):
                    if rng.random() < 0.55:
                        drums.add(t0 + i * beat / 4, i_hat(rng, 0.025, 0.9), rng.uniform(0.12, 0.3), rng.uniform(-0.6, 0.6))
                for q in range(4):
                    bass.add(t0 + q * beat + beat * 0.75, i_bass(bn - 12, beat / 4, "sine"), 0.6)
            harm.add(t0, i_pad([ch[0], ch[2]], bar, 0.2, rng), 0.25)
        elif genre == "ambient":
            harm.add(t0, i_pad(ch4, bar * 1.2, 0.3, rng), 0.5)
            for i in range(4 if main else 2):
                lead.add(t0 + rng.uniform(0, bar), i_pluck(rng.choice(ch4) + 24, 1.2, 0.3), 0.18, rng.uniform(-0.7, 0.7))
            if main:
                for q in (0, 2):
                    drums.add(t0 + q * beat, i_kick(rng, 0.5, 0.4), 0.45)
                bass.add(t0, i_bass(bn, bar * 0.95, "sine"), 0.4)
        elif genre == "chiptune":
            arp = ch + [ch[0] + 12]
            for i in range(16):
                lead.add(t0 + i * beat / 4, crush(i_lead(arp[i % 4] + 12, beat / 4.5, "square", 6000), 5, 2), 0.16)
            if main:
                for i in range(8):
                    bass.add(t0 + i * beat / 2, i_lead(bn + (12 if i % 2 else 0), beat / 2.3, "tri", 9000), 0.45)
                for q in range(4):
                    drums.add(t0 + q * beat, crush(i_kick(rng, 0.2), 5, 3), 0.7)
                    drums.add(t0 + q * beat + beat / 2, crush(i_hat(rng, 0.04), 4, 2), 0.25)
                for q in (1, 3):
                    drums.add(t0 + q * beat, crush(i_snare(rng, 0.15), 4, 3), 0.4)
        elif genre == "trap":
            harm.add(t0, i_pad(ch, bar, 0.3, rng), 0.3)
            if main:
                drums.add(t0, i_kick(rng, 0.3), 0.7)
                drums.add(t0 + 2 * beat, i_clap(rng), 0.55)
                drums.add(t0 + 2 * beat, i_snare(rng, 0.25), 0.3)
                i = 0
                while i < 16:
                    if rng.random() < 0.2 and i < 14:
                        for r in range(4):
                            drums.add(t0 + (i + r / 2) * beat / 4, i_hat(rng, 0.03), 0.2, 0.3)
                        i += 2
                    else:
                        drums.add(t0 + i * beat / 4 * 2, i_hat(rng, 0.04), 0.25, 0.3)
                        i += 2
                bass.add(t0, i_808(bn - 12, beat * 1.8), 0.65)
                bass.add(t0 + 2.5 * beat, i_808(bn - 12 + 7, beat * 1.4, glide_from=bn - 12), 0.55)
        elif genre == "pluckpop":
            for i in range(8):
                if rng.random() < 0.8:
                    lead.add(t0 + i * beat / 2, i_pluck(ch[i % 3] + 12, 0.45, 0.6), 0.32, 0.3 * (1 if i % 2 else -1))
            harm.add(t0, i_keys(ch, bar, 0.3), 0.3)
            if main:
                for q in range(4):
                    drums.add(t0 + q * beat, i_kick(rng, 0.35, 0.8), 0.7 if q % 2 == 0 else 0.0)
                for q in (1, 3):
                    drums.add(t0 + q * beat, i_clap(rng), 0.5)
                for i in range(8):
                    bass.add(t0 + i * beat / 2, i_bass(bn + (7 if i % 4 == 3 else 0), beat / 2.5, cutoff=900), 0.42)
        elif genre == "cinematic":
            harm.add(t0, i_pad([ch[0] - 12, ch[0], ch[2]], bar * 1.1, 0.25, rng), 0.55)
            bass.add(t0, i_bass(bn - 12, bar, "saw", 220), 0.5)
            if main:
                drums.add(t0, sfx_boom(rng, 2.2, -3, 0.3), 0.5)
                for q in (1.5, 2.5, 3):
                    drums.add(t0 + q * beat, i_kick(rng, 0.5, 0.5, -5), 0.45)
            elif sec == "intro":
                drums.add(t0 + 3 * beat, sfx_tick(rng, 0.04, -12), 0.4)

    # into the drop: a riser and a crash on it
    if drop > 0.8:
        rl = min(drop, bar, 2.0)
        fx.add(drop - rl, sfx_riser(rng, rl, 0, 0.5), 0.45)
    if drop >= 0:
        fx.add(drop, i_crash(rng), 0.35 if genre not in ("lofi", "ambient") else 0.15)
        fx.add(drop, i_kick(rng, 0.6, 1.3), 0.6)
    if genre == "lofi":
        nn = n
        crackle = np.zeros(nn)
        idx = rng.choice(nn, int(nn / SR * 40), replace=False)
        crackle[idx] = rng.uniform(-1, 1, len(idx))
        crackle = filt(crackle, "bp", (800, 6000)) + filt(rng.standard_normal(nn), "lp", 300) * 0.02
        fx.x += stereo(crackle * 0.25)
        harm.x = filt(harm.x, "lp", 3500)

    mix = drums.x + bass.x + harm.x * 0.9 + lead.x + fx.x
    mix = reverb(mix, 1.6 if genre in ("ambient", "cinematic") else 0.9, 0.18 if genre != "techno" else 0.08, rng)[:n]
    # sidechain feel for the dance genres: dip everything but drums on each beat after the drop
    if genre in ("house", "synthwave", "techno", "trap"):
        t = t_axis(n)
        ph = ((t - first) % beat) / beat
        pump = np.where(t >= drop, 0.55 + 0.45 * np.clip(ph / 0.35, 0, 1), 1.0)
        mix = drums.x + fx.x + (bass.x + harm.x * 0.9 + lead.x) * pump[:, None]
        mix = reverb(mix, 0.9, 0.12, rng)[:n]
    mix = soft(mix / (np.abs(mix).max() + 1e-9) * 1.2, 1.1)
    # ring out after the length
    end_n = ns(length)
    fo = ns(1.5)
    mix[end_n - fo:end_n] *= np.linspace(1, 0.35, fo)[:, None]
    mix[end_n:] *= np.linspace(0.35, 0, n - end_n)[:, None]
    mix = finish(mix[:ns(length + 1.0)])
    names = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
    grid = {"genre": genre, "bpm": bpm, "beat": round(beat, 5), "bar": round(bar, 5), "key": names[root % 12],
            "scale": scale, "drop": drop, "outro": None if outro > length else outro, "seed": seed, "downbeats": downbeats}
    return mix, grid


# --------------------------------------------------------------------------- cli
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    p = sub.add_parser("sfx")
    p.add_argument("kind", choices=sorted(SFX))
    p.add_argument("out")
    p.add_argument("--len", type=float)
    p.add_argument("--pitch", type=float, default=0.0, help="semitones")
    p.add_argument("--bright", type=float, default=0.5, help="0 dark .. 1 bright")
    p.add_argument("--reverb", type=float, default=0.0, help="extra reverb mix 0..1")
    p.add_argument("--crush", default="", help="bits,down for a lo-fi edge, e.g. 6,3")
    p.add_argument("--chars", type=int, default=16)
    p.add_argument("--cps", type=float, default=24)
    p.add_argument("--seed", type=int, default=1)
    k = sub.add_parser("kit")
    k.add_argument("dir")
    k.add_argument("--palette", choices=sorted(PALETTES), required=True)
    k.add_argument("--seed", type=int, default=1)
    b = sub.add_parser("bed")
    b.add_argument("out")
    b.add_argument("--genre", choices=sorted(GENRES), required=True)
    b.add_argument("--length", type=float, required=True, help="reel length (s)")
    b.add_argument("--drop", type=float, default=0.0, help="time of the big moment; a downbeat lands here")
    b.add_argument("--outro", type=float, help="drums out from here (e.g. the CTA)")
    b.add_argument("--bpm", type=int)
    b.add_argument("--key", choices=sorted(NOTE))
    b.add_argument("--scale", choices=sorted(SCALES))
    b.add_argument("--seed", type=int, default=1)
    a = ap.parse_args()

    if a.cmd == "list":
        print("SFX kinds:")
        for kname, (_, d) in sorted(SFX.items()):
            print("  %-9s %s" % (kname, d))
        print("\nkit palettes:")
        for kname, v in sorted(PALETTES.items()):
            print("  %-10s %s" % (kname, ", ".join(v["members"])))
        print("\nbed genres:")
        for kname, v in sorted(GENRES.items()):
            print("  %-10s %d-%d bpm  %s" % (kname, v["bpm"][0], v["bpm"][1], v["desc"]))
        return

    if a.cmd == "sfx":
        rng = np.random.default_rng(a.seed)
        x = make_sfx(a.kind, rng, a.len, a.pitch, a.bright, chars=a.chars, cps=a.cps)
        if a.crush:
            bits, down = (int(v) for v in a.crush.split(","))
            x = crush(x, bits, down)
        if a.reverb > 0:
            x = reverb(x, 1.0, a.reverb, rng, a.bright)
        write_wav(a.out, finish(x))
        return

    if a.cmd == "kit":
        pal = PALETTES[a.palette]
        rng = np.random.default_rng(a.seed)
        made = {}
        for kname in pal["members"]:
            x = make_sfx(kname, rng, None, pal["pitch"] + rng.uniform(-1.5, 1.5), float(np.clip(pal["bright"] + rng.uniform(-0.1, 0.1), 0, 1)))
            if pal["crush"]:
                x = crush(x, *pal["crush"])
            if pal["rev"] > 0 and kname not in ("type", "key", "tick", "click"):
                x = reverb(x, 0.9, pal["rev"], rng, pal["bright"])
            path = os.path.join(a.dir, "%s.wav" % kname)
            write_wav(path, finish(x))
            made[kname] = round(len(x) / SR, 3)
        meta = os.path.join(a.dir, "kit.json")
        with open(meta, "w", encoding="utf-8") as f:
            json.dump({"palette": a.palette, "seed": a.seed, "lengths": made}, f, indent=1)
        print("kit %s (seed %d): %d sounds, lengths in %s" % (a.palette, a.seed, len(made), meta))
        return

    if a.cmd == "bed":
        if a.drop > a.length:
            sys.exit("--drop is after the end")
        mix, grid = make_bed(a.genre, a.length, a.drop, a.bpm, a.key, a.scale, a.outro, a.seed)
        write_wav(a.out, mix)
        gp = a.out + ".grid.json"
        with open(gp, "w", encoding="utf-8") as f:
            json.dump(grid, f, indent=1)
        print("bed: %s, %d bpm, key %s %s, beat %.3f s; downbeat on %.2f s; grid in %s"
              % (a.genre, grid["bpm"], grid["key"], grid["scale"], grid["beat"], a.drop, gp))


if __name__ == "__main__":
    main()
