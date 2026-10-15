/*
  Now showing: a low-poly screening room plays the Sizzle trailer on a 9:16 screen.
  Click the projector to run it from the top, point at the audience to hear what they think.
  The play buttons, cue list and captions are plain HTML and work without WebGL.
  three.js and the video load only when the room is about to scroll into view.
*/

/* The trailer's cues, mix report and credit. Its JSON (data-trailer-meta on the section)
   replaces these once the page has loaded. */
const FILES = {
  'sizzle-reel.mp4': {
    drop: 2.95,
    cues: [
      [0, 'Hook', 'Nobody reads your README. Four workarounds are struck out.'],
      [2.95, 'Reveal', 'The bronze gates slam shut on the drop.'],
      [5.2, 'Install', 'One line to install.'],
      [7.45, 'Ask', 'Then just ask.'],
      [9.7, 'Script', 'This reel’s own shot list types itself.'],
      [11.95, 'Cut', 'This reel’s own cues print, line by line.'],
      [14.2, 'Lock', 'The contact sheet, then picture lock.'],
      [16.45, 'Mix', 'The drop at 57.02 s locks onto the reveal.'],
      [18.7, 'Print', 'The frame counter runs to 750.'],
      [21.7, 'Try Sizzle', 'The install line types itself.'],
    ],
    mix: `$ music_sync.py sizzle-bgm.mp3 --cue 2.95 --length 25
  hit 57.02s  offset 54.07  pre -14.6 dB  body -8.9 dB  fits yes`,
    mixNote: 'Upbeat Future Bass - So Easy by BombinSound. The drop lands on the bronze gates, 2.95 seconds in. Mixed to −14 LUFS with a 1.2 second fade-out.',
  },
};

/* Who is in tonight. Row A is the front row; seats count from the left. */
const AUDIENCE = [
  { row: 0, seat: 2, kind: 'critic', hair: 0x2b2420, skin: 0xc79a7e, cloth: 0x4a4d52 },
  { row: 0, seat: 6, kind: 'shusher', hair: 0x9a948c, skin: 0xe1c2a8, cloth: 0x6b5446 },
  { row: 1, seat: 1, kind: 'fan', hair: 0x1b1816, skin: 0x8a5a40, cloth: 0xa08672 },
  { row: 1, seat: 5, kind: 'designer', hair: 0x5a4030, skin: 0xd8b294, cloth: 0x2c2c2c },
  { row: 2, seat: 3, kind: 'engineer', hair: 0x1f1c1a, skin: 0xb98468, cloth: 0x3c454c },
  { row: 2, seat: 4, kind: 'popcorn', hair: 0x7b5a3e, skin: 0xe6c6ae, cloth: 0x5c4a3f },
  { row: 3, seat: 0, kind: 'skeptic', hair: 0x3a3330, skin: 0x6b4532, cloth: 0x555555 },
  { row: 3, seat: 6, kind: 'whisper', hair: 0xc4bcb2, skin: 0xcfa58a, cloth: 0x403630 },
  { row: 4, seat: 3, kind: 'sleeper', hair: 0x2a2523, skin: 0xa77356, cloth: 0x30343a },
];

const LINES = {
  critic: ['Hook in under three seconds. Good.', 'Tight cut. No dead air.', 'One idea per headline. Correct.'],
  shusher: ['Shh. This is the good part.', 'Shh. It’s only 25 seconds.', 'No talking during the reel.'],
  fan: ['I’d install that.', 'Seen it three times. Still good.', 'Again! Play it again!'],
  designer: ['That’s the real stylesheet.', 'Real interface. Not a screenshot.', 'The type is so sharp.'],
  engineer: ['Is that a 4K render?', '2160 by 3840. I counted.', 'Music at −14 LUFS. Clean.'],
  popcorn: ['Popcorn? No? More for me.', '25 seconds. Barely time to chew.', 'Best seat in the house.'],
  skeptic: ['An agent cut this? Sure.', 'Who approved this? Oh. Someone did.', 'Every claim true? I’ll check.'],
  whisper: ['Psst. Watch the reveal.', 'Here it comes…', 'Psst. The drop is on the cut.'],
  sleeper: ['Zzz… wake me for the drop.', 'Mm? Is it over?', 'Zzz…'],
  trailer: ['A reel about making reels.', 'Wait, that’s this page.', 'It cut its own trailer. Show-off.'],
  drop: ['The drop hit on the reveal!', 'Right on the beat.', 'Called it. Drop on the reveal.'],
  woke: ['Huh! I’m up. I’m up.', 'Did I miss the drop?'],
  again: ['Ooh, from the top.', 'Good. I missed the start.', 'Again! Watch the hook this time.'],
  rapid: ['Hey, I was watching that!', 'We just saw the start!', 'Again? Really?'],
  poke: ['Yes? It’s only 25 seconds.', 'Do you mind? I’m watching.', 'Ask me after.', 'Get your own seat.'],
  annoyed: ['Seriously. Shh.', 'Usher!', 'Some of us came for the reel.', 'Please. Stop.'],
  move: ['That’s it. I’m moving.', 'New seat. Goodbye.', 'I’m sitting somewhere quieter.'],
  shush: ['Shh!', 'Shh. Both of you.', 'Shhh.'],
  calm: ['Fine. Sit. Watch.', 'Better seat anyway.'],
};
const BOOTH = {
  hover: ['Booth’s open.', 'Click the projector and I’ll run it from the top.', 'Lamp is warm. Reel is threaded.'],
  change: ['Rethreading.', 'From the top.', 'Rewinding the reel.', 'Watch the corner. Here it comes.'],
  annoyed: ['Easy. Reels are heavy.', 'That’s a lot of rewinding.', 'The audience is staring at me.'],
  angry: ['Fine. You run the booth.', 'Every reel. Every time. Really?', 'I’m putting the kettle on.'],
  calm: ['Right. Where were we?', 'Projector cooled off. So did I.'],
};

const ANNOYED = 3, ANGRY = 5, MAX_ANGER = 7;
const FPS = 30;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const section = document.getElementById('screening');
if (section) setup(section);

function setup(root) {
  const $ = (s) => root.querySelector(s);
  const stage = $('.sr-stage'), film = $('.sr-film'), note = $('.sr-note'), playBtn = $('.sr-play'), askBtn = $('.sr-ask'), againBtn = $('.sr-again');
  const caption = $('.sr-caption'), live = $('#sr-live'), cueList = $('.sr-cues'), bubbles = $('.sr-bubbles');
  const sheetBox = $('#sr-sheet'), mixBox = $('#sr-mix');
  const fileOf = (src) => src.split('/').pop().split('?')[0];

  // The room shows one reel, the trailer. (The view keeps a list so the code reads the same either way.)
  const feature = $('.sr-feature');
  const reels = [root.dataset.trailer].map((src) => {
    const data = FILES[fileOf(src)] || {};
    return { key: 'trailer', src, name: (feature && feature.dataset.marquee) || 'Your app', ...data, cues: (data.cues || []).map(([t, name, n]) => ({ t, name, note: n })) };
  });
  let current = 0, playing = !reduceMotion, view = null, flat = false, booted = false;

  /* The trailer's own cue file: cues, mix report and contact sheet. Fetched once the page has loaded. */
  function loadMeta() {
    const meta = root.dataset.trailerMeta;
    if (!meta) return;
    fetch(new URL(meta, document.baseURI)).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j) return;
      const r = reels[0];
      if (Array.isArray(j.cues) && j.cues.length) r.cues = j.cues.map((c) => ({ t: +c.t, name: c.name, note: c.note || '' }));
      if (j.mixReport) {
        r.mix = typeof j.mixReport === 'string' ? j.mixReport : Object.entries(j.mixReport).map(([k, v]) => k.padEnd(9) + ': ' + (typeof v === 'object' ? JSON.stringify(v) : v)).join('\n');
        const m = j.music;
        r.mixNote = !m ? '' : typeof m === 'string' ? m : '“' + m.title + '”' + (m.artist ? ' by ' + m.artist : '') + (m.licence || m.license ? ', ' + (m.licence || m.license) : '') + '.' + (m.hit != null ? ' The drop at ' + m.hit + ' seconds into the track lands on the reveal.' : '');
      }
      if (typeof j.sheet === 'string') r.sheet = j.sheet;
      if (Array.isArray(j.frames) && j.frames.length) r.frames = j.frames.map((f) => (typeof f === 'string' ? { src: f } : { src: f.src || f.file || f.url, t: f.t, alt: f.alt || f.name }));
      const drop = r.cues.find((c) => /reveal|drop/i.test(c.name));
      if (drop) r.drop = drop.t;
      if (current === 0) paintExtras();
    }).catch(() => {});
  }

  /* ---------- Speech: the audience and the projectionist ---------- */
  const rowName = (r) => 'ABCDE'[r];
  const speakers = AUDIENCE.map((d, i) => makeSpeaker({ ...d, i, label: rowName(d.row) + (d.seat + 1) }));
  const booth = makeSpeaker({ kind: 'booth', label: 'Projectionist', booth: true });
  function makeSpeaker(d) {
    const el = document.createElement('div');
    el.className = 'sr-bubble';
    el.innerHTML = '<div class="sr-bubble-in"><b></b><span></span></div>';
    el.querySelector('b').textContent = d.label;
    bubbles.appendChild(el);
    return { ...d, el, text: el.querySelector('span'), anger: 0, peak: 0, lastPoke: 0, hoverAt: -1e9, last: {}, hideT: 0, w: 0, h: 0 };
  }
  function pick(sp, pool, key) {
    let i = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && i === sp.last[key]) i = (i + 1) % pool.length;
    sp.last[key] = i;
    return pool[i];
  }
  function say(sp, text, mood = 'calm', ms = 2600, announce = false) {
    sp.text.textContent = text;
    sp.el.dataset.mood = mood;
    sp.el.classList.remove('is-on');
    void sp.el.offsetWidth; // restart the pop
    sp.el.classList.add('is-on');
    sp.w = 0;
    clearTimeout(sp.hideT);
    sp.hideT = setTimeout(() => sp.el.classList.remove('is-on'), ms);
    if (announce) live.textContent = (sp.booth ? 'Projectionist' : 'Row ' + sp.label[0] + ', seat ' + sp.label.slice(1)) + ': ' + text;
    if (!view) placeFlat();
  }
  // Without the 3D room, bubbles stack in the corner of the frame
  function placeFlat() {
    // Beside the plain player, or over its lower corner when there is no room beside it
    const sr = stage.getBoundingClientRect(), fr = film.getBoundingClientRect();
    let x = fr.right - sr.left + 16, y = 0;
    if (x + 240 > sr.width) x = fr.left - sr.left + 12;
    const bottom = Math.min(fr.bottom, sr.bottom) - sr.top - 12;
    speakers.concat(booth).forEach((sp) => {
      if (!sp.el.classList.contains('is-on')) return;
      sp.el.style.transform = 'translate(' + x + 'px,' + (bottom - y) + 'px) translateY(-100%)';
      y += sp.el.offsetHeight + 6;
    });
  }
  const level = (sp) => (sp.anger >= ANGRY ? 'angry' : sp.anger >= ANNOYED ? 'annoyed' : 'calm');
  function hoverLine(sp) {
    if (sp.booth) return pick(sp, BOOTH.hover, 'hover');
    const r = reels[current];
    return Math.random() < 0.3 ? pick(sp, LINES.trailer, 'trailer') : pick(sp, LINES[sp.kind], 'hover');
  }
  function hover(sp) {
    const now = performance.now();
    if (sp.anger >= ANNOYED || now - sp.hoverAt < 3500 || sp.el.classList.contains('is-on')) return;
    sp.hoverAt = now;
    say(sp, hoverLine(sp), 'calm', 2400);
  }
  function poke(sp) {
    if (sp.booth) return rethread('projector');
    sp.anger = Math.min(sp.anger + 1, MAX_ANGER);
    sp.peak = Math.max(sp.peak, sp.anger);
    sp.lastPoke = performance.now();
    const lvl = level(sp);
    if (lvl === 'angry') {
      say(sp, pick(sp, LINES.move, 'move'), 'angry', 2600, true);
      if (view && view.moveSeat(sp)) { sp.anger = 0; sp.peak = 0 }
    } else {
      say(sp, lvl === 'annoyed' ? pick(sp, LINES.annoyed, 'annoyed') : pick(sp, LINES.poke, 'poke'), lvl, 2600, true);
      if (lvl === 'annoyed') {
        const n = nearest(sp);
        if (n) setTimeout(() => { say(n, pick(n, LINES.shush, 'shush'), 'calm', 1800); if (view) view.react(n, 'turn') }, 500);
      }
    }
    if (view) view.react(sp, lvl);
  }
  function nearest(sp) {
    let best = null, bd = 1e9;
    speakers.forEach((o) => {
      if (o === sp || o.el.classList.contains('is-on')) return;
      const d = Math.abs(o.row - sp.row) * 2 + Math.abs(o.seat - sp.seat);
      if (d < bd) { bd = d; best = o }
    });
    return best;
  }
  // Anger cools once you stop
  setInterval(() => {
    const now = performance.now();
    speakers.concat(booth).forEach((sp) => {
      if (!sp.anger || now - sp.lastPoke < 2600) return;
      sp.anger--;
      if (!sp.anger) {
        if (sp.peak >= ANGRY && sp.booth) say(sp, pick(sp, BOOTH.calm, 'calm'), 'calm', 2600);
        sp.peak = 0;
      }
    });
  }, 900);

  askBtn.addEventListener('click', () => {
    const awake = speakers.filter((s) => !s.el.classList.contains('is-on'));
    const order = awake.sort(() => Math.random() - 0.5).slice(0, 2);
    order.forEach((sp, i) => setTimeout(() => {
      say(sp, hoverLine(sp), 'calm', 3400, i === 0);
      if (view) view.react(sp, 'turn');
    }, i * 700));
  });

  /* ---------- Rethreading, play button, cues ---------- */
  // The projector (or the button) runs the reel from the top: cue dots, the leader, then the picture.
  function rethread(how) {
    if (how !== 'boot') {
      // The projectionist minds a lot of rewinding
      booth.anger = Math.min(booth.anger + 1, MAX_ANGER);
      booth.peak = Math.max(booth.peak, booth.anger);
      booth.lastPoke = performance.now();
      const lvl = level(booth);
      say(booth, pick(booth, lvl === 'calm' ? BOOTH.change : BOOTH[lvl], lvl), lvl, 2600);
      setTimeout(() => {
        const sp = speakers[Math.floor(Math.random() * speakers.length)];
        if (!sp.el.classList.contains('is-on')) say(sp, lvl === 'calm' ? pick(sp, LINES.again, 'again') : pick(sp, LINES.rapid, 'rapid'), lvl === 'calm' ? 'calm' : 'annoyed', 2200);
      }, 900);
    }
    if (view) view.change(current, { first: how === 'boot', booth: level(booth) });
    else if (flat) { loadFlat(current, true); markCue(0) }
  }
  againBtn.addEventListener('click', () => rethread('button'));

  function setPlaying(on) {
    playing = on;
    playBtn.textContent = on ? 'Pause' : 'Play';
    syncFilm();
  }
  playBtn.addEventListener('click', () => setPlaying(!playing));

  const tc = (t) => {
    const s = Math.floor(t + 1e-6), f = Math.min(FPS - 1, Math.floor((t - s) * FPS + 1e-6));
    return '00:' + String(s).padStart(2, '0') + ':' + String(f).padStart(2, '0');
  };
  let cueEls = [];
  function paintExtras() {
    const r = reels[current];
    cueList.replaceChildren(...r.cues.map((c) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sr-cue';
      b.innerHTML = '<span class="sr-tc"></span><span class="sr-cue-name"></span><span class="sr-cue-note"></span>';
      b.children[0].textContent = tc(c.t);
      b.children[1].textContent = c.name;
      b.children[2].textContent = c.note || '';
      b.addEventListener('click', () => seek(c.t));
      li.appendChild(b);
      return li;
    }));
    cueEls = [...cueList.querySelectorAll('.sr-cue')];
    markCue(film.currentTime || 0);

    // Contact sheet: an image, or the reel's own key frames
    const sb = sheetBox.querySelector('.sr-more-body');
    sb.replaceChildren();
    sheetBox.hidden = !(r.sheet || r.frames);
    sheetBox.open = false;
    sheetBox.dataset.ready = '';
    const mb = mixBox.querySelector('.sr-more-body');
    mb.replaceChildren();
    mixBox.hidden = !r.mix;
    if (r.mix) {
      const pre = document.createElement('pre');
      pre.textContent = r.mix;
      mb.appendChild(pre);
      if (r.mixNote) { const p = document.createElement('p'); p.textContent = r.mixNote; mb.appendChild(p) }
    }
  }
  // Sheet images load only when the sheet is opened
  sheetBox.addEventListener('toggle', () => {
    if (!sheetBox.open || sheetBox.dataset.ready) return;
    sheetBox.dataset.ready = '1';
    const r = reels[current], body = sheetBox.querySelector('.sr-more-body');
    const img = (src, alt, cls) => { const i = new Image(); i.src = new URL(src, document.baseURI).href; i.alt = alt; i.decoding = 'async'; if (cls) i.className = cls; return i };
    if (r.sheet) body.appendChild(img(r.sheet, r.sheetAlt || 'Key frames of the ' + r.name + ' reel in a grid.'));
    else {
      const grid = document.createElement('div');
      grid.className = 'sr-frames';
      r.frames.forEach((f, i) => grid.appendChild(img(f.src, f.alt || r.name + ' reel, frame ' + (i + 1) + (f.t != null ? ' at ' + f.t + ' seconds' : ''))));
      body.appendChild(grid);
    }
  });
  function markCue(t) {
    const r = reels[current];
    let on = -1;
    r.cues.forEach((c, i) => { if (c.t <= t + 0.04) on = i });
    cueEls.forEach((b, i) => {
      if ((i === on) === b.hasAttribute('aria-current')) return;
      if (i === on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
  }
  film.addEventListener('timeupdate', () => markCue(film.currentTime));
  function seek(t) {
    if (view) view.cut(); // skip any countdown straight to the picture
    const go = () => { film.currentTime = Math.min(t + 0.02, (film.duration || 25) - 0.05); markCue(t) };
    if (film.readyState >= 1) go(); else film.addEventListener('loadedmetadata', go, { once: true });
    if (!booted) boot();
  }

  /* ---------- The film element: hidden texture source, or the fallback player ---------- */
  let inView = false, screenOn = false;
  function syncFilm() {
    const want = inView && playing && (screenOn || flat);
    if (want && film.paused) film.play().catch(() => {});
    if (!want && !film.paused) film.pause();
  }
  function loadFilm(i) {
    const url = new URL(reels[i].src, document.baseURI).href;
    if (film.src !== url) { film.src = url; film.load() }
  }
  function loadFlat(i, changed) {
    const r = reels[i];
    film.poster = new URL(r.src.replace(/-reel\.mp4$/, '-poster.webp'), document.baseURI).href;
    loadFilm(i);
    if (changed) film.currentTime = 0;
    syncFilm();
  }
  film.addEventListener('error', () => { if (film.getAttribute('poster')) film.removeAttribute('poster') });

  /* ---------- Loading: three.js arrives just before the room scrolls in ---------- */
  const skel = stage.querySelector('.sr-skel');
  function busy(on) {
    stage.classList.toggle('is-loading', on);
    stage.setAttribute('aria-busy', String(on));
  }
  function dropSkeleton(now) {
    if (!skel || !skel.isConnected) return;
    if (now || reduceMotion) return skel.remove();
    skel.addEventListener('transitionend', () => skel.remove(), { once: true });
    setTimeout(() => skel.remove(), 900);
  }
  function boot() {
    if (booted) return;
    booted = true;
    film.preload = 'auto';
    if (!hasWebGL()) return fail();
    loadThree().then((THREE) => {
      view = createView(THREE, {
        stage, film, reels, speakers, booth, reduceMotion,
        get current() { return current },
        get playing() { return playing },
        setScreen(on) { screenOn = on; syncFilm() },
        loadFilm, hover, poke, markCue,
        firstFrame: ready,
      });
      view.change(current, { first: true });
    }).catch((e) => { console.warn('Screening room fell back to the plain player.', e); fail() });
  }
  function ready() {
    film.setAttribute('aria-hidden', 'true');
    film.tabIndex = -1;
    stage.classList.remove('is-flat');
    void stage.offsetWidth; // commit the canvas at opacity 0 so it fades in
    stage.classList.add('is-ready');
    note.hidden = true;
    busy(false);
    dropSkeleton();
  }
  function fail() {
    film.removeAttribute('aria-hidden');
    film.removeAttribute('tabindex');
    flat = true;
    view = null;
    stage.classList.add('is-flat');
    stage.querySelectorAll('canvas').forEach((c) => c.remove());
    busy(false);
    dropSkeleton(true);
    note.textContent = 'The projector couldn’t start here, so the reel plays on its own.';
    note.classList.add('is-flat-note');
    film.controls = false;
    loadFlat(current, false);
  }

  if ('IntersectionObserver' in window) {
    const near = (margin, fn) => {
      const io = new IntersectionObserver((en) => {
        if (en.some((x) => x.isIntersecting)) { io.disconnect(); fn() }
      }, { rootMargin: margin });
      io.observe(stage);
    };
    // Wait for the page itself to finish loading, so the first paint never pays for the room.
    // Then prefetch three.js (no parse) about two screens early and build the room about one screen early.
    const arm = () => {
      loadMeta();
      near('200% 0px', prefetchThree);
      near('100% 0px', boot);
    };
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200));
    if (document.readyState === 'complete') idle(arm, { timeout: 2000 });
    else window.addEventListener('load', () => idle(arm, { timeout: 2000 }), { once: true });
    new IntersectionObserver((en) => {
      inView = en[0].isIntersecting;
      syncFilm();
      if (view) view.visible(inView);
    }, { threshold: 0.15 }).observe(stage);
  } else { inView = true; loadMeta(); boot() }
  document.addEventListener('visibilitychange', () => { if (document.hidden) film.pause(); else syncFilm() });

  paintExtras();
  setPlaying(playing);
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false }
}
function threeUrl() { return new URL('./assets/vendor/three/three.module.min.js', import.meta.url).href }
function prefetchThree() {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'script';
  link.href = threeUrl();
  document.head.appendChild(link);
}
function loadThree() { return import(threeUrl()) }

/* ======================================================================
   The 3D room
   ====================================================================== */

function createView(THREE, api) {
  const { stage, film, reels, speakers, booth } = api;
  const reduceMotion = api.reduceMotion;
  const motion = reduceMotion ? 0 : 1;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const DEG = Math.PI / 180;
  const col = (hex) => new THREE.Color(hex);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  stage.prepend(renderer.domElement);
  const canvas = renderer.domElement;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 1, 200);

  /* ---------- Materials and a tiny geometry merger ---------- */
  const std = (extra) => new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0, ...extra });
  const matRoom = std();
  const matMetal = std({ roughness: 0.5, metalness: 0.45 });
  const matVelvet = std({ roughness: 1 });
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
  // A part is [geometry, colour, x, y, z, rx, ry, rz, sx, sy, sz]
  function part(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    tmpM.compose(tmpP.set(x, y, z), tmpQ.setFromEuler(tmpE.set(rx, ry, rz)), tmpS.set(sx, sy, sz));
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(tmpM);
    return [g, color];
  }
  const box = (w, h, d, color, x, y, z, rx, ry, rz) => part(new THREE.BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz);
  function merge(parts) {
    let n = 0;
    parts.forEach(([g]) => { n += g.attributes.position.count });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), cl = new Float32Array(n * 3);
    let o = 0;
    const c = new THREE.Color();
    parts.forEach(([g, color]) => {
      g.computeVertexNormals();
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      c.set(color);
      for (let i = 0; i < g.attributes.position.count; i++) cl.set([c.r, c.g, c.b], (o + i) * 3);
      o += g.attributes.position.count;
      g.dispose();
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.BufferAttribute(cl, 3));
    return out;
  }
  function mesh(geo, material, cast = true, receive = true) {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = cast;
    m.receiveShadow = receive;
    scene.add(m);
    return m;
  }

  /* ---------- Layout (units: a seated person is about 1.7 tall) ---------- */
  const W = 5.2, FRONT = -7.6, BACK = 5.6;            // room half width, screen wall, back edge
  const SCREEN = { w: 3.94, h: 7, y: 1.3, z: -7.22 };  // a 9:16 portrait screen
  const ROWS = 5, PER_ROW = 7, ROW_Z0 = -4.3, ROW_DZ = 1.45, STEP = 0.34, SEAT_DX = 1.06, SEAT_X0 = -3.55;
  // The booth is an annex at the back left, angled at the screen, so its beam crosses the room
  const MAIN_BACK = 2.55, BOOTH_Y = 2.3, BOOTH_Z0 = 2.45, BX1 = -0.25, BOOTH_H = 3.2, LH = 1.2;
  const SY = SCREEN.y + SCREEN.h / 2;
  const C = {
    slab: 0x1d1b1a, slabEdge: 0x2a2623, carpet: 0x2b2421, riser: 0x221d1a, wall: 0x1e1c1b, wallFin: 0x262321, screenWall: 0x161515,
    stage: 0x231e1b, curtain: 0x6a4f3f, curtainDeep: 0x4c382d, seat: 0x7a5a46, seatShell: 0x3a2f29, frame: 0x151515,
    booth: 0x232120, boothIn: 0x1a1918, metal: 0x3a3836, metalLight: 0x8f8a85, bronze: 0xa08672, ink: 0xf2f2f2,
  };

  /* Shell: a floating slab, two walls (far side and screen wall), stepped floor, stage */
  const shell = [];
  const slab = (x0, x1, z0, z1) => {
    shell.push(box(x1 - x0, 1.1, z1 - z0, C.slab, (x0 + x1) / 2, -0.55, (z0 + z1) / 2));
    shell.push(box(x1 - x0 + 0.04, 0.05, z1 - z0 + 0.04, C.bronze, (x0 + x1) / 2, -0.03, (z0 + z1) / 2)); // a thin bronze lip
  };
  slab(-W - 0.2, W + 0.2, FRONT - 0.2, MAIN_BACK);
  slab(-W - 0.2, BX1 + 0.1, MAIN_BACK - 0.2, BACK);
  shell.push(box(W * 2, 0.02, MAIN_BACK - FRONT, C.carpet, 0, 0.01, (FRONT + MAIN_BACK) / 2));
  for (let r = 1; r <= ROWS; r++) {
    const z0 = ROW_Z0 + (r - 0.5) * ROW_DZ, h = r * STEP;
    shell.push(box(W * 2, h, MAIN_BACK - z0, C.carpet, 0, h / 2, (z0 + MAIN_BACK) / 2));
    shell.push(box(W * 2, 0.06, 0.02, C.riser, 0, h - 0.03, z0 - 0.01)); // shadow line at each step nose
  }
  // The booth's platform
  shell.push(box(BX1 + W, BOOTH_Y, BACK - BOOTH_Z0 + 0.1, C.riser, (BX1 - W) / 2, BOOTH_Y / 2, (BOOTH_Z0 - 0.1 + BACK) / 2));
  shell.push(box(BX1 + W, 0.04, BACK - BOOTH_Z0, C.carpet, (BX1 - W) / 2, BOOTH_Y + 0.02, (BOOTH_Z0 + BACK) / 2));
  // Far wall with acoustic fins
  const WALL_H = 11;
  shell.push(box(0.3, WALL_H, BACK - FRONT, C.wall, -W - 0.15, WALL_H / 2, (FRONT + BACK) / 2));
  for (let z = FRONT + 1.2; z < BACK - 0.4; z += 1.3) shell.push(box(0.12, WALL_H - 1.4, 0.34, C.wallFin, -W + 0.06, (WALL_H - 1.4) / 2 + 0.7, z));
  shell.push(box(0.2, 0.2, BACK - FRONT, C.wallFin, -W + 0.1, WALL_H - 0.4, (FRONT + BACK) / 2));
  // Screen wall
  shell.push(box(W * 2 + 0.3, WALL_H, 0.3, C.screenWall, -0.15, WALL_H / 2, FRONT - 0.15));
  // Stage apron in front of the screen
  shell.push(box(W * 2, 0.45, 1.1, C.stage, 0, 0.225, FRONT + 0.55));
  // Masking frame around the screen
  const fw = SCREEN.w + 0.36, fh = SCREEN.h + 0.36;
  shell.push(box(fw, fh, 0.12, 0x0b0b0b, 0, SY, SCREEN.z - 0.08));
  mesh(merge(shell), matRoom, false, true);

  /* Glowing bits that are not lit: step lights, stage edge, sconces, exit sign */
  const glow = [];
  for (let r = 1; r <= ROWS; r++) {
    const z0 = ROW_Z0 + (r - 0.5) * ROW_DZ, h = r * STEP;
    glow.push(box(0.36, 0.04, 0.03, 0xd6b394, W - 0.55, h - 0.12, z0 - 0.02));
  }
  glow.push(box(W * 2, 0.035, 0.03, 0xc9a98e, 0, 0.41, FRONT + 1.11));
  [-4.2, 0.2].forEach((z) => glow.push(box(0.06, 0.5, 0.36, 0xe7c9a8, -W + 0.08, 4.0, z)));
  glow.push(box(0.05, 0.3, 0.8, 0xa08672, -W + 0.06, 3.0, BOOTH_Z0 - 1.1)); // exit sign, bronze
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  mesh(merge(glow), glowMat, false, false);

  /* Curtains: pleated bronze velvet either side of the screen, and a valance */
  function pleats(width, height, folds, depth) {
    const g = new THREE.PlaneGeometry(width, height, folds * 2, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = Math.round((p.getX(i) / width + 0.5) * folds * 2);
      p.setZ(i, (k % 2 ? depth : -depth) * (1 - 0.25 * (p.getY(i) / height + 0.5)));
    }
    return g;
  }
  const curtainParts = [];
  [-1, 1].forEach((s) => {
    curtainParts.push(part(pleats(1.5, 8.7, 5, 0.13), C.curtain, s * (SCREEN.w / 2 + 0.82), 4.8, FRONT + 0.55, 0, 0, 0));
    curtainParts.push(part(pleats(1.1, 8.7, 4, 0.11), C.curtainDeep, s * (SCREEN.w / 2 + 2.0), 4.8, FRONT + 0.4, 0, s * 0.12, 0));
    curtainParts.push(box(0.12, 0.12, 0.5, C.bronze, s * (SCREEN.w / 2 + 0.55), 2.8, FRONT + 0.75)); // tie-backs
  });
  curtainParts.push(part(pleats(SCREEN.w + 4.6, 0.85, 16, 0.1), C.curtainDeep, 0, SCREEN.y + SCREEN.h + 0.45, FRONT + 0.7));
  const curtains = mesh(merge(curtainParts), matVelvet, true, true);
  curtains.material.side = THREE.DoubleSide;

  /* ---------- Seats: one instanced mesh, rows gently curved toward the screen ---------- */
  const seatGeo = merge([
    box(0.86, 0.16, 0.72, C.seat, 0, 0.46, -0.02),
    box(0.84, 0.92, 0.12, C.seatShell, 0, 0.94, 0.36, -0.14),
    box(0.76, 0.78, 0.06, C.seat, 0, 0.96, 0.29, -0.14),
    box(0.09, 0.08, 0.74, C.frame, 0.49, 0.7, 0.02), box(0.09, 0.08, 0.74, C.frame, -0.49, 0.7, 0.02),
    box(0.07, 0.62, 0.07, C.frame, 0.49, 0.33, 0.24), box(0.07, 0.62, 0.07, C.frame, -0.49, 0.33, 0.24),
    box(0.5, 0.36, 0.3, C.frame, 0, 0.19, 0.08),
  ]);
  const R_CURVE = 26;
  const seats = [];
  for (let r = 0; r < ROWS; r++) for (let s = 0; s < PER_ROW; s++) {
    const x = SEAT_X0 + s * SEAT_DX;
    seats.push({ r, s, x, y: r * STEP, z: ROW_Z0 + r * ROW_DZ + (x * x) / (2 * R_CURVE), yaw: Math.atan2(x, R_CURVE) * 0.9 });
  }
  const seatMesh = new THREE.InstancedMesh(seatGeo, matRoom, seats.length);
  seats.forEach((st, i) => {
    tmpM.compose(tmpP.set(st.x, st.y, st.z), tmpQ.setFromEuler(tmpE.set(0, st.yaw, 0)), tmpS.set(1, 1, 1));
    seatMesh.setMatrixAt(i, tmpM);
  });
  seatMesh.castShadow = seatMesh.receiveShadow = true;
  scene.add(seatMesh);
  const seatAt = (r, s) => seats[r * PER_ROW + s];

  /* ---------- Audience: three instanced meshes (clothes, skin, hair), one bust each ---------- */
  const DARK = 0x16120f;
  const clothGeo = merge([
    part(new THREE.CylinderGeometry(0.33, 0.45, 0.52, 7), 0xffffff, 0, 0.86, 0, 0, 0, 0, 1, 1, 0.62),
  ]);
  const skinGeo = merge([
    part(new THREE.CylinderGeometry(0.1, 0.12, 0.18, 6), 0xffffff, 0, 1.15, 0),
    part(new THREE.IcosahedronGeometry(0.25, 1), 0xffffff, 0, 1.43, 0, 0, 0, 0, 0.92, 1.06, 0.95),
    box(0.05, 0.075, 0.03, DARK, 0.085, 1.46, -0.226), box(0.05, 0.075, 0.03, DARK, -0.085, 1.46, -0.226),
    box(0.1, 0.022, 0.03, 0x6b3c30, 0, 1.33, -0.222),
    part(new THREE.IcosahedronGeometry(0.06, 0), 0xffffff, 0.235, 1.42, 0.0), part(new THREE.IcosahedronGeometry(0.06, 0), 0xffffff, -0.235, 1.42, 0.0),
  ]);
  const hairGeo = merge([
    part(new THREE.SphereGeometry(0.268, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.56), 0xffffff, 0, 1.47, 0.02, 0.5, 0, 0),
  ]);
  const N = speakers.length;
  const crowd = [clothGeo, skinGeo, hairGeo].map((g) => {
    const m = new THREE.InstancedMesh(g, matRoom, N);
    m.castShadow = m.receiveShadow = true;
    m.frustumCulled = false;
    scene.add(m);
    return m;
  });
  const people = speakers.map((sp, i) => {
    crowd[0].setColorAt(i, col(sp.cloth));
    crowd[1].setColorAt(i, col(sp.skin));
    crowd[2].setColorAt(i, col(sp.hair));
    const st = seatAt(sp.row, sp.seat);
    return { sp, i, seat: st, pos: new THREE.Vector3(st.x, st.y, st.z), yaw: st.yaw, look: 0, lookUntil: 0, lookYaw: 0, hop: null, shake: 0, move: null, phase: rand(0, 6), roll: 0 };
  });
  crowd.forEach((m) => { m.instanceColor.needsUpdate = true });
  const byKind = (k) => people.find((p) => p.sp.kind === k);
  // Popcorn for the one who brought it
  const popcorn = mesh(merge([
    part(new THREE.CylinderGeometry(0.15, 0.11, 0.28, 8, 1, true), C.ink),
    part(new THREE.CylinderGeometry(0.152, 0.112, 0.28, 8, 1, true, 0, Math.PI / 4), 0xa08672, 0, 0, 0, 0, 0, 0),
    part(new THREE.CylinderGeometry(0.152, 0.112, 0.28, 8, 1, true, Math.PI, Math.PI / 4), 0xa08672),
    part(new THREE.IcosahedronGeometry(0.16, 0), 0xf3e2c0, 0, 0.15, 0, 0, 0, 0, 1, 0.55, 1),
  ]), matRoom, true, true);
  popcorn.material = matRoom;
  // Invisible, generous hit areas
  const hitPeople = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 1.25, 0.9), new THREE.MeshBasicMaterial({ visible: false }), N);
  hitPeople.frustumCulled = false;
  scene.add(hitPeople);

  /* ---------- The booth: walls, projector, two reels, the projectionist ---------- */
  const by = BOOTH_Y, bh = BOOTH_H, bcx = (BX1 - W) / 2, bw = BX1 + W;
  // The projector stands back from the front wall and turns to face the screen
  const proj = new THREE.Group();
  proj.position.set(-2.95, by, BOOTH_Z0 + 1.35);
  proj.rotation.y = Math.atan2(-(0 - proj.position.x), -(SCREEN.z - proj.position.z));
  scene.add(proj);
  proj.updateMatrixWorld();
  const LENS_F = proj.localToWorld(new THREE.Vector3(0, LH, -1.1));
  const SCREEN_C = new THREE.Vector3(0, SY, SCREEN.z + 0.02);
  // Where the beam passes through the front wall
  const kPort = (BOOTH_Z0 - LENS_F.z) / (SCREEN_C.z - LENS_F.z);
  const portX = LENS_F.x + (SCREEN_C.x - LENS_F.x) * kPort, portY = LENS_F.y + (SCREEN_C.y - LENS_F.y) * kPort;
  const portW = 0.8, portH = 0.62;

  const boothParts = [];
  const wallX0 = -W, wallX1 = BX1;
  boothParts.push(box(bw, portY - portH / 2 - by, 0.22, C.booth, bcx, by + (portY - portH / 2 - by) / 2, BOOTH_Z0));
  boothParts.push(box(bw, by + bh - (portY + portH / 2), 0.22, C.booth, bcx, (portY + portH / 2 + by + bh) / 2, BOOTH_Z0));
  boothParts.push(box(portX - portW / 2 - wallX0, portH, 0.22, C.booth, (wallX0 + portX - portW / 2) / 2, portY, BOOTH_Z0));
  boothParts.push(box(wallX1 - portX - portW / 2, portH, 0.22, C.booth, (wallX1 + portX + portW / 2) / 2, portY, BOOTH_Z0));
  boothParts.push(box(bw + 0.08, 0.08, 0.3, C.bronze, bcx, by + bh, BOOTH_Z0));      // bronze cap on the wall
  boothParts.push(box(bw, 0.14, 1.1, C.booth, bcx, by + bh, BOOTH_Z0 + 0.55));        // a short roof over the port
  boothParts.push(box(0.1, bh, 0.1, C.frame, BX1 - 0.05, by + bh / 2, BOOTH_Z0 + 0.1)); // corner post
  // Low rails on the open sides, so you can see in
  boothParts.push(box(bw, 0.08, 0.1, C.bronze, bcx, by + 0.9, BACK - 0.05));
  boothParts.push(box(0.1, 0.08, BACK - BOOTH_Z0, C.bronze, BX1 - 0.05, by + 0.9, (BOOTH_Z0 + BACK) / 2));
  [[-W + 0.05, BACK - 0.05], [bcx, BACK - 0.05], [BX1 - 0.05, BACK - 0.05], [BX1 - 0.05, (BOOTH_Z0 + BACK) / 2]].forEach(([x, z]) => boothParts.push(box(0.07, 0.9, 0.07, C.frame, x, by + 0.45, z)));
  // A shelf of film cans on the far wall
  boothParts.push(box(0.46, 0.05, 1.5, C.frame, -W + 0.3, by + 1.55, BOOTH_Z0 + 2.0));
  for (let i = 0; i < 3; i++) boothParts.push(part(new THREE.CylinderGeometry(0.22, 0.22, 0.09, 12), i === 1 ? C.bronze : C.metalLight, -W + 0.32, by + 1.62, BOOTH_Z0 + 1.5 + i * 0.48, 0, 0, Math.PI / 2));
  mesh(merge(boothParts), matRoom, true, true);

  // Projector body, lamp house, lens and film path (in the projector's own frame)
  const projMesh = new THREE.Mesh(merge([
    box(0.5, LH - 0.31, 0.5, C.frame, 0, (LH - 0.31) / 2, 0.15),
    box(0.62, 0.62, 1.15, C.metal, 0, LH, 0),
    box(0.5, 0.72, 0.62, C.metal, 0, LH + 0.1, 0.85),
    box(0.52, 0.06, 0.5, C.bronze, 0, LH + 0.48, 0.85),
    part(new THREE.CylinderGeometry(0.12, 0.15, 0.55, 10), C.metalLight, 0, LH, -0.8, Math.PI / 2, 0, 0),
    box(0.06, 1.05, 0.06, C.frame, 0, LH + 0.8, -0.25),
    box(0.06, 1.05, 0.06, C.frame, 0, LH + 0.8, 0.5),
    box(0.02, 0.85, 0.03, 0x0a0a0a, 0.08, LH + 0.72, -0.55, 0.3),
    box(0.02, 0.9, 0.03, 0x0a0a0a, 0.08, LH + 0.72, 0.78, -0.3),
  ]), matMetal);
  projMesh.castShadow = projMesh.receiveShadow = true;
  proj.add(projMesh);
  const lensGlow = new THREE.Mesh(new THREE.CircleGeometry(0.11, 12), new THREE.MeshBasicMaterial({ color: 0xfff1dc, toneMapped: false }));
  lensGlow.position.set(0, LH, -1.08);
  lensGlow.rotation.y = Math.PI;
  proj.add(lensGlow);

  function reelGeo() {
    const p = [
      part(new THREE.CylinderGeometry(0.58, 0.58, 0.05, 20), C.metalLight, 0, 0, 0.045, Math.PI / 2, 0, 0),
      part(new THREE.CylinderGeometry(0.58, 0.58, 0.05, 20), C.metalLight, 0, 0, -0.045, Math.PI / 2, 0, 0),
      part(new THREE.CylinderGeometry(0.44, 0.44, 0.08, 20), 0x2a221d, 0, 0, 0, Math.PI / 2, 0, 0),
      part(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 8), C.bronze, 0, 0, 0, Math.PI / 2, 0, 0),
    ];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      p.push(box(0.12, 0.3, 0.13, 0x1d1a18, Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0, 0, 0, a + Math.PI / 2));
    }
    return merge(p);
  }
  // Two reels across the top of the projector, like a pair of ears: feed in front, take-up behind
  const reelMeshes = [-0.5, 0.75].map((z) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, LH + 1.35, z);
    pivot.rotation.y = Math.PI / 2;
    proj.add(pivot);
    const m = new THREE.Mesh(reelGeo(), matMetal);
    m.castShadow = true;
    pivot.add(m);
    return m;
  });

  // The projectionist: a little figure in a cap, beside the projector
  const PJ_X = -1.25;
  const pj = new THREE.Group();
  pj.position.set(PJ_X, by, BOOTH_Z0 + 1.55);
  scene.add(pj);
  const pjBody = new THREE.Mesh(merge([
    part(new THREE.CylinderGeometry(0.2, 0.26, 0.82, 7), 0x2b2b2e, 0, 0.41, 0),
    part(new THREE.CylinderGeometry(0.3, 0.24, 0.62, 7), 0x6e5747, 0, 1.12, 0),
    box(0.1, 0.5, 0.04, 0xe9e2d6, 0, 1.18, -0.27),
    box(0.16, 0.06, 0.05, 0xa08672, 0, 1.36, -0.28),
  ]), matRoom);
  pjBody.castShadow = true;
  pj.add(pjBody);
  const pjHead = new THREE.Group();
  pjHead.position.y = 1.68;
  pj.add(pjHead);
  pjHead.add(Object.assign(new THREE.Mesh(merge([
    part(new THREE.IcosahedronGeometry(0.25, 1), 0xd9ad8c, 0, 0, 0, 0, 0, 0, 0.95, 1.05, 0.95),
    box(0.16, 0.05, 0.05, 0x3b2c22, 0, -0.08, -0.235),
    part(new THREE.CylinderGeometry(0.26, 0.27, 0.13, 9), 0x1b1b1b, 0, 0.17, 0.0),
    box(0.3, 0.035, 0.22, 0x1b1b1b, 0, 0.13, -0.27),
    box(0.27, 0.04, 0.02, 0xa08672, 0, 0.2, -0.255),
  ]), matRoom), { castShadow: true }));
  const pjEyes = new THREE.Mesh(merge([box(0.05, 0.075, 0.03, DARK, 0.085, 0.03, -0.235), box(0.05, 0.075, 0.03, DARK, -0.085, 0.03, -0.235)]), matRoom);
  pjHead.add(pjEyes);
  const pjArms = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.33, 1.38, 0);
    pj.add(pivot);
    const arm = new THREE.Mesh(merge([box(0.13, 0.56, 0.13, 0x6e5747, 0, -0.26, 0), part(new THREE.IcosahedronGeometry(0.075, 0), 0xd9ad8c, 0, -0.58, 0)]), matRoom);
    arm.castShadow = true;
    pivot.add(arm);
    return pivot;
  });
  // Minding the projector when nobody is watching him
  const PJ_IDLE = Math.atan2(-(proj.position.x - PJ_X), -(proj.position.z + 0.3 - pj.position.z));
  const pjState = { yaw: PJ_IDLE, hop: null, shake: 0, blinkAt: 2, faceUntil: 0, workUntil: 0, sulkUntil: 0 };

  // Hit area for the booth: projector and projectionist both count
  const hitBooth = new THREE.Mesh(new THREE.BoxGeometry(bw - 0.3, 3.3, BACK - BOOTH_Z0), new THREE.MeshBasicMaterial({ visible: false }));
  hitBooth.position.set(bcx + 0.15, by + 1.65, (BOOTH_Z0 + BACK) / 2);
  scene.add(hitBooth);

  /* ---------- Screen, leader and marquee ---------- */
  const vtex = new THREE.VideoTexture(film);
  vtex.colorSpace = THREE.SRGBColorSpace;
  vtex.minFilter = vtex.magFilter = THREE.LinearFilter;
  vtex.generateMipmaps = false;
  ['loadeddata', 'seeked'].forEach((e) => film.addEventListener(e, () => { vtex.needsUpdate = true }));

  const lead = document.createElement('canvas');
  lead.width = 360; lead.height = 640;
  const lx = lead.getContext('2d');
  const ltex = new THREE.CanvasTexture(lead);
  ltex.colorSpace = THREE.SRGBColorSpace;

  const screenMat = new THREE.MeshBasicMaterial({ map: ltex, toneMapped: false });
  const screen = mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), screenMat, false, false);
  screen.position.set(0, SY, SCREEN.z);

  // Soft halo the screen throws on the wall around it
  function gradientTex(stops, w = 128, h = 128) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    stops.forEach(([o, s]) => g.addColorStop(o, s));
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const soft = gradientTex([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.45)'], [1, 'rgba(255,255,255,0)']]);
  const add = (color, opacity) => new THREE.MeshBasicMaterial({ map: soft, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const halo = mesh(new THREE.PlaneGeometry(SCREEN.w * 3, SCREEN.h * 1.7), add(0xffffff, 0.22), false, false);
  halo.position.set(0, SY, FRONT + 0.02);
  // Light pools above the wall sconces
  [-4.2, 0.2].forEach((z) => {
    const p = mesh(new THREE.PlaneGeometry(2.4, 3.2), add(0xffc996, 0.32), false, false);
    p.position.set(-W + 0.14, 4.6, z);
    p.rotation.y = Math.PI / 2;
  });

  // Marquee above the screen: a lit sign with chaser bulbs round it
  const MW = 5.4, MH = 1.35, MY = SCREEN.y + SCREEN.h + 1.6, MZ = FRONT + 0.32;
  const sign = document.createElement('canvas');
  sign.width = 1024; sign.height = 256;
  const sx = sign.getContext('2d');
  const stex = new THREE.CanvasTexture(sign);
  stex.colorSpace = THREE.SRGBColorSpace;
  stex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  mesh(merge([box(MW + 0.3, MH + 0.3, 0.3, 0x141414, 0, MY, MZ - 0.1), box(MW + 0.36, 0.06, 0.36, C.bronze, 0, MY - MH / 2 - 0.15, MZ - 0.1)]), matRoom, true, false);
  const signFace = mesh(new THREE.PlaneGeometry(MW, MH), new THREE.MeshBasicMaterial({ map: stex, toneMapped: false }), false, false);
  signFace.position.set(0, MY, MZ + 0.06);
  function drawSign(name) {
    sx.fillStyle = '#0f0f0f';
    sx.fillRect(0, 0, 1024, 256);
    sx.strokeStyle = '#a08672';
    sx.lineWidth = 4;
    sx.strokeRect(22, 22, 980, 212);
    sx.textAlign = 'center';
    sx.textBaseline = 'alphabetic';
    sx.fillStyle = '#a08672';
    sx.font = '400 54px "Bebas Neue", "Arial Narrow", sans-serif';
    if ('letterSpacing' in sx) sx.letterSpacing = '10px';
    sx.fillText('NOW SHOWING', 512, 92);
    sx.fillStyle = '#f2f2f2';
    sx.font = '400 128px "Bebas Neue", "Arial Narrow", sans-serif';
    if ('letterSpacing' in sx) sx.letterSpacing = '4px';
    sx.fillText(name.toUpperCase(), 512, 212);
    stex.needsUpdate = true;
  }
  const bulbs = [];
  const BX = MW / 2 + 0.05, BY = MH / 2 + 0.05;
  for (let i = 0; i <= 14; i++) { const x = -BX + (i / 14) * BX * 2; bulbs.push([x, BY], [x, -BY]) }
  for (let i = 1; i < 4; i++) { const y = -BY + (i / 4) * BY * 2; bulbs.push([-BX, y], [BX, y]) }
  // Order the bulbs round the frame so the chase runs clockwise
  bulbs.sort((a, b) => Math.atan2(b[1], b[0] * 0.25) - Math.atan2(a[1], a[0] * 0.25));
  const bulbMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.085, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), bulbs.length);
  bulbs.forEach(([x, y], i) => {
    tmpM.makeTranslation(x, MY + y, MZ + 0.1);
    bulbMesh.setMatrixAt(i, tmpM);
    bulbMesh.setColorAt(i, col(0xffe2b8));
  });
  scene.add(bulbMesh);
  const signGlow = mesh(new THREE.PlaneGeometry(MW * 1.9, MH * 3.4), add(0xffc48f, 0.28), false, false);
  signGlow.position.set(0, MY, MZ - 0.02);
  const BULB_ON = col(0xffe6c4), BULB_OFF = col(0x4b3b30);

  /* ---------- The beam: nested additive shells and dust motes ---------- */
  const beamUniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xfff0dc) }, uPower: { value: 1 } };
  const lensHalf = [0.09, 0.12];
  const scr = [SCREEN.w / 2 - 0.02, SCREEN.h / 2 - 0.02];
  function beamGeo() {
    const pos = [], along = [], shell = [];
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    [0.42, 0.6, 0.76, 0.9, 1].forEach((k) => {
      for (let f = 0; f < 4; f++) {
        const a = corners[f], b = corners[(f + 1) % 4];
        const L = (c) => [LENS_F.x + c[0] * lensHalf[0] * k, LENS_F.y + c[1] * lensHalf[1] * k, LENS_F.z];
        const S = (c) => [SCREEN_C.x + c[0] * scr[0] * k, SCREEN_C.y + c[1] * scr[1] * k, SCREEN_C.z];
        const quad = [[L(a), 0], [S(a), 1], [S(b), 1], [L(a), 0], [S(b), 1], [L(b), 0]];
        quad.forEach(([p, t]) => { pos.push(...p); along.push(t); shell.push(k) });
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
    g.setAttribute('shell', new THREE.Float32BufferAttribute(shell, 1));
    return g;
  }
  const beam = new THREE.Mesh(beamGeo(), new THREE.ShaderMaterial({
    uniforms: beamUniforms,
    vertexShader: `attribute float along; attribute float shell; varying float vA; varying float vS; varying vec3 vW;
      void main(){ vA = along; vS = shell; vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uPower; varying float vA; varying float vS; varying vec3 vW;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){
        float smoke = n3(vW*.9 + vec3(uTime*.12, uTime*.05, -uTime*.08)) * .6 + n3(vW*2.3 - vec3(0., uTime*.1, 0.)) * .4;
        float fall = mix(1., .38, vA) * smoothstep(0., .04, vA) * smoothstep(1., .97, vA);
        float a = uPower * (.03 + .045 * smoke) * fall * (1.25 - vS * .6);
        gl_FragColor = vec4(uColor * a, 1.);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  beam.frustumCulled = false;
  scene.add(beam);

  const MOTES = 240;
  const mPos = new Float32Array(MOTES * 3), mSeed = new Float32Array(MOTES);
  for (let i = 0; i < MOTES; i++) {
    const t = Math.pow(Math.random(), 0.8) * 0.94 + 0.04, u = rand(-0.9, 0.9), v = rand(-0.9, 0.9);
    const lp = [LENS_F.x + u * lensHalf[0], LENS_F.y + v * lensHalf[1], LENS_F.z];
    const sp = [SCREEN_C.x + u * scr[0], SCREEN_C.y + v * scr[1], SCREEN_C.z];
    for (let k = 0; k < 3; k++) mPos[i * 3 + k] = lp[k] + (sp[k] - lp[k]) * t;
    mSeed[i] = Math.random() * 100;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  moteGeo.setAttribute('seed', new THREE.BufferAttribute(mSeed, 1));
  const moteUniforms = { uTime: beamUniforms.uTime, uColor: beamUniforms.uColor, uPower: beamUniforms.uPower, uScale: { value: 1 } };
  const motes = new THREE.Points(moteGeo, new THREE.ShaderMaterial({
    uniforms: moteUniforms,
    vertexShader: `attribute float seed; uniform float uTime; uniform float uScale; varying float vTw;
      void main(){ vec3 p = position + vec3(sin(uTime*.23+seed)*.16, sin(uTime*.17+seed*1.7)*.22 - .05*sin(uTime*.05+seed), cos(uTime*.19+seed*.6)*.16);
        vec4 mv = modelViewMatrix * vec4(p,1.); gl_Position = projectionMatrix * mv;
        vTw = .45 + .55 * sin(uTime*1.3 + seed*3.1); gl_PointSize = uScale * (2.2 + fract(seed)*2.4) / -mv.z; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uPower; varying float vTw;
      void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d) * vTw * uPower * .8; gl_FragColor = vec4(uColor * a, 1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  motes.frustumCulled = false;
  scene.add(motes);

  /* ---------- Lights ---------- */
  const hemi = new THREE.HemisphereLight(0xd9cbbd, 0x241d18, 1.5);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffe2c6, 2.1);
  key.position.set(9, 17, 11);
  key.target.position.set(0, 2, -1);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 2, far: 50 });
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  // The screen lights the room in the colours of the film
  const spill = new THREE.SpotLight(0xffffff, 0, 30, 1.05, 1, 0);
  spill.position.set(0, SY, SCREEN.z + 0.4);
  spill.target.position.set(0, 0.5, 3);
  scene.add(spill, spill.target);
  // The projector's light skims the heads and the curtains on its way to the screen
  const lamp = new THREE.SpotLight(0xfff0dc, 0, 30, 0.36, 0.6, 0);
  lamp.position.copy(LENS_F);
  lamp.target.position.copy(SCREEN_C);
  scene.add(lamp, lamp.target);
  // The marquee warms the curtains below it
  const signLight = new THREE.PointLight(0xffc896, 2.2, 7, 1.2);
  signLight.position.set(0, MY - 0.4, MZ + 1.2);
  scene.add(signLight);

  /* ---------- Film colour probe: a tiny copy of the frame ---------- */
  const probe = document.createElement('canvas');
  probe.width = 4; probe.height = 7;
  const pc = probe.getContext('2d', { willReadFrequently: true });
  const filmColor = new THREE.Color(0.75, 0.72, 0.68), filmTarget = new THREE.Color(0.75, 0.72, 0.68);
  let filmLuma = 0.5, lumaTarget = 0.5, probeAt = 0;
  function sample(src) {
    try {
      pc.drawImage(src, 0, 0, 4, 7);
      const d = pc.getImageData(0, 0, 4, 7).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2] }
      const n = d.length / 4 * 255;
      filmTarget.setRGB(r / n, g / n, b / n, THREE.SRGBColorSpace);
      lumaTarget = 0.2126 * r / n + 0.7152 * g / n + 0.0722 * b / n;
    } catch (e) {}
  }

  /* ---------- Countdown leader ---------- */
  const PHASES = reduceMotion ? [['start', 0.6]] : [['cue', 0.5], ['flash', 0.1], ['start', 0.55], [3, 0.6], [2, 0.6], [1, 0.6]];
  let seq = null, time = 0, onVideo = false, strobe = 0;
  const scratches = Array.from({ length: 5 }, () => ({ x: Math.random(), life: 0 }));
  function drawLeader(phase, k, label) {
    const w = lead.width, h = lead.height, cx = w / 2, cy = h / 2;
    if (phase === 'cue') {
      // The running picture, with a cue dot flashing top right, as at a reel change
      if (film.readyState >= 2) lx.drawImage(film, 0, 0, w, h); else { lx.fillStyle = '#1c1c1c'; lx.fillRect(0, 0, w, h) }
      if ((k < 0.35) || (k > 0.55 && k < 0.9)) {
        lx.fillStyle = 'rgba(242,242,242,.9)';
        lx.beginPath(); lx.arc(w - 46, 52, 15, 0, Math.PI * 2); lx.fill();
        lx.strokeStyle = 'rgba(17,17,17,.7)'; lx.lineWidth = 3; lx.stroke();
      }
      return;
    }
    if (phase === 'flash') { lx.fillStyle = '#f2f2f2'; lx.fillRect(0, 0, w, h); return }
    lx.fillStyle = '#1c1c1c';
    lx.fillRect(0, 0, w, h);
    lx.textAlign = 'center';
    lx.textBaseline = 'middle';
    if (phase === 'start' || phase === 'wait') {
      lx.fillStyle = '#f2f2f2';
      lx.font = '400 92px "Bebas Neue", "Arial Narrow", sans-serif';
      lx.fillText('PICTURE', cx, cy - 46);
      lx.fillText('START', cx, cy + 44);
      lx.fillStyle = '#a08672';
      lx.fillRect(cx - 70, cy + 102, 140, 8);
    } else {
      const R = w * 0.4;
      // The sweep: a bronze wedge running clockwise from twelve
      lx.save();
      lx.globalAlpha = 0.85;
      lx.fillStyle = '#a08672';
      lx.beginPath();
      lx.moveTo(cx, cy);
      lx.arc(cx, cy, h, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
      lx.closePath();
      lx.fill();
      lx.restore();
      lx.strokeStyle = 'rgba(242,242,242,.85)';
      lx.lineWidth = 3;
      lx.beginPath(); lx.moveTo(cx, 0); lx.lineTo(cx, h); lx.moveTo(0, cy); lx.lineTo(w, cy); lx.stroke();
      lx.beginPath(); lx.arc(cx, cy, R, 0, Math.PI * 2); lx.stroke();
      lx.beginPath(); lx.arc(cx, cy, R * 0.82, 0, Math.PI * 2); lx.stroke();
      lx.fillStyle = '#1c1c1c';
      lx.beginPath(); lx.arc(cx, cy, R * 0.66, 0, Math.PI * 2); lx.fill();
      lx.fillStyle = '#f2f2f2';
      lx.font = '400 230px "Bebas Neue", "Arial Narrow", sans-serif';
      lx.fillText(String(phase), cx, cy + 12);
    }
    lx.fillStyle = 'rgba(163,163,163,.9)';
    lx.font = '400 26px "Bebas Neue", "Arial Narrow", sans-serif';
    lx.fillText(label, cx, 44);
    lx.fillText('SIZZLE', cx, h - 40);
    // Scratches, dust and a soft vignette, so it reads as film
    if (motion) {
      lx.strokeStyle = 'rgba(242,242,242,.18)';
      lx.lineWidth = 1.5;
      scratches.forEach((s) => {
        if (s.life <= 0 && Math.random() < 0.08) { s.x = Math.random(); s.life = rand(3, 9) }
        if (s.life-- > 0) { lx.beginPath(); lx.moveTo(s.x * w, 0); lx.lineTo(s.x * w + rand(-3, 3), h); lx.stroke() }
      });
      lx.fillStyle = 'rgba(242,242,242,.35)';
      for (let i = 0; i < 7; i++) lx.fillRect(Math.random() * w, Math.random() * h, rand(1, 3.5), rand(1, 3.5));
    }
    const vg = lx.createRadialGradient(cx, cy, h * 0.25, cx, cy, h * 0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.55)');
    lx.fillStyle = vg;
    lx.fillRect(0, 0, w, h);
  }

  const stillAt = (r) => (r.cues.find((c) => /reveal/i.test(c.name)) || { t: 0.5 }).t + 1.2;
  function setScreen(video) {
    onVideo = video;
    screenMat.map = video ? vtex : ltex;
    screenMat.needsUpdate = true;
    api.setScreen(video);
  }
  function change(i, opts = {}) {
    const r = reels[i];
    drawSign(r.name);
    // A rethread shows the cue dots on the running picture first; from a blank screen it starts at the leader
    const wasOn = onVideo && !opts.first;
    const list = wasOn ? PHASES : PHASES.filter(([p]) => p !== 'cue' && p !== 'flash');
    seq = { i, list, idx: 0, t0: time, label: 'REEL ' + String(i + 1).padStart(2, '0') + ' · ' + r.name.toUpperCase(), loaded: false };
    onVideo = false;
    screenMat.map = ltex;
    screenMat.needsUpdate = true;
    if (!wasOn) { api.loadFilm(i); seq.loaded = true; setScreen(false) }
    strobe = opts.first ? 0 : 1;
    if (!opts.first) {
      // Heads turn to the booth; the projectionist gets to work
      people.forEach((p) => {
        if (p.move) return;
        p.lookUntil = time + rand(1.1, 2.2);
        p.lookDelay = time + rand(0, 0.35);
        p.lookYaw = yawTo(p, hitBooth.position) * 0.75;
      });
      pjState.workUntil = time + 1.6;
      pjState.hop = { t0: time, dur: 0.35, h: 0.18 };
      if (opts.booth === 'angry') { pjState.sulkUntil = time + 3.5; pjState.shake = 0.06; for (let k = 0; k < 6; k++) puff(pj.position.x, by + 2.1, pj.position.z) }
      else if (opts.booth === 'annoyed') pjState.shake = 0.04;
    }
  }
  function cut() {
    if (!seq) return;
    if (!seq.loaded) { api.loadFilm(seq.i); seq.loaded = true }
    seq = null;
    setScreen(true);
  }
  function runSeq() {
    if (!seq) return;
    let ph = seq.list[seq.idx];
    let k = (time - seq.t0) / ph[1];
    while (k >= 1 && seq.idx < seq.list.length - 1) {
      seq.t0 += ph[1];
      seq.idx++;
      ph = seq.list[seq.idx];
      k = (time - seq.t0) / ph[1];
    }
    if (!seq.loaded && ph[0] !== 'cue') { api.loadFilm(seq.i); seq.loaded = true; setScreen(false) }
    if (k >= 1) {
      // Countdown done: cut to picture as soon as there is a frame
      if (film.readyState >= 2) {
        // Playing starts from the top; a paused or still room shows a frame just after the reveal
        try { film.currentTime = api.playing ? 0 : stillAt(reels[seq.i]) } catch (e) {}
        seq = null;
        setScreen(true);
        return;
      }
      drawLeader('start', 1, seq.label);
    } else drawLeader(ph[0], clamp(k, 0, 1), seq.label);
    ltex.needsUpdate = true;
    if (ph[0] === 'flash') strobe = 1;
    if (time - probeAt > 0.12) { probeAt = time; sample(lead) }
  }

  /* ---------- Steam for a cross projectionist ---------- */
  const puffs = [];
  const puffGeo = new THREE.IcosahedronGeometry(0.08, 0);
  function puff(x, y, z) {
    if (!motion) return;
    let s = puffs.find((q) => q.life <= 0);
    if (!s) {
      if (puffs.length > 30) return;
      s = { mesh: new THREE.Mesh(puffGeo, new THREE.MeshStandardMaterial({ color: 0xd9d4cc, flatShading: true, transparent: true })) };
      scene.add(s.mesh);
      puffs.push(s);
    }
    s.mesh.position.set(x + rand(-0.15, 0.15), y, z + rand(-0.15, 0.15));
    s.v = new THREE.Vector3(rand(-0.3, 0.3), rand(0.9, 1.4), rand(-0.3, 0.3));
    s.life = s.max = rand(0.6, 1);
    s.mesh.visible = true;
  }

  /* ---------- Camera: a three-quarter view from behind the booth, fitted to the stage ---------- */
  const target = new THREE.Vector3(0, 4.4, -1.2);
  const tmp = new THREE.Vector3();
  let dist = 40, baseAz = 0.6, baseEl = 0.4, viewW = 1, viewH = 1, ptx = 0, pty = 0, px = 0, py = 0;
  function aim(d, az, el) {
    camera.position.set(target.x + d * Math.sin(az) * Math.cos(el), target.y + d * Math.sin(el), target.z + d * Math.cos(az) * Math.cos(el));
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }
  const MUST_SEE = [
    [-W - 0.3, WALL_H, FRONT - 0.3], [W, WALL_H, FRONT - 0.3], [-W - 0.3, WALL_H, BACK], [-W - 0.3, -1.1, BACK],
    [W + 0.2, -1.1, FRONT], [W + 0.2, 0, FRONT], [0, MY + MH, MZ], [BX1, by + bh + 0.3, BACK], [BX1, -1.1, BACK], [W + 0.2, -1.1, MAIN_BACK],
  ].map((v) => new THREE.Vector3(...v));
  // On narrow stages only the heart of the room has to fit; the walls and slab may run off the edges
  const CORE = [
    [0, MY + MH, MZ], [-SCREEN.w / 2 - 1.2, MY + MH, FRONT + 0.6], [W, 0.45, FRONT + 1.1], [W, 0, MAIN_BACK - 0.6],
    [-W + 0.6, by + bh, BOOTH_Z0], [-W + 0.6, by, BACK], [BX1, by + 1, BACK], [BX1, 0, BACK],
  ].map((v) => new THREE.Vector3(...v));
  let fitPoints = MUST_SEE;
  function bounds() {
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    fitPoints.forEach((v) => {
      tmp.copy(v).project(camera);
      x0 = Math.min(x0, tmp.x); x1 = Math.max(x1, tmp.x); y0 = Math.min(y0, tmp.y); y1 = Math.max(y1, tmp.y);
    });
    return { x0, x1, y0, y1 };
  }
  function fit() {
    viewW = stage.clientWidth || 1;
    viewH = stage.clientHeight || 1;
    renderer.setSize(viewW, viewH, false);
    camera.aspect = viewW / viewH;
    camera.updateProjectionMatrix();
    fitPoints = camera.aspect < 1.1 ? CORE : MUST_SEE;
    // Wide stages get a broader three-quarter view; tall ones look more down the room
    const a = clamp((camera.aspect - 0.6) / 1.2, 0, 1);
    baseAz = (26 + a * 12) * DEG;
    baseEl = (25 - a * 7) * DEG;
    target.set(0, 4, -1);
    for (let pass = 0; pass < 3; pass++) {
      let lo = 10, hi = 160;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        aim(mid, baseAz, baseEl);
        const b = bounds();
        const ok = b.x0 > -0.98 && b.x1 < 0.98 && b.y0 > -0.96 && b.y1 < 0.94;
        if (ok) hi = mid; else lo = mid;
      }
      dist = hi;
      aim(dist, baseAz, baseEl);
      // Re-centre the target on the room's projected bounds
      const b = bounds();
      const cxn = (b.x0 + b.x1) / 2, cyn = (b.y0 + b.y1) / 2 - 0.02;
      const halfH = Math.tan((camera.fov / 2) * DEG) * dist, halfW = halfH * camera.aspect;
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      target.addScaledVector(right, cxn * halfW).addScaledVector(up, cyn * halfH);
    }
    aim(dist, baseAz, baseEl);
    moteUniforms.uScale.value = viewH * renderer.getPixelRatio() * 0.06;
  }
  fit();
  new ResizeObserver(fit).observe(stage);

  /* ---------- Pointer: parallax, hover, click ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let hovered = null;
  function pickAt(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects([hitPeople, hitBooth], false)[0];
    if (!h) return null;
    return h.object === hitBooth ? booth : people[h.instanceId].sp;
  }
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    ptx = ((e.clientX - r.left) / r.width) * 2 - 1;
    pty = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (e.pointerType !== 'mouse') return;
    const sp = pickAt(e);
    if (sp === hovered) return;
    hovered = sp;
    canvas.style.cursor = sp ? 'pointer' : '';
    if (sp) {
      api.hover(sp);
      const p = people.find((q) => q.sp === sp);
      if (p && !p.move) { p.hop = { t0: time, dur: 0.3, h: 0.1 }; p.lookUntil = time + 2.2; p.lookDelay = time; p.lookYaw = yawTo(p, camera.position) }
      if (sp === booth) pjState.faceUntil = time + 2.2;
    }
  });
  stage.addEventListener('pointerleave', () => { ptx = pty = 0; hovered = null; canvas.style.cursor = '' });
  canvas.addEventListener('click', (e) => {
    const sp = pickAt(e);
    if (sp) api.poke(sp);
  });

  function yawTo(p, v) {
    // A seated bust faces -z; turn it toward a point, but only as far as a neck and a chair allow
    const raw = Math.atan2(-(v.x - p.pos.x), -(v.z - p.pos.z));
    let d = raw - p.seat.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    return clamp(d, -2.3, 2.3);
  }

  /* ---------- Run only while on screen ---------- */
  let running = false, raf = 0, last = 0, lastFilmT = 0;
  function visible(on) {
    if (on && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame) }
    if (!on) { running = false; cancelAnimationFrame(raf) }
  }

  const bobM = new THREE.Matrix4();
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = clamp((now - last) / 1000, 0, 0.1); // rAF stamps can predate performance.now()
    last = Math.max(last, now);
    time += dt;
    const t = time;

    // Camera with soft parallax and a slow drift
    px += (ptx - px) * Math.min(1, dt * 2.5) * motion;
    py += (pty - py) * Math.min(1, dt * 2.5) * motion;
    aim(dist, baseAz + px * 0.07 + Math.sin(t * 0.13) * 0.012 * motion, baseEl - py * 0.03);

    runSeq();
    const playingNow = onVideo && !film.paused;

    // Drop cue: the audience bounces, someone notices, the sleeper wakes
    if (onVideo) {
      const ft = film.currentTime, drop = reels[api.current].drop;
      if (drop && lastFilmT < drop && ft >= drop && ft - lastFilmT < 1) {
        people.forEach((p) => { if (!p.move) p.hop = { t0: t + rand(0, 0.15), dur: 0.36, h: 0.16 } });
        const sl = byKind('sleeper');
        if (sl && Math.random() < 0.5) speakOnce(sl.sp, LINES.woke);
        else speakOnce(people[Math.floor(Math.random() * people.length)].sp, LINES.drop);
      }
      lastFilmT = ft;
      if (t - probeAt > 0.15) { probeAt = t; sample(film) }
    }

    // Light from the screen follows the picture; a rethread makes it stutter
    strobe = Math.max(0, strobe - dt * 1.6);
    const fl = strobe > 0 && motion ? 1 - strobe * rand(0, 0.6) : 1;
    filmColor.lerp(filmTarget, Math.min(1, dt * 4));
    filmLuma += (lumaTarget - filmLuma) * Math.min(1, dt * 4);
    const lumaK = 0.45 + filmLuma * 0.9;
    screenMat.color.setScalar(fl);
    spill.color.copy(filmColor).lerp(col(0xffffff), 0.25);
    spill.intensity = 2.4 * lumaK * fl;
    halo.material.color.copy(filmColor);
    halo.material.opacity = 0.2 * lumaK * fl;
    beamUniforms.uColor.value.copy(filmColor).lerp(col(0xfff0dc), 0.55);
    beamUniforms.uPower.value = (0.75 + 0.5 * lumaK) * fl * (1 + (motion ? Math.sin(t * 31) * 0.02 : 0));
    beamUniforms.uTime.value = t * motion;
    lamp.intensity = 5 * fl;
    lensGlow.material.color.setScalar(0.8 + 0.2 * fl);

    // Reels turn while the film runs, fast while rethreading
    const spin = (playingNow ? 1.3 : 0) + (seq && motion ? 5 : 0);
    reelMeshes[0].rotation.z -= spin * dt * motion;
    reelMeshes[1].rotation.z -= spin * 0.72 * dt * motion;

    // Chaser bulbs
    const chase = Math.floor(t * 7 * motion);
    for (let i = 0; i < bulbs.length; i++) bulbMesh.setColorAt(i, (i + chase) % 3 === 0 ? BULB_ON : BULB_OFF);
    bulbMesh.instanceColor.needsUpdate = true;

    stepPeople(t, dt);
    stepBooth(t, dt);

    puffs.forEach((s) => {
      if (s.life <= 0) return;
      s.life -= dt;
      s.mesh.position.addScaledVector(s.v, dt);
      const k = 1 - s.life / s.max;
      s.mesh.scale.setScalar(0.6 + k * 1.6);
      s.mesh.material.opacity = Math.max(0, 0.85 * (1 - k));
      if (s.life <= 0) s.mesh.visible = false;
    });

    renderer.render(scene, camera);
    placeBubbles();
  }
  function speakOnce(sp, pool) {
    if (sp.el.classList.contains('is-on')) return;
    sp.text.textContent = pool[Math.floor(Math.random() * pool.length)];
    sp.el.dataset.mood = 'calm';
    sp.el.classList.remove('is-on');
    void sp.el.offsetWidth;
    sp.el.classList.add('is-on');
    sp.w = 0;
    clearTimeout(sp.hideT);
    sp.hideT = setTimeout(() => sp.el.classList.remove('is-on'), 2400);
  }

  function stepPeople(t, dt) {
    people.forEach((p) => {
      let y = p.pos.y, yaw = p.seat.yaw;
      if (p.move) {
        const mv = p.move, k = clamp((t - mv.t0) / mv.dur, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        p.pos.lerpVectors(mv.from, mv.to, e);
        y = p.pos.y + Math.sin(Math.PI * k) * 1.1;
        yaw = Math.atan2(-(mv.to.x - mv.from.x), -(mv.to.z - mv.from.z));
        if (k >= 1) { p.move = null; p.pos.copy(mv.to); p.hop = { t0: t, dur: 0.25, h: 0.08 } }
      }
      // Turning round: to the camera when pointed at, to the booth on a rethread
      let want = 0;
      if (!p.move && t < p.lookUntil && t >= (p.lookDelay || 0)) want = p.lookYaw;
      p.look += (want - p.look) * Math.min(1, dt * 6);
      if (!p.move) yaw = p.seat.yaw + p.look;
      if (p.hop) {
        const k = (t - p.hop.t0) / p.hop.dur;
        if (k >= 1) p.hop = null; else if (k > 0) y += Math.sin(Math.PI * k) * p.hop.h * motion;
      }
      p.shake = Math.max(0, p.shake - dt * 0.3);
      const sleeper = p.sp.kind === 'sleeper' && t > (p.wokeUntil || 0) && !p.move;
      p.roll += ((sleeper ? 0.32 : 0) - p.roll) * Math.min(1, dt * 3);
      const breathe = 1 + Math.sin(t * (sleeper ? 1.1 : 2) + p.phase) * 0.018 * motion;
      tmpM.compose(
        tmpP.set(p.pos.x + Math.sin(t * 50) * p.shake * motion, y, p.pos.z),
        tmpQ.setFromEuler(tmpE.set(sleeper ? 0.12 : 0, yaw, p.roll)),
        tmpS.set(1, breathe, 1),
      );
      crowd.forEach((m) => m.setMatrixAt(p.i, tmpM));
      bobM.compose(tmpP.set(p.pos.x, y + 0.62, p.pos.z), tmpQ.setFromEuler(tmpE.set(0, yaw, 0)), tmpS.set(1, 1, 1));
      hitPeople.setMatrixAt(p.i, bobM);
      if (p.sp.kind === 'popcorn') {
        popcorn.position.set(0.32, 0.98, -0.22).applyMatrix4(tmpM);
        popcorn.rotation.y = yaw;
      }
    });
    crowd.forEach((m) => { m.instanceMatrix.needsUpdate = true });
    hitPeople.instanceMatrix.needsUpdate = true;
  }

  function stepBooth(t, dt) {
    const s = pjState;
    // Faces you when pointed at or cross; otherwise minds the projector
    const face = t < s.faceUntil || (booth.anger >= ANNOYED && t >= s.sulkUntil);
    const sulk = t < s.sulkUntil;
    const wantYaw = sulk ? 2.4 : face ? Math.atan2(-(camera.position.x - pj.position.x), -(camera.position.z - pj.position.z)) : PJ_IDLE;
    let d = wantYaw - s.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    s.yaw += d * Math.min(1, dt * 6);
    pj.rotation.y = s.yaw;
    let y = by;
    if (s.hop) {
      const k = (t - s.hop.t0) / s.hop.dur;
      if (k >= 1) s.hop = null; else y += Math.sin(Math.PI * k) * s.hop.h * motion;
    }
    s.shake = Math.max(0, s.shake - dt * 0.25);
    pj.position.y = y;
    pj.position.x = PJ_X + Math.sin(t * 50) * s.shake * motion;
    const working = t < s.workUntil;
    pjArms[0].rotation.x = working ? -2.2 + Math.sin(t * 14) * 0.25 * motion : sulk ? -1.2 : Math.sin(t * 1.4) * 0.05 * motion;
    pjArms[1].rotation.x = working ? -1.9 + Math.cos(t * 12) * 0.25 * motion : sulk ? -1.2 : Math.sin(t * 1.4 + 1) * 0.05 * motion;
    pjArms[0].rotation.z = sulk ? -0.9 : 0;
    pjArms[1].rotation.z = sulk ? 0.9 : 0;
    pjHead.rotation.z = Math.sin(t * 1.2) * 0.05 * motion;
    pjHead.rotation.x = working ? 0.3 : 0;
    const blink = t > s.blinkAt && t < s.blinkAt + 0.12;
    if (t > s.blinkAt + 0.12) s.blinkAt = t + rand(2, 5);
    pjEyes.scale.y = blink ? 0.15 : 1;
    if (booth.anger >= ANGRY && motion && t > (s.steamAt || 0)) { s.steamAt = t + 0.12; puff(pj.position.x, by + 2.1, pj.position.z) }
  }

  /* Bubbles: above each head, nearer speakers keep their spot, others stack up */
  const headTop = new THREE.Vector3();
  function placeBubbles() {
    const shown = [];
    people.forEach((p) => add(p.sp, headTop.set(p.pos.x, p.pos.y + 2.05, p.pos.z), p.pos.z));
    add(booth, headTop.set(pj.position.x, by + 2.4, pj.position.z), pj.position.z);
    function add(sp, v, z) {
      if (!sp.el.classList.contains('is-on')) return;
      if (!sp.w) { sp.w = sp.el.offsetWidth; sp.h = sp.el.offsetHeight }
      v.project(camera);
      const x = (v.x + 1) / 2 * viewW, half = sp.w / 2;
      shown.push({ el: sp.el, x, cx: clamp(x, half + 6, viewW - half - 6), y: (1 - v.y) / 2 * viewH, w: sp.w, h: sp.h, z });
    }
    shown.sort((a, b) => b.y - a.y);
    const placed = [];
    shown.forEach((s) => {
      for (let moved = true, guard = 0; moved && guard < 12; guard++) {
        moved = false;
        for (const q of placed) {
          if (Math.abs(s.cx - q.cx) < (s.w + q.w) / 2 + 4 && s.y > q.y - q.h - 4 && s.y - s.h < q.y) { s.y = q.y - q.h - 4; moved = true }
        }
      }
      placed.push(s);
      s.el.style.setProperty('--tail', clamp(s.x - s.cx, -s.w / 2 + 14, s.w / 2 - 14).toFixed(1) + 'px');
      s.el.style.transform = 'translate(' + s.cx.toFixed(1) + 'px,' + Math.max(s.h + 2, s.y).toFixed(1) + 'px) translate(-50%,-100%)';
      s.el.style.zIndex = String(100 + Math.round(s.z * 10));
    });
  }

  // First frame now, even off screen: shaders compile early and the room is there when it scrolls in
  drawSign(reels[api.current].name);
  drawLeader('start', 0, 'REEL 01');
  ltex.needsUpdate = true;
  stepPeople(0, 0);
  stepBooth(0, 0);
  renderer.render(scene, camera);
  api.firstFrame();
  if (document.fonts && document.fonts.load) {
    document.fonts.load('400 64px "Bebas Neue"').then(() => { drawSign(reels[api.current].name); if (!running) renderer.render(scene, camera) }).catch(() => {});
  }
  visible(stage.getBoundingClientRect().top < innerHeight && stage.getBoundingClientRect().bottom > 0);

  return {
    change,
    cut,
    visible,
    react(sp, lvl) {
      const p = people.find((q) => q.sp === sp);
      if (!p || p.move) return;
      if (lvl === 'turn') { p.lookUntil = time + 2; p.lookDelay = time; p.lookYaw = yawTo(p, camera.position) }
      else {
        p.hop = { t0: time, dur: 0.3, h: lvl === 'annoyed' ? 0.12 : 0.2 };
        p.lookUntil = time + 2.4; p.lookDelay = time; p.lookYaw = yawTo(p, camera.position);
        if (lvl === 'annoyed') p.shake = 0.04;
        if (p.sp.kind === 'sleeper') p.wokeUntil = time + 8;
      }
    },
    moveSeat(sp) {
      const p = people.find((q) => q.sp === sp);
      if (!p || p.move || !motion) return false;
      const taken = new Set(people.map((q) => q.seat));
      const free = seats.filter((st) => !taken.has(st) && Math.abs(st.r - p.seat.r) + Math.abs(st.s - p.seat.s) >= 3);
      const st = free[Math.floor(Math.random() * free.length)];
      if (!st) return false;
      p.move = { from: p.pos.clone(), to: new THREE.Vector3(st.x, st.y, st.z), t0: time + 0.5, dur: 1.1 };
      p.seat = st;
      p.sp.row = st.r; p.sp.seat = st.s;
      p.sp.label = 'ABCDE'[st.r] + (st.s + 1);
      setTimeout(() => { p.sp.el.querySelector('b').textContent = p.sp.label }, 1700);
      return true;
    },
  };
}
