// ============================================================
//  main.js — Callie Rae McSpadden portfolio
//  Section highlighting, experience filters, email copy,
//  footer year, and the animated orbital preview.
// ============================================================

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 1. Highlight the nav link for the section on screen
const navLinks = [...document.querySelectorAll('.nav-list a')];
const sections = navLinks.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);

const spy = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((a) => {
      const active = a.getAttribute('href') === '#' + entry.target.id;
      a.classList.toggle('is-active', active);
      if (active) {
        a.setAttribute('aria-current', 'true');
        // keep the active chip visible in the phone nav bar
        const bar = a.closest('nav');
        if (bar && bar.scrollWidth > bar.clientWidth) {
          const ar = a.getBoundingClientRect(), br = bar.getBoundingClientRect();
          bar.scrollLeft += ar.left - br.left - (br.width - ar.width) / 2;
        }
      } else {
        a.removeAttribute('aria-current');
      }
    });
  });
}, { rootMargin: '-40% 0px -55% 0px' });
sections.forEach((s) => spy.observe(s));

// 2. Experience filters
const chips = [...document.querySelectorAll('.chip')];
const roles = [...document.querySelectorAll('.role')];
const countEl = document.getElementById('filter-count');
const totalBullets = document.querySelectorAll('.bullets li').length;

function applyFilter(tag) {
  chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === tag)));
  let shown = 0;
  roles.forEach((role, i) => {
    let matches = 0;
    role.querySelectorAll('.bullets li').forEach((li) => {
      const hit = tag === 'all' || li.dataset.tags.split(' ').includes(tag);
      li.hidden = !hit;
      li.classList.toggle('is-match', hit && tag !== 'all');
      if (hit) matches++;
    });
    shown += matches;
    role.classList.toggle('is-empty', matches === 0);
    role.open = tag === 'all' ? i === 0 : matches > 0;
  });
  countEl.textContent = tag === 'all'
    ? `${totalBullets} highlights across ${roles.length} roles`
    : `${shown} of ${totalBullets} highlights`;
}
chips.forEach((c) => c.addEventListener('click', () => applyFilter(c.dataset.filter)));
// Opening a role by hand while filtered shows everything in it
roles.forEach((role) => role.addEventListener('toggle', () => {
  if (role.open && role.classList.contains('is-empty')) {
    role.querySelectorAll('.bullets li').forEach((li) => { li.hidden = false; });
  }
}));
applyFilter('all');

// 3. Contact form, delivered by Web3Forms so the email address never appears on the page
// Paste the access key from web3forms.com between the quotes:
const WEB3FORMS_KEY = 'f50ce5f0-cc4d-4437-8f51-9675e9a021da';

const openBtn = document.getElementById('open-form');
const form = document.getElementById('contact-form');
if (openBtn && form) {
  const status = document.getElementById('cf-status');
  const sendBtn = document.getElementById('cf-send');
  const setStatus = (text, kind) => { status.textContent = text; status.className = 'form-status' + (kind ? ' is-' + kind : ''); };

  openBtn.addEventListener('click', () => {
    const open = form.hidden;
    form.hidden = !open;
    openBtn.setAttribute('aria-expanded', String(open));
    if (open) document.getElementById('cf-name').focus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fields = [...form.querySelectorAll('input[required], textarea[required]')];
    let firstBad = null;
    fields.forEach((f) => {
      const ok = f.value.trim() !== '' && f.checkValidity();
      f.setAttribute('aria-invalid', String(!ok));
      if (!ok && !firstBad) firstBad = f;
    });
    if (firstBad) { setStatus('Please fill in your name, a valid email and a message.', 'error'); firstBad.focus(); return; }
    if (WEB3FORMS_KEY.startsWith('PASTE_')) { setStatus('This form isn\'t connected yet. Please reach out on LinkedIn for now.', 'error'); return; }

    const data = Object.fromEntries(new FormData(form));
    if (data.botcheck) return; // filled in by a bot
    sendBtn.disabled = true; setStatus('Sending…');
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: `Portfolio message from ${data.name}`,
          from_name: 'Callie Rae McSpadden portfolio',
          name: data.name, email: data.email, message: data.message,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || out.success === false) throw new Error(out.message || 'Send failed');
      form.reset(); fields.forEach((f) => f.removeAttribute('aria-invalid'));
      setStatus('Thanks! Your message is on its way.', 'ok');
    } catch {
      setStatus('Your message didn\'t send. Please try again in a moment, or reach out on LinkedIn.', 'error');
    } finally {
      sendBtn.disabled = false;
    }
  });
}

// 4. Footer year
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// 5. Orbital preview: a small 3d(z²) hydrogen cloud, sampled from |ψ|²
(function orbitalPreview() {
  const canvas = document.getElementById('orbital');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const N = 6000;
  const pts = new Float32Array(N * 3);
  const sign = new Int8Array(N);
  // radial: r² e^{-r/3}, pdf r² R² = r⁶ e^{-2r/3}; angular: 3cos²θ − 1
  const rmax = 30;
  let i = 0;
  while (i < N) {
    const r = Math.random() * rmax;
    const z = 2 * Math.random() - 1;
    const ang = 3 * z * z - 1;
    const p = Math.pow(r, 6) * Math.exp(-2 * r / 3) * ang * ang;
    if (Math.random() * 5400 > p) continue; // peak of r⁶e^{-2r/3}·ang² ≈ 5270
    const t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    pts[i * 3] = r * s * Math.cos(t); pts[i * 3 + 1] = r * s * Math.sin(t); pts[i * 3 + 2] = r * z;
    sign[i] = ang >= 0 ? 1 : -1;
    i++;
  }
  let W = 0, H = 0, dpr = 1;
  function size() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.width = Math.max(1, Math.round(rect.width * dpr));
    H = canvas.height = Math.max(1, Math.round(rect.height * dpr));
  }
  new ResizeObserver(size).observe(canvas);

  let angle = 0.6, visible = true, last = performance.now();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  const tilt = 0.35, ct = Math.cos(tilt), st = Math.sin(tilt);

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (visible && W) {
      if (!reduceMotion) angle += dt * 0.4;
      ctx.fillStyle = '#07081a'; ctx.fillRect(0, 0, W, H);
      const scale = Math.min(W, H) / 34;
      const ca = Math.cos(angle), sa = Math.sin(angle);
      const dot = Math.max(1, dpr * 1.2);
      for (let k = 0; k < N; k++) {
        const x = pts[k * 3], y = pts[k * 3 + 1], z = pts[k * 3 + 2];
        const x1 = x * ca - y * sa, y1 = x * sa + y * ca;   // spin about z
        const y2 = y1 * ct - z * st, z2 = y1 * st + z * ct; // tilt toward viewer
        const depth = 0.35 + 0.65 * (y2 / 25 + 1) / 2;
        ctx.fillStyle = sign[k] > 0 ? `rgba(178,160,255,${Math.min(1, depth * 1.4)})` : `rgba(255,140,178,${Math.min(1, depth * 1.4)})`;
        ctx.fillRect(W / 2 + x1 * scale, H / 2 - z2 * scale, dot, dot);
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
