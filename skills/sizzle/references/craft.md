# Craft: story, copy, layout, motion, design

The thinking behind the reels. Read before writing the script.

## Story

- **One promise.** A reel sells one sentence (e.g. "send a file to the screen next to you"). Every beat
  either sets up the pain, shows the promise working, or removes a doubt.
- **Hook in the first second.** Text is on screen by 0.15 s. Start with the viewer's pain, phrased as a
  question they'd answer "yes" to ("Still emailing files to yourself?"). Show the workarounds they use
  today, then strike them out: it makes the pain concrete without a word of explanation.
- **Reveal at ~3 s.** A full-screen brand moment (colour burst, logo, name, the product's own tagline).
  This is where the music should hit.
- **Show, don't list.** Each demo beat is a headline plus the real UI doing exactly that thing: a tap, a
  file flying across, a shape drawing itself. Three beats is plenty; four is the maximum in 25 s.
- **Proof before the ask.** One beat that removes the doubt people actually have (privacy, cost,
  sign-up, lock-in), stated plainly and only if true.
- **CTA with a hold.** Mark, "Try X.", a short reassurance ("Free, in any browser."), the URL typing
  itself, and ~2 s of hold so people can read and screenshot it.

## Copy

- Headlines: 2 lines max, about 16 characters per line at 100-110 px. Second line is the payoff, in the
  accent colour or the brand's "hand" style.
- Use the product's own words (README, tagline, UI labels). Don't invent features, numbers or comparisons.
- Prefer verbs and nouns people say out loud: "Send it." beats "Frictionless cross-device content delivery".
- If a line overflows, cut words before shrinking the type.
- Write the script so it can double as a voiceover later (short sentences, natural rhythm).

## Layout (1080x1920)

- Persistent brand pill at y≈196 after the reveal: mark, name, a 5-word descriptor.
- Headline zone y≈320-560, centred. The demo lives below it (y≈600-1450).
- Safe zones: platform UI covers roughly the top 190 px, the bottom 380 px, and a right-hand column of
  buttons from y≈1100 down. Nothing that must be read goes there.
- Devices: a laptop above and a phone in front works for "two screens"; a single centred phone works for
  mobile-first products; a full-bleed app frame (rail + header) works for canvas/editor apps.
- Render device screens with CSS `zoom` (crisp text at 4K), not `transform: scale`.

## Motion vocabulary

- **Line mask reveal** for headlines: each line slides up out of its own `overflow:hidden` box (1 s,
  ease-out-expo), leaves upward faster (0.45 s, ease-in). Stagger lines by 0.12 s.
- **Pop** (`cubic-bezier(.34,1.56,.64,1)`) for chips, pills, icons and arrivals.
- **Draw-on** for strokes: `pathLength="1"`, `stroke-dasharray:1 2`, animate `stroke-dashoffset` 1 to 0.
  A pen or cursor following the same path (CSS `offset-path`) makes it feel hand-made.
- **Flight** for "it moved from here to there": `offset-path` on a cubic curve, lift-hover-fly keyframes,
  a comet trail of dots with small delays, and a streak path drawn in sync.
- **Taps**: a translucent dot that presses (scale .78) plus an accent ring that expands. Cursor arrow for
  desktop clicks.
- **Transitions between acts**: a brand-colour circle wipe that collapses into the brand pill, a giant
  highlighter stroke that sweeps the screen, a dark-mode circle reveal from a button. Pick one signature
  transition per product and reuse it at the CTA.
- Background life: a subtle pattern (dots, grid), two very slow drifting glows, slow radar rings. Never
  busy enough to compete with text.
- Pace: something moves every ~0.5 s, but a headline gets at least ~1.2 s fully on screen.

## Design

- The product's own palette, fonts and icons only. Copy tokens from its stylesheet; load its font files.
- Give each product a distinct reel identity: e.g. one dark with an electric accent, the next light paper
  with a highlighter yellow. Same structure, different feel.
- Demo data should look real and friendly: plausible device names, a "sunset.jpg 4.2 MB", a short note
  like "Lunch at 1? Pizza's on me." Never real people's data.
- Dark scenes: inherited text colours don't re-resolve, so set `color:var(--ink)` on the dark container.
  Highlight-behind-text styles that work on light paper often fail on dark: switch to accent-coloured
  text with an underline swipe.
