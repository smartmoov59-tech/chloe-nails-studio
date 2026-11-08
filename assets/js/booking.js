/* Chloé Nails Studio — assistant de réservation 100 % statique.
   Aucun serveur, aucun abonnement : la demande est transformée en SMS pré-rempli (sms:),
   appel (tel:), texte à copier ou fichier agenda (.ics). Chloé confirme ensuite par SMS. */
(() => {
  'use strict';

  const PHONE = '+33646786268';
  const PHONE_LABEL = '06 46 78 62 68';
  const MAX_SLOTS = 3;
  const LAST_START = { weekday: 18, saturday: 11 }; // dernier début de pose (fermeture 20h / 13h)
  const FIRST_START = 9;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const form = $('#wizForm');
  if (!form) return;

  /* ------------------------------------------------------------ données */
  const SERVICES = $$('.svc[data-service]').map(el => ({ id: el.dataset.service, name: el.dataset.name, desc: el.dataset.desc }));
  SERVICES.push({ id: 'conseil', name: 'Je ne sais pas encore', desc: 'Chloé me conseille' });

  const state = { step: 1, service: null, slots: [], viewMonth: null, activeDate: null };
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const fmtLong = d => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  const fmtShort = d => new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
  const fmtTime = t => { const [h, m] = t.split(':'); return `${Number(h)}h${m === '00' ? '' : m}`; };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  const today = startOfDay(new Date());
  const maxDate = addDays(today, 90);
  state.viewMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  function slotsFor(date) {
    const dow = date.getDay();
    if (dow === 0) return [];
    const last = dow === 6 ? LAST_START.saturday : LAST_START.weekday;
    const out = [];
    for (let h = FIRST_START; h <= last; h++) out.push(`${pad(h)}:00`);
    // le jour même : au moins 2 h devant soi
    if (iso(date) === iso(today)) {
      const limit = new Date().getHours() + 2;
      return out.filter(t => Number(t.slice(0, 2)) >= limit);
    }
    return out;
  }
  const selectable = d => d >= today && d <= maxDate && slotsFor(d).length > 0;

  /* ------------------------------------------------------------ étape 1 : prestations */
  const chips = $('#svcChips');
  SERVICES.forEach(s => {
    const wrap = document.createElement('div'); wrap.className = 'chip';
    const input = document.createElement('input'); input.type = 'radio'; input.name = 'service'; input.id = 's-' + s.id; input.value = s.id;
    const label = document.createElement('label'); label.htmlFor = input.id;
    const b = document.createElement('b'); b.textContent = s.name;
    const span = document.createElement('span'); span.textContent = s.desc;
    label.append(b, span); wrap.append(input, label); chips.appendChild(wrap);
    input.addEventListener('change', () => { state.service = s.id; sync(); });
  });
  document.addEventListener('chloe:pick', e => {
    const input = $('#s-' + e.detail);
    if (!input) return;
    input.checked = true; state.service = e.detail; sync();
  });

  /* ------------------------------------------------------------ étape 2 : calendrier + créneaux */
  const calGrid = $('#calGrid'), calTitle = $('#calTitle'), calPrev = $('#calPrev'), calNext = $('#calNext');
  const slotsGrid = $('#slotsGrid'), slotsTitle = $('#slotsTitle'), slotsHint = $('#slotsHint');
  const picked = document.createElement('ul'); picked.className = 'picked'; picked.setAttribute('aria-label', 'Créneaux choisis');
  slotsHint.after(picked);

  function renderCal() {
    const v = state.viewMonth;
    calTitle.textContent = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(v);
    calGrid.textContent = '';
    ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach((l, i) => {
      const s = document.createElement('span'); s.className = 'cal__dow'; s.textContent = l;
      s.setAttribute('aria-hidden', 'true'); calGrid.appendChild(s);
    });
    const lead = (v.getDay() + 6) % 7;
    for (let i = 0; i < lead; i++) calGrid.appendChild(document.createElement('span'));
    const days = new Date(v.getFullYear(), v.getMonth() + 1, 0).getDate();
    for (let n = 1; n <= days; n++) {
      const d = new Date(v.getFullYear(), v.getMonth(), n);
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'cal__day'; btn.textContent = n; btn.dataset.date = iso(d);
      btn.setAttribute('aria-label', fmtLong(d));
      const ok = selectable(d);
      if (!ok) btn.disabled = true;
      if (iso(d) === iso(today)) btn.classList.add('is-today');
      btn.setAttribute('aria-pressed', String(state.activeDate === iso(d)));
      btn.addEventListener('click', () => { state.activeDate = iso(d); renderCal(); renderSlots(); });
      calGrid.appendChild(btn);
    }
    calPrev.disabled = v.getFullYear() === today.getFullYear() && v.getMonth() === today.getMonth();
    calNext.disabled = v.getFullYear() > maxDate.getFullYear() || (v.getFullYear() === maxDate.getFullYear() && v.getMonth() >= maxDate.getMonth());
  }
  calPrev.addEventListener('click', () => { state.viewMonth = new Date(state.viewMonth.getFullYear(), state.viewMonth.getMonth() - 1, 1); renderCal(); });
  calNext.addEventListener('click', () => { state.viewMonth = new Date(state.viewMonth.getFullYear(), state.viewMonth.getMonth() + 1, 1); renderCal(); });

  const hasSlot = (date, time) => state.slots.some(s => s.date === date && s.time === time);
  function renderSlots() {
    slotsGrid.textContent = '';
    if (!state.activeDate) { slotsTitle.textContent = 'Choisissez d\u2019abord un jour'; return; }
    const d = fromIso(state.activeDate);
    slotsTitle.textContent = cap(fmtLong(d));
    const list = slotsFor(d);
    if (!list.length) {
      const p = document.createElement('p'); p.className = 'slots__empty'; p.textContent = 'Plus de créneau ce jour-là. Essayez le lendemain ou appelez Chloé.';
      slotsGrid.appendChild(p); return;
    }
    list.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'slot'; b.textContent = t;
      b.setAttribute('aria-label', `${fmtLong(d)} à ${fmtTime(t)}`);
      b.setAttribute('aria-pressed', String(hasSlot(state.activeDate, t)));
      b.addEventListener('click', () => toggleSlot(state.activeDate, t));
      slotsGrid.appendChild(b);
    });
  }
  function toggleSlot(date, time) {
    const i = state.slots.findIndex(s => s.date === date && s.time === time);
    if (i >= 0) state.slots.splice(i, 1);
    else if (state.slots.length >= MAX_SLOTS) { toast(`${MAX_SLOTS} créneaux maximum : retirez-en un pour en choisir un autre.`); return; }
    else state.slots.push({ date, time });
    state.slots.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    renderSlots(); renderPicked(); sync();
  }
  function renderPicked() {
    picked.textContent = '';
    state.slots.forEach(s => {
      const li = document.createElement('li');
      const t = document.createElement('span'); t.textContent = `${cap(fmtShort(fromIso(s.date)))} · ${fmtTime(s.time)}`;
      const x = document.createElement('button'); x.type = 'button'; x.textContent = '×';
      x.setAttribute('aria-label', `Retirer ${fmtLong(fromIso(s.date))} à ${fmtTime(s.time)}`);
      x.addEventListener('click', () => { state.slots = state.slots.filter(o => o !== s); renderSlots(); renderPicked(); sync(); });
      li.append(t, x); picked.appendChild(li);
    });
  }

  /* ------------------------------------------------------------ étape 3 : coordonnées */
  const fName = $('#fName'), fNameErr = $('#fNameErr'), fFirst = $('#fFirst'), fDepose = $('#fDepose'), fNote = $('#fNote');

  /* ------------------------------------------------------------ message / ICS */
  function buildMessage() {
    const svc = SERVICES.find(s => s.id === state.service);
    const name = fName.value.trim();
    const note = fNote.value.trim();
    const byDate = new Map();
    state.slots.forEach(s => { if (!byDate.has(s.date)) byDate.set(s.date, []); byDate.get(s.date).push(fmtTime(s.time)); });
    const slots = [...byDate].map(([d, times]) => `${fmtLong(fromIso(d))} à ${times.join(' ou ')}`);
    const lines = [`Bonjour Chloé, c'est ${name}.`];
    lines.push(state.service === 'conseil'
      ? 'Je souhaiterais prendre rendez-vous et j\u2019aimerais votre conseil sur la prestation.'
      : `Je souhaiterais prendre rendez-vous pour : ${svc.name}.`);
    lines.push(state.slots.length === 1 ? `Créneau souhaité : ${slots[0]}.` : `Créneaux possibles : ${slots.join(' ou ')}.`);
    if (fFirst.checked) lines.push('C\u2019est ma première fois chez vous.');
    if (fDepose.checked) lines.push('J\u2019aurais besoin d\u2019une dépose de ma pose actuelle.');
    if (note) lines.push(`Message : ${note}`);
    lines.push('Pouvez-vous me confirmer la disponibilité et le tarif ? Merci beaucoup !');
    return lines.join('\n');
  }

  function makeICS() {
    const s = state.slots[0];
    const [y, m, d] = s.date.split('-').map(Number), [hh, mm] = s.time.split(':').map(Number);
    const stamp = n => `${n.getFullYear()}${pad(n.getMonth() + 1)}${pad(n.getDate())}T${pad(n.getHours())}${pad(n.getMinutes())}00`;
    const start = new Date(y, m - 1, d, hh, mm), end = new Date(y, m - 1, d, hh + 2, mm);
    const esc = t => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const others = state.slots.slice(1).map(o => `${fmtLong(fromIso(o.date))} à ${fmtTime(o.time)}`);
    const desc = 'Demande de rendez-vous à confirmer par SMS auprès de Chloé : ' + PHONE_LABEL + (others.length ? '\nAutres créneaux proposés : ' + others.join(' ; ') : '');
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Chloe Nails Studio//Reservation//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', `UID:${Date.now()}@chloe-nails-studio`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
      `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
      `SUMMARY:${esc('Chloé Nails Studio — demande de RDV (à confirmer)')}`,
      `LOCATION:${esc('Bd Mireille, 13480 Cabriès')}`,
      `DESCRIPTION:${esc(desc)}`, 'STATUS:TENTATIVE',
      'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Rappel rendez-vous Chloé Nails Studio', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('is-on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('is-on'), 3200);
  }

  $('#btnCopy').addEventListener('click', async () => {
    const text = buildMessage();
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (_) { /* rien */ } ta.remove();
    }
    toast('Message copié. Collez-le dans un SMS au ' + PHONE_LABEL);
  });
  $('#btnIcs').addEventListener('click', () => {
    const blob = new Blob([makeICS()], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rdv-chloe-nails-studio.ics';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('Fichier agenda téléchargé (rendez-vous à confirmer)');
  });

  /* ------------------------------------------------------------ navigation entre étapes */
  const panels = $$('.wiz__panel', form), stepLis = $$('#wizSteps li'), bar = $('#wizBar');
  const back = $('#wizBack'), next = $('#wizNext'), sum = $('#wizSum');
  const nextLabel = () => $('.btn__in', next);

  function valid(step) {
    if (step === 1) return !!state.service;
    if (step === 2) return state.slots.length > 0;
    if (step === 3) return fName.value.trim().length >= 2;
    return true;
  }
  const hints = { 1: 'Choisissez une prestation pour continuer', 2: 'Choisissez au moins un créneau', 3: '', 4: '' };

  function sync() {
    const ok = valid(state.step);
    next.disabled = state.step < 3 && !ok;
    if (state.step === 1) sum.textContent = ok ? SERVICES.find(s => s.id === state.service).name : hints[1];
    else if (state.step === 2) sum.textContent = ok ? `${state.slots.length} créneau${state.slots.length > 1 ? 'x' : ''} choisi${state.slots.length > 1 ? 's' : ''}` : hints[2];
    else sum.textContent = '';
  }

  function go(n, dir = 1, silent = false) {
    const prev = $(`.wiz__panel[data-panel="${state.step}"]`, form);
    state.step = n;
    panels.forEach(p => { p.hidden = Number(p.dataset.panel) !== n; });
    stepLis.forEach((li, i) => { li.classList.toggle('is-active', i === n - 1); li.classList.toggle('is-done', i < n - 1); });
    bar.style.transform = `scaleX(${n / 4})`;
    back.hidden = n === 1;
    next.hidden = n === 4;
    nextLabel().firstChild.textContent = n === 3 ? 'Voir ma demande ' : 'Continuer ';
    const panel = $(`.wiz__panel[data-panel="${n}"]`, form);
    if (!silent && window.gsap && !reduce) gsap.fromTo(panel, { opacity: 0, x: 40 * dir }, { opacity: 1, x: 0, duration: 0.8, ease: 'expo.out', clearProps: 'transform' });
    const heading = $('legend, .wiz__q', panel);
    if (heading && !silent) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
    if (n === 2) { renderCal(); renderSlots(); renderPicked(); }
    if (n === 4) showRecap();
    sync();
    // garder le haut de l'assistant visible sur mobile
    const top = silent ? 0 : $('#wiz').getBoundingClientRect().top;
    if (top < 0 && window.__scrollTo) window.__scrollTo('#wiz', { offset: -96, duration: 1 });
    else if (top < 0) $('#wiz').scrollIntoView({ block: 'start' });
    return prev;
  }

  function showRecap() {
    const msg = buildMessage();
    $('#recap').textContent = msg;
    $('#btnSms').href = `sms:${PHONE}?&body=${encodeURIComponent(msg)}`;
  }

  next.addEventListener('click', () => {
    if (state.step === 3) {
      if (!valid(3)) {
        fNameErr.textContent = 'Indiquez votre prénom pour que Chloé sache à qui répondre.';
        fName.setAttribute('aria-invalid', 'true'); fName.focus();
        if (window.gsap && !reduce) gsap.fromTo(fName, { x: -8 }, { x: 0, duration: 0.6, ease: 'elastic.out(1,.3)' });
        return;
      }
      fNameErr.textContent = ''; fName.removeAttribute('aria-invalid');
    }
    if (valid(state.step) && state.step < 4) go(state.step + 1, 1);
  });
  back.addEventListener('click', () => { if (state.step > 1) go(state.step - 1, -1); });
  fName.addEventListener('input', () => { if (fName.value.trim().length >= 2) { fNameErr.textContent = ''; fName.removeAttribute('aria-invalid'); } });
  form.addEventListener('submit', e => e.preventDefault());
  form.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') { e.preventDefault(); if (!next.hidden && !next.disabled) next.click(); } });

  go(1, 1, true);
})();
