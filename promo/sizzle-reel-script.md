# Sizzle reel: Your app, now showing

**Length:** 25 seconds, 9:16 vertical (1080x1920 CSS, rendered at 2x to 2160x3840, 30 fps, 750 frames)
**Goal:** show what Sizzle is in one breath: you install a skill, ask your agent for a reel, and it scripts, cuts, gets your sign-off, syncs the music and renders it. Made with Sizzle itself.
**Visuals:** `promo/sizzle-reel.html`. Sizzle has no app UI of its own, so the reel shows the real artefacts of a run: the install line, the ask, this reel's own shot list, this reel's own `CUES` object (printed from the live code), this reel's own contact sheet (stills rendered by `reel.py stills`), the track's real waveform with the real `music_sync.py` result, and the real frame count.
**Look:** the site's film-release art direction. Soft black `#111111`, surface `#1c1c1c`, ink `#f2f2f2`, muted `#a3a3a3`, one bronze accent `#a08672` (text on bronze `#111111`). Bebas Neue for poster capitals, EB Garamond for the voice, JetBrains Mono for terminal text, all loaded from `promo/fonts/`. Square corners only. Motifs: film perforations that advance between scenes, a running timecode, scene slates, a bronze gate that slams shut on the drop and bookends the reel, and the logo's film frame (10:16, perforation notches, the play triangle cut out) that the whole screen collapses into. No lime, no yellow, no rounded pills.
**Audio:** music only. The lines below double as a voiceover script.

## Script (on-screen copy, also readable as a voiceover)

> Nobody reads your README. Your app deserves a trailer.
> Your agent presents: Sizzle. Your app, now showing.
> One line to install.
> Then just ask.
> It writes the script.
> Cut on cue, in HTML.
> You approve it first.
> The drop hits the reveal.
> Rendered frame by frame.
> Sizzle. A skill for AI agents. npx skills add mhfrough/sizzle. mhfrough.github.io/sizzle

## Shot list

| Time | On screen |
|---|---|
| 0.0 - 2.9 | **Hook.** "NOBODY READS / YOUR README." in poster capitals, "Your app deserves a trailer." in italic beneath. Four workaround tags float around it (README.md · 2,400 words, screenshot-final-v3.png, demo.gif · 38 MB, walkthrough.mov · 6:12); each is struck through in bronze on the half beats, then they fall. |
| 2.95 - 5.2 | **Reveal.** On the drop, two bronze gates slam shut with a flash at the seam. The mark pops, "YOUR AGENT PRESENTS", SIZZLE rises letter by letter, "Your app, now showing." Then the poster and the bronze collapse into the film-frame mark of the brand bar lockup (mark + SIZZLE, with a running timecode). |
| 5.2 - 7.45 | **01 Install.** "ONE LINE / TO INSTALL." A terminal types `npx skills add mhfrough/sizzle`; sizzle added; Claude Code · Codex · Cursor · Gemini CLI · OpenCode. |
| 7.45 - 9.7 | **02 Ask.** "THEN JUST / ASK." The chat types "make a promo reel for this app"; the agent answers "Reading your code. Writing the script." |
| 9.7 - 11.95 | **03 Script.** "IT WRITES / THE SCRIPT." This reel's own shot list types itself, row by row; the SCRIPT row lights up. |
| 11.95 - 14.2 | **04 Cut.** "CUT ON CUE, / IN HTML." `sizzle-reel.html`: the live `CUES` object prints line by line, and each cue drops its block onto the 25 s timeline; a 9:16 preview assembles; a playhead sweeps. |
| 14.2 - 16.45 | **05 Lock.** "YOU APPROVE / IT FIRST." The contact sheet of this reel's own stills lays out, Approve is pressed, PICTURE LOCK is stamped. |
| 16.45 - 18.7 | **06 Mix.** "THE DROP HITS / THE REVEAL." `music_sync.py`: the track's real waveform slides until the drop at 57.02 s locks onto the reveal cue at 2.95 s; the result prints: offset 54.07, pre -14.6 dB, body -8.9 dB, fits yes. |
| 18.7 - 21.7 | **07 Print.** "RENDERED / FRAME BY FRAME." `reel.py all`: the frame counter runs 000 to 750 while the reel's frames pass through the gate; sizzle-reel.mp4, 2160 × 3840 · 25 s · −14 LUFS. |
| 21.7 - 25.0 | **CTA.** The bronze gate slams again: A SKILL FOR AI AGENTS, the Sizzle lockup (mark + SIZZLE, #111111 on bronze), "Your app, now showing.", the install line types itself, mhfrough.github.io/sizzle, and a film-poster billing block. Holds to the end. |

## Claims check

| Claim | Source |
|---|---|
| A skill for AI agents | README: "Sizzle is a skill that makes short vertical promo reels ... works with any AI agent that can read files and run commands." |
| `npx skills add mhfrough/sizzle` | README, Install. |
| Claude Code · Codex · Cursor · Gemini CLI · OpenCode | README: "Any agent that reads skills (Claude Code, Codex, Cursor, Gemini CLI, OpenCode and more)". |
| It reads your code, writes the script | SKILL.md steps 1-2 (read the README, HTML, stylesheet and app code; write `<name>-reel-script.md`). |
| Cut on cue, in HTML | SKILL.md step 3: the reel is an HTML page, all timing in one `CUES` object. The code on screen is printed from this reel's own `CUES` at run time. |
| You approve it first | SKILL.md steps 4-5: stills and contact sheet (`reel.py stills`), then the approval gate before music and render. The sheet on screen is this reel's own. |
| The drop hits the reveal | `tools/music_sync.py`, run on this reel's track with `--cue 2.95 --length 25`: hit 57.02 s, offset 54.07, pre -14.6 dB, body -8.9 dB, fits yes. The waveform is the track's real RMS envelope (0.25 s steps). |
| Rendered frame by frame, 750 frames, 2160 × 3840, 25 s, −14 LUFS | `tools/render.js` (fake clock, every frame seeked), `reel.py` (scale 2), `CUES.end` 25 × 30 fps = 750, `tools/mux.py` (normalised to -14 LUFS, -1 dBTP). |
| Open source, MIT | LICENSE. |
| mhfrough.github.io/sizzle | README, Site. |

## Retiming

All times live in `CUES` in `sizzle-reel.html`; scene changes sit on the track's beat grid (0.75 s from the drop at 2.95 s). Change a cue and everything tied to it moves, including the code printed in scene 04 and the timeline blocks.

## Music

**Track used:** [Upbeat Future Bass - So Easy](https://pixabay.com/music/future-bass-upbeat-future-bass-so-easy-581626/) by BombinSound, under the Pixabay Content License (free for commercial use, no credit required, not Content ID registered, not AI-generated). Saved as `promo/sizzle-bgm.mp3` (gitignored: the licence doesn't allow redistributing the track on its own).
Starts at 54.07 s, so the breakdown builds under the hook and the drop (57.02 s in the track) lands on the bronze gate at 2.95 s. Mixed at -14 dB, normalised to -14 LUFS, 1.2 s fade-out.

## Fonts

Bebas Neue, EB Garamond and JetBrains Mono, latin subsets from Google Fonts, all under the SIL Open Font License, saved in `promo/fonts/` so rendering never depends on the network.

## Render

```sh
python skills/sizzle/tools/reel.py stills promo/reel.json 1.5,4,6.5,8.8,11,13.2,15.5,17.8,20.2,23.5
python skills/sizzle/tools/reel.py all promo/reel.json
```
