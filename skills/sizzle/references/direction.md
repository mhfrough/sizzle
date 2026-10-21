# Direction: a look made for this reel

The direction is the reel's visual and sonic identity, written down before building. It is generated
from the approved concept and the product's brand, never picked from a preset, and it must pass
`tools/fingerprint.py check` against every earlier reel.

## The axes

Write a value for every axis (run `fingerprint.py axes` for the common values; free words are fine when
none fits). Then describe the whole in two or three sentences in the script file.

| Axis | Decide | Questions to ask |
|---|---|---|
| concept | The concept type (from `concepts.md`) | Which idea carries it? |
| aspect, length | Canvas and duration | Where does it run? What does the concept need? |
| tone | dark, light, saturated, duotone, monochrome, gradient | What feeling, and what did recent reels use? |
| palette | `[bg, ink, accent, ...]` hex, in role order | How do the brand's colours get roles here? |
| display_font, type | The headline face and how type is used | Giant and condensed? Small editorial captions? Mono? Hand? |
| motion | The motion language and its easing | Snappy, fluid, stepped, elastic, cinematic, glitch, handmade, physics? |
| camera | How the frame moves | Locked off, push and pan, one take, hard cuts, split screen, scroll, orbit? |
| composition | Where things sit | Centred, flush-left, strict grid, full-bleed, collage, asymmetric, letterbox? |
| demo | How the UI appears | In a device, full bleed, exploded into layers, as fragments, cursor on a desktop, not at all? |
| opening | The first frame | A question, mid-action, black with sound, a number, an object, a quote? |
| ending | The last frame | URL typing, logo sting, a button pressed, a loop back, a question, an end card? |
| texture | The surface | None, grain, halftone, paper, scanlines, glass, noise gradient, grid, dots? |
| signature | One sentence: the move people remember | What only this reel does? |
| music, bpm | Genre and tempo | What does the concept *sound* like, and what did recent reels use? |
| sfx | The SFX palette | digital, organic, cinematic, retro, soft, glitch, none, or sourced? |

## Generating it

1. **Start from the concept.** A chat-thread wants message bubbles, a tight column, quick pops; a
   metaphor reel wants one object rendered with care and a slow camera. Write the axes the concept
   obviously implies first.
2. **Bring in the brand.** It wins on colour *values* and usually on fonts (see below).
3. **Run `fingerprint.py fresh`** and, for every axis the concept and brand leave open, choose a value
   recent reels didn't use. Push at least four axes away from the most recent reel, even when the
   checker would accept less.
4. **Commit to one signature move** that comes from the product (its gesture, its icon, its data) and
   echo it at least once (often at the end).
5. **Run `fingerprint.py check`.** FAIL: change what it names. WARN: push one more axis.

## Merging the direction with the brand

- **Colour:** the product's primary colour usually becomes the accent; its background and text colours
  become `bg` / `ink` when the direction's tone matches the product. When they clash (a dark direction
  for a light product), keep the direction's tone and build `bg` and surfaces from the product's neutrals
  in that direction. Duotone, monochrome or saturated directions may re-role the brand's colours (accent
  as background, ink as the only other colour): that is a good way to make a reel look new while staying
  on-brand. Check contrast on the first stills.
- **Type:** the product's display font is the default. Change it only when the direction's type
  approach *is* the treatment (mono for a terminal story, a serif for an editorial letter, a pixel face for
  a retro reel); then use the product's font for body text. A new face needs a licence that allows it
  (OFL, or the product's own); `templates/fonts/` has three OFL faces. Fonts from Google Fonts are OFL, but
  downloading one is an action to ask about.
- **Icons and logo:** always the product's own.

## Making each axis really different

Type is the fastest way to change a look. Vary the **scale** (one word filling the screen vs small
captions in a corner), **case**, **weight**, **tracking** and **placement** as well as the face.

Motion languages, each with an easing to match:

| Language | Feel | Easing / timing |
|---|---|---|
| snappy | Pops, quick settles | `cubic-bezier(.16,1,.3,1)` 0.4-0.7 s, pops with `cubic-bezier(.34,1.56,.64,1)` |
| fluid | Long glides, overlaps | `cubic-bezier(.65,0,.35,1)` 1-1.6 s, things never stop dead |
| stepped | Stop-motion | `steps(6)` or `steps(8)`, slight jitter |
| elastic | Springs, wobble | overshooting keyframes (110%, 96%, 100%) |
| cinematic | Slow, weighty, hard cuts on the hit | linear-ish drifts 3-6 s, cuts on the beat |
| glitch | RGB split, slices, jumps | `steps(1)`, clip-path slices, 1-3 frame flashes |
| handmade | Drawn, wobbly, imperfect | stroke draw-on, slight rotations, `offset-path` pens |
| physics | Gravity, bounce, mass | fall with ease-in, bounce keyframes, stagger by mass |
| typewriter | Type is the motion | per-character delays, a caret, line-by-line scroll |

Composition and camera change the look more than colour does: try a strict 12-column grid, a single
off-centre axis, full-bleed UI with text cut into it, collage with overlaps, a letterboxed film frame, a
split screen, a continuous one-take camera, a scroll.

## Earlier treatments (to step away from)

`references/techniques/treatments.html` holds twelve treatments used by earlier reels (midnight-electric,
paper-ink, swiss-grid, brutalist, editorial-serif, terminal-mono, pastel-soft, riso-print, glass-gradient,
colorblock-pop, noir-film, arcade-crt). They are reference for how a treatment is built from tokens and
texture rules. Don't reuse one as is; if the direction lands near one, change at least its type
approach, composition and motion.

## Sound belongs to the direction

Pick the music genre and SFX palette with the look, not after: a stepped, riso-printed reel wants
something tape-warm and organic SFX; a glass-gradient reel wants airy pads and soft SFX. Vary them from
recent reels like any other axis (`references/sound.md`).
