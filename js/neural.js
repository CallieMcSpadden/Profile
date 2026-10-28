// ============================================================
//  neural.js: background network of neurons and circuit traces
//  with pulses of "current". Fades behind the reading column,
//  responds to scrolling, honours reduced motion.
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

  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const hex = v => cs.getPropertyValue(v).trim() || '#888';
    const dark = matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.getAttribute('data-theme') !== 'light'
      || document.documentElement.getAttribute('data-theme') === 'dark';
    colors = { a: hex('--violet'), b: hex('--safranin'), dark };
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

  function build() {
    nodes = []; edges = []; pulses = [];
    FIELD_H = H * 1.6;
    const target = Math.round(Math.min(140, Math.max(36, (W * FIELD_H) / 19000)));
    let tries = 0;
    while (nodes.length < target && tries < target * 30) {
      tries++;
      const x = rand(-20, W + 20), y = rand(-20, FIELD_H + 20);
      if (Math.random() > fade(x) * 0.9 + 0.1) continue;          // fewer nodes behind the text
      if (nodes.some(n => (n.x - x) ** 2 + (n.y - y) ** 2 < 70 * 70)) continue;
      const organic = Math.random() < 0.55;
      const node = { x, y, organic, r: organic ? rand(2.2, 3.6) : rand(1.6, 2.4), glow: 0, links: [], dendrites: [] };
      if (organic) {
        const k = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < k; i++) {
          const ang = rand(0, Math.PI * 2), len = rand(10, 24);
          const bend = rand(-0.5, 0.5);
          node.dendrites.push({ ang, len, bend, fork: Math.random() < 0.5 ? rand(0.4, 0.9) : 0 });
        }
      }
      nodes.push(node);
    }
    // connect each node to its two nearest neighbours
    const seen = new Set();
    nodes.forEach((a, i) => {
      const near = nodes.map((b, j) => ({ j, d: (a.x - b.x) ** 2 + (a.y - b.y) ** 2 })).filter(o => o.j !== i)
        .sort((p, q) => p.d - q.d).slice(0, 2);
      near.forEach(({ j, d }) => {
        if (d > 260 * 260) return;
        const key = i < j ? i + '-' + j : j + '-' + i;
        if (seen.has(key)) return; seen.add(key);
        edges.push(makeEdge(i, j));
      });
    });
    edges.forEach((e, k) => { nodes[e.a].links.push(k); nodes[e.b].links.push(k); });
  }

  function makeEdge(i, j) {
    const A = nodes[i], B = nodes[j];
    const trace = !(A.organic && B.organic) && Math.random() < 0.7;
    const pts = [];
    if (trace) {
      // circuit trace: horizontal run, 45° bend, horizontal run
      const dy = B.y - A.y, dx = B.x - A.x;
      const diag = Math.min(Math.abs(dy), Math.abs(dx) * 0.8);
      const sx = Math.sign(dx) || 1, sy = Math.sign(dy) || 1;
      const run = (Math.abs(dx) - diag) / 2;
      const p1 = { x: A.x + sx * run, y: A.y };
      const p2 = { x: p1.x + sx * diag, y: A.y + sy * diag };
      const p3 = { x: B.x, y: p2.y };
      [A, p1, p2, p3, B].forEach(p => pts.push({ x: p.x, y: p.y }));
    } else {
      // dendrite-like curve
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      const nx = -(B.y - A.y), ny = B.x - A.x, nl = Math.hypot(nx, ny) || 1;
      const off = rand(-0.25, 0.25) * Math.hypot(B.x - A.x, B.y - A.y);
      const cx = mx + nx / nl * off, cy = my + ny / nl * off;
      for (let s = 0; s <= 18; s++) {
        const t = s / 18;
        pts.push({ x: (1 - t) ** 2 * A.x + 2 * (1 - t) * t * cx + t * t * B.x, y: (1 - t) ** 2 * A.y + 2 * (1 - t) * t * cy + t * t * B.y });
      }
    }
    const cum = [0];
    for (let s = 1; s < pts.length; s++) cum.push(cum[s - 1] + Math.hypot(pts[s].x - pts[s - 1].x, pts[s].y - pts[s - 1].y));
    const path = new Path2D();
    pts.forEach((p, s) => s ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y));
    return { a: i, b: j, trace, pts, cum, len: cum[cum.length - 1], path };
  }

  function pointAt(e, d) {
    const { pts, cum } = e;
    if (d <= 0) return pts[0];
    if (d >= e.len) return pts[pts.length - 1];
    let s = 1; while (cum[s] < d) s++;
    const t = (d - cum[s - 1]) / (cum[s] - cum[s - 1] || 1);
    return { x: pts[s - 1].x + (pts[s].x - pts[s - 1].x) * t, y: pts[s - 1].y + (pts[s].y - pts[s - 1].y) * t };
  }

  function fire(nodeIndex, depth) {
    const n = nodes[nodeIndex];
    if (!n || !n.links.length || pulses.length > 60) return;
    n.glow = 1;
    const k = n.links[Math.floor(Math.random() * n.links.length)];
    const e = edges[k];
    pulses.push({ e: k, d: 0, dir: e.a === nodeIndex ? 1 : -1, speed: rand(90, 170), depth });
  }

  function offsetY() {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    return -(scrollY / max) * (FIELD_H - H);
  }

  function draw(dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const oy = offsetY();
    ctx.translate(0, oy);
    const base = colors.dark ? 0.22 : 0.16;

    // connections
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    edges.forEach(e => {
      const A = nodes[e.a], B = nodes[e.b];
      if (Math.max(A.y, B.y) + oy < -30 || Math.min(A.y, B.y) + oy > H + 30) return;
      const g = ctx.createLinearGradient(A.x, A.y, B.x, B.y);
      g.addColorStop(0, colors.a); g.addColorStop(1, colors.b);
      ctx.strokeStyle = g;
      ctx.globalAlpha = base * Math.min(fade(A.x), fade(B.x));
      ctx.lineWidth = e.trace ? 1 : 1.2;
      ctx.stroke(e.path);
    });

    // nodes: neuron cell bodies with dendrites, or circuit vias
    nodes.forEach(n => {
      const y = n.y + oy;
      if (y < -40 || y > H + 40) return;
      const f = fade(n.x);
      n.glow = Math.max(0, n.glow - dt * 1.6);
      ctx.globalAlpha = (base + 0.18 + n.glow * 0.6) * f;
      ctx.strokeStyle = colors.a; ctx.fillStyle = colors.a;
      if (n.organic) {
        ctx.lineWidth = 1;
        n.dendrites.forEach(d => {
          const ex = n.x + Math.cos(d.ang) * d.len, ey = n.y + Math.sin(d.ang) * d.len;
          const cx = n.x + Math.cos(d.ang + d.bend) * d.len * .55, cy = n.y + Math.sin(d.ang + d.bend) * d.len * .55;
          ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.quadraticCurveTo(cx, cy, ex, ey); ctx.stroke();
          if (d.fork) {
            ctx.beginPath(); ctx.moveTo(ex, ey);
            ctx.lineTo(ex + Math.cos(d.ang + d.fork) * d.len * .45, ey + Math.sin(d.ang + d.fork) * d.len * .45); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ex, ey);
            ctx.lineTo(ex + Math.cos(d.ang - d.fork) * d.len * .4, ey + Math.sin(d.ang - d.fork) * d.len * .4); ctx.stroke();
          }
        });
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + n.glow * 2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 1.2 + n.glow * 1.5, 0, Math.PI * 2); ctx.stroke();
      }
      if (n.glow > 0.05) {
        const rg = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 18);
        rg.addColorStop(0, colors.b); rg.addColorStop(1, 'transparent');
        ctx.globalAlpha = n.glow * 0.5 * f; ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(n.x, n.y, 18, 0, Math.PI * 2); ctx.fill();
      }
    });

    // pulses of current
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i], e = edges[p.e];
      p.d += p.speed * (1 + energy * 2.2) * dt;
      if (p.d >= e.len) {
        pulses.splice(i, 1);
        const arrive = p.dir === 1 ? e.b : e.a;
        nodes[arrive].glow = 1;
        if (p.depth < 6 && Math.random() < 0.62) fire(arrive, p.depth + 1);
        continue;
      }
      for (let k = 0; k < 7; k++) {
        const dd = p.d - k * 5;
        if (dd < 0) break;
        const pt = pointAt(e, p.dir === 1 ? dd : e.len - dd);
        const f = fade(pt.x);
        ctx.globalAlpha = (0.9 - k * 0.12) * f * (colors.dark ? 1 : 0.85);
        ctx.fillStyle = k < 2 ? colors.b : colors.a;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, k === 0 ? 2.1 : 1.6 - k * 0.15, 0, Math.PI * 2); ctx.fill();
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
    if (best >= 0) { lastHover = performance.now(); fire(best, 0); }
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
      spawn += dt * (0.9 + energy * 6);
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
