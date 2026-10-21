# <Product> reel: <working title>

## Brief

| | |
|---|---|
| Audience | <who, specifically> |
| Platform and format | <where it runs> · <9:16 / 4:5 / 1:1 / 16:9> · <canvas, e.g. 1080x1920> |
| Length | <seconds> |
| The one message | <one sentence> |
| Feeling | <two or three words> |
| Call to action | <what to do, and where> |
| Must show | <features, from the code> |
| Claims allowed | <true, traceable> |
| Avoid | <what it doesn't do, tones to avoid, private data> |
| Brand | <colours, fonts, logo, tagline exactly as written, URL> |
| Given by the person | <their brief, concept or references, or "none, decided from the product"> |

## Concepts offered

`fingerprint.py fresh` said recent reels used: <concept types, tones, openings, music>.

```
A. <Title> (<type>, <format>, <length>)
   Logline:   <one sentence>
   Opens on:  <the first second>
   Middle:    <how it moves>
   Ends on:   <the last frame and the ask>
   Signature: <the moment people remember>
   Sound:     <music genre or silence + SFX character>

B. ...

C. ...
```

**Chosen:** <letter, and any changes the person asked for>

## Script (approved <date>)

**Logline:** <one sentence>

| Time | On screen | Words (on screen / VO) | Sound |
|---|---|---|---|
| 0.00-<t> | <what we see> | <copy> | <music section; SFX> |
| ... | | | |
| <t>-<end> | <the ending> | <the ask> | <final hit / ring out> |

## Claims check

Every claim on screen, and where the product backs it (README line, code path, live behaviour):

| Claim | Source |
|---|---|
| | |

## Direction

<Two or three sentences: the look, the motion, the sound, and how it differs from recent reels.>
The axes are in `promo/reel.json` → `direction`. `fingerprint.py check`: <PASS / WARN, closest reel and %>.
`fingerprint.py look` (after stills): <result>.

## Sound

**Music:** <title> by <artist>, <link>, <licence>, Content ID: no, AI-generated: no; offset <s> so <its hit>
lands on <cue>. *Or:* generated bed, `synth.py bed --genre <g> --seed <n> --drop <t>`.
**SFX:** <synth.py kit --palette <p> --seed <n>, and/or sourced sounds with credits>. <N> events, cues in `reel.json`.
Credits required: <none / where they go>. Keep sourced audio out of public repos if its licence forbids
redistribution.

## Render

```sh
python <skill>/tools/reel.py stills promo/reel.json <start, middle and end of every beat>
python <skill>/tools/reel.py all promo/reel.json
python <skill>/tools/fingerprint.py record promo/reel.json
```
