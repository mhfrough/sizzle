# <Product> reel: <working title>

**Length:** <20-25> seconds, 9:16 vertical (1080x1920 CSS, rendered at 2x to 2160x3840, 30 fps)
**Goal:** <the one thing a viewer should understand and do after watching>
**Visuals:** `promo/<product>-reel.html`. <Which real parts of the product appear: its stylesheet, its renderer, its icons.>
**Look:** <palette, fonts, motif (taken from the product), and how it differs from any sibling reel>
**Audio:** <music only / voiceover + music>. Music is chosen after the visuals are approved.

## Script (on-screen copy, also readable as a voiceover)

> <Hook: the pain, in one line>
> <Reveal: product name + its own tagline>
> <Demo beat 1>
> <Demo beat 2>
> <Demo beat 3>
> <Proof: the promise, kept>
> <CTA: what to do + where>

## Shot list

| Time | On screen |
|---|---|
| 0.0 - 3.0 | **Hook.** |
| 3.0 - 5.3 | **Reveal.** |
| 5.3 - 10 | **Demo 1.** |
| 10 - 15 | **Demo 2.** |
| 15 - 19 | **Proof.** |
| 19 - 25 | **CTA.** |

## Claims check

Every claim on screen, and where the product backs it (README line, code path, live behaviour):

| Claim | Source |
|---|---|
| | |

## Retiming

All times live in `CUES` in the HTML. Change a cue and everything tied to it moves.

## Music

**Track used:** <title> by <artist>, <link>, <licence>. Content ID: <no>. AI-generated: <no>.
Starts at <offset> s so <hit at X s in the track> lands on <cue> at <Y> s. Mixed at -14 dB, -14 LUFS, <fade> s fade-out.
Keep the track file out of public repos if its licence forbids redistributing it alone.

## Render

```sh
python <skill>/tools/reel.py stills promo/reel.json 1.5,4,8,12,16,20,23
python <skill>/tools/reel.py all promo/reel.json
```
