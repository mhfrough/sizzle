# Sound: music and sound effects

Sound comes after the picture is approved, so the cut is final when you place it. The music genre and the
SFX palette come from the direction and should differ from recent reels (`fingerprint.py fresh`).

A reel's sound has up to three layers:

1. **Music**: a sourced royalty-free track, a generated bed, or nothing (some concepts are stronger with
   only SFX and silence).
2. **SFX**: the sounds of things happening on screen.
3. **Voiceover** (optional): `reel.json` `voiceover`; the music ducks under speech automatically.

## Music, option A: a sourced track

A track qualifies only if all of these hold:

- **Licence** allows commercial use in videos. Record the licence name, the artist, the track URL, and any
  credit the licence requires, in the script's Sound section.
- **No Content ID / copyright-claim registration** (Pixabay shows "Content ID Registered"; skip those,
  they trigger claims on YouTube and Instagram even when the licence is fine).
- **Not AI-generated**, unless the person says that's fine (Pixabay labels these).
- **Fits the direction's genre and tempo**, with a clear hit or drop you can land on the big moment.
- **Long enough** for the reel after the offset (length + ~1 s).

Sources (always read the licence on the track's own page; terms change):

| Source | Music | SFX | Licence notes |
|---|---|---|---|
| Pixabay (pixabay.com/music, /sound-effects) | yes | yes | Pixabay Content License: commercial use, no credit needed. Skip "Content ID Registered" and, unless agreed, "AI generated". |
| Mixkit (mixkit.co) | yes | yes | Mixkit licences: free for commercial use; check the item's licence (music vs SFX terms differ). |
| Free Music Archive (freemusicarchive.org) | yes | no | Per track Creative Commons. Use CC0 or CC BY (credit the artist); avoid NC (non-commercial) and ND for promos. |
| Incompetech (incompetech.com) | yes | no | CC BY 4.0: credit Kevin MacLeod in the video description or credits. |
| Freesound (freesound.org) | loops | yes | Per sound: filter to CC0 (no credit); CC BY needs credit; avoid CC BY-NC. Needs a login to download, so the person downloads. |
| YouTube Audio Library (studio.youtube.com) | yes | yes | Downloaded by the person from YouTube Studio; some tracks require attribution; read the terms for use outside YouTube. |

On Pixabay you can fetch a track page's HTML and read the duration, the Content ID and AI labels and the
CDN MP3 URL; search pages list track URLs.

**Consent:** downloading is an action the person approves. Shortlist 2-3 tracks with preview links,
artist, length, genre and licence; ask them to pick; name the file, the host and the rough size in the
same question. Download only what they approve.

**Sync:** `python -I <skill>/tools/music_sync.py promo/<name>-bgm.mp3 --cue <big moment> --length <end>`
prints tempo, a loudness strip and candidate hits with the offset that lands each on your cue. Pick a row
where `fits` is yes, `pre` is quieter than `body`, and `dips` fall on scene changes. Put it in
`reel.json` `music.offset`. If the track's beat is strong, nudge cues onto its beats (`CUES` only).

## Music, option B: a generated bed

`tools/synth.py bed` makes a backing track from scratch (numpy synthesis: no samples, no licence, no
download, no Content ID). Its bar grid is built so a downbeat lands exactly on `--drop`, with a quieter
intro and a riser into it.

```sh
python <skill>/tools/synth.py list     # genres: house lofi synthwave techno ambient chiptune trap pluckpop cinematic
python <skill>/tools/synth.py bed promo/<name>-bed.wav --genre lofi --length 18 --drop 2.4 --outro 15 --seed 41
```

- `--length` = `CUES.end`, `--drop` = the big moment, `--outro` = where drums drop out (often the CTA).
- `--bpm`, `--key`, `--scale` override the genre's defaults; a new `--seed` gives a new progression,
  key and groove. Never reuse a seed and genre from an earlier reel.
- It writes `<out>.grid.json` with the downbeat times: snap scene changes to them for a cut that feels
  edited to the music.
- Offset is 0 (`music.offset`). It is sketch quality: say so, and offer a sourced track when the reel
  matters a lot.

## Sound effects

### Making them

`tools/synth.py` makes 20 kinds (`synth.py list`): whoosh, swipe, riser, reverse, impact, boom, subdrop,
click, tick, pop, snap, thud, chime, notif, error, shimmer, glitch, tape, key, type.

```sh
python <skill>/tools/synth.py kit promo/sfx --palette organic --seed 41       # a matched set
python <skill>/tools/synth.py sfx riser promo/sfx/riser.wav --len 1.6 --pitch -3 --seed 41
python <skill>/tools/synth.py sfx type promo/sfx/type-url.wav --chars 18 --cps 24  # matches R.type(el, url, t, 24)
```

Kit palettes: **digital** (bright clicks, notifs, glitch), **organic** (snaps, thuds, soft keys),
**cinematic** (booms, risers, sub drops), **retro** (bit-crushed, 8-bit), **soft** (gentle pops, chimes),
**glitch** (stutters, ticks, sub). `--pitch` (semitones), `--bright` (0-1), `--reverb`, `--crush` shape
single sounds. Use a new seed per reel.

Or source SFX from the table above under the same licence and consent rules.

### Placing them

In `reel.json`, each event sits on a cue (resolved from the page's `CUES` at render time):

```json
"sfx": [
  {"file": "promo/sfx/riser.wav",  "at": "drop-1.6", "gain_db": -10},
  {"file": "promo/sfx/impact.wav", "at": "drop",     "gain_db": -6},
  {"file": "promo/sfx/swipe.wav",  "at": "card2-.1", "gain_db": -12, "pan": 0.4},
  {"file": "promo/sfx/click.wav",  "at": "tap1",     "gain_db": -14},
  {"file": "promo/sfx/type-url.wav", "at": "url",    "gain_db": -16}
],
"sfx_duck_db": -4
```

- `at`: seconds or a cue expression. Risers and reverse swells *end* on the moment: `at` = cue minus
  their length (`kit.json` lists lengths).
- `gain_db` (default -6), `pan` (-1 left to 1 right; follow on-screen motion), `from` / `len` / `fade` to
  use part of a file.
- The music dips by `sfx_duck_db` under the SFX so hits read without a loud mix.

### Taste

- Sound the **story**, not every animation: the big moment, scene transitions, the taps you want felt,
  typing that matters, the ending. 5-15 events in 20 s is typical; a manifesto may want three.
- One family per reel (the kit's palette). Mixing a cartoon pop with a cinematic boom breaks the world.
- Leave air: a beat of silence before the hit makes it land.
- Match motion: a whoosh's peak sits at the middle of the move; a click on the press frame, not the ring.
- Quieter than you think: SFX under the music by 6-14 dB, except the one big hit.

## Mix

`tools/mux.py` does it: music at `gain_db` (default -14 dB) with a 0.4 s fade-in and `fade_out`, SFX bus
on top with the music dip, VO ducking, the whole mix normalised to -14 LUFS (BS.1770-4) with a true-peak
limiter at -1 dBTP, AAC 192 kb/s 48 kHz. After any sound change, `reel.py mux` re-mixes the existing
frames.

## Credits and repo hygiene

- List every sourced track and sound with title, author, URL and licence in the script's Sound section;
  put required credits where the licence says (video description, end card).
- Generated sound: note "music and SFX generated with sizzle synth.py, seed N".
- Many licences forbid redistributing the files alone: keep sourced audio out of public repos
  (`.gitignore` it). The rendered MP4 is fine to publish.
