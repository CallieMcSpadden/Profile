// ============================================================
//  neural.js: background network of circuit nodes and a few
//  neurons, joined by right-angled traces, with pulses of
//  "current" (faint yellow tail, bright teal head). Fades
//  behind the reading column, responds to scrolling, honours
//  reduced motion.
// ============================================================
(function neuralBackground() {
  const canvas = document.createElement('canvas');
  canvas.className = 'neural-bg';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, dpr = 1, FIELD_H = 0;
  let nodes = [], edges = [], pulses = [];
  let colors = {};
  let col = { x0: 0, x1: 0 };            // reading column, where the network fades
  let railEdge = 0;                      // desktop side navigation, also kept quiet
  let scrollY = window.scrollY, lastScrollY = scrollY, energy = 0;

  const rand = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;
  const NEURON_SHARE = 0.1;   // one circle in ten is a neuron
  const LEAD_SHARE = 0.35;    // share of circles that send out a line ending in dendrites

  const toRGB = h => { h = h.replace('#', ''); if (h.length === 3) h = h.replace(/./g, c => c + c); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mix = (p, q, t) => `rgb(${p.map((v, i) => Math.round(v + (q[i] - v) * t)).join(',')})`;

  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const hex = v => cs.getPropertyValue(v).trim() || '#888';
    const dark = matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.getAttribute('data-theme') !== 'light'
      || document.documentElement.getAttribute('data-theme') === 'dark';
    colors = {
      a: hex('--violet'), bg: hex('--bg'), dark,
      // current: faint yellow tail → bright teal head
      spark: toRGB(dark ? '#fde68a' : '#eab308'),
      bright: toRGB(dark ? '#2dd4bf' : '#14b8a6'),
    };
    colors.brightCss = mix(colors.bright, colors.bright, 0);
  }

  // How visible the network is at a given x: low behind the text column, full in the margins
  function fade(x) {
    if (railEdge && x < railEdge - 10) return 0.28;
    const ramp = 140;
    if (x < col.x0 - ramp || x > col.x1 + ramp) return 1;
    if (x > col.x0 + ramp && x < col.x1 - ramp) return 0.16;
    const d = x < (col.x0 + col.x1) / 2 ? Math.abs(x - col.x0) : Math.abs(x - col.x1);
    const t = Math.min(1, d / ramp);
    const inside = x > col.x0 && x < col.x1;
    return inside ? 0.16 + (1 - t) * 0.42 : 0.58 + t * 0.42;
  }

  function measureColumn() {
    const m = document.querySelector('main');
    if (!m) { col = { x0: W * .25, x1: W * .75 }; return; }
    const r = m.getBoundingClientRect();
    col = { x0: r.left + 16, x1: r.right - 16 };
    const rail = document.querySelector('.rail');
    railEdge = rail && innerWidth > 900 ? rail.getBoundingClientRect().right : 0;
  }

  // ---------- shapes ----------
  // Dendrite tree: tapering, gently curving branches that fork as they reach outward
  function grow(segs, x, y, ang, len, w, depth) {
    const bend = rand(-0.35, 0.35);
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
    const cx = x + Math.cos(ang + bend) * len * 0.55, cy = y + Math.sin(ang + bend) * len * 0.55;
    segs.push({ x, y, cx, cy, ex, ey, w, tip: depth === 0 });
    if (depth === 0) return;
    const kids = depth >= 2 ? 2 : (Math.random() < 0.5 ? 3 : 2);
    for (let i = 0; i < kids; i++) {
      const spread = (i / (kids - 1 || 1) - 0.5) * rand(0.7, 1.1);
      grow(segs, ex, ey, ang + bend * 0.6 + spread, len * rand(0.52, 0.7), Math.max(0.5, w * 0.58), depth - 1);
    }
  }
  // Axon terminal: a spray of curved fibres fanning forward, each ending in a small bouton
  function terminal(x, y, dir, scale = 1) {
    const segs = [];
    const k = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < k; i++) {
      const a = dir + (i / (k - 1) - 0.5) * rand(1.5, 1.9);
      const len = rand(12, 24) * scale, bend = rand(-0.45, 0.45);
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      const cx = x + Math.cos(a - bend) * len * 0.5, cy = y + Math.sin(a - bend) * len * 0.5;
      segs.push({ x, y, cx, cy, ex, ey, w: 0.9, tip: true });
      if (Math.random() < 0.35) {
        const a2 = a + rand(-0.6, 0.6), l2 = len * 0.5;
        segs.push({ x: ex, y: ey, cx: ex + Math.cos(a2) * l2 * 0.5, cy: ey + Math.sin(a2) * l2 * 0.5, ex: ex + Math.cos(a2 + 0.2) * l2, ey: ey + Math.sin(a2 + 0.2) * l2, w: 0.7, tip: true });
      }
    }
    return segs;
  }
  function segPath(segs) {
    const p = new Path2D();
    segs.forEach(s => { p.moveTo(s.x, s.y); p.quadraticCurveTo(s.cx, s.cy, s.ex, s.ey); });
    return p;
  }

  // Right-angled route from A to B: straight, an L, or a Z
  function route(A, B) {
    const dx = B.x - A.x, dy = B.y - A.y;
    if (Math.abs(dx) < 4) return [A, { x: A.x, y: B.y }, B];
    if (Math.abs(dy) < 4) return [A, { x: B.x, y: A.y }, B];
    const r = Math.random();
    if (r < 0.43) return [A, { x: B.x, y: A.y }, B];                      // L, across then down
    if (r < 0.86) return [A, { x: A.x, y: B.y }, B];                       // L, down then across
    const f = rand(0.3, 0.7);
    if (r < 0.93) { const mx = A.x + dx * f; return [A, { x: mx, y: A.y }, { x: mx, y: B.y }, B]; } // Z, horizontal ends
    const my = A.y + dy * f; return [A, { x: A.x, y: my }, { x: B.x, y: my }, B];                    // Z, vertical ends
  }

  function edgeFrom(a, b, pts) {
    const cum = [0];
    for (let s = 1; s < pts.length; s++) cum.push(cum[s - 1] + Math.hypot(pts[s].x - pts[s - 1].x, pts[s].y - pts[s - 1].y));
    const path = new Path2D();
    pts.forEach((p, s) => s ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y));
    return { a, b, pts: pts.map(p => ({ x: p.x, y: p.y })), cum, len: cum[cum.length - 1], path, glow: 0 };
  }

  function build() {
    nodes = []; edges = []; pulses = [];
    FIELD_H = H * 1.6;
    const target = Math.round(Math.min(140, Math.max(36, (W * FIELD_H) / 24000)));
    let tries = 0;
    while (nodes.length < target && tries < target * 30) {
      tries++;
      const x = rand(-20, W + 20), y = rand(-20, FIELD_H + 20);
      if (Math.random() > fade(x) * 0.9 + 0.1) continue;          // fewer nodes behind the text
      const neuron = Math.random() < NEURON_SHARE;
      const room = neuron ? 170 : 70;
      if (nodes.some(n => (n.x - x) ** 2 + (n.y - y) ** 2 < (n.neuron ? Math.max(room, 170) : room) ** 2)) continue;
      const node = { x, y, neuron, r: neuron ? rand(2.6, 3.2) : rand(1.6, 2.4), glow: 0, links: [] };
      if (neuron) {
        const segs = [];
        const k = 5 + Math.floor(Math.random() * 3);
        const axonAt = Math.floor(Math.random() * k);
        const turn = rand(0, TAU);
        const longOnes = new Set(); while (longOnes.size < 2) { const j = Math.floor(Math.random() * k); if (j !== axonAt) longOnes.add(j); }
        let axonEnd = null;
        for (let i = 0; i < k; i++) {
          const ang = turn + (i / k) * TAU + rand(-0.25, 0.25);
          if (i === axonAt) {
            // the axon: one long, slightly wavering process that ends in a terminal spray
            const len = rand(85, 125), b = rand(-0.2, 0.2);
            const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
            segs.push({ x, y, cx: x + Math.cos(ang + b) * len * 0.5, cy: y + Math.sin(ang + b) * len * 0.5, ex, ey, w: 1.8, tip: false });
            axonEnd = terminal(ex, ey, ang);
          } else {
            grow(segs, x, y, ang, rand(36, 52) * (longOnes.has(i) ? 2 : 1), 2, 2);   // a couple of roots run twice as long
          }
        }
        node.trunk = segPath(segs.filter(s => s.w >= 1.2));
        node.fine = segPath(segs.filter(s => s.w < 1.2).concat(axonEnd || []));
        node.tips = segs.concat(axonEnd || []).filter(s => s.tip).map(s => ({ x: s.ex, y: s.ey }));
      }
      nodes.push(node);
    }
    // featured leads: one near the top pointing down with long dendrites (3x the earlier feature),
    // one in the bottom right pointing up with dendrites twice the usual length
    const marginX = () => {
      const right = W - col.x1, left = col.x0 - (railEdge || 0);
      return right >= left ? col.x1 + right * 0.55 : (railEdge || 0) + left * 0.45;
    };
    const feature = [];
    const place = (x, y, ty, dir, scale, reach) => {
      const yy0 = dir > 0 ? y - 30 : ty - reach, yy1 = dir > 0 ? ty + reach : y + 30;
      nodes = nodes.filter(n => !(n.x > x - reach && n.x < x + reach && n.y > yy0 && n.y < yy1) && !(n.neuron && Math.hypot(n.x - x, n.y - (y + ty) / 2) < reach + 160));
      const node = { x, y, neuron: false, r: 2, glow: 0, links: [] };
      nodes.push(node);
      feature.push({ node, ty, dir, scale });
    };
    {
      const x = marginX(), y = H * 0.12;
      place(x, y, y + rand(70, 100), Math.PI / 2, 4.8, 130);
      const x2 = Math.min(W - 60, Math.max(x, W * 0.82)), y2 = FIELD_H * rand(0.82, 0.9);
      place(x2, y2, y2 - rand(60, 90), -Math.PI / 2, 2, 70);
    }
    // resolve indices once all clearing is done
    feature.forEach(f => { f.i = nodes.indexOf(f.node); });
    // connect each node to its two nearest neighbours with right-angled traces
    const seen = new Set();
    nodes.forEach((a, i) => {
      const near = nodes.map((b, j) => ({ j, d: (a.x - b.x) ** 2 + (a.y - b.y) ** 2 })).filter(o => o.j !== i)
        .sort((p, q) => p.d - q.d).slice(0, 2);
      near.forEach(({ j, d }, rank) => {
        if (d > 260 * 260) return;
        if (rank === 1 && Math.random() < 0.5) return;               // fewer loops and boxed-in pockets
        const key = i < j ? i + '-' + j : j + '-' + i;
        if (seen.has(key)) return; seen.add(key);
        edges.push(edgeFrom(i, j, route(nodes[i], nodes[j])));
      });
    });
    // leads: lines from some circles that run off and end in dendrites
    nodes.forEach((n, i) => {
      if (n.neuron || Math.random() > LEAD_SHARE) return;
      const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
      let d1 = dirs[Math.floor(Math.random() * 4)];
      const pts = [{ x: n.x, y: n.y }];
      let x = n.x + Math.cos(d1) * rand(30, 80), y = n.y + Math.sin(d1) * rand(30, 80);
      pts.push({ x, y });
      let dir = d1;
      if (Math.random() < 0.6) {
        dir = d1 + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
        const l2 = rand(20, 60);
        x += Math.cos(dir) * l2; y += Math.sin(dir) * l2;
        pts.push({ x, y });
      }
      const e = edgeFrom(i, -1, pts);
      const up = Math.abs(dir + Math.PI / 2) < 0.01 || Math.abs(dir - 3 * Math.PI / 2) < 0.01;
      const bottomRight = x > W * 0.6 && y > FIELD_H * 0.55;
      const segs = terminal(x, y, dir, up && bottomRight ? 2 : 1);
      e.term = { path: segPath(segs), tips: segs.filter(s => s.tip).map(s => ({ x: s.ex, y: s.ey })) };
      edges.push(e);
    });
    // the two featured leads, each in its own cleared space
    feature.forEach(f => {
      const n = nodes[f.i];
      const pts = [{ x: n.x, y: n.y }, { x: n.x, y: f.ty }];
      const e = edgeFrom(f.i, -1, pts);
      const segs = terminal(n.x, f.ty, f.dir, f.scale);
      e.term = { path: segPath(segs), tips: segs.filter(t => t.tip).map(t => ({ x: t.ex, y: t.ey })) };
      edges.push(e);
    });
    edges.forEach((e, k) => { nodes[e.a].links.push(k); if (e.b >= 0) nodes[e.b].links.push(k); });
  }

  function pointAt(e, d) {
    const { pts, cum } = e;
    if (d <= 0) return pts[0];
    if (d >= e.len) return pts[pts.length - 1];
    let s = 1; while (cum[s] < d) s++;
    const t = (d - cum[s - 1]) / (cum[s] - cum[s - 1] || 1);
    return { x: pts[s - 1].x + (pts[s].x - pts[s - 1].x) * t, y: pts[s - 1].y + (pts[s].y - pts[s - 1].y) * t };
  }

  function fire(nodeIndex, depth, slow = true) {
    const n = nodes[nodeIndex];
    if (!n || !n.links.length || pulses.length > 60) return;
    n.glow = 1;
    const k = n.links[Math.floor(Math.random() * n.links.length)];
    const e = edges[k];
    pulses.push({ e: k, d: 0, dir: e.a === nodeIndex ? 1 : -1, speed: rand(90, 170) * (slow ? 0.25 : 1), depth, slow });
  }

  function offsetY() {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    return -(scrollY / max) * (FIELD_H - H);
  }

  const dots = (tips, r) => { ctx.beginPath(); tips.forEach(t => { ctx.moveTo(t.x + r, t.y); ctx.arc(t.x, t.y, r, 0, TAU); }); ctx.fill(); };

  function draw(dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const oy = offsetY();
    ctx.translate(0, oy);
    const base = colors.dark ? 0.15 : 0.11;
    const onScreen = (y0, y1) => !(y1 + oy < -60 || y0 + oy > H + 60);

    // traces and leads
    ctx.strokeStyle = colors.a; ctx.fillStyle = colors.a;
    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
    edges.forEach(e => {
      const A = e.pts[0], B = e.pts[e.pts.length - 1];
      if (!onScreen(Math.min(A.y, B.y), Math.max(A.y, B.y))) return;
      const f = Math.min(fade(A.x), fade(B.x));
      ctx.globalAlpha = base * f;
      ctx.lineWidth = 1;
      ctx.stroke(e.path);
      if (e.term) {
        e.glow = Math.max(0, e.glow - dt * 1.4);
        ctx.lineCap = 'round';
        ctx.globalAlpha = (base + 0.12 + e.glow * 0.6) * f;
        ctx.lineWidth = 0.9; ctx.stroke(e.term.path);
        dots(e.term.tips, 1.3 + e.glow * 0.8);
        ctx.lineCap = 'butt';
      }
    });

    // circles (circuit nodes) and neurons
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    nodes.forEach(n => {
      if (!onScreen(n.y - 200, n.y + 200)) return;
      const f = fade(n.x);
      n.glow = Math.max(0, n.glow - dt * 1.6);
      ctx.strokeStyle = colors.a; ctx.fillStyle = colors.a;
      if (n.neuron) {
        const a = (base + 0.2 + n.glow * 0.5) * f;
        ctx.globalAlpha = a;
        ctx.lineWidth = 1.8; ctx.stroke(n.trunk);
        ctx.lineWidth = 0.8; ctx.stroke(n.fine);
        dots(n.tips, 0.9);
        // cell body with a nucleus
        ctx.globalAlpha = Math.min(1, a * 1.5);
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + n.glow * 1.2, 0, TAU); ctx.fill();
      } else {
        ctx.globalAlpha = (base + 0.18 + n.glow * 0.6) * f;
        ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 1.2 + n.glow * 1.5, 0, TAU); ctx.stroke();
      }
      if (n.glow > 0.05) {
        const R = n.neuron ? 26 : 18;
        const rg = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, R);
        rg.addColorStop(0, colors.brightCss); rg.addColorStop(1, 'transparent');
        ctx.globalAlpha = n.glow * 0.45 * f; ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(n.x, n.y, R, 0, TAU); ctx.fill();
      }
    });

    // pulses of current: a comet with a faint yellow tail and a bright teal head
    const TRAIL = 14, GAP = 3.2;
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i], e = edges[p.e];
      p.d += p.speed * (1 + energy * 2.2) * dt;
      if (p.d >= e.len) {
        pulses.splice(i, 1);
        if (p.dir === 1 && e.b < 0) { e.glow = 1; continue; }        // reached the dendrites at a lead's end
        const arrive = p.dir === 1 ? e.b : e.a;
        nodes[arrive].glow = 1;
        if (p.depth < 6 && Math.random() < 0.62) fire(arrive, p.depth + 1, p.slow);
        continue;
      }
      for (let k = TRAIL - 1; k >= 0; k--) {
        const dd = p.d - k * GAP;
        if (dd < 0) continue;
        const pt = pointAt(e, p.dir === 1 ? dd : e.len - dd);
        const t = k / (TRAIL - 1);                                    // 0 at the head, 1 at the tail
        ctx.globalAlpha = (0.95 - t * 0.8) * fade(pt.x) * (colors.dark ? 1 : 0.9);
        ctx.fillStyle = mix(colors.bright, colors.spark, t);
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 2.3 - t * 1.4, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // scroll: feeds energy into the network and drives the progress axon
  function onScroll() {
    scrollY = window.scrollY;
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    document.documentElement.style.setProperty('--scroll-progress', (scrollY / max).toFixed(4));
    if (reduce) { draw(0); return; }
    energy = Math.min(1, energy + Math.abs(scrollY - lastScrollY) / 900);
    lastScrollY = scrollY;
  }
  addEventListener('scroll', onScroll, { passive: true });

  // a light touch: moving the pointer near a node can set it off
  let lastHover = 0;
  addEventListener('pointermove', e => {
    if (reduce || performance.now() - lastHover < 220) return;
    const oy = offsetY();
    let best = -1, bd = 60 * 60;
    nodes.forEach((n, i) => { const d = (n.x - e.clientX) ** 2 + (n.y + oy - e.clientY) ** 2; if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { lastHover = performance.now(); fire(best, 0, false); }
  }, { passive: true });

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    measureColumn(); readColors(); build(); onScroll();
    if (reduce) draw(0);
  }
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readColors(); if (reduce) draw(0); });
  new MutationObserver(() => { readColors(); if (reduce) draw(0); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  resize();

  if (reduce) return;
  let last = performance.now(), spawn = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!document.hidden) {
      energy = Math.max(0, energy - dt * 0.6);
      spawn += dt * (0.9 + energy * 6) / 8;
      while (spawn > 1) {
        spawn -= 1;
        const oy = offsetY();
        const visible = nodes.map((n, i) => i).filter(i => nodes[i].y + oy > -20 && nodes[i].y + oy < H + 20);
        if (visible.length) fire(visible[Math.floor(Math.random() * visible.length)], 0);
      }
      draw(dt);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
