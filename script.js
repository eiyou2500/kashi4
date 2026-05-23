/* =========================================================================
   Le Tomona — script.js
   Scroll interactions, reveal animations, parallax
   ========================================================================= */

(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -----------------------------------------------------------------------
     Year stamp in footer
     ----------------------------------------------------------------------- */
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  /* -----------------------------------------------------------------------
     Mobile navigation toggle
     ----------------------------------------------------------------------- */
  const navToggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');

  if (navToggle && nav) {
    const close = () => {
      navToggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
    };

    navToggle.addEventListener('click', () => {
      const isOpen = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!isOpen));
      nav.classList.toggle('is-open', !isOpen);
    });

    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', close);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
  }

  /* -----------------------------------------------------------------------
     Letter splitting (for headline reveal)
     Wraps each character of an element's text in <span class="letter">.
     Preserves <br>, <span>, and other inline children by walking child nodes.
     ----------------------------------------------------------------------- */
  function splitToLetters(el) {
    if (el.dataset.split === 'done') return;

    // CJK detection — Japanese / Chinese / Korean text should not be split
    // per-character because that breaks line-break rules and produces
    // a vertical column of characters on narrow viewports.
    const CJK = /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF\uAC00-\uD7AF]/;

    const walk = (node) => {
      // Element node: recurse into its children
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === 'BR') return;
        Array.from(node.childNodes).forEach(walk);
        return;
      }
      // Text node: split into letters (skip if contains CJK)
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (!text || !text.trim()) return;
        if (CJK.test(text)) return; // leave Japanese text intact
        const frag = document.createDocumentFragment();
        for (const ch of text) {
          if (ch === ' ') {
            frag.appendChild(document.createTextNode(' '));
          } else {
            const span = document.createElement('span');
            span.className = 'letter';
            span.textContent = ch;
            frag.appendChild(span);
          }
        }
        node.parentNode.replaceChild(frag, node);
      }
    };

    Array.from(el.childNodes).forEach(walk);
    el.dataset.split = 'done';
  }

  document.querySelectorAll('[data-split-letters]').forEach(splitToLetters);

  /* -----------------------------------------------------------------------
     Scroll reveal — IntersectionObserver
     Handles:
       [data-reveal]            -> add .is-revealed on the element
       [data-reveal-children]   -> add .is-revealed (staggers children via CSS)
       [data-split-letters]     -> stagger inner .letter spans
     ----------------------------------------------------------------------- */
  const revealNodes = document.querySelectorAll(
    '[data-reveal], [data-reveal-children], [data-split-letters], .reveal'
  );

  if (reduceMotion || !('IntersectionObserver' in window)) {
    // No animation: just reveal everything
    revealNodes.forEach((el) => {
      el.classList.add('is-revealed', 'is-visible');
      el.querySelectorAll('.letter').forEach((l) => l.classList.add('is-revealed'));
    });
  } else {
    const revealLetters = (el) => {
      const letters = el.querySelectorAll('.letter');
      letters.forEach((letter, i) => {
        const delay = Math.min(i * 30, 1200);
        setTimeout(() => letter.classList.add('is-revealed'), delay);
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          el.classList.add('is-revealed', 'is-visible');
          if (el.hasAttribute('data-split-letters')) {
            revealLetters(el);
          }
          observer.unobserve(el);
        });
      },
      {
        root: null,
        threshold: 0.15,
        rootMargin: '0px 0px -8% 0px',
      }
    );

    revealNodes.forEach((el) => observer.observe(el));
  }

  /* -----------------------------------------------------------------------
     Scroll progress bar  (top of page)
     ----------------------------------------------------------------------- */
  const progress = document.querySelector('[data-scroll-progress]');
  const header = document.querySelector('[data-header]');

  /* -----------------------------------------------------------------------
     Scroll parallax for elements with [data-parallax-y]
     value is multiplier of scroll delta, applied as translateY
     ----------------------------------------------------------------------- */
  const parallaxNodes = Array.from(document.querySelectorAll('[data-parallax-y]'));

  let lastScroll = -1;
  let ticking = false;

  function updateScroll() {
    const y = window.scrollY;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = docH > 0 ? Math.min(1, Math.max(0, y / docH)) : 0;

    // Progress bar
    if (progress) {
      progress.style.setProperty('--progress', (ratio * 100).toFixed(2) + '%');
    }

    // Header state
    if (header) {
      if (y > 28) header.classList.add('is-scrolled');
      else header.classList.remove('is-scrolled');
    }

    // Parallax
    if (!reduceMotion) {
      const vh = window.innerHeight;
      parallaxNodes.forEach((el) => {
        const factor = parseFloat(el.dataset.parallaxY) || 0;
        const rect = el.getBoundingClientRect();
        const elCenter = rect.top + rect.height / 2;
        // Only animate when reasonably in view to avoid wasted work
        if (rect.bottom < -200 || rect.top > vh + 200) return;
        const offset = (elCenter - vh / 2) * factor;
        el.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
      });
    }

    ticking = false;
    lastScroll = y;
  }

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(updateScroll);
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  updateScroll();

  /* -----------------------------------------------------------------------
     Mouse parallax — [data-parallax-mouse]
     Small movement following pointer for hero ornaments / cards
     ----------------------------------------------------------------------- */
  if (!reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const mouseNodes = Array.from(document.querySelectorAll('[data-parallax-mouse]'));
    if (mouseNodes.length) {
      let cx = 0, cy = 0;
      const handle = (event) => {
        cx = (event.clientX / window.innerWidth - 0.5) * 2;
        cy = (event.clientY / window.innerHeight - 0.5) * 2;
        mouseNodes.forEach((el) => {
          const range = parseFloat(el.dataset.parallaxMouse) || 8;
          el.style.transform = `translate3d(${(cx * range).toFixed(2)}px, ${(cy * range).toFixed(2)}px, 0)`;
        });
      };
      window.addEventListener('mousemove', handle, { passive: true });
    }
  }

  /* -----------------------------------------------------------------------
     Smooth anchor scrolling that respects sticky header height
     ----------------------------------------------------------------------- */
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    const href = link.getAttribute('href');
    if (!href || href === '#' || href.length < 2) return;
    link.addEventListener('click', (event) => {
      const target = document.querySelector(href);
      if (!target) return;
      event.preventDefault();
      const headerH = header ? header.offsetHeight : 0;
      const top = window.scrollY + target.getBoundingClientRect().top - headerH - 12;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();
