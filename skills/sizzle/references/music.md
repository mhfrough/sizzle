# Music: sourcing, licence, consent, sync, mix

Music comes last, after the visuals are approved, so the cut is final when you sync it.

## Sourcing checklist

A track qualifies only if all of these hold:

- **Licence** allows commercial use without attribution in videos (e.g. the Pixabay Content License).
  Record the licence name and the track URL in the script's Music section.
- **No Content ID / copyright-claim registration.** Pixabay shows "Content ID Registered" on such tracks;
  those trigger claims on YouTube and Instagram even when the licence is fine. Skip them.
- **Not AI-generated**, unless the person says that's fine (Pixabay labels these "AI generated").
- **Mood matches the brand**: e.g. bright future bass for a fast utility, playful pizzicato for a
  sketchbook. Prefer tracks with a clear build-then-drop or a distinct hit you can land on the reveal.
- **Long enough** for the window you need after the offset (reel length + ~1 s).

On Pixabay you can fetch a track page's HTML and read: duration (`"duration":"PT1M43S"`), the
"Content ID Registered" and "AI generated" labels, and the CDN MP3 URL. Search pages list track URLs.

## Consent

Downloading a file is an action the person should approve. Give them a shortlist of 2-3 tracks per reel
with preview links, artist, length and mood, and ask them to pick. In the same question, state the file
name, the source host and the approximate size. Download only what they approved.

## Sync

```sh
python -I <skill>/tools/music_sync.py promo/<name>-bgm.mp3 --cue <reveal time> --length <reel length>
```

It prints tempo, a loudness strip, and candidate hits with the offset that lands each one on your cue.
Pick a row where:

- `fits` is yes (the window ends before the track does),
- `pre` (under the hook) is quieter than `body`: a build into the reveal feels intentional,
- any `dips` fall on your scene changes rather than mid-beat.

Put the offset in `reel.json` under `music.offset`. After a music change, `reel.py mux` re-mixes the
existing frames; no need to render them again.

## Mix

`tools/mux.py` does it: music gain -14 dB before normalisation, 0.4 s fade-in, 1.2 s fade-out, whole mix
normalised to -14 LUFS integrated (BS.1770-4) with a true-peak limiter at -1 dBTP, AAC 192 kb/s 48 kHz.
With a voiceover, music ducks 9 dB under speech automatically.

## Repo hygiene

Many free licences forbid redistributing the track on its own. Keep the MP3 out of public repos
(`.gitignore` it); the rendered MP4 is fine to publish.
