// Run with: node pricing.test.js   (no test framework needed)
'use strict';

const assert = require('node:assert/strict');
const {
  DEFAULT_CONFIG,
  roundToNearest,
  calculateQuote,
  formatPrice,
} = require('./pricing.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  ✗ ${name}\n    ${err.message.split('\n').join('\n    ')}`);
  }
}

console.log('pricing.js');

test('nothing selected → empty quote', () => {
  assert.equal(calculateQuote([], 'weekly').status, 'empty');
});

test('single type: street interview, weekly → 290 PLN/reel, 1,160 PLN/month', () => {
  const q = calculateQuote(['street'], 'weekly'); // 240 × 1.2 = 288 → 290
  assert.equal(q.status, 'priced');
  assert.equal(q.isRange, false);
  assert.deepEqual(q.perReel, { min: 290, max: 290 });
  assert.deepEqual(q.monthly, { min: 1160, max: 1160 }); // 290 × 4 reels
});

test('several types → range from cheapest to most expensive type', () => {
  // street 240, owner 280, product 260 at weekly (× 1.2)
  const q = calculateQuote(['street', 'owner', 'product'], 'weekly');
  assert.equal(q.isRange, true);
  assert.deepEqual(q.perReel, { min: 290, max: 340 }); // 288 → 290, 336 → 340
  assert.deepEqual(q.monthly, { min: 1160, max: 1360 });
});

test('several types with the same price → single price, not a range', () => {
  const q = calculateQuote(['product', 'behind'], 'weekly'); // both 260
  assert.equal(q.isRange, false);
  assert.deepEqual(q.perReel, { min: 310, max: 310 });
});

test('"Other" only → consult us, no price', () => {
  const q = calculateQuote(['other'], 'weekly');
  assert.equal(q.status, 'consult');
  assert.equal(q.includesCustom, true);
  assert.equal(q.perReel, undefined);
});

test('"Other" mixed with standard types → priced on the standard types only', () => {
  const q = calculateQuote(['other', 'product'], 'weekly'); // 260 × 1.2 = 312 → 310
  assert.equal(q.status, 'priced');
  assert.equal(q.includesCustom, true);
  assert.equal(q.isRange, false);
  assert.deepEqual(q.perReel, { min: 310, max: 310 });
  assert.deepEqual(q.monthly, { min: 1240, max: 1240 });
});

// Street interview (base 240) at every delivery rhythm.
const rhythmCases = [
  ['3-per-week', 240, 12, 2880], // 240 × 1.0
  ['2-per-week', 260, 8, 2080], // 240 × 1.1 = 264 → 260
  ['weekly', 290, 4, 1160], // 240 × 1.2 = 288 → 290
  ['every-2-weeks', 310, 2, 620], // 240 × 1.3 = 312 → 310
  ['single', 360, 1, 360], // 240 × 1.5
];
for (const [rhythmId, perReel, reels, monthly] of rhythmCases) {
  test(`rhythm ${rhythmId}: ${perReel} PLN/reel × ${reels} reels = ${monthly} PLN/month`, () => {
    const q = calculateQuote(['street'], rhythmId);
    assert.equal(q.rhythm.reelsPerMonth, reels);
    assert.equal(q.perReel.min, perReel);
    assert.equal(q.monthly.min, monthly);
  });
}

test('rounding: to the nearest 10, halves round up, float noise ignored', () => {
  assert.equal(roundToNearest(244), 240);
  assert.equal(roundToNearest(245), 250);
  assert.equal(roundToNearest(336), 340);
  assert.equal(roundToNearest(250 * 1.1), 280); // 275.00000000000006 in floating point
  assert.equal(calculateQuote(['event'], 'single').perReel.min, 410); // 270 × 1.5 = 405 → 410
});

test('prices come from the config object passed in', () => {
  const config = {
    ...DEFAULT_CONFIG,
    videoTypes: [{ id: 'street', name: 'Street interview', basePrice: 1000 }],
    rhythms: [{ id: 'weekly', name: 'Weekly', reelsPerMonth: 4, multiplier: 1.25 }],
  };
  const q = calculateQuote(['street'], 'weekly', config);
  assert.deepEqual(q.perReel, { min: 1250, max: 1250 });
  assert.deepEqual(q.monthly, { min: 5000, max: 5000 });
});

test('unknown type or rhythm → throws', () => {
  assert.throws(() => calculateQuote(['street'], 'daily'), /Unknown delivery rhythm/);
  assert.throws(() => calculateQuote(['wedding'], 'weekly'), /Unknown video type/);
});

test('formatPrice: thousands separator, en dash for ranges, PLN', () => {
  assert.equal(formatPrice(3360), '3,360 PLN');
  assert.equal(formatPrice({ min: 290, max: 340 }), '290–340 PLN');
  assert.equal(formatPrice({ min: 310, max: 310 }), '310 PLN');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed > 0 ? 1 : 0;
