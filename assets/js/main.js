/* Chloé Nails Studio — mouvement (GSAP + ScrollTrigger + Lenis, tous hébergés en local) */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Garde-fou : sans GSAP le site reste lisible (tout est visible par défaut en CSS).
  if (!window.gsap || !window.ScrollTrigger) {
    const l = $('#loader'); if (l) l.remove();
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const ready = Promise.all([
    document.readyState === 'complete' ? Promise.resolve() : new Promise(r => addEventListener('load', r, { once: true })),
    document.fonts ? document.fonts.ready : Promise.resolve()
  ]);

  /* ---------------------------------------------------------------- smooth scroll */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  const scrollTo = (target, opts = {}) => {
    if (lenis) lenis.scrollTo(target, { duration: 1.7, easing: t => 1 - Math.pow(1 - t, 4), ...opts });
    else {
      const el = typeof target === 'string' ? $(target) : target;
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    }
  };
  window.__scrollTo = scrollTo;

  /* ---------------------------------------------------------------- découpe du texte (lettres / mots) */
  function split(root, mode) {
    root.setAttribute('aria-label', root.textContent.replace(/\s+/g, ' ').trim());
    const out = [];
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(p => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            const word = document.createElement('span');
            word.className = 'wd'; word.setAttribute('aria-hidden', 'true');
            if (mode === 'chars') {
              [...p].forEach(ch => {
                const m = document.createElement('span'); m.className = 'cm';
                const i = document.createElement('span'); i.className = 'ci'; i.textContent = ch;
                m.appendChild(i); word.appendChild(m); out.push(i);
              });
            } else {
              const m = document.createElement('span'); m.className = 'wm';
              const i = document.createElement('span'); i.className = 'wi'; i.textContent = p;
              m.appendChild(i); word.appendChild(m); out.push(i);
            }
            frag.appendChild(word);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(root);
    return out;
  }

  const heroL1 = split($('#heroL1'), 'chars');
  const heroL2 = split($('#heroL2'), 'chars');
  const heroSub = split($('#heroSub'), 'words');
  const callChars = split($('#callNum'), 'chars');
  const gigaA = split($('#gigaChloe'), 'chars');
  const gigaB = split($('#gigaNails'), 'chars');
  const titleWords = $$('[data-split="words"]').map(el => ({ el, parts: split(el, 'words') }));

  /* ---------------------------------------------------------------- préchargeur + entrée du hero */
  function introHero() {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo('#heroVideo', { scale: 1.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 2.4 }, 0)
      .from(heroL1, { yPercent: 135, rotate: 7, duration: 1.6, stagger: 0.07 }, 0.15)
      .from(heroL2, { yPercent: 135, duration: 1.3, stagger: 0.035 }, 0.55)
      .from('#heroEyebrow', { y: 24, opacity: 0, duration: 1.1 }, 0.5)
      .from(heroSub, { yPercent: 120, duration: 1.1, stagger: 0.012 }, 0.85)
      .from('#heroCta .btn', { y: 36, opacity: 0, duration: 1.1, stagger: 0.12 }, 1.05)
      .from('[data-hero-card]', { scale: 0.55, opacity: 0, duration: 1.7, stagger: 0.18 }, 0.6)
      .from('[data-hero-almond]', { opacity: 0, scale: 0.85, duration: 2.2 }, 0.2)
      .from('#heroChip', { opacity: 0, y: -16, duration: 1.1 }, 1.1)
      .from('#nav', { opacity: 0, duration: 1.2, ease: 'power2.out' }, 1.0);
    return tl;
  }

  async function runLoader() {
    const loader = $('#loader');
    if (!loader) return;
    if (reduce) { loader.remove(); return; }
    const num = $('#loaderNum'), fill = $('#loaderFill'), st = { p: 0 };
    gsap.set(fill, { yPercent: 100 });
    await new Promise(res => gsap.to(st, {
      p: 100, duration: 1.9, ease: 'power2.inOut',
      onUpdate() { num.textContent = String(Math.round(st.p)).padStart(2, '0'); gsap.set(fill, { yPercent: 100 - st.p }); },
      onComplete: res
    }));
    await Promise.race([ready, new Promise(r => setTimeout(r, 4000))]);
    await new Promise(res => {
      gsap.timeline({ onComplete: res })
        .to('.loader__count, .loader__name', { yPercent: -40, opacity: 0, duration: 0.6, ease: 'power3.in' })
        .to(loader, { yPercent: -106, duration: 1.2, ease: 'expo.inOut' }, '-=0.1')
        .add(() => introHero(), '-=0.8');
    });
    loader.remove();
  }

  /* ---------------------------------------------------------------- navigation */
  const nav = $('#nav');
  let navHidden = false, menuOpen = false;
  const showNav = () => { if (navHidden) { navHidden = false; gsap.to(nav, { yPercent: 0, duration: 0.7, ease: 'expo.out', overwrite: 'auto' }); } };
  const hideNav = () => { if (!navHidden && !menuOpen) { navHidden = true; gsap.to(nav, { yPercent: -110, duration: 0.7, ease: 'expo.out', overwrite: 'auto' }); } };
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: self => {
      const y = self.scroll();
      nav.classList.toggle('is-solid', y > 80);
      if (y > 320 && self.direction === 1) hideNav(); else if (self.direction === -1 || y <= 320) showNav();
    }
  });
  gsap.to('#progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

  // menu mobile plein écran
  const burger = $('#burger'), menu = $('#menu');
  function setMenu(open) {
    menuOpen = open;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    menu.setAttribute('aria-hidden', String(!open));
    if (open) {
      showNav(); if (lenis) lenis.stop(); menu.classList.add('is-open');
      nav.classList.remove('is-solid'); nav.style.color = 'var(--cream)';
      gsap.fromTo(menu, { clipPath: 'circle(0% at calc(100% - 3rem) 2.4rem)' }, { clipPath: 'circle(150% at calc(100% - 3rem) 2.4rem)', duration: reduce ? 0 : 1.1, ease: 'expo.out' });
      gsap.fromTo('.menu__links a span', { yPercent: 115 }, { yPercent: 0, duration: reduce ? 0 : 1, stagger: 0.06, ease: 'expo.out', delay: reduce ? 0 : 0.2 });
    } else {
      nav.style.color = '';
      nav.classList.toggle('is-solid', window.scrollY > 80);
      gsap.to(menu, { clipPath: 'circle(0% at calc(100% - 3rem) 2.4rem)', duration: reduce ? 0 : 0.7, ease: 'expo.inOut', onComplete: () => { menu.classList.remove('is-open'); if (lenis) lenis.start(); } });
    }
  }
  burger.addEventListener('click', () => setMenu(!menuOpen));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen) setMenu(false); });

  // liens d'ancre : défilement doux
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = $(id);
    if (!target) return;
    e.preventDefault();
    if (menuOpen) setMenu(false);
    setTimeout(() => scrollTo(id === '#top' ? 0 : target, { offset: 0 }), menuOpen ? 350 : 0);
    history.replaceState(null, '', id);
    // pour les lecteurs d'écran / clavier : déplacer le focus
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }));

  /* ---------------------------------------------------------------- hero : parallax multicouche */
  const heroVideo = $('#heroVideo');
  const saveData = navigator.connection && navigator.connection.saveData;
  if ((reduce || saveData) && heroVideo) { heroVideo.removeAttribute('autoplay'); heroVideo.preload = 'none'; heroVideo.pause(); }
  if (!reduce) {
    const h = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
    gsap.to('[data-hero-media]', { yPercent: 14, ease: 'none', scrollTrigger: h });
    gsap.to('[data-hero-almond]', { yPercent: -16, rotate: 10, ease: 'none', scrollTrigger: h });
    gsap.to('[data-hero-card="1"]', { yPercent: -45, ease: 'none', scrollTrigger: h });
    gsap.to('[data-hero-card="2"]', { yPercent: -85, ease: 'none', scrollTrigger: h });
    gsap.to('.hero__content', { yPercent: -14, opacity: 0.15, ease: 'none', scrollTrigger: h });
    gsap.to('.hero__chip', { opacity: 0, ease: 'none', scrollTrigger: { ...h, end: '30% top' } });

    if (fine) {
      const layers = [
        { el: '[data-hero-media]', k: -10 }, { el: '[data-hero-almond]', k: 26 },
        { el: '[data-hero-card="1"]', k: -34 }, { el: '[data-hero-card="2"]', k: 46 }
      ].map(l => ({ ...l, x: gsap.quickTo(l.el, 'x', { duration: 1.2, ease: 'power3' }), y: gsap.quickTo(l.el, 'y', { duration: 1.2, ease: 'power3' }) }));
      $('.hero').addEventListener('pointermove', e => {
        const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
        layers.forEach(l => { l.x(nx * l.k); l.y(ny * l.k); });
      });
    }
  }

  /* ---------------------------------------------------------------- marquee réactif au scroll */
  const rows = $$('[data-marquee]').map(el => {
    const item = el.firstElementChild;
    for (let i = 0; i < 3; i++) el.appendChild(item.cloneNode(true));
    return { el, item, dir: +el.dataset.marquee, pos: 0, w: 1 };
  });
  const measure = () => rows.forEach(r => { r.w = r.item.offsetWidth || 1; });
  if (!reduce) {
    let vel = 0, dirF = 1, boost = 0;
    ScrollTrigger.create({ onUpdate: s => { vel = s.getVelocity(); if (vel > 0) dirF = 1; else if (vel < 0) dirF = -1; } });
    gsap.ticker.add((time, dt) => {
      vel *= 0.92;
      boost += (Math.min(Math.abs(vel) / 320, 9) - boost) * 0.08;
      rows.forEach(r => {
        r.pos += (60 + 60 * boost) * dirF * r.dir * (dt / 1000);
        r.pos = ((r.pos % r.w) + r.w) % r.w;
        gsap.set(r.el, { x: -r.pos });
      });
    });
  } else {
    rows.forEach(r => r.el.style.transform = 'translateX(0)');
  }
  ready.then(measure);
  addEventListener('resize', measure);

  /* ---------------------------------------------------------------- titres : masque qui monte */
  if (!reduce) {
    titleWords.forEach(({ el, parts }) => {
      gsap.from(parts, { yPercent: 125, duration: 1.2, ease: 'expo.out', stagger: 0.06, scrollTrigger: { trigger: el, start: 'top 86%' } });
    });
    gsap.from(callChars, { yPercent: 120, duration: 1.4, ease: 'expo.out', stagger: 0.045, scrollTrigger: { trigger: '#callNum', start: 'top 88%' } });
    gsap.from(gigaA, { yPercent: 120, duration: 1.6, ease: 'expo.out', stagger: 0.07, scrollTrigger: { trigger: '#footer', start: 'top 70%' } });
    gsap.from(gigaB, { yPercent: 120, duration: 1.4, ease: 'expo.out', stagger: 0.04, scrollTrigger: { trigger: '#footer', start: 'top 60%' } });
    // révélations génériques (fondu + montée)
    ['.lead', '.booking__note', '.how li', '.find__card', '.qa', '.stat', '.callband__actions .btn', '.callband__kicker', '.footer__top > div'].forEach(sel => {
      $$(sel).forEach(el => gsap.from(el, { y: 44, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 92%' } }));
    });
    gsap.from('#wiz', { y: 70, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '#wiz', start: 'top 88%' } });
    gsap.from('#mapBox', { clipPath: 'inset(14% 14% 14% 14% round 30px)', opacity: 0.2, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '#mapBox', start: 'top 85%' } });
    // formes amande flottantes
    $$('[data-float]').forEach((el, i) => gsap.to(el, { yPercent: i % 2 ? 22 : -22, rotate: i % 2 ? -12 : 14, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));
  }

  /* ---------------------------------------------------------------- histoire (pin) & prestations (horizontal) */
  const mm = gsap.matchMedia();
  const story = $('.story'), services = $('.services');

  mm.add('(min-width: 821px)', () => {
    if (reduce) return;
    story.classList.add('is-pinned');
    services.classList.add('is-pinned');

    /* storytelling pinné */
    const steps = $$('.story__step'), imgs = $$('.story__img'), n = steps.length;
    const tints = ['#FBF4EF', '#F8E9E3', '#F3D6D0', '#FBF4EF'];
    gsap.set(steps.slice(1), { autoAlpha: 0 });
    gsap.set(imgs.slice(1), { clipPath: 'circle(0% at 50% 100%)' });
    const cur = $('#storyCur');
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: story, start: 'top top', end: () => '+=' + n * 95 + '%', pin: true, scrub: 0.7, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 2,
        onUpdate: () => { cur.textContent = String(Math.min(n, Math.floor(tl.time() + 0.55) + 1)).padStart(2, '0'); }
      }
    });
    for (let i = 1; i < n; i++) {
      tl.to(steps[i - 1], { autoAlpha: 0, yPercent: -14, duration: 0.5, ease: 'power2.in' }, i)
        .fromTo(steps[i], { autoAlpha: 0, yPercent: 16 }, { autoAlpha: 1, yPercent: 0, duration: 0.6, ease: 'power2.out' }, i + 0.2)
        .fromTo(imgs[i], { clipPath: 'circle(0% at 50% 100%)' }, { clipPath: 'circle(142% at 50% 100%)', duration: 0.95, ease: 'power1.inOut' }, i - 0.05)
        .fromTo($('img', imgs[i]), { scale: 1.34 }, { scale: 1.12, duration: 1.1 }, i - 0.05)
        .to(story, { backgroundColor: tints[i], duration: 0.8 }, i - 0.05);
    }
    tl.to('.story__progress i', { scaleY: 1, duration: n - 1, ease: 'none' }, 0.2);
    tl.to({}, { duration: 0.5 });
    gsap.fromTo($('img', imgs[0]), { scale: 1.3 }, { scale: 1.12, duration: 2.2, ease: 'expo.out', scrollTrigger: { trigger: story, start: 'top 70%', once: true } });

    /* prestations : défilement horizontal piloté par le scroll vertical */
    const track = $('#svcTrack');
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: services, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 1 }
    });

    return () => { story.classList.remove('is-pinned'); services.classList.remove('is-pinned'); gsap.set(story, { clearProps: 'backgroundColor' }); };
  });

  mm.add('(max-width: 820px)', () => {
    if (reduce) return;
    $$('.story__step').forEach(step => {
      gsap.from(step, { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: step, start: 'top 85%' } });
      const im = $('.story__mimg', step);
      if (im) gsap.from(im, { clipPath: 'inset(100% 0 0 0)', duration: 1.5, ease: 'expo.out', scrollTrigger: { trigger: im, start: 'top 88%' } });
    });
    $$('.svc').forEach((c, i) => gsap.from(c, { x: 50, opacity: 0, duration: 1, ease: 'expo.out', delay: Math.min(i, 3) * 0.05, scrollTrigger: { trigger: '#svcTrack', start: 'top 88%' } }));
  });

  // « Choisir » sur une prestation : pré-sélection + descente vers la réservation
  $$('[data-pick]').forEach(b => b.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('chloe:pick', { detail: b.dataset.pick }));
    scrollTo('#reserver', { offset: 0 });
  }));

  /* ---------------------------------------------------------------- compteurs */
  $$('[data-count]').forEach(el => {
    const end = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0);
    const fmt = v => v.toFixed(dec).replace('.', ',');
    if (reduce) { el.textContent = fmt(end); return; }
    const o = { v: 0 }; el.textContent = fmt(0);
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: end, duration: 2.4, ease: 'power3.out', onUpdate: () => { el.textContent = fmt(o.v); } }) });
  });

  /* ---------------------------------------------------------------- galerie : révélation, parallax interne, tilt, lightbox */
  const items = $$('.gitem');
  if (!reduce) {
    items.forEach(it => {
      gsap.from(it, { clipPath: 'inset(100% 0 0 0)', duration: 1.5, ease: 'expo.out', scrollTrigger: { trigger: it, start: 'top 92%' } });
      gsap.fromTo($('img', it), { yPercent: -9, scale: 1.22 }, { yPercent: 9, scale: 1.22, ease: 'none', scrollTrigger: { trigger: it, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    gsap.matchMedia().add('(min-width: 701px)', () => {
      const cols = $$('.gcol');
      gsap.fromTo(cols[1], { y: 70 }, { y: -90, ease: 'none', scrollTrigger: { trigger: '#galGrid', start: 'top bottom', end: 'bottom top', scrub: 0.8 } });
      gsap.fromTo(cols[2], { y: -30 }, { y: 50, ease: 'none', scrollTrigger: { trigger: '#galGrid', start: 'top bottom', end: 'bottom top', scrub: 0.8 } });
    });
  }
  if (fine && !reduce) {
    items.forEach(it => {
      it.addEventListener('pointermove', e => {
        const r = it.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(it, { rotateY: px * 9, rotateX: -py * 9, transformPerspective: 1000, duration: 0.6, ease: 'power3.out' });
      });
      it.addEventListener('pointerleave', () => gsap.to(it, { rotateX: 0, rotateY: 0, duration: 1, ease: 'elastic.out(1,.5)' }));
    });
  }

  const lb = $('#lightbox'), lbImg = $('#lbImg'), lbCap = $('#lbCap');
  let lbIdx = 0, lbOpener = null;
  const lbShow = i => {
    lbIdx = (i + items.length) % items.length;
    const it = items[lbIdx];
    lbImg.src = it.dataset.full; lbImg.alt = $('img', it).alt;
    lbCap.textContent = it.dataset.cap + (it.dataset.mine === '1' ? ' — réalisation de Chloé' : ' — inspiration (photo libre de droits)');
    lbImg.classList.add('is-kb');
    if (!reduce) gsap.fromTo(lbImg, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.8, ease: 'expo.out' });
  };
  const lbOpen = i => {
    lbOpener = document.activeElement; lb.classList.add('is-open'); lb.setAttribute('aria-hidden', 'false');
    if (lenis) lenis.stop(); lbShow(i); $('#lbClose').focus();
  };
  const lbClose = () => {
    lb.classList.remove('is-open'); lb.setAttribute('aria-hidden', 'true'); if (lenis && !menuOpen) lenis.start();
    if (lbOpener) lbOpener.focus();
  };
  items.forEach((it, i) => it.addEventListener('click', () => lbOpen(i)));
  $('#lbClose').addEventListener('click', lbClose);
  $('#lbPrev').addEventListener('click', () => lbShow(lbIdx - 1));
  $('#lbNext').addEventListener('click', () => lbShow(lbIdx + 1));
  lb.addEventListener('click', e => { if (e.target === lb) lbClose(); });
  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') lbClose();
    else if (e.key === 'ArrowLeft') lbShow(lbIdx - 1);
    else if (e.key === 'ArrowRight') lbShow(lbIdx + 1);
    else if (e.key === 'Tab') {
      const f = $$('.lightbox__btn', lb), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------------------------------------------------------------- avis : carrousel */
  const rv = $('#rvTrack'), cards = $$('.rv', rv), bar = $('#rvBar');
  const step = () => (cards[0] ? cards[0].offsetWidth + 24 : 400);
  const updateRv = () => {
    const rect = rv.getBoundingClientRect(), mid = rect.left + rect.width / 2;
    cards.forEach(c => {
      const r = c.getBoundingClientRect(), d = Math.min(Math.abs(r.left + r.width / 2 - mid) / rect.width, 0.7);
      gsap.set(c, { scale: 1 - d * 0.1, opacity: 1 - d * 0.55 });
    });
    const max = rv.scrollWidth - rv.clientWidth;
    gsap.set(bar, { scaleX: 0.14 + 0.86 * (max > 0 ? rv.scrollLeft / max : 1) });
  };
  let rvRaf = 0;
  rv.addEventListener('scroll', () => { cancelAnimationFrame(rvRaf); rvRaf = requestAnimationFrame(updateRv); }, { passive: true });
  $('#rvPrev').addEventListener('click', () => rv.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }));
  $('#rvNext').addEventListener('click', () => {
    const atEnd = rv.scrollLeft + rv.clientWidth >= rv.scrollWidth - 8;
    if (atEnd) rv.scrollTo({ left: 0, behavior: reduce ? 'auto' : 'smooth' });
    else rv.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' });
  });
  // glisser à la souris
  let drag = null, moved = false;
  rv.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; drag = { x: e.clientX, left: rv.scrollLeft }; moved = false; });
  addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 4) { moved = true; rv.classList.add('is-drag'); }
    rv.scrollLeft = drag.left - dx;
  });
  addEventListener('pointerup', () => { if (!drag) return; drag = null; rv.classList.remove('is-drag'); });
  rv.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  // lecture automatique (désactivée en mouvement réduit, au survol et au focus)
  if (!reduce) {
    let hovering = false, inView = false;
    rv.addEventListener('pointerenter', () => hovering = true);
    rv.addEventListener('pointerleave', () => hovering = false);
    rv.addEventListener('focusin', () => hovering = true);
    rv.addEventListener('focusout', () => hovering = false);
    ScrollTrigger.create({ trigger: rv, start: 'top 85%', end: 'bottom 15%', onToggle: s => inView = s.isActive });
    setInterval(() => { if (inView && !hovering && !drag && !menuOpen) $('#rvNext').click(); }, 6500);
    gsap.from(cards, { y: 70, rotate: 2.5, duration: 1.4, ease: 'expo.out', stagger: 0.14, scrollTrigger: { trigger: rv, start: 'top 88%' } });
  }
  updateRv();
  addEventListener('resize', updateRv);

  /* ---------------------------------------------------------------- FAQ */
  const toggleQa = (btn, open) => {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    btn.setAttribute('aria-expanded', String(open));
    panel.inert = !open;
    if (reduce) { panel.style.height = open ? 'auto' : '0px'; return; }
    gsap.to(panel, { height: open ? 'auto' : 0, duration: 0.8, ease: 'expo.out', onComplete: () => ScrollTrigger.refresh() });
  };
  $$('.qa__q').forEach(btn => {
    document.getElementById(btn.getAttribute('aria-controls')).inert = true;
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      $$('.qa__q[aria-expanded="true"]').forEach(o => { if (o !== btn) toggleQa(o, false); });
      toggleQa(btn, !open);
    });
  });

  /* ---------------------------------------------------------------- horaires : « ouvert maintenant » */
  const SCHED = { 1: [9, 20], 2: [9, 20], 3: [9, 20], 4: [9, 20], 5: [9, 20], 6: [9, 13], 0: null };
  const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  function updateHours() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const d = now.getDay(), h = now.getHours() + now.getMinutes() / 60, badge = $('#openBadge');
    $$('#hours [data-dow]').forEach(r => r.classList.toggle('is-today', +r.dataset.dow === d));
    const s = SCHED[d];
    if (s && h >= s[0] && h < s[1]) { badge.classList.add('is-open'); badge.textContent = `Ouvert maintenant · jusqu'à ${s[1]}h`; return; }
    badge.classList.remove('is-open');
    let txt = 'Fermé actuellement';
    if (s && h < s[0]) txt = `Fermé · ouvre à ${s[0]}h`;
    else for (let k = 1; k <= 7; k++) { const nd = (d + k) % 7; if (SCHED[nd]) { txt = `Fermé · ouvre ${k === 1 ? 'demain' : DAYS[nd]} à ${SCHED[nd][0]}h`; break; } }
    badge.textContent = txt;
  }
  updateHours(); setInterval(updateHours, 60000);

  /* ---------------------------------------------------------------- curseur amande, boutons magnétiques, tilt 3D */
  if (fine && !reduce) {
    const cur = $('#cursor');
    gsap.set(cur, { xPercent: -50, yPercent: -50 });
    const cx = gsap.quickTo(cur, 'x', { duration: 0.4, ease: 'power3' }), cy = gsap.quickTo(cur, 'y', { duration: 0.4, ease: 'power3' });
    addEventListener('pointermove', e => { cx(e.clientX); cy(e.clientY); cur.style.opacity = 1; }, { passive: true });
    document.addEventListener('pointerover', e => cur.classList.toggle('is-hover', !!e.target.closest('a, button, input, textarea, label, [data-tilt]')));
    document.documentElement.addEventListener('mouseleave', () => cur.style.opacity = 0);

    $$('[data-magnetic]').forEach(el => {
      const inner = $('.btn__in', el);
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        gsap.to(el, { x: dx * 0.28, y: dy * 0.4, duration: 0.5, ease: 'power3.out' });
        if (inner) gsap.to(inner, { x: dx * 0.14, y: dy * 0.2, duration: 0.5, ease: 'power3.out' });
      });
      el.addEventListener('pointerleave', () => gsap.to(inner ? [el, inner] : el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1,.4)' }));
    });

    $$('[data-tilt]').forEach(el => {
      const glare = $('.svc__glare', el);
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        gsap.to(el, { rotateY: (px - 0.5) * 14, rotateX: (0.5 - py) * 14, transformPerspective: 900, duration: 0.5, ease: 'power3.out' });
        if (glare) gsap.to(glare, { x: px * r.width, y: py * r.height, duration: 0.4, ease: 'power3.out' });
      });
      el.addEventListener('pointerleave', () => gsap.to(el, { rotateX: 0, rotateY: 0, duration: 1, ease: 'elastic.out(1,.5)' }));
    });
  }

  /* ---------------------------------------------------------------- bouton flottant mobile : s'efface sur la réservation */
  const fab = $('#fab');
  ScrollTrigger.create({ trigger: '#reserver', start: 'top 70%', end: 'bottom 30%', onToggle: s => gsap.to(fab, { yPercent: s.isActive ? 180 : 0, duration: 0.6, ease: 'expo.out' }) });

  /* ---------------------------------------------------------------- démarrage */
  ready.then(() => ScrollTrigger.refresh());
  runLoader().then(() => { if (lenis && !menuOpen) lenis.start(); ScrollTrigger.refresh(); });
  // filet de sécurité : le scroll ne reste jamais bloqué
  setTimeout(() => { if (lenis && !menuOpen && !lb.classList.contains('is-open')) lenis.start(); }, 7000);
})();
