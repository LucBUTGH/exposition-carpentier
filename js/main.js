/**
 * Exposition — Ombres & Lumières
 * Main JavaScript
 */

/* ── Utility ─────────────────────────────────────────────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ── Navigation scroll effect ────────────────────────────── */
function initNav() {
  const nav = $('.nav');
  if (!nav) return;

  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // initial check
}

/* ── Scroll reveal animations ────────────────────────────── */
function initReveal() {
  const els = $$('.reveal');
  if (!els.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  els.forEach(el => observer.observe(el));
}

/* ── Dynamic gallery loading ────────────────────────────── */
async function initGallery() {
  const grid = $('.gallery-grid');
  if (!grid) return;

  try {
    const res = await fetch('/api/gallery');
    const data = await res.json();
    if (!data.ok || !data.artworks?.length) return;

    grid.innerHTML = '';

    data.artworks.forEach((artwork, i) => {
      const delay = i % 3;
      const article = document.createElement('article');
      article.className = `gallery-item reveal${delay ? ` reveal-delay-${delay}` : ''}`;
      article.dataset.title = artwork.title;
      article.dataset.date = artwork.technique || '';
      article.dataset.full = artwork.imageUrl;

      const img = document.createElement('img');
      img.className = 'gallery-item__img';
      img.src = artwork.imageUrl;
      img.alt = artwork.title;

      const titleEl = document.createElement('p');
      titleEl.className = 'gallery-item__title';
      titleEl.textContent = artwork.title;

      const techEl = document.createElement('span');
      techEl.className = 't-caption';
      techEl.textContent = artwork.technique || '';

      const overlay = document.createElement('div');
      overlay.className = 'gallery-item__overlay';
      overlay.appendChild(titleEl);
      overlay.appendChild(techEl);

      article.appendChild(img);
      article.appendChild(overlay);
      grid.appendChild(article);
    });
  } catch {
    // En cas d'erreur, on garde la galerie hardcodée
  }
}

/* ── Gallery lightbox ────────────────────────────────────── */
function initLightbox() {
  const lightbox     = $('.lightbox');
  const lightboxImg  = $('.lightbox__img');
  const lightboxTitle = $('.lightbox__title');
  const lightboxDate  = $('.lightbox__date');
  const closeBtn     = $('.lightbox__close');
  const items        = $$('.gallery-item');

  if (!lightbox) return;

  const openLightbox = (item) => {
    const img   = item.dataset.full  || item.querySelector('img')?.src;
    const title = item.dataset.title || '';
    const date  = item.dataset.date  || '';

    lightboxImg.src = img || '';
    if (lightboxTitle) lightboxTitle.textContent = title;
    if (lightboxDate)  lightboxDate.textContent  = date;

    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  };

  items.forEach(item => {
    item.addEventListener('click', () => openLightbox(item));
  });

  closeBtn?.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
}

/* ── Hero image load animation ───────────────────────────── */
function initHero() {
  const hero = $('.hero');
  if (!hero) return;

  const img = hero.querySelector('.hero__bg-img');
  if (!img) {
    hero.classList.add('loaded');
    return;
  }

  if (img.complete) {
    hero.classList.add('loaded');
  } else {
    img.addEventListener('load', () => hero.classList.add('loaded'));
  }
}

/* ── Contact form ────────────────────────────────────────── */
function initContactForm() {
  const form = $('.contact__form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const btn = form.querySelector('.btn-primary');
    const original = btn.textContent;
    btn.textContent = 'Envoi en cours…';
    btn.disabled = true;

    // Simulate async submit — replace with actual fetch when backend is ready
    setTimeout(() => {
      btn.textContent = 'Message envoyé';
      form.reset();

      setTimeout(() => {
        btn.textContent = original;
        btn.disabled = false;
      }, 3000);
    }, 1200);
  });
}

/* ── Parallax (subtle) ───────────────────────────────────── */
function initParallax() {
  const hero = $('.hero__bg-img');
  if (!hero || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    hero.style.transform = `scale(1) translateY(${y * 0.25}px)`;
  }, { passive: true });
}

/* ── Smooth active nav link ──────────────────────────────── */
function initActiveNav() {
  const sections = $$('section[id]');
  const links    = $$('.nav__links a[href^="#"]');

  if (!sections.length || !links.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        links.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
      });
    },
    { threshold: 0.4 }
  );

  sections.forEach(s => observer.observe(s));
}

/* ── Init ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  initNav();
  await initGallery();
  initReveal();
  initLightbox();
  initHero();
  initContactForm();
  initParallax();
  initActiveNav();
});
