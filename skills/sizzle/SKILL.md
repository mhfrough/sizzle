---
name: sizzle
description: Make short promo reels and videos (Instagram Reels, TikTok, YouTube Shorts, feeds, landing pages; 9:16, 4:5, 1:1 or 16:9, about 6-60 s) for a product, written from its brief or concept, built from scratch as a scripted HTML animation, approved first, then rendered frame-exact to a 4K MP4 with royalty-free music and sound effects. No templates: every reel gets its own concept, script, look, motion and sound, checked against every earlier reel so no two look or sound alike. Use when someone asks for a promo video, reel, teaser, sizzle reel, launch video, ad or product demo clip, especially for a web app whose code is available.
license: MIT
metadata:
  version: "3.0"
  outputs: "promo/<name>-reel-script.md (brief, concepts, script), promo/<name>-reel.html, promo/reel.json (render config, direction, sound cues), promo/sfx/, videos/<name>-reel.mp4 + .webp poster"
---

# Sizzle

Sizzle turns a product and its brief into a short promo reel. The reel is an HTML page with one
timeline, written for this reel alone, shown to the person as a live preview and key frames. Only after
they approve it is it rendered frame by frame to a 4K MP4, with music and sound effects placed on the
reel's own moments.

**No template, no two alike.** There is no starter look, no fixed story shape and no fixed length.
Each reel starts from a brief, gets a concept and a script of its own, then a written *direction* (format,
palette, type, motion, camera, composition, opening, ending, signature move, music genre, SFX palette)
that `tools/fingerprint.py` checks against every reel made before, across all projects. If it is too close
to an earlier reel, change the direction until it passes. The page is then built from scratch on a bare
engine (`templates/reel-engine.html`) that only handles timing and rendering.

The method works for any agent that can read files, write files and run shell commands. Where this file
says "ask", use whatever way you have to ask the person (a question tool, or plain chat) and wait.

Paths like `templates/...`, `tools/...` and `references/...` are inside this skill's folder; below it is
written `<skill>` (for example `~/.claude/skills/sizzle`). Paths like `promo/...` and `videos/...` are in
the product's repo. Run the commands from the product's repo root.

## What you get

- `promo/<name>-reel-script.md`: brief, the concepts offered, the approved script with a sound column,
  claims check, direction, music and SFX credits.
- `promo/<name>-reel.html`: the reel, previewable in any browser; all timing in one `CUES` object.
- `promo/reel.json`: render config, the direction, the sound cues. `promo/sfx/`: the sound effects used.
- `videos/<name>-reel.mp4` (H.264 High, AAC, -14 LUFS) and a `.webp` poster.

## The workflow (with approval gates)

Do these in order. Never skip a gate: each one exists because rework after rendering is expensive.

### 1. Brief: understand the product and what this reel is for

- Read the README, the main HTML, the stylesheet and the app code. Note: the one-line promise, the 3-5 real
  features, what it does NOT do, and the claims you are allowed to make.
- Collect the brand: colour tokens, fonts and their files, icons, logo, the tagline exactly as written,
  the live URL. Look for code you can run inside the reel (its stylesheet classes, its renderer, its icon
  map): real code beats screenshots, stays sharp at 4K and can't drift from the real look.
- Take the person's brief, concept, script idea or references if they gave any; they come first. If they
  gave none, ask briefly (one question, with your guesses as defaults) for what matters most: who it is
  for, where it will run (sets the format), the one thing a viewer should do after, the feeling. Don't
  block on it: when they don't know, decide from the product and say what you decided.
- Write the **Brief** section of `promo/<name>-reel-script.md` (from `templates/reel-script.md`):
  audience, platform and format, length, the single message, the feeling, the call to action, must-show
  features, claims allowed, things to avoid, brand assets.
- Screenshots for reference: check them for private data first (real names, emails, devices, tokens) and
  never put those in the reel. Use invented, plausible demo data.

### 2. Concepts: three different ideas

- Run `python <skill>/tools/fingerprint.py fresh` to see what recent reels already used (concept, format,
  tone, motion, opening, music ...).
- Read `references/concepts.md`. Write **three concepts** for this brief that differ from each other *and*
  from recent reels on concept type, structure and feeling. Each gets: a title, a one-line logline, the
  opening image (first second), the shape of the middle, the ending, the signature move people will
  remember, the format and length, and the sound idea (music genre or none, the SFX character).
- Invent; don't fill in a pattern. A concept should only make sense for *this* product (its gesture, its
  data, its users' day), never be a slot you could drop any app into.
- Ask the person to pick one (or mix them). If they gave a concept in step 1, develop it and offer two
  alternatives anyway.

### 3. Script (gate 1: script approval)

- Write the **Script** section from the chosen concept: one row per beat with its time, what is on screen,
  the on-screen words, the voiceover line if any, and the **sound** (music section, SFX). The concept sets
  how many beats there are, how long each lasts and the total length. There is no required hook, reveal,
  demo or proof beat: use what the concept needs.
- Copy rules (`references/craft.md`): every claim true and traceable (fill the claims check), short lines
  people say out loud, readable time on screen (about 1 s per 3 words, never under 0.8 s).
- Show the person the script (logline, beats table, words, sound) and **ask for approval**. Change it
  until they approve. Nothing is built before this yes.

### 4. Direction (the look, checked for freshness)

- Read `references/direction.md`. Write the reel's **direction** from the concept and the brand: format and
  canvas size, palette roles, type pairing and scale, motion language and easing, camera, composition
  rule, texture, how the UI appears, the opening and ending frames, the signature move, music genre and
  BPM, SFX palette. Write it in words in the script file and as the `direction` object in `promo/reel.json`
  (start from `templates/reel.json`; set `width` / `height` to the canvas).
- Run `python <skill>/tools/fingerprint.py check promo/reel.json`. On **FAIL**, change the axes it names
  (and anything else that drifts toward an earlier reel) and run it again until it passes. A WARN is a
  prompt to push one more axis further. Don't lower the bar, and don't override the brand to pass: move
  the treatment (type scale, composition, motion, camera, texture, palette roles) instead.

### 5. Build the HTML from scratch

- Copy `templates/reel-engine.html` to `promo/<name>-reel.html`. Set `SIZE` to the canvas and `CUES` to the
  script's beats (name cues after them: `cold`, `fold1`, `drop`, `end` ...). Keep the parts marked ENGINE.
- Write everything else for this reel: tokens from the direction, the scenes, the motion. Load the
  product's fonts with `@font-face` (or the direction's display face; `templates/fonts/` has three OFL
  faces). Link the product's stylesheet or load its renderer and drive it with scripted data
  (`references/case-studies.md` shows two ways).
- `references/techniques/` is a cookbook of worked techniques (transitions, text animation, hooks, frames,
  endings, surfaces). Learn the mechanics there, then write this reel's own version. Never paste a
  technique wholesale, and never repeat the last reel's signature move.
- Timing: every time lives in `CUES`. Elements use `data-in="cue+.12"` / `data-out="cue"`, or
  `var(--cue)` in CSS. Text that changes uses `R.beat` / `R.type`. Positions (taps, flight paths, beams)
  go in `R.onMeasure` with `R.box(el)`.
- Safe zones for the platform you target: on 9:16 keep text out of the top ~10% and bottom ~20%, and key
  action away from the right edge in the lower half (platform buttons sit there). 4:5 and 1:1 feeds crop
  less; 16:9 has none. Read `references/craft.md`.
- In `promo/reel.json` check `name`, `page`, `width`, `height`, `out`, `poster_t` and the port. `root` is
  the folder served over HTTP, relative to the JSON file; the page's `../` links must resolve inside it.

### 6. Check it yourself before showing anyone

- Render key frames: `python <skill>/tools/reel.py stills promo/reel.json <times>` (start, middle and end
  of every beat), then look at the contact sheet `promo/.reel-work/<name>/stills/sheet.jpg` and the PNGs.
  `reel.py` starts its own server if nothing answers on the port in `reel.json`.
- Look for: elements visible too early, stray dots or lines, overlapping or clipped text, unreadable
  contrast, empty states, console errors. `references/pitfalls.md` lists every bug class we have hit.
- Run `python <skill>/tools/fingerprint.py look promo/reel.json`: it compares these stills with the stills of
  earlier reels. On FAIL the reel *looks* like an earlier one even if its direction differs on paper: change
  the palette roles, composition or scale of the scenes it matches, re-render, re-check.

### 7. Gate 2: approval of the picture

Show the person the live preview URL (`python -m http.server <port>`, then
`http://localhost:<port>/promo/<name>-reel.html`) and the contact sheet. Say in a few lines how it follows
the approved script and what makes its look its own. Ask for approval or changes. If they ordered several
reels, finish and get approval for one before starting the next; each gets its own concept and direction.

### 8. Sound: music and sound effects (after picture approval)

Follow `references/sound.md`. The music genre and SFX palette come from the direction, so they differ from
recent reels too.

- **Music**, one of: a sourced royalty-free track (shortlist 2-3 with links, licence, Content ID status;
  ask the person to pick and to approve the download, naming the file, host and rough size), or a
  generated bed when they prefer nothing downloaded or nothing fits:
  `python <skill>/tools/synth.py bed promo/<name>-bed.wav --genre <genre> --length <end> --drop <cue> --outro <cue> --seed <n>`
  (its downbeat lands exactly on the drop, so its offset is 0). For a sourced track, find the offset with
  `python -I <skill>/tools/music_sync.py <track> --cue <big moment> --length <end>`.
- **SFX**: make a kit in the direction's palette, `python <skill>/tools/synth.py kit promo/sfx --palette <palette> --seed <n>`,
  or single sounds with `synth.py sfx <kind> ...`, or source them (licence rules in `references/sound.md`,
  ask before downloading). Place each on a cue in `reel.json` `sfx`: `{"file": "promo/sfx/whoosh.wav",
  "at": "fold1-.25", "gain_db": -9, "pan": -0.3}`. Sound only what matters: transitions, the big moment,
  taps you want felt, typing, the ending. Silence and one well-placed hit beat a sound on every move.
- Put music in `reel.json` (`music.file`, `music.offset`), and the credits in the script file.

### 9. Render, verify, record

```sh
python <skill>/tools/reel.py all promo/reel.json     # frames then MP4 (music + SFX) + poster
```

After a sound change only, `python <skill>/tools/reel.py mux promo/reel.json` re-mixes the existing frames.
Check the mux summary (duration = `end`, -14 LUFS, peak under -1 dBTP, the SFX count you expect), pull a
couple of frames from the MP4 to confirm it decodes (PyAV: `av.open(path).decode(video=0)`), then
**record the reel** so future reels stay away from it:

```sh
python <skill>/tools/fingerprint.py record promo/reel.json
```

Hand over the MP4, the poster, the concept and direction in one line each, the music and SFX credits, and
what is not committed. Gitignore the work folder and, if a licence forbids redistribution, the audio file.

## Setup

- Node 18+ and Playwright in the project or globally: `npm i -D playwright && npx playwright install chromium`
  (or point `PLAYWRIGHT` at an existing `node_modules/playwright`).
- Python 3.10+: `pip install -r <skill>/tools/requirements.txt` (av, numpy, scipy, opencv-python, pillow).
- No ffmpeg needed. Encoding goes through PyAV's bundled libx264.

## Files in this skill

| Path | What it is |
|---|---|
| `AGENTS.md` | Short entry point for agents that look for that file name. |
| `templates/reel-engine.html` | The bare engine: canvas size, `CUES`, `R` helpers, renderer contract, preview. No look, no scenes. |
| `templates/reel-script.md` | Brief, concepts, script with sound column, claims check, direction, credits. |
| `templates/reel.json` | Render config, direction and sound cues for the tools. |
| `templates/fonts/` | Three OFL display faces (Bebas Neue, EB Garamond, JetBrains Mono) for when a direction calls for them. |
| `tools/reel.py` | One command: `stills` (+ contact sheet), `frames`, `mux`, `all`, `poster`. Serves the root itself. |
| `tools/render.js` | Playwright renderer with a fake clock: frame-exact CSS animations and JS beats, any canvas size. |
| `tools/mux.py` | Frames + music + SFX (+ voiceover) to MP4: H.264 High crf 16, AAC 192k, -14 LUFS, true-peak limited. |
| `tools/synth.py` | Royalty-free sound from scratch: 20 SFX kinds, 6 kit palettes, music beds in 9 genres. |
| `tools/music_sync.py` | A sourced track's tempo and hits, and the offset that lands a hit on your cue. |
| `tools/fingerprint.py` | Keeps reels different: `fresh`, `check` (direction), `look` (stills), `record`. |
| `tools/requirements.txt` | Python packages for the tools. |
| `references/concepts.md` | Concept types and how to invent one for this product. |
| `references/direction.md` | Building a fresh direction: the axes, brand merge, variety rules. |
| `references/sound.md` | Music and SFX: sources, licences, consent, the synth, placement, sync, mix. |
| `references/craft.md` | Story, copy, layout, motion and design principles. |
| `references/techniques/` | Cookbook of worked motion and design techniques to learn from, not to paste. |
| `references/pitfalls.md` | Bugs we hit building real reels, with the fix for each. |
| `references/case-studies.md` | Two finished reels: what was built and why. |
