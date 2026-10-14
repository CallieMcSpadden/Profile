// ============================================================
//  main.js — Callie McSpadden portfolio
//  Effects: scroll reveal, scroll-idle contrast, footer year
// ============================================================

// 1. Reveal sections as they scroll into view
const reveals = document.querySelectorAll('.reveal');

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
    }
  });
}, { threshold: 0.15 });

reveals.forEach((el) => observer.observe(el));

// 2. While scrolling: dim content. When scrolling stops: promote to full contrast.
let scrollTimer;

window.addEventListener('scroll', () => {
  document.body.classList.add('is-scrolling');

  // Strip the "settled" (full-contrast) state on anything visible
  document.querySelectorAll('.is-visible').forEach((el) => {
    el.classList.remove('is-settled');
  });

  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    document.body.classList.remove('is-scrolling');

    // Everything currently in view goes to full contrast
    document.querySelectorAll('.is-visible').forEach((el) => {
      el.classList.add('is-settled');
    });
  }, 250);
}, { passive: true });

// 3. On load, settle anything already on screen (e.g. the hero)
window.addEventListener('load', () => {
  document.querySelectorAll('.is-visible').forEach((el) => {
    el.classList.add('is-settled');
  });
});

// 4. Footer year — auto-updates
const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}
