# Sizzle (agent entry point)

This folder is a skill for making short promo reels (9:16, 4:5, 1:1 or 16:9, about 6-60 s) for products:
a script written from the product's brief, built from scratch as an HTML animation, approved by the person,
then rendered frame-exact to a 4K MP4 with royalty-free music and sound effects. There are no templates:
every reel gets its own concept, look, motion and sound, and no two reels may look or sound alike.

**When a task asks for a promo video, reel, teaser, sizzle reel, ad or launch clip, read `SKILL.md` in this
folder and follow it step by step.** It links to the templates, tools and references you need.

Non-negotiables, whichever agent you are:

1. Read the product's code and docs before writing a word. Every on-screen claim must be true.
2. Start from the brief: offer three different concepts, write the script from the chosen one, and get
   the script approved before building anything.
3. Write a direction for this reel and pass `tools/fingerprint.py check`; never copy an earlier reel's
   look, structure, signature move or music genre. Build the page from scratch on `templates/reel-engine.html`.
4. Use the product's real styles or renderer, with invented demo data. No private data.
5. All timing lives in the `CUES` object. Measure positions with animations off.
6. Check rendered stills yourself (and `fingerprint.py look`), then get the person's approval of the
   picture before rendering video.
7. Sound: music and SFX that are free for commercial use, no Content ID, or made with `tools/synth.py`.
   Ask before downloading anything.
8. Render with `tools/reel.py`, verify the MP4 (duration, -14 LUFS, decodes), `fingerprint.py record` it,
   and report what was and wasn't done.
