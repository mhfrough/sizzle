// Render a reel page frame by frame with a fake clock (Playwright + Chromium).
//
// usage: node render.js stills <url> <outDir> 1,3.5,7      -> 1080x1920 PNG stills named t<sec>.png
//        node render.js frames <url> <outDir> [fps=30] [scale=2] -> 00000.jpg, 00001.jpg ... (2160x3840 at scale 2)
//
// The page must expose:
//   window.reelReady   a promise that resolves once fonts/assets are in and the scene is built
//   window.startReel() starts the timeline (removes the paused state, schedules beats)
//   window.REEL        { duration } in seconds, set before reelReady resolves
// and must not autoplay when the URL has ?render (the renderer calls startReel itself).
//
// How it stays frame-exact: page.clock fakes Date/setTimeout/requestAnimationFrame, so JS beats fire at
// exact reel times; every CSS/Web Animation is paused and seeked to the frame time before each screenshot.
// Playwright is found via $PLAYWRIGHT (a path), then the current directory's node_modules, then global.
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');

function loadPlaywright() {
  const tries = [
    () => require(path.resolve(process.env.PLAYWRIGHT)),
    () => createRequire(path.join(process.cwd(), 'noop.js'))('playwright'),
    () => require('playwright'),
    () => require(path.join(require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')),
  ];
  if (!process.env.PLAYWRIGHT) tries.shift();
  for (const t of tries) {
    try { return t(); } catch { /* try the next one */ }
  }
  console.error('Playwright not found. Run `npm i -D playwright && npx playwright install chromium` in your project, or set PLAYWRIGHT=/path/to/node_modules/playwright');
  process.exit(2);
}
const { chromium } = loadPlaywright();

const [mode, rawUrl, outDir, a4, a5] = process.argv.slice(2);
if (!['stills', 'frames'].includes(mode) || !rawUrl || !outDir) {
  console.error('usage: node render.js stills <url> <outDir> 1,5,9 | node render.js frames <url> <outDir> [fps] [scale]');
  process.exit(1);
}
const url = rawUrl + (rawUrl.includes('?') ? '&' : '?') + 'render';
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  // GPU flags help WebGL pages; harmless elsewhere.
  const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
  const scale = mode === 'frames' ? +(a5 || 2) : 1;
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: scale });
  page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text()) });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.clock.install();
  await page.goto(url);
  await page.waitForFunction(() => window.reelReady, null, { timeout: 60000 });
  await page.evaluate(() => window.reelReady);
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1500);
  const dur = await page.evaluate(() => {
    const births = new Map();
    const initial = new Set(document.getAnimations());
    let last = 0;
    window.__seek = (t) => {
      document.getAnimations().forEach((a) => {
        // animations created later (by beats) start counting from the frame they were born on
        if (!births.has(a)) births.set(a, initial.has(a) ? 0 : last);
        a.pause();
        a.currentTime = Math.max(0, (t - births.get(a)) * 1000);
      });
      last = t;
    };
    window.startReel();
    document.getAnimations().forEach((a) => initial.add(a));
    return window.REEL.duration;
  });
  console.log('ready, duration', dur);

  const fps = mode === 'frames' ? +(a4 || 30) : 30;
  const total = Math.round(dur * fps);
  // stills: each requested time is taken from its nearest frame
  const want = new Map();
  if (mode === 'stills') {
    for (const w of String(a4 || '1').split(',').map(Number).filter((x) => isFinite(x) && x >= 0)) {
      const f = Math.round(w * fps);
      if (f >= total) { console.log('skip still', w, '(after the end, ' + dur + ' s)'); continue; }
      if (!want.has(f)) want.set(f, []);
      want.get(f).push(w);
    }
  }
  const lastStill = Math.max(-1, ...want.keys());
  let t = 0;
  const t0 = Date.now();
  for (let f = 0; f < total; f++) {
    const tf = f / fps;
    const step = (tf - t) * 1000;
    if (step > 0) await page.clock.runFor(step);
    t = tf;
    await page.evaluate((x) => window.__seek(x), tf);
    if (mode === 'frames') {
      await page.screenshot({ path: path.join(outDir, String(f).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 95 });
      if (f % 60 === 0) console.log('frame', f, '/', total, ((Date.now() - t0) / 1000).toFixed(0) + 's');
    } else {
      for (const w of want.get(f) || []) {
        await page.screenshot({ path: path.join(outDir, 't' + w.toFixed(2) + '.png') });
        console.log('still', w);
      }
      if (f >= lastStill) break;
    }
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1) });
