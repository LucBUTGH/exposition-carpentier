/**
 * Philippe Carpentier — Multi-page site
 * Main JavaScript
 */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ── Scroll reveal ────────────────────────────────────────── */
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
    { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
  );

  els.forEach(el => observer.observe(el));
}

/* ── Dynamic gallery loading ──────────────────────────────── */
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
      techEl.className = 'gallery-item__technique';
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
    // Keep hardcoded gallery as fallback
  }
}

/* ── Lightbox ─────────────────────────────────────────────── */
function initLightbox() {
  const lightbox = $('.lightbox');
  const lightboxImg = $('.lightbox__img');
  const lightboxTitle = $('.lightbox__title');
  const lightboxDate = $('.lightbox__date');
  const closeBtn = $('.lightbox__close');

  if (!lightbox) return;

  const open = (item) => {
    const img = item.dataset.full || item.querySelector('img')?.src;
    const title = item.dataset.title || '';
    const date = item.dataset.date || '';

    if (!img) return;

    lightboxImg.src = img;
    if (lightboxTitle) lightboxTitle.textContent = title;
    if (lightboxDate) lightboxDate.textContent = date;

    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const close = () => {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  };

  // Delegate click on gallery items (works with dynamic content)
  document.addEventListener('click', (e) => {
    const item = e.target.closest('.gallery-item');
    if (item) open(item);
  });

  closeBtn?.addEventListener('click', close);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

/* ── Hero ─────────────────────────────────────────────────── */
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

/* ── Contact form ─────────────────────────────────────────── */
function initContactForm() {
  const form = $('.contact__form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const btn = form.querySelector('.btn-primary');
    const original = btn.textContent;
    btn.textContent = 'Envoi en cours…';
    btn.disabled = true;

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

/* ── Artist portrait placeholder ──────────────────────────── */
function initArtistPortrait() {
  const img = $('.artist__portrait-img');
  if (!img) return;

  const placeholder = img.nextElementSibling;
  if (!placeholder) return;

  const hide = () => { placeholder.style.display = 'none'; };

  if (img.complete) hide();
  else img.addEventListener('load', hide);
}

/* ── Init ─────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  initHero();
  initArtistPortrait();

  // Gallery page
  if ($('.gallery-grid')) {
    await initGallery();
    initLightbox();
  }

  // Contact page
  initContactForm();

  // Reveal (must be last to catch dynamic elements)
  initReveal();
});
