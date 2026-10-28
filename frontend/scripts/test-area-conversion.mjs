import assert from 'node:assert/strict';

// Test areaConversion logic
const SQFT_PER_CENT = 435.6;

function sqftToCent(sqft) {
  if (isNaN(sqft) || !isFinite(sqft) || sqft < 0) return 0;
  return sqft / SQFT_PER_CENT;
}

function centToSqft(cent) {
  if (isNaN(cent) || !isFinite(cent) || cent < 0) return 0;
  return cent * SQFT_PER_CENT;
}

function formatCent(cent, maxDecimals = 4) {
  if (isNaN(cent) || !isFinite(cent) || cent < 0) return '';
  if (Math.abs(cent) < 1e-9) return '0';
  const factor = Math.pow(10, maxDecimals);
  const rounded = Math.round(cent * factor) / factor;
  return rounded.toString();
}

function formatSqft(sqft, maxDecimals = 2) {
  if (isNaN(sqft) || !isFinite(sqft) || sqft < 0) return '';
  if (Math.abs(sqft) < 1e-9) return '0';
  const factor = Math.pow(10, maxDecimals);
  const rounded = Math.round(sqft * factor) / factor;
  return rounded.toString();
}

console.log('Running area and cent conversion tests...');

// 1. Direct formula conversions
assert.equal(sqftToCent(435.6), 1, '435.6 sq ft should equal 1 cent');
assert.equal(formatCent(sqftToCent(435.6)), '1');

assert.equal(sqftToCent(2178), 5, '2,178 sq ft should equal 5 cents');
assert.equal(formatCent(sqftToCent(2178)), '5');

assert.equal(sqftToCent(4356), 10, '4,356 sq ft should equal 10 cents');
assert.equal(formatCent(sqftToCent(4356)), '10');

// 1000 sq ft -> approx 2.295 cents (2.2957 rounded to 4 decimals)
const centFor1000 = sqftToCent(1000);
assert.ok(Math.abs(centFor1000 - 2.29568) < 0.001, '1000 sq ft should be approximately 2.295 cents');
assert.equal(formatCent(centFor1000), '2.2957');

// Cent to Sqft
assert.equal(centToSqft(1), 435.6, '1 cent should equal 435.6 sq ft');
assert.equal(formatSqft(centToSqft(1)), '435.6');

assert.equal(centToSqft(5), 2178, '5 cents should equal 2178 sq ft');
assert.equal(formatSqft(centToSqft(5)), '2178');

assert.equal(centToSqft(10), 4356, '10 cents should equal 4356 sq ft');
assert.equal(formatSqft(centToSqft(10)), '4356');

// 2.295 cents to sqft
const sqftFor2_295 = centToSqft(2.295);
assert.equal(formatSqft(sqftFor2_295), '999.7');

// 2. Edge Cases: Empty, NaN, Infinity, negative values
assert.equal(formatCent(NaN), '');
assert.equal(formatCent(Infinity), '');
assert.equal(formatCent(-1), '');
assert.equal(formatCent(-0), '0');
assert.equal(formatCent(0), '0');

assert.equal(formatSqft(NaN), '');
assert.equal(formatSqft(Infinity), '');
assert.equal(formatSqft(-100), '');
assert.equal(formatSqft(0), '0');

// 3. Two-way precision without infinite rounding drift
const initialCent = 3.5;
const convertedSqft = centToSqft(initialCent);
const backToCent = sqftToCent(convertedSqft);
assert.equal(backToCent, initialCent, 'Round-trip conversion should preserve precision');

console.log('All area & cent conversion tests passed successfully!');
