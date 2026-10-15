# Sizzle (agent entry point)

This folder is a skill for making short vertical promo reels (9:16, 20-25 s) for software products:
a scripted HTML animation, approved by the person first, then rendered frame-exact to a 4K MP4 with
licensed, beat-synced music.

**When a task asks for a promo video, reel, teaser, sizzle reel or launch clip, read `SKILL.md` in this
folder and follow it step by step.** It links to the templates, tools and references you need.

Non-negotiables, whichever agent you are:

1. Read the product's code and docs before writing a word. Every on-screen claim must be true.
2. Build the reel from the product's real styles or renderer, with invented demo data. No private data.
3. All timing lives in the `CUES` object. Measure positions with animations off.
4. Check rendered stills yourself, then get the person's approval on the HTML before rendering video.
5. Music: free for commercial use, no Content ID, not AI-generated unless agreed. Ask before downloading.
6. Render with `tools/reel.py`, verify the MP4 (duration, -14 LUFS, decodes), report what was and wasn't done.
