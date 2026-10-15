/* Sizzle page: the how-to loop, slates, install tabs, copy buttons, reveals, GitHub stars. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* How it runs: four scenes on one clock, typed and counted as it goes, with a running timecode.
     Off screen it stops; under reduced motion it never starts and the still list shows instead. */
  const howto = $('.howto');
  if (howto && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const scenes = $$('.scene', howto), steps = $$('.howto-steps li', howto), tc = $('.howto-tc', howto);
    const LEN = 4000, CHAR = 45, FPS = 30;
    const typed = $$('[data-type]', howto).map((el) => {
      const text = el.textContent;
      el.innerHTML = '<span class="t-on"></span><span class="t-off"></span>';
      return { el, text, on: el.firstChild, off: el.lastChild, at: +el.dataset.at, scene: el.closest('.scene') };
    });
    const counts = $$('[data-count]', howto).map((el) => { const s = el.closest('.scene'); return { el, at: +el.dataset.at, dur: +el.dataset.dur, to: +el.dataset.to, scene: s, bar: $('.meter i', s) } });
    const pad = (n) => String(n).padStart(2, '0');
    let cur = 0, start = 0, raf = 0, lastF = -1;
    // Each frame writes only what changed, and at most once per timecode frame (30 fps), so the loop costs
    // a few small text updates rather than a relayout of every line on every display frame.
    const paint = (ms) => {
      const f = Math.floor((cur * LEN + ms) / 1000 * FPS);
      if (f === lastF) return;
      lastF = f;
      const s = scenes[cur];
      typed.forEach((x) => {
        if (x.scene !== s) return;
        const k = Math.max(0, Math.min(x.text.length, Math.floor((ms - x.at) / CHAR)));
        if (k === x.k) return;
        x.k = k;
        x.on.textContent = x.text.slice(0, k); x.off.textContent = x.text.slice(k);
        x.el.classList.toggle('typing', k < x.text.length);
      });
      counts.forEach((c) => {
        if (c.scene !== s) return;
        const p = Math.max(0, Math.min(1, (ms - c.at) / c.dur)), v = Math.round(p * c.to);
        if (v === c.v) return;
        c.v = v;
        c.el.textContent = String(v).padStart(3, '0');
        if (c.bar) c.bar.style.setProperty('--p', p);
      });
      if (tc) tc.textContent = `00:00:${pad(Math.floor(f / FPS))}:${pad(f % FPS)}`;
    };
    const show = (i) => {
      cur = i; start = performance.now(); lastF = -1;
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

  /* Slates: an empty <p class="slate"> is filled from data-sc / data-tc / data-label, or from its section's id.
     Timecodes follow the trailer's beats, so the page reads in the reel's order. A fragment that renders
     its markup later can call window.sizzleSlates(). */
  const SLATES = {
    studio: ['02', '00:00:02:28', 'Cut'],
    how: ['03', '00:00:09:21', 'Picture lock'],
    screening: ['04', '00:00:14:06', 'Now showing'],
  };
  const fillSlates = () => $$('.slate').forEach((el) => {
    if (el.children.length || el.textContent.trim()) return;
    const sec = el.closest('section[id]');
    const [sc, tc, label] = SLATES[sec && sec.id] || [];
    const d = el.dataset;
    const parts = [['sc', 'SC ' + (d.sc || sc || '00')], ['tc', d.tc || tc || '00:00:00:00'], ['label', d.label || label]];
    parts.forEach(([k, v]) => {
      if (!v) return;
      const s = document.createElement('span');
      s.className = 'slate-' + k; s.textContent = v;
      el.append(s);
    });
  });
  fillSlates();
  window.sizzleSlates = fillSlates;

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

  /* Install tabs: arrow keys, Home and End move between them (automatic activation) */
  const tabs = $$('.inst-tabs [role="tab"]');
  const select = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const n = tabs.length;
      const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: n - 1 }[e.key];
      if (to == null) return;
      e.preventDefault();
      select(tabs[(to + n) % n], true);
    });
  });

  /* Copy buttons (the fragments use these too, and the same #toast) */
  const toast = $('#toast');
  let tt;
  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const src = $(b.dataset.copy);
    const text = src.textContent.trim();
    try { await navigator.clipboard.writeText(text) } catch {
      const r = document.createRange(); r.selectNodeContents(src); getSelection().removeAllRanges(); getSelection().addRange(r);
    }
    const label = b.dataset.label || (b.dataset.label = b.textContent);
    b.textContent = 'Copied';
    toast.textContent = 'Copied. Paste it into your terminal.';
    toast.classList.add('is-on');
    clearTimeout(tt);
    tt = setTimeout(() => { toast.classList.remove('is-on'); b.textContent = label }, 1800);
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
