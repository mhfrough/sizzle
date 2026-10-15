---
name: sizzle
description: Make short vertical promo reels (9:16, 20-25 s, Instagram Reels / TikTok / YouTube Shorts) for a software product, as a scripted HTML animation that is approved first and then rendered frame-exact to a 4K MP4 with licensed, beat-synced music. Use when someone asks for a promo video, reel, teaser, sizzle reel, launch video or product demo clip, especially for a web app whose code is available.
license: MIT
metadata:
  version: "1.0"
  outputs: "promo/<name>-reel.html, promo/<name>-reel-script.md, promo/reel.json, videos/<name>-reel.mp4 + .webp poster"
---

# Sizzle

Sizzle turns a product into a 20-25 second vertical promo reel. The reel is built as an HTML page with a
single timeline, shown to the person as a live preview and key frames, and only after they approve it is it
rendered frame by frame to a 2160x3840 MP4 with music whose drop lands on the reel's big moment.

The method works for any agent that can read files, write files and run shell commands. Where this file
says "ask", use whatever way you have to ask the person (a question tool, or plain chat) and wait.

Paths like `templates/...`, `tools/...` and `references/...` are inside this skill's folder; below it is
written `<skill>` (for example `~/.claude/skills/sizzle`). Paths like `promo/...` and `videos/...` are in
the product's repo. Run the commands from the product's repo root.

## What you get

- `promo/<name>-reel.html`: the reel. 1080x1920 CSS, all timing in one `CUES` object, previewable in any browser.
- `promo/<name>-reel-script.md`: copy, shot list with times, claims check, music credit.
- `promo/reel.json`: render config. `videos/<name>-reel.mp4` (H.264 High, AAC, -14 LUFS) and a `.webp` poster.

## The workflow (with approval gates)

Do these in order. Never skip a gate: each one exists because rework after rendering is expensive.

### 1. Understand the product (read, don't guess)

- Read the README, the main HTML, the stylesheet and the app code. Note: the one-line promise, the 3-5 real
  features, what it does NOT do, and the claims you are allowed to make.
- Collect the brand: colour tokens (light and dark), fonts and their files, the icon set, logo/favicon,
  the share image (`og-image`), the tagline exactly as written, the live URL.
- Look for code you can run inside the reel: the product's own stylesheet classes, its renderer
  (canvas/SVG/three.js), its icon map. Real code beats screenshots: it stays sharp at 4K, animates, and
  can't drift from the real look.
- If you capture screenshots for reference, check them for private data first (real device names,
  emails, file names, tokens) and never put those in the reel. Use invented, plausible demo data.
- If the person points at reference reels, study their structure, pace and type, not their content.

### 2. Script and storyboard

Write `<name>-reel-script.md` from `templates/reel-script.md`. The proven arc for 20-25 s:

| Beat | Time | Job |
|---|---|---|
| Hook | 0-3 s | Name the pain in one line; show the old workarounds and strike them out. |
| Reveal | 3-5 s | A full-screen brand moment: mark, name, the product's own tagline. |
| Demo | 5-18 s | 2-4 beats, each "one headline + the real UI doing it". |
| Proof | 18-21 s | The promise kept: privacy, speed, free, open source, whatever is true. |
| CTA | 21-25 s | The mark, "Try X.", where to get it (URL types itself), hold ~2 s. |

Rules: one idea per headline, 2 lines max, 16 characters per line or fewer at ~100px. Every claim must be
true and traceable (fill the claims table). Read `references/craft.md` before writing copy.

### 3. Build the HTML

Start from `templates/reel-template.html`. It already has the timeline, the renderer contract, the preview
fit/replay controls and the motion vocabulary. Then:

- Swap in the brand tokens and fonts. Give each product its own look; if there is a sibling reel, make
  this one visibly different (light vs dark, different motif).
- Build the demo from the product's real parts. Link its stylesheet and use its class names inside device
  frames, or load its renderer and drive it with scripted data (see `references/case-studies.md`).
- Keep every time in `CUES`. Elements reference cues with `data-in="demo+.12"` / `data-out="proof"`, and
  JS derives CSS variables from `CUES`. Text that changes inside the UI (typing, counters, states) goes in
  `BEATS`.
- Put anything that needs a position (taps, flight paths, beams, doodles) in `measure()`, which reads
  layout unscaled and with animations off.
- Respect the safe zones: keep text out of the top ~190 px and bottom ~380 px, and keep key action away
  from the right edge below y≈1100 (platform buttons sit there).
- Copy `templates/reel.json` to `promo/reel.json` and set `name`, `page`, `out`, `poster_t` and the port.
  `root` is the folder served over HTTP, relative to the JSON file; the page's `../` links must resolve
  inside it. Set `end` in `CUES` to the reel length (the renderer makes `end` x `fps` frames).

### 4. Check it yourself before showing anyone

- Serve the project root for the live preview (`python -m http.server <port>`, then open
  `http://localhost:<port>/promo/<name>-reel.html`). `reel.py` starts its own server if nothing answers on
  the port in `reel.json`.
- Render key frames: `python <skill>/tools/reel.py stills promo/reel.json 1.5,4,7,10,13,16,19,23`, then
  look at the contact sheet `promo/.reel-work/<reel.json name>/stills/sheet.jpg` and the single PNGs next
  to it.
- Look for: stray dots or lines before their cue, elements visible too early, overlapping headlines,
  clipped or overflowing text, unreadable contrast, empty states that should be filled, console errors.
- Fix, re-render the affected times, repeat. `references/pitfalls.md` lists every bug class we have hit.

### 5. Gate: approval of the HTML

Show the person the live preview URL and the contact sheet (send the image if you can). Summarise the
beats in a few lines and ask for approval or changes. If they ordered several reels, finish and get
approval for one before starting the next.

### 6. Music (after approval only)

Follow `references/music.md`. In short: free-for-commercial-use licence, no Content ID registration, not
AI-generated (unless the person is fine with that), mood that fits the brand. Shortlist 2-3 tracks with
links, ask the person to pick and to approve the download (name the file, source and rough size). Then:

```sh
python -I <skill>/tools/music_sync.py promo/<name>-bgm.mp3 --cue <reveal time> --length <reel length>
```

Pick the offset that lands a hit on the reveal with a quieter build under the hook, and put it in
`reel.json` (`music.file` and `music.offset`).

### 7. Render and deliver

```sh
python <skill>/tools/reel.py all promo/reel.json     # frames (2160x3840 JPEG) then MP4 + poster
```

After a music change only, `python <skill>/tools/reel.py mux promo/reel.json` re-mixes the existing frames.
Check the mux summary (25.000 s, -14 LUFS, peak under -1 dBTP), pull a couple of frames from the MP4 to
confirm it decodes (PyAV: `av.open(path).decode(video=0)`), and hand over the MP4 path(s), the poster, the music credit and what is not committed.
Gitignore the work folder and, if the licence forbids redistribution, the music file.

## Setup

- Node 18+ and Playwright in the project or globally: `npm i -D playwright && npx playwright install chromium`
  (or point `PLAYWRIGHT` at an existing `node_modules/playwright`).
- Python 3.10+: `pip install -r <skill>/tools/requirements.txt` (av, numpy, scipy, opencv-python, pillow).
- No ffmpeg needed. Encoding goes through PyAV's bundled libx264.

## Files in this skill

| Path | What it is |
|---|---|
| `AGENTS.md` | Short entry point for agents that look for that file name. |
| `templates/reel-template.html` | Starter reel: timeline, renderer contract, preview, motion vocabulary, five scenes. |
| `templates/reel-script.md` | Script, shot list, claims check, music credit. |
| `templates/reel.json` | Render config for `tools/reel.py`. |
| `tools/reel.py` | One command: `stills` (+ contact sheet), `frames`, `mux`, `all`, `poster`. Serves the root itself. |
| `tools/render.js` | Playwright renderer with a fake clock: frame-exact CSS animations and JS beats. |
| `tools/mux.py` | Frames + music (+ voiceover) to MP4: H.264 High crf 16, AAC 192k, -14 LUFS, true-peak limited. |
| `tools/music_sync.py` | Finds a track's tempo and hits, and the offset that lands a hit on your cue. |
| `tools/requirements.txt` | Python packages for the tools. |
| `references/craft.md` | Story, copy, layout, motion and design rules. |
| `references/pitfalls.md` | Bugs we hit building real reels, with the fix for each. |
| `references/music.md` | Sourcing, licence checks, consent, sync and mix. |
| `references/case-studies.md` | Two finished reels (Flick, Scrawl): what was built and why. |
