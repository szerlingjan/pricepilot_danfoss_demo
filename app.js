// Calculator UI. All pricing rules live in pricing.js; this file only reads the
// form, calls calculateQuote() and renders the result.
(function () {
  'use strict';

  const { DEFAULT_CONFIG: config, calculateQuote, formatPrice, findVideoType } = window.PricePilot;

  const $ = (selector) => document.querySelector(selector);

  const state = {
    types: new Set(),
    rhythm: config.defaultRhythm,
  };

  // Line icons for the video-type cards (static markup, drawn with currentColor).
  const ICONS = {
    street: '<rect x="9" y="2.5" width="6" height="11.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3.5M8.5 21h7"/>',
    owner: '<circle cx="12" cy="7.5" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
    product: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
    event: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    review: '<path d="m12 3.2 2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.4 2.8 1-6-4.3-4.2 6-.9z"/>',
    behind: '<path d="M3.5 9.5h17V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z"/><path d="m3.5 9.5 1.2-5h15.6l-1.1 5M9 4.5l-1.5 5M14.5 4.5 13 9.5"/>',
    tutorial: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="m10 9 5 3-5 3z"/>',
    other: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
  };

  /* ---------- small DOM helpers ---------- */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function reelsLabel(n) {
    return `${n} ${n === 1 ? 'reel' : 'reels'}`;
  }

  function surchargeLabel(rhythm) {
    const pct = Math.round((rhythm.multiplier - 1) * 100);
    return pct === 0 ? 'base price' : `+${pct}% per reel`;
  }

  /* ---------- theme toggle ---------- */

  function initTheme() {
    const button = $('#theme-toggle');
    const apply = (theme) => {
      document.documentElement.dataset.theme = theme;
      button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    };
    apply(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

    button.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      apply(next);
      try {
        localStorage.setItem('theme', next);
      } catch (e) {
        /* storage unavailable (private mode): theme just isn't remembered */
      }
    });
  }

  /* ---------- options (built from the price config) ---------- */

  function input(type, name, value, checked) {
    const node = el('input', 'option-input');
    node.type = type;
    node.name = name;
    node.value = value;
    node.checked = checked;
    return node;
  }

  function renderOptions() {
    const typeGrid = $('#type-options');
    config.videoTypes.forEach((t) => {
      const card = el('label', 'type-card');
      const icon = el('span', 'type-icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24">${ICONS[t.id] || ICONS.other}</svg>`;
      card.append(
        input('checkbox', 'type', t.id, false),
        icon,
        el('span', 'type-name', t.name),
        el('span', 'type-price', t.basePrice == null ? 'priced individually' : `from ${formatPrice(t.basePrice)} / reel`),
      );
      typeGrid.append(card);
    });

    // Delivery rhythm: radio buttons laid out as stops on a slider track.
    const stops = $('#rhythm-options');
    config.rhythms.forEach((r) => {
      const stop = el('label', 'stop');
      const dot = el('span', 'stop-dot');
      dot.setAttribute('aria-hidden', 'true');
      const extra = el('span', 'sr-only', `, ${reelsLabel(r.reelsPerMonth)} per month, ${surchargeLabel(r)}`);
      stop.append(input('radio', 'rhythm', r.id, r.id === state.rhythm), dot, el('span', 'stop-name', r.name), extra);
      stops.append(stop);
    });
  }

  /* ---------- live quote ---------- */

  function currentQuote() {
    return calculateQuote([...state.types], state.rhythm);
  }

  function totalLabel(rhythm) {
    return rhythm.reelsPerMonth === 1 ? 'in total' : 'per month';
  }

  function renderQuote() {
    const q = currentQuote();
    const amount = $('#quote-amount');
    const reel = $('#quote-reel');
    const note = $('#quote-note');
    const notes = [];

    $('#quote-label').textContent = totalLabel(q.rhythm);
    $('#quote-reel-row').hidden = q.status === 'consult';

    if (q.status === 'empty') {
      amount.textContent = '–';
      reel.textContent = '–';
      notes.push('Pick a video type to see your price.');
    } else if (q.status === 'consult') {
      amount.textContent = 'On request';
      $('#quote-label').textContent = 'priced individually';
      notes.push('"Other" is priced individually. Send a request and the studio will reply with a price.');
    } else {
      amount.textContent = formatPrice(q.monthly);
      reel.textContent = formatPrice(q.perReel);
      if (q.isRange) notes.push('Range: from your cheapest to your most expensive selected type.');
      if (q.includesCustom) notes.push('"Other" is not included and will be quoted separately.');
    }

    amount.classList.toggle('is-placeholder', q.status !== 'priced');
    amount.classList.toggle('is-range', q.status === 'priced' && q.isRange);
    note.textContent = notes.join(' ');
    note.hidden = notes.length === 0;

    $('#rhythm-summary').textContent =
      `${q.rhythm.name} · ${reelsLabel(q.rhythm.reelsPerMonth)} per month · ${surchargeLabel(q.rhythm)}`;
    $('#request-btn').disabled = q.status === 'empty';
    $('#custom-field').hidden = !state.types.has('other');
  }

  /* ---------- steps ---------- */

  function showStep(id) {
    document.querySelectorAll('.step').forEach((step) => {
      step.hidden = step.id !== id;
    });
    window.scrollTo(0, 0);
    document.querySelector(`#${id} h1`).focus();
  }

  function renderSummary() {
    const q = currentQuote();
    const list = $('#summary-list');
    list.replaceChildren();

    const add = (term, value, className) => {
      const row = el('div', `summary-row${className ? ` ${className}` : ''}`);
      row.append(el('dt', '', term), el('dd', '', value));
      list.append(row);
    };

    if (q.status === 'priced') {
      add(q.rhythm.reelsPerMonth === 1 ? 'Total' : 'Per month', formatPrice(q.monthly), 'summary-row--total');
      add('Per reel', formatPrice(q.perReel));
    } else {
      add('Price', 'On request', 'summary-row--total');
    }

    const typeNames = [...state.types].map((id) => findVideoType(id, config).name);
    add('Video types', typeNames.join(', '));

    const description = $('#custom-description').value.trim();
    if (state.types.has('other') && description) add('Your description', description);
    if (q.status === 'priced' && q.includesCustom) add('"Other"', 'Quoted separately by the studio');

    add('Delivery', `${q.rhythm.name} (${reelsLabel(q.rhythm.reelsPerMonth)} per month)`);
  }

  function reset() {
    state.types.clear();
    state.rhythm = config.defaultRhythm;
    $('#quote-form').reset();
    $('#order-form').reset();
    document.querySelectorAll('input[name="rhythm"]').forEach((radio) => {
      radio.checked = radio.value === state.rhythm;
    });
    renderQuote();
  }

  /* ---------- events ---------- */

  function bindEvents() {
    $('#quote-form').addEventListener('change', (event) => {
      const target = event.target;
      if (target.name === 'type') {
        if (target.checked) state.types.add(target.value);
        else state.types.delete(target.value);
      } else if (target.name === 'rhythm') {
        state.rhythm = target.value;
      }
      renderQuote();
    });

    // The quote form has no submit action; stop Enter in a field from reloading the page.
    $('#quote-form').addEventListener('submit', (event) => event.preventDefault());

    $('#request-btn').addEventListener('click', () => {
      renderSummary();
      showStep('step-order');
    });

    $('#back-btn').addEventListener('click', () => showStep('step-configure'));

    // No backend: the browser's built-in validation runs, then we only show a confirmation.
    $('#order-form').addEventListener('submit', (event) => {
      event.preventDefault();
      showStep('step-done');
    });

    $('#restart-btn').addEventListener('click', () => {
      reset();
      showStep('step-configure');
    });
  }

  initTheme();
  renderOptions();
  bindEvents();
  renderQuote();
})();
