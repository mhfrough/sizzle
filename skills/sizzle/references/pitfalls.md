# Pitfalls (and the fix for each)

Every one of these happened while building real reels. Check rendered stills for them before showing
anyone.

| Symptom | Cause | Fix |
|---|---|---|
| A short lime/ink bar or dot sits on screen from frame 0 | An animated stroke's first keyframe made it visible before its cue (`opacity:1` at 0%, or fill-mode `both`). | Start invisible: `0%{visibility:hidden} 0.1%{visibility:visible}`; for decorative streaks use `opacity:0` until the flight begins. |
| A 6 px dot at the end of an "invisible" line | Round line caps: with `stroke-dasharray: L L`, the next dash starts exactly at the path end and draws a cap. | Make the gap longer than the path: `L (L+40)` or `1 2` with `pathLength="1"`; or use butt caps. |
| Cards, list items or a received file appear before their cue | The product's stylesheet has a more specific rule (e.g. `.screen .item{animation:none}`) that beats your reel rule. | Match or exceed specificity: `.screen .item.reel-arrive{...}`. Check computed `animation` in the browser if unsure. |
| Positions are `NaN`, paths empty (`MNaN NaN`) in the preview | Measured while the preview container was scaled to 0 (hidden pane) or mid-animation. | Measure with `transform:none` on the reel and a `.measure` class that sets `animation:none !important`, then restore. |
| Preview shows the wrong text for the time (typing done before the scene) | Hidden tabs pause CSS animations but not `setTimeout`, so JS beats drift. | In preview, run beats from a rAF loop that reads a reference CSS animation's `currentTime`. In render mode, plain `setTimeout` is fine (fake clock). |
| Header or sheet lands far from where you put it | `zoom` multiplies `left/top/width` too. | Divide positions by the zoom, or position a wrapper and zoom its child. |
| Marker tip is black instead of the stroke colour | `fill="var(--tip)"` as an SVG attribute: attributes don't resolve `var()`. | Use `style="fill:var(--tip)"`. |
| Translucent highlighter becomes opaque | Your draw keyframes animate `opacity`, which overrides the element's `opacity` attribute. | Animate `visibility` and `stroke-dashoffset` only. |
| The whole drawing jumps or scales from the wrong origin | A global `transform-origin`/`transform-box` rule also applies to SVG groups that use a `transform` attribute. | Set `transform-box/origin` inline only on the elements you animate with CSS transforms. |
| An arrow has no head | The element factory didn't set the head style (`end:'triangle'`); the renderer's default was "none". | Always pass every field the renderer reads; render one of each element type early. |
| Text invisible in a dark scene | Inherited `color` was computed on the light ancestor; changing custom properties on a child doesn't re-resolve it. | Set `color:var(--ink)` on the themed container. |
| A headline line overflows the frame | Copy too long for the font at 100+ px (hand fonts are wide). | Shorten the copy; aim for 16 characters per line. |
| Slivers of old headlines (a white or accent dash) stay on screen after they exit | The exit slide (`translateY(-112%)`) doesn't clear the mask when the font's ascenders/descenders overflow the line box (fallback fonts make it worse). | Exit further and fade: `to{transform:translateY(-135%);opacity:0}`. Load the real font so metrics match. |
| Two headlines visibly overlap mid-swap, especially when sizes differ | The new line starts before the old one has left. | Delay the incoming line ~0.3 s after the outgoing one starts, or keep sizes consistent. |
| Screenshots show a real device or person | Live discovery features pick up real things on the network. | Never ship raw screenshots of live sessions. Rebuild the UI with invented data. |
| Frames render but the video looks different from the preview | Animations created after `startReel` (class toggles) weren't seeked. | The renderer seeks every animation each frame and times late-born ones from their birth frame: keep that logic, and create nothing on `requestAnimationFrame` alone. |
| Fonts swap mid-video | Rendering started before web fonts loaded. | `reelReady` waits on `document.fonts.load(...)` for every weight used, then `document.fonts.ready`. |

## Self-check routine

1. Render stills at the start, middle and end of every scene, plus just before each reveal.
2. Scan for colour that shouldn't be there (a pixel scan for the accent colour in a region is quick).
3. Open the preview in a browser, read the console for errors.
4. After muxing, decode two frames from the MP4 and check duration and loudness in the mux summary.
