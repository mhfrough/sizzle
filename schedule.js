/* Production schedule: tabs for seven scenes, a monitor that builds each scene's artefact, and an auto-advance
   that runs only while the section is on screen and nobody has touched it. Self-initialising; needs no other script. */
(() => {
  const root = document.querySelector('#how.sched, #how .sched');
  if (!root) return;
  const $ = (s, el = root) => el.querySelector(s);
  const $$ = (s, el = root) => [...el.querySelectorAll(s)];

  const tabs = $$('.sc-list [role="tab"]');
  const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
  if (!tabs.length || panels.some((p) => !p)) return;

  const list = $('.sc-list'), clap = $('.sc-clap'), prog = $('.sc-prog i'), autoBtn = $('.sc-auto'), scLabel = $('.sc-bar-sc');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 860px)');
  const STEP = 5600;               // ms per scene while auto-advancing
  const DUR = 25;                  // reel length on the cut timeline

  let cur = Math.max(0, tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'));
  let shownAt = performance.now(); // when the current scene came on (drives its own animation)
  let elapsed = 0;                 // auto-advance time spent on the current scene
  let last = 0, raf = 0;
  let auto = !reduce.matches;      // reduced motion: start paused, the Play button is still there
  let stopped = false;             // the person interacted: never resume on our own
  let inView = false, hovered = false;

  root.classList.add('is-live');
  autoBtn.hidden = false;

  /* Per-scene drivers for the parts CSS can't do alone: the playhead on the cut, the frame counter on the print */
  const cut = (() => {
    const p = panels[2], art = $('.sc-a3', p);
    if (!art) return null;
    const cues = $$('.sc-lane .sc-cue', art), lines = $$('.sc-ln', art), frames = $$('.sc-pv .sc-fr', art), tc = $('.sc-tc', art);
    const within = (el, t) => t >= +el.dataset.a && t < +el.dataset.b;
    let lastT = -1;
    return (ms) => {
      // a 25-second sweep in 4.6 s, a short hold on the last frame, then round again
      const cyc = 5600, sweep = 4600, k = ms % cyc;
      const t = reduce.matches ? 2.95 : Math.min(DUR, Math.max(0, (k - 150) / sweep * DUR));
      if (Math.abs(t - lastT) < 0.01) return;
      lastT = t;
      art.style.setProperty('--t', t.toFixed(3));
      tc.textContent = t.toFixed(2).padStart(5, '0');
      cues.forEach((el) => el.classList.toggle('is-on', within(el, t)));
      lines.forEach((el) => el.classList.toggle('is-on', within(el, t)));
      frames.forEach((el) => el.classList.toggle('is-on', within(el, t)));
    };
  })();

  const print = (() => {
    const p = panels[6], n = $('.sc-big-n', p), meter = $('.sc-meter', p), log = $('.sc-log', p);
    if (!n) return null;
    const TOTAL = 750, START = 300, RUN = 2600;
    let lastF = -1;
    return (ms) => {
      const f = reduce.matches ? TOTAL : Math.round(Math.max(0, Math.min(1, (ms - START) / RUN)) * TOTAL);
      if (f === lastF) return;
      lastF = f;
      n.textContent = String(f).padStart(3, '0');
      meter.style.setProperty('--p', f / TOTAL);
      // render.js prints a line every 60 frames; the last one it prints is frame 720. About 0.2 s a frame.
      const shown = Math.min(720, Math.floor(f / 60) * 60);
      log.textContent = `frame ${shown} / ${TOTAL} ${Math.round(shown * 0.2)}s`;
      p.classList.toggle('is-done', f >= TOTAL);
    };
  })();
  const drivers = { 2: cut, 6: print };

  /* Show a scene: tabs, panels, restart its build, clap the sticks */
  // `init`: the first call, before the page has painted. Nothing has played yet, so it skips the two layout
  // reads (the animation restart and the chip scroll) and leaves the first frame free of forced reflows.
  const show = (i, { focus = false, fromAuto = false, init = false } = {}) => {
    const changed = i !== cur;
    cur = i;
    tabs.forEach((t, n) => {
      const on = n === i;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      panels[n].hidden = !on;
      panels[n].classList.toggle('is-on', on);
      panels[n].classList.remove('is-play', 'is-done');
    });
    if (!init) void panels[i].offsetWidth; // restart this panel's own animations
    panels[i].classList.add('is-play');
    if (scLabel) scLabel.textContent = 'Sc. ' + String(i + 1).padStart(2, '0');
    if (changed && clap && !reduce.matches) { clap.classList.remove('is-clap'); void clap.offsetWidth; clap.classList.add('is-clap') }
    shownAt = performance.now();
    elapsed = 0;
    if (drivers[i]) drivers[i](0);
    if (focus) tabs[i].focus();
    // keep the active chip in view inside the strip without scrolling the page
    if (narrow.matches && list && !init) {
      const t = tabs[i], l = list.getBoundingClientRect(), r = t.getBoundingClientRect();
      if (r.left < l.left || r.right > l.right) list.scrollTo({ left: list.scrollLeft + r.left - l.left - 16, behavior: fromAuto && !reduce.matches ? 'smooth' : 'auto' });
    }
  };

  const setAuto = (on) => {
    auto = on;
    root.classList.toggle('is-auto', on);
    autoBtn.textContent = on ? 'Pause' : 'Play';
    autoBtn.setAttribute('aria-label', on ? 'Pause the schedule' : 'Play the schedule, one scene every few seconds');
    if (!on) prog.style.setProperty('--p', 0);
    elapsed = 0;
  };

  const stop = () => { if (!stopped) { stopped = true; setAuto(false) } };

  /* One clock for everything: auto-advance, its hairline, and the current scene's driver */
  const tick = (now) => {
    const dt = last ? Math.min(100, now - last) : 0;
    last = now;
    if (auto && inView && !hovered && !document.hidden) {
      elapsed += dt;
      if (elapsed >= STEP) show((cur + 1) % tabs.length, { fromAuto: true });
    }
    prog.style.setProperty('--p', auto ? Math.min(1, elapsed / STEP) : 0);
    const d = drivers[cur];
    if (d) d(now - shownAt);
    raf = requestAnimationFrame(tick);
  };
  const run = () => { if (!raf) { last = 0; raf = requestAnimationFrame(tick) } };
  const halt = () => { cancelAnimationFrame(raf); raf = 0 };

  /* Tabs: click or arrow keys. Any interaction stops the auto-advance for good. */
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => { stop(); if (i !== cur) show(i) });
    t.addEventListener('keydown', (e) => {
      const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      let to = null;
      if (k) to = (i + k + tabs.length) % tabs.length;
      if (e.key === 'Home') to = 0;
      if (e.key === 'End') to = tabs.length - 1;
      if (to == null) return;
      e.preventDefault();
      stop();
      show(to, { focus: true });
    });
  });
  const isBtn = (e) => e.target instanceof Element && e.target.closest('.sc-auto');
  root.addEventListener('pointerdown', (e) => { if (!isBtn(e)) stop() });
  root.addEventListener('keydown', (e) => { if (!isBtn(e)) stop() });
  root.addEventListener('focusin', (e) => { if (!isBtn(e)) stop() });
  list.addEventListener('wheel', stop, { passive: true });
  list.addEventListener('touchstart', stop, { passive: true });
  // reading the monitor with the pointer on it holds the clock (without stopping it)
  $('.sc-body').addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hovered = true });
  $('.sc-body').addEventListener('pointerleave', () => { hovered = false });

  autoBtn.addEventListener('click', () => {
    if (auto) { stopped = true; setAuto(false) }
    else { stopped = false; setAuto(true); show(cur) }
  });

  const orient = () => list.setAttribute('aria-orientation', narrow.matches ? 'horizontal' : 'vertical');
  orient();
  narrow.addEventListener?.('change', orient);

  setAuto(auto);
  show(cur, { init: true });

  /* On screen: run the clock and replay the scene. Off screen: everything stops. */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      const was = inView;
      inView = e.isIntersecting;
      if (inView) { if (!was) show(cur); run() } else halt();
    }, { threshold: 0.35 }).observe($('.sc-mon'));
  } else { inView = true; run() }
  document.addEventListener('visibilitychange', () => { if (document.hidden) halt(); else if (inView) run() });
})();
