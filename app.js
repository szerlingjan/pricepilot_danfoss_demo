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

  function optionCard({ type, name, value, checked, title, meta }) {
    const label = el('label', 'option');
    const input = el('input', 'option-input');
    input.type = type;
    input.name = name;
    input.value = value;
    input.checked = checked;
    label.append(input, el('span', 'option-title', title));
    [].concat(meta).forEach((line) => label.append(el('span', 'option-meta', line)));
    const tick = el('span', 'option-tick');
    tick.setAttribute('aria-hidden', 'true');
    label.append(tick);
    return label;
  }

  function renderOptions() {
    const typeGrid = $('#type-options');
    config.videoTypes.forEach((t) => {
      typeGrid.append(optionCard({
        type: 'checkbox',
        name: 'type',
        value: t.id,
        checked: false,
        title: t.name,
        meta: t.basePrice == null ? 'Priced individually' : `from ${formatPrice(t.basePrice)} / reel`,
      }));
    });

    const rhythmGrid = $('#rhythm-options');
    config.rhythms.forEach((r) => {
      const surcharge = Math.round((r.multiplier - 1) * 100);
      rhythmGrid.append(optionCard({
        type: 'radio',
        name: 'rhythm',
        value: r.id,
        checked: r.id === state.rhythm,
        title: r.name,
        meta: [
          `${reelsLabel(r.reelsPerMonth)} / month`,
          surcharge === 0 ? 'Base price' : `+${surcharge}% per reel`,
        ],
      }));
    });
  }

  /* ---------- live quote ---------- */

  function currentQuote() {
    return calculateQuote([...state.types], state.rhythm);
  }

  function totalLabel(rhythm) {
    return rhythm.reelsPerMonth === 1 ? 'Estimated total' : 'Estimated monthly cost';
  }

  function renderQuote() {
    const q = currentQuote();
    const label = $('#quote-label');
    const amount = $('#quote-amount');
    const detail = $('#quote-detail');
    const note = $('#quote-note');
    const notes = [];

    label.textContent = totalLabel(q.rhythm);

    if (q.status === 'empty') {
      amount.textContent = '–';
      detail.textContent = 'Select a video type to see a price.';
    } else if (q.status === 'consult') {
      amount.textContent = 'Custom quote';
      detail.textContent = '"Other" is priced individually. Send a request and the studio will reply with a price.';
    } else {
      amount.textContent = formatPrice(q.monthly);
      detail.textContent = `${formatPrice(q.perReel)} per reel × ${reelsLabel(q.rhythm.reelsPerMonth)}`;
      if (q.isRange) notes.push('Range: from your cheapest to your most expensive selected type.');
      if (q.includesCustom) notes.push('"Other" is not included and will be quoted separately.');
    }

    amount.classList.toggle('is-placeholder', q.status !== 'priced');
    note.textContent = notes.join(' ');
    note.hidden = notes.length === 0;
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

    const typeNames = [...state.types].map((id) => findVideoType(id, config).name);
    add('Video types', typeNames.join(', '));

    const description = $('#custom-description').value.trim();
    if (state.types.has('other') && description) add('Your description', description);

    add('Delivery', `${q.rhythm.name} (${reelsLabel(q.rhythm.reelsPerMonth)} / month)`);

    if (q.status === 'priced') {
      add('Price per reel', formatPrice(q.perReel));
      if (q.includesCustom) add('"Other"', 'Quoted separately by the studio');
      add(totalLabel(q.rhythm), formatPrice(q.monthly), 'summary-row--total');
    } else {
      add('Price', 'Custom quote from the studio', 'summary-row--total');
    }
  }

  function reset() {
    state.types.clear();
    state.rhythm = config.defaultRhythm;
    $('#quote-form').reset();
    $('#order-form').reset();
    document.querySelectorAll('input[name="rhythm"]').forEach((input) => {
      input.checked = input.value === state.rhythm;
    });
    renderQuote();
  }

  /* ---------- events ---------- */

  function bindEvents() {
    $('#quote-form').addEventListener('change', (event) => {
      const input = event.target;
      if (input.name === 'type') {
        if (input.checked) state.types.add(input.value);
        else state.types.delete(input.value);
      } else if (input.name === 'rhythm') {
        state.rhythm = input.value;
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
