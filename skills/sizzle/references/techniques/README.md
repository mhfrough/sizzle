# Techniques: a cookbook, not parts

These files hold worked examples of motion and design techniques: how a circle wipe, a scramble headline,
a halftone surface or a tilted phone is built in CSS and JS on the reel engine. **Read them to learn the
mechanics, then write your own version for this reel.** Never paste one in whole, never reuse the same
one as the signature move of two reels in a row, and never build a reel out of these alone: the reel's
look comes from its direction (`references/direction.md`), not from this folder.

The examples were written for an older slot system, so they use `{{brand}}`-style placeholders, style
tokens (`--accent`, `--ease-pop` ...) and cue names (`reveal`, `demo`, `tap1` ...) that your reel may not
have. Rename freely; the mechanics are what carry over.

| File | What it shows | Examples |
|---|---|---|
| `transitions.html` | Ways to move between acts | circle-wipe, blinds, split-doors, zoom-through, glitch-cut, ink-blob, highlighter-sweep, flash-cut, iris-letterbox, tile-flip |
| `headlines.html` | Ways for text to arrive and leave | line-mask, word-pop, char-cascade, scramble, typewriter, outline-fill, echo-stack, highlight-swipe, flip-3d, blur-focus, stamp-slam |
| `hooks.html` | Ways to show a pain fast | strike-chips, notification-pile, loading-hell, question-stack, split-before, stat-slam, tab-chaos, search-fail |
| `frames.html` | Ways to stage a UI | phone, laptop-phone, browser-window, app-fullbleed, exploded-cards, tilted-phone, polaroid-board |
| `ctas.html` | Ways to end | url-pill, search-type, button-press, stamp-badge, terminal-cmd, end-card, big-type, sticker-pile |
| `backgrounds.html` | Surfaces | dots-glow, grid-lines, film-grain, gradient-mesh, halftone, scanlines, paper-grain, starfield, diagonal-stripes, colorblock-shift |
| `treatments.html` | Whole visual treatments as token sets plus texture rules | midnight-electric, paper-ink, swiss-grid, brutalist, editorial-serif, terminal-mono, pastel-soft, riso-print, glass-gradient, colorblock-pop, noir-film, arcade-crt |

## How to use one well

1. Find the mechanism: which property animates, what is masked or clipped, what the script measures.
2. Change at least two of: shape, direction, timing curve, colour logic, scale, what triggers it. A circle
   wipe can become a wipe shaped like the product's icon, coming from where the last tap landed.
3. Tie it to this product: the best moves come from the product itself (its icon, its core gesture, what
   its data looks like), not from a list.
4. Keep the engine's rules: every time from a cue, hidden before its cue, gone after its out, positions
   measured in `R.onMeasure`.

## Rules the engine needs (whatever you build)

- **Never hard-code a time.** Use cue variables (`var(--reveal)`) or `data-in="cue+.2"` / `data-out="cue"`
  (which set `--d` / `--o` on the element), `data-at="cue"` (sets `--at`), `data-s="cue"` (sets `--s`).
  Durations (`.6s`) are fine.
- **Invisible before its cue, gone after its out.** First keyframe hidden with fill `both`; exits `forwards`.
- **Positions** come from `R.onMeasure(fn)` with `R.box(el)` (canvas pixels, animations off).
- **Text changes** go through `R.beat(t, fn)` or `R.type(el, text, t0, cps)`, never `setTimeout` or
  `requestAnimationFrame` (the renderer drives a fake clock).
- **Prefix your classes and keyframes** per scene (`s3-`, `@keyframes s3Fold`) so scenes never collide.

## Engine helpers (`R`)

| Helper | What it does |
|---|---|
| `R.C` / `CUES` | The cues object. `R.W`, `R.H`: the canvas size. |
| `R.at('demo+.2')` | Cue expression to seconds. |
| `R.beat(t, fn)` | Run `fn` at reel time `t` (a number or cue expression): frame-exact in render, CSS-clock synced in preview. |
| `R.type(el, text, t0, cps)` | Type `text` into `el` from `t0` at `cps` characters per second. |
| `R.split(el, 'chars' or 'words')` | Wrap each char/word in a span `.c` / `.w` with `--i`; sets `--n` on `el`. |
| `R.onMeasure(fn)` | Run `fn` with the reel unscaled and animations off; use `R.box(el)` for canvas-pixel boxes. |
| `R.render` | True when the renderer drives the page. |
| `.r-fit` | Class for big text that must not overflow: shrunk to fit its parent (child spans are lines). |
