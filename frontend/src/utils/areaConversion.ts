/**
 * Conversion utility for land and property area measurements.
 * Conversion standard: 1 cent = 435.6 square feet.
 */

export const SQFT_PER_CENT = 435.6;

/**
 * Converts square feet to cent.
 * Formula: Cent = Area in sq ft / 435.6
 */
export function sqftToCent(sqft: number): number {
  if (isNaN(sqft) || !isFinite(sqft) || sqft < 0) return 0;
  return sqft / SQFT_PER_CENT;
}

/**
 * Converts cent to square feet.
 * Formula: Area in sq ft = Cent * 435.6
 */
export function centToSqft(cent: number): number {
  if (isNaN(cent) || !isFinite(cent) || cent < 0) return 0;
  return cent * SQFT_PER_CENT;
}

/**
 * Formats a cent numeric value for display in the form input.
 * Keeps up to maxDecimals decimal digits without trailing zeros.
 * Returns empty string for empty/invalid inputs.
 */
export function formatCent(cent: number, maxDecimals: number = 4): string {
  if (isNaN(cent) || !isFinite(cent) || cent < 0) return '';
  if (Math.abs(cent) < 1e-9) return '0';
  const factor = Math.pow(10, maxDecimals);
  const rounded = Math.round(cent * factor) / factor;
  return rounded.toString();
}

/**
 * Formats a square feet numeric value for display in the form input.
 * Keeps up to maxDecimals decimal digits without trailing zeros.
 * Returns empty string for empty/invalid inputs.
 */
export function formatSqft(sqft: number, maxDecimals: number = 2): string {
  if (isNaN(sqft) || !isFinite(sqft) || sqft < 0) return '';
  if (Math.abs(sqft) < 1e-9) return '0';
  const factor = Math.pow(10, maxDecimals);
  const rounded = Math.round(sqft * factor) / factor;
  return rounded.toString();
}
