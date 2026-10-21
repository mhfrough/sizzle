# Craft: story, copy, layout, motion, design

Principles, not a recipe. The concept and direction decide the shape; these keep any shape working.

## Story

- **One message.** A reel sells one sentence. Every beat sets it up, shows it working, or removes a doubt.
  If a beat does none of these, cut it.
- **The first second earns the rest.** Something is on screen and moving by 0.15 s, and it is the most
  interesting thing you have: a question, a mid-action frame, a number, a sound on black, an object.
  Vary the kind of opening from recent reels.
- **A turn.** Every reel has a moment where things change (the reveal, the drop, the answer, the click).
  The music's hit or the biggest SFX lands there. It does not have to be at 3 s or be a logo.
- **Show, don't list.** The real UI doing the thing beats a sentence about it. Three moments of use is
  plenty; four is the most a 25 s reel holds.
- **Doubt before the ask,** when there is one people really have (privacy, price, sign-up, lock-in),
  stated plainly and only if true.
- **An ending people can act on.** Name, the action, where (URL, store, handle), held long enough to read
  and screenshot (about 2 s). The form of the ending comes from the direction: a typed URL, a pressed
  button, a loop, a sticker, a sign-off.

## Copy

- Use the product's own words (README, tagline, UI labels). Don't invent features, numbers or comparisons.
- Words people say out loud: "Send it." beats "Frictionless cross-device content delivery".
- Reading time: about 1 s per 3 words on screen, never under 0.8 s for a line.
- Line length depends on the type approach: a giant condensed face fits 6-10 characters a line on 9:16; a
  caption style fits 30. If a line overflows, cut words before shrinking the type.
- Write so the script can double as a voiceover (short sentences, natural rhythm).

## Layout

- Canvas sizes: 9:16 is 1080x1920, 4:5 is 1080x1350, 1:1 is 1080x1080, 16:9 is 1920x1080 (CSS px, rendered 2x).
- Safe zones on 9:16 platforms: the top ~190 px, the bottom ~380 px and a right-hand column of buttons from
  y≈1100 down are covered by platform UI. Nothing that must be read goes there. 4:5 and 1:1 feeds crop the
  caption area only; 16:9 has no overlay.
- The composition rule from the direction holds for the whole reel; break it once, on purpose, at the turn.
- Devices are one option among many (full-bleed UI, exploded layers, fragments, a cursor on a desktop).
  When you use one, render its screen with CSS `zoom` (crisp text at 4K), not `transform: scale`.

## Motion

- One motion language per reel (`references/direction.md`), with its easing, applied to everything.
- Hierarchy: the big moment moves the most; everything else moves less so it reads as big.
- Pace: something moves about every 0.5 s, but a line of copy gets its full reading time still.
- Stroke draw-on: `pathLength="1"`, `stroke-dasharray:1 2`, animate `stroke-dashoffset` 1 to 0; a pen
  following the same path (`offset-path`) makes it feel made by hand.
- Flights ("it moved from here to there"): `offset-path` on a curve, measured in `R.onMeasure`.
- Taps and clicks: show the press on the frame it happens and sound it there.
- Transitions are part of the signature: design one for this reel (from the product's icon, its gesture)
  rather than reusing a stock wipe. `references/techniques/` shows the mechanics.
- Background life never competes with text.

## Design

- The product's palette (in the direction's roles), its fonts unless the direction's type approach
  replaces the display face, its icons and logo.
- Demo data looks real and friendly: plausible names, "sunset.jpg 4.2 MB", "Lunch at 1? Pizza's on me."
  Never real people's data.
- Dark scenes: inherited text colours don't re-resolve, so set `color:var(--ink)` on the dark container.
  Highlight-behind-text styles that work on light paper often fail on dark.
- Before you show anyone: does a frame from this reel look like a frame from the last one? If yes, change
  the composition or scale of that scene (`fingerprint.py look` checks this).
