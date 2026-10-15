/* The Cutting Room: a visitor cuts a trailer for their own app, live.
   One cue list (like the skill's CUES) and one clock. Every moving part of the reel is a paused Web Animation
   whose currentTime is set from that clock, and text beats (typing, counters) are pure functions of time,
   so the reel can be scrubbed both ways and lands on the same frame every time. */
(() => {
  const root = document.getElementById('studio');
  if (!root || !Element.prototype.animate) return;
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];

  const FPS = 30;
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = {
    out: 'cubic-bezier(.16,1,.3,1)', in: 'cubic-bezier(.55,0,.75,.2)', pop: 'cubic-bezier(.34,1.56,.64,1)',
    wipe: 'cubic-bezier(.7,0,.25,1)', io: 'cubic-bezier(.65,0,.35,1)', ring: 'cubic-bezier(.2,.7,.3,1)', lin: 'linear'
  };
  const DEF = { name: 'Sizzle', hook: 'Nobody reads your README.', tag: 'Your app, now showing.', f1: 'One line to install.', f2: 'You approve it first.', f3: '', url: 'mhfrough.github.io/sizzle' };
  const COLOUR = { '#a08672': 'bronze', '#d4f84b': 'lime', '#ff5b3a': 'vermilion', '#4d7cff': 'cobalt', '#3fd6a0': 'mint', '#f2c94c': 'marigold' };
  // per type style: [characters per line, largest size in cqw] for each kind of headline, and an average glyph width in em
  const TYPE = {
    poster: { name: 'poster capitals', hook: [13, 19], feat: [13, 11.6], cta: [12, 19], word: 40, w: .42 },
    grotesk: { name: 'grotesk', hook: [11, 12.4], feat: [13, 9.2], cta: [11, 14.4], word: 29, w: .56 },
    serif: { name: 'serif', hook: [12, 14], feat: [14, 10.2], cta: [12, 16.5], word: 32, w: .47 }
  };

  /* ---------- the motion vocabulary (the skill's keyframes, as Web Animations) ---------- */
  const K = {
    lineIn: [{ transform: 'translateY(135%)' }, { transform: 'translateY(0)' }],
    lineOut: [{ transform: 'translateY(0)' }, { transform: 'translateY(-150%)' }],
    rise: [{ opacity: 0, transform: 'translateY(5.5cqw)' }, { opacity: 1, transform: 'translateY(0)' }],
    riseOut: [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-5.5cqw)' }],
    riseEm: [{ opacity: 0, transform: 'translateY(1.2em)' }, { opacity: 1, transform: 'translateY(0)' }],
    sink: [{ opacity: 1, transform: 'translateY(0) rotate(0deg)' }, { opacity: 0, transform: 'translateY(8cqw) rotate(0deg)' }],
    pop: [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1)' }],
    popOut: [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.72)' }],
    fadeIn: [{ opacity: 0 }, { opacity: 1 }],
    fadeOut: [{ opacity: 1 }, { opacity: 0 }],
    strike: [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
    growY: [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
    wipeIn: [{ clipPath: 'circle(0% at 50% 52%)' }, { clipPath: 'circle(80% at 50% 52%)' }],
    wipeOut: [{ clipPath: 'circle(80% at 50% 52%)' }, { clipPath: 'circle(0% at 50% 12.7%)' }],
    charUp: [{ transform: 'translateY(135%)' }, { transform: 'translateY(0)' }],
    devIn: [{ opacity: 0, transform: 'translateY(26cqw) rotate(-3deg)' }, { opacity: 1, transform: 'translateY(0) rotate(0deg)' }],
    press: [{ transform: 'scale(1)' }, { transform: 'scale(.8)', offset: .4 }, { transform: 'scale(1)' }],
    ring: [{ opacity: .5, transform: 'scale(.12)' }, { opacity: 0, transform: 'scale(1)' }],
    tapRing: [{ opacity: .95, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(1.7)' }],
    unmask: [{ clipPath: 'inset(-400% -200% -900% -200%)' }, { clipPath: 'inset(-400% -200% -900% -200%)' }]
  };
  const fall = (r, x) => [{ opacity: 1, transform: 'translate(0,0) rotate(0deg)' }, { opacity: 0, transform: `translate(${x}cqw,62cqw) rotate(${r}deg)` }];
  const toastIn = [{ opacity: 0, transform: 'translate(-50%,1.4em)' }, { opacity: 1, transform: 'translate(-50%,0)' }];

  /* ---------- DOM ---------- */
  const form = $('#st-bay'), screen = $('#st-screen'), reel = $('#st-reel');
  const track = $('#st-track'), ruler = $('#st-ruler'), blocksEl = $('#st-blocks');
  const playBtn = $('#st-play'), tcEl = $('#st-tc'), tcEnd = $('#st-tc-end'), sceneEl = $('#st-scene');
  const shotsEl = $('#st-shots'), promptEl = $('#st-prompt'), own = $('#st-own'), ownWrap = own.closest('.st-own');
  const field = (k) => $('#st-' + k);

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const tc = (s) => {
    const f = Math.floor(s * FPS + 1e-6);
    return [Math.floor(f / (FPS * 60)), Math.floor(f / FPS) % 60, f % FPS].map((n) => String(n).padStart(2, '0')).join(':');
  };
  // a tiny deterministic "random" so falling words always fall the same way
  const rnd = (i, s = 1) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x) };

  /* ---------- state from the editing bay ---------- */
  function read() {
    const v = (k) => field(k).value.trim().replace(/\s+/g, ' ');
    const name = v('name') || 'Your app';
    const feats = ['f1', 'f2', 'f3'].map(v).filter(Boolean);
    const spare = ['Your first feature.', 'Your second feature.'];
    while (feats.length < 2) feats.push(spare[feats.length]);
    const picked = form.querySelector('input[name="accent"]:checked');
    const accent = (picked ? picked.value : own.value).toLowerCase();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'yourapp';
    return {
      name, feats, accent,
      hook: v('hook') || DEF.hook,
      tag: v('tag') || 'Your app, now showing.',
      url: (v('url') || slug + '.app').replace(/^https?:\/\//i, '').replace(/\/$/, ''),
      cut: form.querySelector('input[name="cut"]:checked').value,
      type: form.querySelector('input[name="type"]:checked').value
    };
  }

  /* ---------- the cut: one cue list, like the skill's CUES ---------- */
  function plan(s) {
    const teaser = s.cut === 'teaser';
    const L = teaser ? 10 : 25;
    const hook = teaser ? 1.9 : 2.95, reveal = teaser ? 1.75 : 2.5, cta = teaser ? 2.6 : 4.6;
    const fl = (L - hook - reveal - cta) / s.feats.length;
    const cues = [
      { id: 'hook', kind: 'hook', label: 'Hook', short: 'HK', at: 0, len: hook },
      { id: 'reveal', kind: 'reveal', label: 'Reveal', short: 'REV', at: hook, len: reveal }
    ];
    s.feats.forEach((f, i) => cues.push({ id: 'f' + i, kind: 'feature', n: i, label: 'Feature ' + (i + 1), short: 'F' + (i + 1), at: hook + reveal + i * fl, len: fl }));
    cues.push({ id: 'cta', kind: 'cta', label: 'CTA', short: 'CTA', at: L - cta, len: cta });
    // every cue starts on a whole frame, so labels, seeks and the render agree
    cues.forEach((c) => { c.at = Math.round(c.at * FPS) / FPS });
    cues.forEach((c, i) => { c.len = (i < cues.length - 1 ? cues[i + 1].at : L) - c.at });
    return { L, k: teaser ? .62 : 1, cues };
  }
  // the frame that shows a scene at its best, for cueing up an edit
  function hero(c) {
    const k = P.k;
    if (c.kind === 'hook') return 1.3 * k;
    if (c.kind === 'reveal') return c.at + 1.75 * k;
    if (c.kind === 'feature') return c.at + c.len - .95 * kfOf(c);
    return P.L - .25;
  }
  const kfOf = (c) => clamp(c.len / 7.475, .3, 1);

  /* ---------- headlines ---------- */
  // split a line into at most `max` lines of about `per` characters, as evenly as the words allow
  function split(text, per, max) {
    const words = text.split(' ');
    if (text.length <= per || words.length < 2) return [text];
    const n = clamp(Math.ceil(text.length / per), 2, Math.min(max, words.length));
    let best = null;
    const walk = (start, left, acc) => {
      if (left === 1) {
        const lines = acc.concat(words.slice(start).join(' '));
        const worst = Math.max(...lines.map((l) => l.length));
        const score = worst * 10 + (lines[0].length > lines[lines.length - 1].length ? 1 : 0);
        if (!best || score < best.score) best = { score, lines };
        return;
      }
      for (let i = start + 1; i <= words.length - left + 1; i++) walk(i, left - 1, acc.concat(words.slice(start, i).join(' ')));
    };
    walk(0, n, []);
    return best.lines;
  }
  function headline(lines, size, opts = {}) {
    const last = lines.length - 1;
    const body = lines.map((l, i) => {
      const acc = (opts.accent === 'last' && i === last && lines.length > 1) || opts.accent === 'all' ? ' class="st-r-acc"' : '';
      const inner = opts.words
        ? l.split(' ').map((w) => `<span class="st-r-w">${esc(w)}<i class="st-r-x"></i></span>`).join(' ')
        : opts.html ? opts.html(l, i) : esc(l);
      return `<span class="st-r-line"><span${acc}>${inner}</span></span>`;
    }).join('');
    return `<div class="st-r-h" style="font-size:${size.toFixed(2)}cqw">${body}</div>`;
  }
  const sizeFor = (lines, cfg, T) => Math.min(cfg[1], 86 / (Math.max(...lines.map((l) => l.length)) * T.w));
  // shrink a headline until its widest line fits `avail` cqw (the estimate above is close; this makes it exact)
  function fit(el, avail) {
    const W = screen.clientWidth;
    if (!W || !el) return;
    let widest = 0;
    el.querySelectorAll('.st-r-line > span, .st-r-word').forEach((s) => { widest = Math.max(widest, s.scrollWidth) });
    const room = W * avail / 100;
    if (widest > room) el.style.fontSize = (parseFloat(el.style.fontSize) * room / widest).toFixed(3) + 'cqw';
  }

  /* ---------- small inline art ---------- */
  const TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="square"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const CURSOR = '<div class="st-r-cur"><b></b><svg viewBox="0 0 24 24"><path d="M4 2.5v17.2l4.6-4.3 2.9 6.6 3-1.3-2.9-6.5 6.3-.2z" fill="#f7f7f7" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg></div>';
  const ARROW = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 34 34 14M18 14h16v16" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="square"/></svg>';

  function cardHTML(i, s, initial) {
    const bar = (tab) => `<div class="st-r-cbar"><span class="st-r-mark"><span>${esc(initial)}</span></span><b>${esc(s.name)}</b><span class="st-r-tab">${tab}</span></div>`;
    if (i % 3 === 0) {
      const rows = [['Kick-off notes', 'Mon'], ['Review the draft', 'Tue'], ['Send the update', 'Wed'], ['Plan next week', 'Fri']];
      return `<div class="st-r-card st-r-cA">${bar('Today')}
        <div class="st-r-ctitle">This week <small><span class="st-r-count">0</span>/4 done</small></div>
        <ul class="st-r-rows">${rows.map((r) => `<li><span class="st-r-chk"><i>${TICK}</i></span><span class="st-r-lbl">${r[0]}<i class="st-r-x"></i></span><span class="st-r-meta">${r[1]}</span></li>`).join('')}</ul>
        <div class="st-r-prog"><i></i></div>
        <div class="st-r-toast"><i></i>All done for the week</div>${CURSOR}</div>`;
    }
    if (i % 3 === 1) {
      const h = [34, 52, 41, 63, 55, 72, 94], d = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
      return `<div class="st-r-card st-r-cB">${bar('Insights')}
        <div class="st-r-ctitle">Activity <small>Last 7 days</small></div>
        <div class="st-r-num"><b class="st-r-n">0</b><span>updates</span><span class="st-r-delta">▲ 38%</span></div>
        <div class="st-r-chart">${h.map((v, n) => `<div class="st-r-bar${n === 6 ? ' on' : ''}" style="--h:${v}%"><i></i>${n === 6 ? '<span class="st-r-tip">Today · 214</span>' : ''}</div>`).join('')}</div>
        <div class="st-r-days">${d.map((x) => `<span>${x}</span>`).join('')}</div>${CURSOR}</div>`;
    }
    const people = [['AM', '#f4b183'], ['JS', '#a9c4ff'], ['KT', '#bfe3a5']];
    return `<div class="st-r-card st-r-cC">${bar('Share')}
      <div class="st-r-doc"><span class="st-r-thumb"><i></i><i></i><i></i><i></i></span><span><b>Week 42 plan</b><span>Edited just now</span></span></div>
      <div class="st-r-link"><code>${esc(s.url)}/s/8f2k</code><span class="st-r-btn"><span class="st-r-b1">Copy link</span><span class="st-r-b2">Copied</span></span></div>
      <div class="st-r-people"><span>Shared with</span>${people.map((p) => `<span class="st-r-av" style="--r-c:${p[1]}">${p[0]}<em>${TICK}</em></span>`).join('')}</div>
      <div class="st-r-toast"><i></i>Shared with 3 people</div>${CURSOR}</div>`;
  }

  /* ---------- build the reel from the state and the cue list ---------- */
  let S, P, anims = [], beats = [], t = 0;
  function A(el, kf, at, dur, ease = 'out', fill = 'both', extra) {
    if (!el) return null;
    const a = el.animate(kf, Object.assign({ delay: at * 1000, duration: Math.max(1, dur * 1000), easing: EASE[ease] || ease, fill }, extra));
    a.pause();
    anims.push(a);
    return a;
  }
  // a path through points {t, x, y} in em, holding at each point for `hold` seconds
  function path(el, pts) {
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t, span = Math.max(.001, t1 - t0);
    const kf = pts.map((p) => ({ offset: (p.t - t0) / span, transform: `translate(${p.x.toFixed(3)}em,${p.y.toFixed(3)}em)`, easing: EASE.io }));
    A(el, kf, t0, span, 'lin');
  }
  // the centre of `el` relative to `card`, in the card's em (layout only, transforms ignored)
  function spot(el, card, dx = .5, dy = .5) {
    let x = 0, y = 0, n = el;
    while (n && n !== card) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent }
    const em = parseFloat(getComputedStyle(card).fontSize) || 1;
    return { x: (x + el.offsetWidth * dx) / em, y: (y + el.offsetHeight * dy) / em };
  }

  function build() {
    anims.forEach((a) => a.cancel());
    anims = []; beats = [];
    const s = S, T = TYPE[s.type], k = P.k, L = P.L, C = P.cues;
    const cue = (id) => C.find((c) => c.id === id);
    const hookC = cue('hook'), revC = cue('reveal'), ctaC = cue('cta'), feats = C.filter((c) => c.kind === 'feature');
    const initial = (s.name.match(/[\p{L}\p{N}]/u) || ['A'])[0].toUpperCase();
    const on = onColour(s.accent);

    screen.dataset.type = s.type;
    reel.style.setProperty('--r-acc', s.accent);
    reel.style.setProperty('--r-on', on);

    const hookLines = split(s.hook, T.hook[0], 3);
    const ctaLines = split(`Try ${s.name}.`, T.cta[0], 2);
    const nameSize = Math.min(T.word, 86 / (s.name.length * T.w * 1.08));

    reel.innerHTML = `
      <div class="st-r-glow st-r-g1"></div><div class="st-r-glow st-r-g2"></div>
      <div class="st-r-dots"></div>
      <div class="st-r-rings"><b></b><b></b><b></b></div>
      <div class="st-r-vig"></div>
      <div class="st-r-hook">${headline(hookLines, sizeFor(hookLines, T.hook, T), { words: true, accent: 'last' })}</div>
      <div class="st-r-brand"><div class="st-r-brand-in"><span class="st-r-mark"><span>${esc(initial)}</span></span><b>${esc(s.name)}</b><span class="st-r-desc">${esc(s.tag)}</span></div></div>
      <div class="st-r-hl">${s.feats.map((f) => { const ls = split(f, T.feat[0], 2); return headline(ls, sizeFor(ls, T.feat, T), { accent: 'last' }) }).join('')}</div>
      <div class="st-r-stage">${s.feats.map((f, i) => cardHTML(i, s, initial)).join('')}</div>
      <div class="st-r-cta">
        <span class="st-r-mark"><span class="st-r-cta-rings"><b></b><b></b><b></b></span><span>${esc(initial)}</span></span>
        ${headline(ctaLines, sizeFor(ctaLines, T.cta, T), { html: (l) => esc(l).replace(esc(s.name), `<span class="st-r-acc">${esc(s.name)}</span>`) })}
        <p class="st-r-sub">${esc(s.tag)}</p>
        <div class="st-r-url">${ARROW}<span><span class="st-r-typed"></span><span class="st-r-caret"></span></span></div>
      </div>
      <div class="st-r-wipe"><div class="st-r-wipe-in">
        <div class="st-r-big"><span>${esc(initial)}</span></div>
        <div class="st-r-word" style="font-size:${nameSize.toFixed(2)}cqw">${[...s.name].map((ch) => `<span>${esc(ch)}</span>`).join('')}</div>
        <p class="st-r-tag">${esc(s.tag)}</p>
      </div></div>`;

    const q = (sel, el = reel) => el.querySelector(sel);
    const qa = (sel, el = reel) => [...el.querySelectorAll(sel)];
    fit(q('.st-r-hook .st-r-h'), 88);
    qa('.st-r-hl .st-r-h').forEach((h) => fit(h, 88));
    fit(q('.st-r-cta .st-r-h'), 88);
    fit(q('.st-r-word').parentElement, 90);

    /* background life: two glows drift for the whole reel, square rings pulse out from the centre */
    A(q('.st-r-g1'), [{ transform: 'translate(0,0) scale(1)' }, { transform: 'translate(-18cqw,52cqw) scale(1.25)' }], 0, L, 'lin');
    A(q('.st-r-g2'), [{ transform: 'translate(0,0) scale(1)' }, { transform: 'translate(22cqw,-58cqw) scale(1.15)' }], 0, L, 'lin');
    qa('.st-r-rings b').forEach((b, i) => A(b, K.ring, .4 + i * 1.4, 4.2, 'ring', 'none', { iterations: Infinity }));

    /* hook: the pain rises line by line, a strike runs through it, the words fall */
    const H = hookC.at + hookC.len;
    A(q('.st-r-hook .st-r-h'), [{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }], 0, H, 'lin');
    const hLines = qa('.st-r-hook .st-r-line');
    hLines.forEach((ln, i) => A(ln.firstElementChild, K.lineIn, (.15 + i * .1) * k, 1 * k));
    const words = qa('.st-r-hook .st-r-w');
    const total = words.reduce((n, w) => n + w.textContent.length, 0) || 1;
    const sweep = .6 * k, s0 = H - 1.4 * k;
    let done = 0;
    words.forEach((w, j) => {
      const share = w.textContent.length / total;
      A(q('.st-r-x', w), K.strike, s0 + done / total * sweep, Math.max(.06, share * sweep) + .04, 'lin');
      done += w.textContent.length;
      const r = (rnd(j) * 22 + 6) * (j % 2 ? 1 : -1), x = (rnd(j, 2) - .5) * 14;
      A(w, fall(r, x), H - .72 * k + j * .045 * k, .62 * k, 'in', 'forwards');
    });
    hLines.forEach((ln) => A(ln, K.unmask, H - .72 * k, .001, 'lin', 'forwards'));

    /* reveal: the accent bursts open, the mark pops, the name rises letter by letter, then it all
       collapses into the brand bar at the top */
    const R = revC.at, RL = revC.len, wipe = q('.st-r-wipe');
    A(wipe, K.wipeIn, R, .62 * Math.max(k, .8), 'wipe');
    A(q('.st-r-big'), K.pop, R + .22 * k, .7 * k, 'pop');
    A(q('.st-r-big span'), K.charUp, R + .36 * k, .6 * k);
    qa('.st-r-word span').forEach((ch, i) => A(ch, K.charUp, R + .4 * k + i * .055 * k, .8 * k));
    A(q('.st-r-tag'), K.rise, R + .95 * k, .7 * k);
    A(q('.st-r-wipe-in'), K.popOut, R + RL - .52 * k, .35 * k, 'in', 'forwards');
    A(wipe, K.wipeOut, R + RL - .4 * k, .6 * Math.max(k, .8), 'wipe', 'forwards');
    const brand = q('.st-r-brand');
    A(brand, K.rise, R + RL - .12, .8 * k);
    A(brand, K.riseOut, ctaC.at - .35 * k, .45 * k, 'in', 'forwards');

    /* features: one headline and "your app" doing exactly that */
    const heads = qa('.st-r-hl .st-r-h'), cards = qa('.st-r-stage .st-r-card');
    feats.forEach((c, i) => {
      const F = c.at, FL = c.len, kf = kfOf(c), end = F + FL;
      const outDur = .45 * Math.min(1, kf * 1.6);
      qa('.st-r-line', heads[i]).forEach((ln, li) => {
        A(ln.firstElementChild, K.lineIn, F + (.12 + li * .12) * kf, 1 * kf);
        A(ln.firstElementChild, K.lineOut, end - .06 + li * .04 * kf, outDur, 'in', 'forwards');
      });
      const card = cards[i];
      A(card, K.devIn, F + .1 * kf, 1.1 * kf);
      A(card, K.sink, end - .4 * kf, .5 * kf, 'in', 'forwards');
      const w0 = F + 1.05 * kf, w1 = end - .75 * kf, span = w1 - w0;
      cardMotion(i % 3, card, w0, span, kf, end);
    });

    /* call to action: mark, "Try X.", the line, the address types itself, hold */
    const Cs = ctaC.at, mark = q('.st-r-cta > .st-r-mark');
    A(mark, K.pop, Cs + .05 * k, .7 * k, 'pop');
    A(q(':scope > span:last-child', mark), K.charUp, Cs + .22 * k, .6 * k);
    qa('.st-r-cta-rings b').forEach((b, i) => A(b, K.ring, Cs + .45 * k + i * .8, 2.4, 'ring', 'none', { iterations: Infinity }));
    qa('.st-r-cta .st-r-line').forEach((ln, i) => A(ln.firstElementChild, K.lineIn, Cs + (.22 + i * .12) * k, 1 * k));
    A(q('.st-r-sub'), K.rise, Cs + .55 * k, .7 * k);
    A(q('.st-r-url'), K.rise, Cs + .8 * k, .7 * k);
    const typed = q('.st-r-typed'), caret = q('.st-r-caret'), url = s.url, t0 = Cs + 1.05 * k, per = .045 * k;
    beats.push((tt) => {
      const n = clamp(Math.floor((tt - t0) / per), 0, url.length);
      if (typed._n !== n) { typed.textContent = url.slice(0, n); typed._n = n }
      caret.style.opacity = n < url.length || Math.floor(tt * 2) % 2 === 0 ? 1 : 0;
    });
  }

  function cardMotion(kind, card, w0, span, kf, end) {
    const q = (sel) => card.querySelector(sel), qa = (sel) => [...card.querySelectorAll(sel)];
    const cur = q('.st-r-cur'), arrow = q('.st-r-cur svg'), ring = q('.st-r-cur b');
    const W = card.offsetWidth / (parseFloat(getComputedStyle(card).fontSize) || 1);
    const H = card.offsetHeight / (parseFloat(getComputedStyle(card).fontSize) || 1);
    const enter = { x: W * 1.08, y: H * 1.05 }, leave = { x: W * 1.1, y: H * .9 };
    const tap = (at) => {
      A(arrow, K.press, at - .03, .32 * Math.max(kf, .6), 'out', 'forwards');
      A(ring, K.tapRing, at, .55 * Math.max(kf, .6), 'out', 'forwards');
    };
    // one path for the cursor: in from off the card, to each target, out again
    const route = (targets) => {
      const travel = Math.min(.42, span * .09);
      const pts = [{ t: w0 - travel, ...enter }];
      targets.forEach((g) => { pts.push({ t: g.at - .06, x: g.x, y: g.y }); pts.push({ t: g.at + Math.min(.22, span * .05), x: g.x, y: g.y }) });
      const lastAt = pts[pts.length - 1].t;
      pts.push({ t: lastAt + travel * 1.2, ...leave });
      A(cur, K.fadeIn, w0 - travel, .2, 'lin');
      A(cur, K.fadeOut, lastAt + travel * .7, .3, 'lin', 'forwards');
      path(cur, pts);
      targets.forEach((g) => tap(g.at));
    };

    if (kind === 0) {
      const rows = qa('.st-r-rows li'), n = rows.length, count = q('.st-r-count');
      rows.forEach((r, j) => A(r, K.riseEm, w0 - .7 * kf + j * .07 * kf, .6 * kf));
      const at = rows.map((r, j) => w0 + span * (.1 + j * .19));
      route(rows.map((r, j) => ({ at: at[j], ...spot(r.querySelector('.st-r-chk'), card) })));
      rows.forEach((r, j) => {
        A(r.querySelector('.st-r-chk i'), K.pop, at[j] + .02, .4 * Math.max(kf, .6), 'pop');
        A(r.querySelector('.st-r-lbl .st-r-x'), K.strike, at[j] + .06, .32 * Math.max(kf, .6), 'out');
        A(r.querySelector('.st-r-lbl'), [{ color: '#f2f2f2' }, { color: '#8a8a8a' }], at[j] + .06, .3);
        A(q('.st-r-prog i'), [{ transform: `scaleX(${j / n})` }, { transform: `scaleX(${(j + 1) / n})` }], at[j] + .04, .45 * Math.max(kf, .6), 'out', j ? 'forwards' : 'both');
      });
      A(q('.st-r-toast'), toastIn, w0 + span * .86, .45 * Math.max(kf, .6), 'out');
      beats.push((tt) => { const d = at.filter((a) => a + .02 <= tt).length; if (count._n !== d) { count.textContent = d; count._n = d } });
    } else if (kind === 1) {
      const bars = qa('.st-r-bar i'), num = q('.st-r-n'), last = qa('.st-r-bar')[6];
      bars.forEach((b, j) => A(b, K.growY, w0 + span * .02 + j * .07 * Math.max(kf, .5), .75 * Math.max(kf, .5), 'out'));
      const c0 = w0, c1 = w0 + span * .5, TO = 1284;
      beats.push((tt) => {
        const p = clamp((tt - c0) / (c1 - c0), 0, 1), e = 1 - Math.pow(1 - p, 3), v = Math.round(TO * e);
        if (num._n !== v) { num.textContent = v.toLocaleString('en-GB'); num._n = v }
      });
      A(q('.st-r-delta'), K.pop, w0 + span * .52, .5 * Math.max(kf, .6), 'pop');
      const hit = w0 + span * .66;
      route([{ at: hit, ...spot(last, card, .5, .35) }]);
      A(q('.st-r-tip'), K.pop, hit + .05, .45 * Math.max(kf, .6), 'pop');
    } else {
      const btn = q('.st-r-btn'), avs = qa('.st-r-av'), hit = w0 + span * .16;
      route([{ at: hit, ...spot(btn, card) }]);
      A(btn, K.press, hit, .3 * Math.max(kf, .6), 'out', 'forwards');
      A(q('.st-r-b1'), K.fadeOut, hit + .08, .12, 'lin', 'forwards');
      A(q('.st-r-b2'), K.fadeIn, hit + .1, .15, 'lin');
      avs.forEach((a, j) => {
        A(a, K.pop, w0 + span * (.38 + j * .1), .5 * Math.max(kf, .6), 'pop');
        A(a.querySelector('em'), K.pop, w0 + span * (.44 + j * .1), .4 * Math.max(kf, .6), 'pop');
      });
      A(q('.st-r-toast'), toastIn, w0 + span * .82, .45 * Math.max(kf, .6), 'out');
    }
  }

  function onColour(hex) {
    const lin = (i) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4) };
    const L = .2126 * lin(1) + .7152 * lin(3) + .0722 * lin(5);
    return (L + .05) / .0556 >= .938 / (L + .05) ? '#111111' : '#f2f2f2';
  }

  /* ---------- timeline, shot list and prompt ---------- */
  function buildTimeline() {
    const L = P.L;
    blocksEl.innerHTML = P.cues.map((c, i) => `<button type="button" class="st-block" data-i="${i}" style="--len:${c.len.toFixed(3)}" aria-label="${c.label}, from ${tc(c.at)}">
      <span class="bl-name" aria-hidden="true"><span class="bl-long">${c.label}</span><span class="bl-short">${c.short}</span></span><span class="bl-tc" aria-hidden="true">${tc(c.at)}</span><i></i></button>`).join('');
    const step = L > 12 ? 5 : 2;
    let marks = '';
    for (let s = step; s < L; s += step) marks += `<b style="left:${(s / L * 100).toFixed(3)}%">${String(s).padStart(2, '0')}</b>`;
    ruler.innerHTML = marks;
    ruler.style.setProperty('--tick', (100 / L).toFixed(4) + '%');
    ruler.setAttribute('aria-valuemax', L);
    tcEnd.textContent = '/ ' + tc(L);
    $('#st-frames').textContent = L * FPS;
    lastCue = -1;
  }
  function describe(c) {
    const s = S, n = esc(s.name);
    if (c.kind === 'hook') return `<q>${esc(s.hook)}</q> A strike runs through it and the words fall.`;
    if (c.kind === 'reveal') return `A <span class="sh-sw" style="--sw:${s.accent}"></span>${COLOUR[s.accent] || s.accent} burst. ${n}, letter by letter, then <q>${esc(s.tag)}</q>`;
    if (c.kind === 'feature') {
      const what = [`A ${n} checklist ticks itself off, four for four.`, `The ${n} dashboard counts up and today’s bar lands.`, `A ${n} link is copied and shared with three people.`][c.n % 3];
      return `<q>${esc(s.feats[c.n])}</q> ${what}`;
    }
    return `<q>Try ${n}.</q> ${esc(s.url)} types itself, then holds to the last frame.`;
  }
  function buildScript() {
    const s = S;
    shotsEl.innerHTML = P.cues.map((c, i) => `<tr data-i="${i}"><td><button type="button" class="sh-tc" data-i="${i}" aria-label="Jump to ${c.label}, ${tc(c.at)}">${tc(c.at)}</button></td><td><span class="sh-scene">${c.label}</span></td><td>${describe(c)}</td></tr>`).join('');
    $('#st-meta').textContent = `${s.name} reel · ${P.L} s · ${P.cues.length} scenes · 1080 × 1920`;
    $('#st-reelname').innerHTML = `${esc(s.name)} reel <b>· cut ${String(cutNo).padStart(2, '0')}</b>`;
    const lines = promptLines();
    promptEl.innerHTML = lines.map(([key, v]) => key ? `<span class="p-k">${esc(key)}:</span> ${esc(v)}` : esc(v)).join('\n');
  }
  function promptLines() {
    const s = S;
    return [
      [null, 'Make a promo reel for this app with the Sizzle skill.'],
      ['App', s.name],
      ['Hook', `"${s.hook}"`],
      ['Tagline', `"${s.tag}"`],
      ['Features', ''],
      ...s.feats.map((f, i) => [null, `  ${i + 1}. ${f}`]),
      ['Accent', s.accent],
      ['Type', TYPE[s.type].name],
      ['Length', `${P.L} s (${s.cut} cut)`],
      ['CTA', `Try ${s.name}. ${s.url}`]
    ];
  }
  const promptText = () => promptLines().map(([key, v]) => key ? `${key}: ${v}`.trimEnd() : v).join('\n');

  /* ---------- the clock ---------- */
  let playing = false, raf = 0, last = 0, lastCue = -1, cutNo = 1;
  function render() {
    const ms = t * 1000;
    for (const a of anims) a.currentTime = ms;
    for (const b of beats) b(t);
    track.style.setProperty('--p', (t / P.L).toFixed(5));
    tcEl.textContent = tc(t);
    let ci = 0;
    P.cues.forEach((c, i) => { if (t >= c.at - 1e-6) ci = i });
    const c = P.cues[ci], blocks = blocksEl.children;
    if (ci !== lastCue) {
      [...blocks].forEach((b, i) => { b.classList.toggle('is-on', i === ci); b.style.setProperty('--f', i < ci ? 1 : 0); if (i === ci) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current') });
      [...shotsEl.children].forEach((r, i) => r.classList.toggle('is-on', i === ci));
      sceneEl.textContent = c.label;
      lastCue = ci;
    }
    if (blocks[ci]) blocks[ci].style.setProperty('--f', clamp((t - c.at) / c.len, 0, 1).toFixed(4));
    if (!playing) aria();
  }
  function aria() {
    const c = P.cues[lastCue] || P.cues[0];
    ruler.setAttribute('aria-valuenow', t.toFixed(2));
    ruler.setAttribute('aria-valuetext', `${tc(t)}, ${c.label}`);
  }
  const snap = (x) => Math.round(x * FPS) / FPS;
  function seek(x) { t = clamp(snap(x), 0, P.L - 1 / FPS); render() }
  function loop(now) {
    const dt = Math.min(.1, (now - last) / 1000);
    last = now;
    t += dt;
    if (t >= P.L) t -= P.L;
    render();
    raf = requestAnimationFrame(loop);
  }
  function play() {
    if (playing) return;
    playing = true; last = performance.now();
    raf = requestAnimationFrame(loop);
    syncBtn();
  }
  function pause() {
    if (!playing) return;
    playing = false; cancelAnimationFrame(raf);
    t = snap(t); render(); syncBtn();
  }
  function syncBtn() {
    playBtn.classList.toggle('is-playing', playing);
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }

  /* ---------- re-cut ---------- */
  let lastEdit = 0;
  function recut(bump) {
    const oldL = P ? P.L : null;
    S = read();
    P = plan(S);
    if (oldL && oldL !== P.L) t = t / oldL * P.L;
    if (bump) { const now = performance.now(); if (now - lastEdit > 1500) cutNo++; lastEdit = now }
    build(); buildTimeline(); buildScript();
    t = clamp(t, 0, P.L - 1 / FPS);
    render();
  }

  // typing cues the edited scene up on its best frame and holds it; playback resumes from that scene after a pause in typing
  let holdTimer = 0, resume = false;
  function cueEdit(id) {
    let c = P.cues.find((x) => x.id === id);
    if (!c && /^f/.test(id)) c = P.cues.filter((x) => x.kind === 'feature').pop();
    if (!c) return;
    if (playing) { resume = true; pause() }
    seek(hero(c));
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => { if (resume && visible && !userPaused) { resume = false; seek(c.at); play() } }, 1600);
  }

  let pendingRaf = 0, pendingCue = null;
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('input', (e) => {
    const el = e.target;
    if (el === own) {
      form.querySelectorAll('input[name="accent"]').forEach((r) => { r.checked = false });
      ownWrap.classList.add('is-on');
    } else if (el.name === 'accent') ownWrap.classList.remove('is-on');
    // one re-cut per frame, however fast the typing or the colour drag
    pendingCue = el.dataset.cue || (el.name === 'accent' || el === own ? 'reveal' : pendingCue);
    if (!pendingRaf) pendingRaf = requestAnimationFrame(() => {
      pendingRaf = 0;
      recut(true);
      if (pendingCue) cueEdit(pendingCue);
      pendingCue = null;
    });
  });
  own.addEventListener('click', () => {
    if (!ownWrap.classList.contains('is-on')) {
      form.querySelectorAll('input[name="accent"]').forEach((r) => { r.checked = false });
      ownWrap.classList.add('is-on');
      recut(true); cueEdit('reveal');
    }
  });
  $('#st-reset').addEventListener('click', () => {
    Object.keys(DEF).forEach((k) => { field(k).value = DEF[k] });
    $('#st-a1').checked = true; $('#st-c2').checked = true; $('#st-t1').checked = true;
    ownWrap.classList.remove('is-on');
    cutNo = 0; lastEdit = 0;
    recut(true);
    seek(REDUCE ? hero(P.cues[1]) : 0);
    if (!REDUCE && visible) { userPaused = false; play() }
  });

  /* ---------- transport ---------- */
  let userPaused = false, visible = false;
  const toggle = () => { if (playing) { userPaused = true; resume = false; pause() } else { userPaused = false; if (t >= P.L - 2 / FPS) t = 0; play() } };
  playBtn.addEventListener('click', toggle);
  const cueIndex = () => { let ci = 0; P.cues.forEach((c, i) => { if (t >= c.at - 1e-6) ci = i }); return ci };
  $('#st-prev').addEventListener('click', () => {
    const ci = cueIndex(), c = P.cues[ci];
    seek(t - c.at > .35 || ci === 0 ? c.at : P.cues[ci - 1].at);
  });
  $('#st-next').addEventListener('click', () => { const ci = cueIndex(); seek(ci < P.cues.length - 1 ? P.cues[ci + 1].at : P.L) });
  $('#st-safe').addEventListener('click', (e) => {
    const onNow = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    e.currentTarget.setAttribute('aria-pressed', onNow);
    screen.classList.toggle('show-zones', onNow);
  });

  // jump to a scene: play it from the top, or under reduced motion show its best frame
  function jump(i) {
    const c = P.cues[i];
    if (!c) return;
    if (REDUCE) { seek(hero(c)); return }
    seek(c.at);
    userPaused = false; play();
  }
  let skipClick = false;
  blocksEl.addEventListener('click', (e) => {
    const b = e.target.closest('.st-block');
    if (!b || skipClick) return;
    jump(+b.dataset.i);
  });
  shotsEl.addEventListener('click', (e) => { const b = e.target.closest('.sh-tc'); if (b) jump(+b.dataset.i) });

  // scrub: drag anywhere on the ruler, or drag (not click) across the blocks
  let drag = null;
  const timeAt = (x) => { const r = ruler.getBoundingClientRect(); return (x - r.left) / r.width * P.L };
  function startDrag(e) {
    drag.live = true;
    try { track.setPointerCapture(drag.id) } catch {}
    track.classList.add('is-drag');
    if (playing) pause();
    seek(timeAt(e.clientX));
  }
  track.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, live: false, was: playing };
    if (!e.target.closest('.st-block')) { e.preventDefault(); startDrag(e); ruler.focus({ preventScroll: true }) }
  });
  track.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.live) { if (Math.abs(e.clientX - drag.x) > 6) startDrag(e); return }
    seek(timeAt(e.clientX));
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.live) {
      track.classList.remove('is-drag');
      skipClick = true; setTimeout(() => { skipClick = false }, 0);
      if (drag.was && !userPaused) play();
    }
    drag = null;
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  ruler.addEventListener('keydown', (e) => {
    const f = 1 / FPS;
    const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (d) { e.preventDefault(); if (playing) { userPaused = true; pause() } seek(t + d * (e.shiftKey ? 1 : f)); return }
    if (e.key === 'Home') { e.preventDefault(); seek(0) }
    else if (e.key === 'End') { e.preventDefault(); seek(P.L) }
    else if (e.key === 'PageDown') { e.preventDefault(); const ci = cueIndex(); seek(ci < P.cues.length - 1 ? P.cues[ci + 1].at : P.L) }
    else if (e.key === 'PageUp') { e.preventDefault(); const ci = cueIndex(), c = P.cues[ci]; seek(t - c.at > .35 || ci === 0 ? c.at : P.cues[ci - 1].at) }
    else if (e.key === ' ' || e.key === 'k' || e.key === 'K') { e.preventDefault(); toggle() }
  });

  /* ---------- copy ---------- */
  const toast = document.getElementById('toast') || (() => {
    const el = document.createElement('div');
    el.className = 'st-toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
    return el;
  })();
  let toastT = 0;
  async function copy(text, btn, label, msg) {
    let ok = true;
    try { await navigator.clipboard.writeText(text) } catch {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy') } catch { ok = false }
      ta.remove();
    }
    btn.textContent = ok ? 'Copied' : 'Select and copy';
    toast.textContent = ok ? msg : 'Copy did not work here. Select the text and copy it.';
    toast.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => { toast.classList.remove('is-on'); btn.textContent = label }, 1800);
  }
  $('#st-copy').addEventListener('click', (e) => copy(promptText(), e.currentTarget, 'Copy the prompt', 'Prompt copied. Paste it into your agent, in your app’s folder.'));
  $('#st-copy-install').addEventListener('click', (e) => copy($('#st-install-cmd').textContent.trim(), e.currentTarget, 'Copy', 'Copied. Paste it into your terminal.'));

  /* ---------- start: the timeline, shot list and prompt are written at once (plain markup, no layout reads, and
     the page keeps its full height from the start). The reel itself, which measures type and builds a few hundred
     animations, is cut once the monitor is under a screen away, so the page's first paint never pays for it.
     Then it plays when on screen (never under reduced motion) and pauses when it leaves. ---------- */
  S = read(); P = plan(S);
  buildTimeline(); buildScript();
  t = REDUCE ? snap(hero(P.cues[1])) : 0;
  render();
  let started = false, rz = 0, lastW = 0;
  function start() {
    if (started) return;
    started = true;
    build();
    render();
    // a font that arrives after this first cut changes how type fits; cut again once it has
    if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => recut(false));
    lastW = screen.clientWidth;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (!visible) { if (playing) { pause(); resume = false } }
        else if (!REDUCE && !userPaused) play();
      }, { threshold: .35 }).observe(screen);
    }
  }
  if ('IntersectionObserver' in window) {
    const near = new IntersectionObserver((en) => { if (en.some((e) => e.isIntersecting)) { near.disconnect(); start() } }, { rootMargin: '60% 0px' });
    near.observe($('.st-deck') || screen);
    root.addEventListener('focusin', start, true);
    root.addEventListener('pointerdown', start, true);
  } else start();
  // a resize can change how type fits; re-cut once it settles
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (started && screen.clientWidth !== lastW) { lastW = screen.clientWidth; recut(false) } }, 150) });
})();
