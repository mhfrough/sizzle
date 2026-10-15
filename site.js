/* Sizzle page: the how-to loop, output index, the cue rail, copy buttons, reveals, GitHub stars. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* How it runs: four scenes on one clock, typed and counted as it goes. Off screen it stops;
     under reduced motion it never starts and the still list shows instead. */
  const howto = $('.howto');
  if (howto && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const scenes = $$('.scene', howto), steps = $$('.howto-steps li', howto), LEN = 4000, CHAR = 45;
    const typed = $$('[data-type]', howto).map((el) => {
      const text = el.textContent;
      el.innerHTML = '<span class="t-on"></span><span class="t-off"></span>';
      return { el, text, on: el.firstChild, off: el.lastChild, at: +el.dataset.at, scene: el.closest('.scene') };
    });
    const counts = $$('[data-count]', howto).map((el) => ({ el, at: +el.dataset.at, dur: +el.dataset.dur, to: +el.dataset.to, scene: el.closest('.scene') }));
    let cur = 0, start = 0, raf = 0;
    const paint = (ms) => {
      const s = scenes[cur];
      typed.forEach((x) => {
        if (x.scene !== s) return;
        const k = Math.max(0, Math.min(x.text.length, Math.floor((ms - x.at) / CHAR)));
        x.on.textContent = x.text.slice(0, k); x.off.textContent = x.text.slice(k);
        x.el.classList.toggle('typing', k < x.text.length);
      });
      counts.forEach((c) => {
        if (c.scene !== s) return;
        const p = Math.max(0, Math.min(1, (ms - c.at) / c.dur));
        c.el.textContent = String(Math.round(p * c.to)).padStart(3, '0');
        s.style.setProperty('--p', p);
      });
    };
    const show = (i) => {
      cur = i; start = performance.now();
      scenes.concat(steps).forEach((el) => el.classList.remove('is-on'));
      void howto.offsetWidth; // restart the scene's own animations
      scenes[i].classList.add('is-on');
      steps.forEach((el, n) => { el.classList.toggle('is-on', n === i); el.classList.toggle('is-done', n < i) });
      paint(0);
    };
    const tick = (t) => {
      if (t - start >= LEN) show((cur + 1) % scenes.length); else paint(t - start);
      raf = requestAnimationFrame(tick);
    };
    howto.classList.add('is-live');
    new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      if (e.isIntersecting) { show(cur); raf = requestAnimationFrame(tick) }
    }).observe(howto);
  }

  /* Reveal each part once as it enters, staggered inside its section. Never leaves content hidden. */
  const reveals = $$('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    reveals.forEach((el) => {
      const sibs = [...el.parentElement.querySelectorAll(':scope > [data-reveal]')];
      el.style.setProperty('--delay', sibs.indexOf(el) * 80 + 'ms');
      io.observe(el);
    });
    addEventListener('load', () => setTimeout(() => reveals.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) el.classList.add('is-in');
    }), 2500));
  } else reveals.forEach((el) => el.classList.add('is-in'));

  /* Output index: one tab per thing a run produces */
  const tabs = $$('.reels-index [role="tab"]');
  const select = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (!on) { panel.hidden = true; const v = $('video', panel); if (v) v.pause(); }
    });
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    panel.hidden = false;
    panel.style.animation = 'none'; void panel.offsetWidth; panel.style.animation = '';
    if (focus) tab.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (k) { e.preventDefault(); select(tabs[(i + k + tabs.length) % tabs.length], true) }
    });
  });

  /* Cue rail: drag, click or use the arrow keys to scrub the reel; notes jump to their cue */
  const video = $('#cue-video'), rail = $('#rail'), panel = $('.cue-panel');
  if (video && rail) {
    video.removeAttribute('controls');
    const DUR = 25;
    const notes = $$('.cue-plate .note');
    const set = (t) => {
      const p = Math.max(0, Math.min(1, t / DUR));
      rail.style.setProperty('--p', p);
      rail.setAttribute('aria-valuenow', (p * DUR).toFixed(1));
      rail.setAttribute('aria-valuetext', (p * DUR).toFixed(1) + ' seconds');
      let cur = null;
      notes.forEach((n) => { if (+n.dataset.t <= t + 0.05) cur = n });
      notes.forEach((n) => n.classList.toggle('is-on', n === cur));
    };
    const seek = (t) => { video.currentTime = Math.max(0, Math.min(DUR - 0.05, t)); set(t) };
    video.addEventListener('timeupdate', () => set(video.currentTime));
    let dragging = false;
    const at = (e) => { const r = rail.getBoundingClientRect(); return (e.clientY - r.top) / r.height * DUR };
    rail.addEventListener('pointerdown', (e) => { dragging = true; rail.setPointerCapture(e.pointerId); video.pause(); seek(at(e)) });
    rail.addEventListener('pointermove', (e) => { if (dragging) seek(at(e)) });
    rail.addEventListener('pointerup', () => { dragging = false });
    rail.addEventListener('keydown', (e) => {
      const d = { ArrowDown: 0.5, ArrowRight: 0.5, ArrowUp: -0.5, ArrowLeft: -0.5, PageDown: 2, PageUp: -2 }[e.key];
      if (d != null) { e.preventDefault(); video.pause(); seek(video.currentTime + d) }
      if (e.key === 'Home') { e.preventDefault(); seek(0) }
      if (e.key === 'End') { e.preventDefault(); seek(DUR) }
    });
    notes.forEach((n) => n.addEventListener('click', () => { seek(+n.dataset.t); video.play().catch(() => {}) }));
    video.addEventListener('click', () => (video.paused ? video.play() : video.pause()).catch?.(() => {}));
    // Play muted when it scrolls into view, pause when it leaves
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { if (e.isIntersecting) video.play().catch(() => {}); else video.pause() }, { threshold: 0.5 }).observe(panel);
    }
  }

  /* Copy buttons */
  const toast = $('#toast');
  let tt;
  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const text = $(b.dataset.copy).textContent.trim();
    try { await navigator.clipboard.writeText(text) } catch {
      const r = document.createRange(); r.selectNodeContents($(b.dataset.copy)); getSelection().removeAllRanges(); getSelection().addRange(r);
    }
    b.textContent = 'Copied';
    toast.textContent = 'Copied. Paste it into your terminal.';
    toast.classList.add('is-on');
    clearTimeout(tt);
    tt = setTimeout(() => { toast.classList.remove('is-on'); b.textContent = 'Copy' }, 1800);
  }));

  /* GitHub stars: the last known count at once, then GitHub again if that count is over five minutes old
     or zero (at most 12 requests an hour; 60 are allowed without a token). Any failure leaves no count. */
  const star = $('#starLink');
  const showStars = (n) => {
    star.classList.toggle('has-count', n > 0);
    $('#starCount').textContent = n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
    $('.star-sr', star).textContent = n > 0 ? `, ${n} ${n === 1 ? 'star' : 'stars'}` : '';
  };
  if (star) (async () => {
    const KEY = 'sizzle-stars', FRESH = 5 * 60e3;
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(KEY)) } catch {}
    if (cached && typeof cached.n === 'number') showStars(cached.n);
    if (cached && cached.n > 0 && Date.now() - cached.t < FRESH) return;
    try {
      const res = await fetch('https://api.github.com/repos/mhfrough/sizzle', { cache: 'no-store' });
      const n = res.ok ? (await res.json()).stargazers_count : null;
      if (typeof n !== 'number') return;
      try { localStorage.setItem(KEY, JSON.stringify({ n, t: Date.now() })) } catch {}
      showStars(n);
    } catch {}
  })();
})();
