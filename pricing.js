/**
 * PricePilot pricing model: pure functions, no DOM access.
 *
 * Price per reel  = base price of the video type × delivery-rhythm multiplier,
 *                   rounded to the nearest 10 PLN.
 * Monthly price   = price per reel × reels delivered per month.
 *
 * Several video types selected → a range (cheapest type to most expensive type).
 * "Other" has no fixed price: on its own it means "consult us", and next to
 * standard types it is left out of the calculated price.
 *
 * Works in the browser (exposed as window.PricePilot) and in Node (module.exports).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.PricePilot = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function deepFreeze(obj) {
    Object.values(obj).forEach((value) => {
      if (value && typeof value === 'object') deepFreeze(value);
    });
    return Object.freeze(obj);
  }

  const DEFAULT_CONFIG = deepFreeze({
    currency: 'PLN',
    roundTo: 10,
    defaultRhythm: 'weekly',
    videoTypes: [
      { id: 'street', name: 'Street interview', basePrice: 240 },
      { id: 'owner', name: 'Interview with the owner', basePrice: 280 },
      { id: 'product', name: 'Product showcase', basePrice: 260 },
      { id: 'event', name: 'Event coverage', basePrice: 270 },
      { id: 'review', name: 'Service review', basePrice: 250 },
      { id: 'behind', name: 'Behind the scenes', basePrice: 260 },
      { id: 'tutorial', name: 'Tutorial / how-to', basePrice: 270 },
      // No fixed price: the studio quotes it individually.
      { id: 'other', name: 'Other', basePrice: null },
    ],
    rhythms: [
      { id: '3-per-week', name: '3× per week', reelsPerMonth: 12, multiplier: 1.0 },
      { id: '2-per-week', name: '2× per week', reelsPerMonth: 8, multiplier: 1.1 },
      { id: 'weekly', name: 'Weekly', reelsPerMonth: 4, multiplier: 1.2 },
      { id: 'every-2-weeks', name: 'Every 2 weeks', reelsPerMonth: 2, multiplier: 1.3 },
      { id: 'single', name: 'Single reel', reelsPerMonth: 1, multiplier: 1.5 },
    ],
  });

  /**
   * Round to the nearest `step`, halves rounding up.
   * The toFixed() step removes floating-point noise (250 × 1.1 = 275.00000000000006).
   */
  function roundToNearest(value, step = 10) {
    return Math.round(Number((value / step).toFixed(6))) * step;
  }

  function findVideoType(id, config = DEFAULT_CONFIG) {
    const type = config.videoTypes.find((t) => t.id === id);
    if (!type) throw new Error(`Unknown video type: ${id}`);
    return type;
  }

  function findRhythm(id, config = DEFAULT_CONFIG) {
    const rhythm = config.rhythms.find((r) => r.id === id);
    if (!rhythm) throw new Error(`Unknown delivery rhythm: ${id}`);
    return rhythm;
  }

  function isCustomType(type) {
    return type.basePrice === null || type.basePrice === undefined;
  }

  function pricePerReel(basePrice, multiplier, step = 10) {
    return roundToNearest(basePrice * multiplier, step);
  }

  /**
   * @param {string[]} typeIds   selected video type ids
   * @param {string}   rhythmId  selected delivery rhythm id
   * @param {object}   [config]  price configuration (defaults to DEFAULT_CONFIG)
   * @returns {object} one of:
   *   { status: 'empty' }                                   nothing selected
   *   { status: 'consult', rhythm, includesCustom: true }   only "Other"
   *   { status: 'priced', rhythm, perReel: {min, max}, monthly: {min, max},
   *     isRange, includesCustom }
   */
  function calculateQuote(typeIds, rhythmId, config = DEFAULT_CONFIG) {
    const rhythm = findRhythm(rhythmId, config);
    const types = [...new Set(typeIds)].map((id) => findVideoType(id, config));

    if (types.length === 0) return { status: 'empty', rhythm };

    const includesCustom = types.some(isCustomType);
    const basePrices = types.filter((t) => !isCustomType(t)).map((t) => t.basePrice);

    if (basePrices.length === 0) return { status: 'consult', rhythm, includesCustom };

    const step = config.roundTo;
    const min = pricePerReel(Math.min(...basePrices), rhythm.multiplier, step);
    const max = pricePerReel(Math.max(...basePrices), rhythm.multiplier, step);

    return {
      status: 'priced',
      rhythm,
      perReel: { min, max },
      monthly: { min: min * rhythm.reelsPerMonth, max: max * rhythm.reelsPerMonth },
      isRange: min !== max,
      includesCustom,
    };
  }

  const NBSP = ' ';

  /** 3360 → "3,360 PLN"; {min: 290, max: 340} → "290–340 PLN". */
  function formatPrice(amount, currency = DEFAULT_CONFIG.currency) {
    const fmt = (n) => n.toLocaleString('en-US');
    const range = typeof amount === 'number' ? { min: amount, max: amount } : amount;
    const text = range.min === range.max ? fmt(range.min) : `${fmt(range.min)}–${fmt(range.max)}`;
    return `${text}${NBSP}${currency}`;
  }

  return {
    DEFAULT_CONFIG,
    roundToNearest,
    pricePerReel,
    findVideoType,
    findRhythm,
    calculateQuote,
    formatPrice,
  };
});
